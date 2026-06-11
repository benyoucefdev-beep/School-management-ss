require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  // Clear all old migration records, insert only the new canonical one as "already run"
  await pool.query('DELETE FROM _migrations');
  await pool.query(
    "INSERT INTO _migrations (filename) VALUES ('001_school_schema.sql')"
  );
  const { rows } = await pool.query('SELECT * FROM _migrations ORDER BY id');
  console.log('_migrations table now contains:');
  rows.forEach(r => console.log(' -', r.filename, '(run_at:', r.run_at, ')'));
  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
