require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const hash = await bcrypt.hash('Test1234!', 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, username, password_hash, role)
     VALUES ('Test Admin', 'test@edumanage.app', 'testadmin', $1, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $1, username = 'testadmin', name = 'Test Admin'
     RETURNING id, name, email, username, role`,
    [hash]
  );
  console.log('Test user ready:', JSON.stringify(rows[0], null, 2));
  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
