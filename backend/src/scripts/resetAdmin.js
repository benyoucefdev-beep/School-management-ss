// backend/scripts/resetAdmin.js
// Run: node backend/src/scripts/resetAdmin.js
// Resets admin@axialogy.com password to: Axialogy2024!

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const pool   = require('../db');

async function resetAdmin() {
  const password = 'Axialogy2024!';
  const hash = await bcrypt.hash(password, 10);

  // Fix role constraint first
  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await pool.query(`
    ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin','graphic_designer','software_developer','printer','ads_manager'))
  `);

  // Map old roles
  await pool.query(`UPDATE users SET role='admin' WHERE role='owner'`);
  await pool.query(`UPDATE users SET role='ads_manager' WHERE role='manager'`);
  await pool.query(`UPDATE users SET role='graphic_designer' WHERE role='member'`);

  // Upsert admin user
  const { rows } = await pool.query(`
    INSERT INTO users (name, email, username, password_hash, role)
    VALUES ('Admin', 'admin@axialogy.com', 'admin', $1, 'admin')
    ON CONFLICT (email) DO UPDATE
      SET password_hash = $1, role = 'admin', username = 'admin'
    RETURNING id, email, role
  `, [hash]);

  console.log('✅ Admin reset:');
  console.table(rows);
  console.log('   Email:    admin@axialogy.com');
  console.log('   Password: Axialogy2024!');
  await pool.end();
}

resetAdmin().catch(e => { console.error(e); process.exit(1); });
