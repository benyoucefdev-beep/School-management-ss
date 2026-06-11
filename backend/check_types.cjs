require('dotenv').config();
const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='suppliers' ORDER BY ordinal_position`);
  console.log('suppliers:', r.rows.map(x => x.column_name).join(', '));
  const r2 = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='clients' ORDER BY ordinal_position`);
  console.log('clients:', r2.rows.map(x => x.column_name).join(', '));
  const r3 = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tasks' ORDER BY ordinal_position`);
  console.log('tasks:', r3.rows.map(x => x.column_name).join(', '));
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
