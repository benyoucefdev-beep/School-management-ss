const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { computeUserTaskStatus } = require('../services/taskStatus');

// POST /api/auth/login — unified login for team members, clients, and suppliers
router.post('/login', async (req, res) => {
  const { email, password } = req.body; // email field handles username OR email
  if (!email || !password)
    return res.status(400).json({ error: 'Username/Email and password are required' });

  const loginInput = email.toLowerCase().trim();
  try {
    // ── Step 1: Check team members (users table) ──────────────────────
    const { rows: userRows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $1',
      [loginInput]
    );
    if (userRows.length > 0) {
      const user = userRows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      // Recompute task-based status on login so the returned data is accurate
      await computeUserTaskStatus(user.id);

      // Re-fetch user with updated task status
      const { rows: [freshUser] } = await pool.query(
        'SELECT id, name, email, role, photo_url, task_status, next_task_info, manual_available FROM users WHERE id = $1',
        [user.id]
      );

      const token = jwt.sign(
        { id: freshUser.id, email: freshUser.email, role: freshUser.role, name: freshUser.name },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );
      return res.json({
        token,
        user: { 
          id: freshUser.id, 
          name: freshUser.name, 
          email: freshUser.email, 
          role: freshUser.role, 
          photo_url: freshUser.photo_url,
          task_status: freshUser.task_status,
          next_task_info: freshUser.next_task_info,
          manual_available: freshUser.manual_available
        },
      });
    }

    // ── Step 2: Check clients (portal_username, case-insensitive) ──────────
    const { rows: clientRows } = await pool.query(
      `SELECT id, company_name, portal_token, portal_username, portal_password_hash, portal_plain_password
       FROM clients WHERE LOWER(portal_username) = LOWER($1)`,
      [loginInput]
    );
    if (clientRows.length > 0) {
      const client = clientRows[0];
      // Support both bcrypt hash (registered via portal) and plain password (set by admin)
      let valid = false;
      if (client.portal_password_hash) {
        valid = await bcrypt.compare(password, client.portal_password_hash);
      } else if (client.portal_plain_password) {
        valid = password === client.portal_plain_password;
      }
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { id: client.id, role: 'client', name: client.company_name, portal_token: client.portal_token },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.json({
        token,
        user: { id: client.id, name: client.company_name, role: 'client', portal_token: client.portal_token },
      });
    }

    // ── Step 3: Check suppliers (portal_username, case-insensitive) ──────────
    const { rows: supplierRows } = await pool.query(
      `SELECT id, name, portal_token, portal_username, portal_password_hash, portal_plain_password
       FROM suppliers WHERE LOWER(portal_username) = LOWER($1)`,
      [loginInput]
    );
    if (supplierRows.length > 0) {
      const supplier = supplierRows[0];
      // Support both bcrypt hash (registered via portal) and plain password (set by admin)
      let valid = false;
      if (supplier.portal_password_hash) {
        valid = await bcrypt.compare(password, supplier.portal_password_hash);
      } else if (supplier.portal_plain_password) {
        valid = password === supplier.portal_plain_password;
      }
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { id: supplier.id, role: 'supplier', name: supplier.name, portal_token: supplier.portal_token },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.json({
        token,
        user: { id: supplier.id, name: supplier.name, role: 'supplier', portal_token: supplier.portal_token },
      });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    // Client/supplier users are not in the users table — return JWT payload directly
    if (req.user.role === 'client' || req.user.role === 'supplier') {
      return res.json(req.user);
    }
    const { rows } = await pool.query(
      'SELECT id, name, email, role, photo_url, task_status, next_task_info, manual_available, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/me/status — team member signals they finished a task early
// Toggles manual_available. When true the admin sees "Available (finished early)".
// This is auto-reset when a new task is assigned to the user.
router.put('/me/status', authenticate, async (req, res) => {
  if (req.user.role === 'client' || req.user.role === 'supplier') {
    return res.status(403).json({ error: 'Not applicable' });
  }
  try {
    // Fetch current flag and flip it
    const { rows: [current] } = await pool.query(
      'SELECT manual_available FROM users WHERE id = $1',
      [req.user.id]
    );
    const newFlag = !current?.manual_available;

    await pool.query(
      'UPDATE users SET manual_available = $1 WHERE id = $2',
      [newFlag, req.user.id]
    );

    // Recompute task status immediately so the change is reflected
    const { computeUserTaskStatus } = require('../services/taskStatus');
    await computeUserTaskStatus(req.user.id);

    const { rows } = await pool.query(
      'SELECT id, name, email, role, photo_url, task_status, next_task_info, manual_available FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/me (update own profile — name, email, username, photo_url)
router.put('/me', authenticate, async (req, res) => {
  const { name, photo_url, email, username } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET name      = COALESCE($1, name),
           photo_url = COALESCE($2, photo_url),
           email     = COALESCE($3, email),
           username  = COALESCE($4, username)
       WHERE id = $5
       RETURNING id, name, username, email, role, photo_url`,
      [name || null, photo_url || null, email || null, username || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const field = err.detail?.includes('username') ? 'Username' : 'Email';
      return res.status(409).json({ error: `${field} already in use` });
    }
    res.status(500).json({ error: err.message });
  }
});


// PUT /api/auth/me/password
router.put('/me/password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Both current and new passwords are required' });

  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
