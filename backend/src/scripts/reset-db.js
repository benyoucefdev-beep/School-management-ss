require('dotenv').config();
const { Client } = require('pg');
const pool = require('../db');

async function resetDB() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database. Dropping schema...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;');
    console.log('✓ Database cleared.');

    console.log('Running migrations...');
    const migrate = require('../migrate');
    // migrate.js executes automatically when required if it is called directly.
    // However, since it is async, we can just spawn a child process or instruct the user.
  } catch (e) {
    console.error('Error clearing database:', e);
  } finally {
    await client.end();
  }
}

resetDB();
