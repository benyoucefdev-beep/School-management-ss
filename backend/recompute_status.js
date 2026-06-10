require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const { computeUsersTaskStatus } = require('./src/services/taskStatus');
  
  const { rows } = await pool.query("SELECT id, name FROM users WHERE role NOT IN ('client', 'supplier')");
  console.log('Recomputing for:', rows.map(r => r.name).join(', '));
  
  await computeUsersTaskStatus(rows.map(r => r.id));
  
  const { rows: updated } = await pool.query("SELECT name, task_status, next_task_info FROM users WHERE role NOT IN ('client', 'supplier')");
  console.log('\nResult:');
  updated.forEach(u => {
    const info = u.next_task_info ? ` | ${u.next_task_info}` : '';
    console.log(`  ${u.name}: ${u.task_status}${info}`);
  });
  
  await pool.end();
}

run().catch(e => { console.error('Error:', e.message); pool.end(); });
