require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const storedHash = '$2a$12$50R8CJlo3umn9cVKonaNlOnensNb4mYZjxbcUjL27lbnNYdVWaSJm';
  const password   = 'Test1234!';

  // Test if existing hash matches
  const matches = await bcrypt.compare(password, storedHash);
  console.log('Does stored hash match "Test1234!"?', matches);

  // Generate a fresh known-good hash and update the row by ID
  const freshHash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = '9df794d7-31de-4cba-836f-cd62453345ef' RETURNING id, name, email, username, role`,
    [freshHash]
  );
  console.log('Updated user:', rows[0]);

  // Verify the new hash works
  const verifyOk = await bcrypt.compare(password, freshHash);
  console.log('New hash verification:', verifyOk);

  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
