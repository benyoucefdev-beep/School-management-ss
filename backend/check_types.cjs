require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name IN ('suppliers','clients','tasks','users')
    AND column_name = 'id'
    ORDER BY table_name
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
