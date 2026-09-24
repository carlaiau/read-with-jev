import {customTextSchema,customTextStore} from '../src/server/custom-text-store';
const sql=customTextStore();if(!sql)throw new Error('Set DATABASE_URL before preparing user-text storage.');
for(const statement of customTextSchema)await sql.query(statement);
console.log('Custom text and guest usage tables prepared.');
