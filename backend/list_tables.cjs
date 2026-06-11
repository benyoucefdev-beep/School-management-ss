require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
  .then(r => { r.rows.forEach(t => console.log(t.tablename)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
