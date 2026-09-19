import {neon} from '@neondatabase/serverless';
import {randomUUID} from 'node:crypto';
import {validEmotionScores,type EmotionScores} from '../lib/reading-emotions';

/**
 * Shared read-through cache for reader sentence scores. Rows are model predictions, never gold:
 * they carry the request digest, edition fingerprint and model so a prompt or edition change
 * misses instead of silently serving a stale answer. Research runs keep their own cache and run
 * artifacts and must not read from here.
 */
export const scoresTable='reader_emotion_scores',leasesTable='reader_model_leases';
export const emotionStoreSchema=[
 `CREATE TABLE IF NOT EXISTS ${scoresTable} (
   cache_key text PRIMARY KEY,
   layer text NOT NULL,
   sentence_id text NOT NULL,
   source_key text NOT NULL,
   model text NOT NULL,
   scores jsonb NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now())`,
 `CREATE INDEX IF NOT EXISTS ${scoresTable}_source_key_idx ON ${scoresTable} (source_key)`,
 `CREATE TABLE IF NOT EXISTS ${leasesTable} (
   id text PRIMARY KEY,
   acquired_at timestamptz NOT NULL DEFAULT now(),
   expires_at timestamptz NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS ${leasesTable}_expires_at_idx ON ${leasesTable} (expires_at)`,
];

export type StoreClient=ReturnType<typeof neon>;
let client:StoreClient|null|undefined;
/** Absent DATABASE_URL means local development: the on-disk cache is the only cache. */
export function emotionStore():StoreClient|null{
 if(client===undefined)client=process.env.DATABASE_URL?neon(process.env.DATABASE_URL):null;
 return client;
}
export const emotionStoreEnabled=()=>!!emotionStore();

/** A ceiling across every instance, unlike readingRequestConcurrency which is per process. */
export function maxConcurrentModelCalls(raw=process.env.JEV_MAX_CONCURRENT_CALLS):number{
 const value=Number(raw);
 return Number.isInteger(value)&&value>0?value:12;
}
/** Comfortably longer than the route's own 90s ceiling, so a crashed instance self-heals. */
export const leaseSeconds=120;

export type StoredRow={cacheKey:string;layer:string;sentenceId:string;sourceKey:string;model:string;scores:EmotionScores};

/** A read failure is a miss, never an error: an unreachable cache must not break reading. */
export async function storedScores(cacheKey:string,sql=emotionStore()):Promise<EmotionScores|undefined>{
 if(!sql)return undefined;
 let rows;
 try{rows=await sql`SELECT scores FROM reader_emotion_scores WHERE cache_key=${cacheKey}`;}
 catch(error){console.warn('Shared emotion cache read failed; treating as a miss.',error);return undefined;}
 const scores=(rows as {scores?:unknown}[])[0]?.scores;
 // A row from an older prompt, or an edited one, must not become a silent answer.
 return validEmotionScores(scores)?scores:undefined;
}

export async function storeScores(row:StoredRow,sql=emotionStore()):Promise<boolean>{
 if(!sql)return false;
 try{
  await sql`INSERT INTO reader_emotion_scores (cache_key,layer,sentence_id,source_key,model,scores)
   VALUES (${row.cacheKey},${row.layer},${row.sentenceId},${row.sourceKey},${row.model},${JSON.stringify(row.scores)}::jsonb)
   ON CONFLICT (cache_key) DO NOTHING`;
  return true;
 }catch(error){console.warn('Shared emotion cache write failed; the score is still served.',error);return false;}
}

/**
 * A soft global semaphore over model calls. Leases expire, so an instance that dies mid-call
 * frees its slot without cleanup. The count is taken from the statement's snapshot and therefore
 * excludes this row, so a simultaneous burst can briefly overshoot the ceiling; it converges as
 * soon as the losers release. Exactness would need a serialisable transaction and is not worth
 * a round trip here, because the point is to avoid hammering the provider, not to ration.
 *
 * Returns the lease when admitted, 'busy' when at capacity, and undefined when there is no store
 * to ask, in which case the caller falls back to its per-process limit.
 */
export async function acquireModelSlot(sql=emotionStore(),limit=maxConcurrentModelCalls()):Promise<string|'busy'|undefined>{
 if(!sql)return undefined;
 const id=randomUUID();
 let rows;
 try{
  rows=await sql`
   WITH expired AS (DELETE FROM reader_model_leases WHERE expires_at < now()),
        inserted AS (INSERT INTO reader_model_leases (id,expires_at)
                     VALUES (${id},now()+make_interval(secs=>${leaseSeconds})) RETURNING id)
   SELECT inserted.id, (SELECT count(*)::int FROM reader_model_leases WHERE expires_at >= now()) AS active
   FROM inserted` as {id:string;active:number}[];
 }catch(error){
  // Fail open: an unreachable store drops us back to the per-process ceiling rather than
  // stopping analysis. There is no spend argument for failing closed here.
  console.warn('Model slot lease failed; falling back to the per-process limit.',error);
  return undefined;
 }
 if(Number(rows[0].active)<limit)return id;
 await releaseModelSlot(id,sql);
 return 'busy';
}

export async function releaseModelSlot(id:string,sql=emotionStore()):Promise<void>{
 if(!sql)return;
 try{await sql`DELETE FROM reader_model_leases WHERE id=${id}`;}
 catch(error){console.warn('Model slot release failed; the lease will expire.',error);}
}
