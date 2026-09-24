import {randomUUID} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {customTextLimit,guestCallLimit,type CustomTextDocument,type CustomTextSummary} from '../lib/custom-text';
import {validEmotionScores,type EmotionScores} from '../lib/reading-emotions';

export const customTextSchema=[
 `CREATE TABLE IF NOT EXISTS user_texts (id uuid PRIMARY KEY, owner_id text NOT NULL, title text NOT NULL, body text NOT NULL, revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
 `CREATE INDEX IF NOT EXISTS user_texts_owner_updated_idx ON user_texts (owner_id,updated_at DESC)`,
 `CREATE TABLE IF NOT EXISTS custom_text_scores (scope text NOT NULL, document_id uuid REFERENCES user_texts(id) ON DELETE CASCADE, request_key text NOT NULL, scores jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (scope,request_key))`,
 `CREATE TABLE IF NOT EXISTS guest_jev_usage (guest_id uuid PRIMARY KEY, used integer NOT NULL DEFAULT 0 CHECK (used >= 0))`,
];

type Sql=ReturnType<typeof neon>;
let client:Sql|null|undefined;
export function customTextStore():Sql|null{
 if(client===undefined)client=process.env.DATABASE_URL?neon(process.env.DATABASE_URL):null;
 return client;
}
export class CustomTextStoreError extends Error{}
function requireStore():Sql{
 const sql=customTextStore();if(!sql)throw new CustomTextStoreError('Saved texts and guest analysis need a configured database.');return sql;
}
type Row={id:string;title:string;body:string;revision:number;created_at:string|Date;updated_at:string|Date};
const iso=(value:string|Date)=>new Date(value).toISOString();
function document(row:Row):CustomTextDocument{return {id:row.id,title:row.title,body:row.body,revision:row.revision,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)};}
function summary(row:Row):CustomTextSummary{const {body:_,...item}=document(row);return item;}
export function validCustomText(title:unknown,body:unknown):title is string{
 return typeof title==='string'&&title.trim().length>0&&title.length<=120&&typeof body==='string'&&body.length<=customTextLimit;
}
export async function listCustomTexts(ownerId:string,sql=requireStore()):Promise<CustomTextSummary[]>{
 const rows=await sql`SELECT id,title,body,revision,created_at,updated_at FROM user_texts WHERE owner_id=${ownerId} ORDER BY updated_at DESC` as Row[];
 return rows.map(summary);
}
export async function getCustomText(ownerId:string,id:string,sql=requireStore()):Promise<CustomTextDocument|null>{
 const rows=await sql`SELECT id,title,body,revision,created_at,updated_at FROM user_texts WHERE id=${id} AND owner_id=${ownerId}` as Row[];
 return rows[0]?document(rows[0]):null;
}
export async function createCustomText(ownerId:string,title:string,body:string):Promise<CustomTextDocument>{
 const sql=requireStore(),id=randomUUID();
 const rows=await sql`INSERT INTO user_texts (id,owner_id,title,body) VALUES (${id},${ownerId},${title.trim()},${body}) RETURNING id,title,body,revision,created_at,updated_at` as Row[];
 return document(rows[0]);
}
export async function updateCustomText(ownerId:string,id:string,revision:number,title:string,body:string,sql=requireStore()):Promise<CustomTextDocument|null>{
 const rows=await sql`UPDATE user_texts SET title=${title.trim()},body=${body},revision=revision+1,updated_at=now() WHERE id=${id} AND owner_id=${ownerId} AND revision=${revision} RETURNING id,title,body,revision,created_at,updated_at` as Row[];
 return rows[0]?document(rows[0]):null;
}
export async function deleteCustomText(ownerId:string,id:string,sql=requireStore()):Promise<boolean>{
 const rows=await sql`DELETE FROM user_texts WHERE id=${id} AND owner_id=${ownerId} RETURNING id` as {id:string}[];
 return rows.length>0;
}
export async function storedCustomScore(scope:string,key:string):Promise<EmotionScores|undefined>{
 const sql=requireStore();const rows=await sql`SELECT scores FROM custom_text_scores WHERE scope=${scope} AND request_key=${key}` as {scores:unknown}[];
 return validEmotionScores(rows[0]?.scores)?rows[0].scores:undefined;
}
export async function storeCustomScore(scope:string,key:string,scores:EmotionScores):Promise<void>{
 const sql=requireStore(),documentId=scope.startsWith('text:')?scope.slice(5):null;
 await sql`INSERT INTO custom_text_scores (scope,document_id,request_key,scores) VALUES (${scope},${documentId},${key},${JSON.stringify(scores)}::jsonb) ON CONFLICT (scope,request_key) DO NOTHING`;
}
/** Admission is atomic across serverless instances. A cache hit never calls this. */
export async function reserveGuestCall(guestId:string,sql=requireStore()):Promise<number|null>{
 const rows=await sql`INSERT INTO guest_jev_usage (guest_id,used) VALUES (${guestId},1) ON CONFLICT (guest_id) DO UPDATE SET used=guest_jev_usage.used+1 WHERE guest_jev_usage.used<${guestCallLimit} RETURNING used` as {used:number}[];
 return rows[0]?.used??null;
}
