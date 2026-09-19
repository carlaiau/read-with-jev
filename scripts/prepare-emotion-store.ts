// Creates the shared reader cache tables. Idempotent: safe to run before every deploy.
import {emotionStore,emotionStoreSchema,scoresTable,leasesTable,maxConcurrentModelCalls,leaseSeconds} from '../src/server/emotion-store';
import assert from 'node:assert/strict';
const sql=emotionStore();
assert(sql,'Set DATABASE_URL to a Neon connection string first');
for(const statement of emotionStoreSchema)await sql.query(statement);
const [{count}]=await sql.query(`SELECT count(*)::int AS count FROM ${scoresTable}`) as {count:number}[];
const [{active}]=await sql.query(`SELECT count(*)::int AS active FROM ${leasesTable} WHERE expires_at >= now()`) as {active:number}[];
console.log(JSON.stringify({tables:[scoresTable,leasesTable],cachedSentences:count,
 activeModelSlots:active,maxConcurrentModelCalls:maxConcurrentModelCalls(),leaseSeconds},null,2));
