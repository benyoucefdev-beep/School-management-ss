const router = require('express').Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/rbac');

const VALID_ROLES = ['admin', 'graphic_designer', 'software_developer', 'printer', 'ads_manager'];

router.use(authenticate, isAdmin());

const WORKLOAD_THRESHOLD = parseInt(process.env.WORKLOAD_THRESHOLD || '10', 10);

// GET /api/team — list all users with open task count
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, u.role, u.photo_url, u.created_at,
         u.plain_password,
         COUNT(t.id) FILTER (WHERE t.status NOT IN ('done', 'completed')) AS open_task_count
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/team/workload — per-member open task counts with overload flag
router.get('/workload', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.name,
         COUNT(t.id) FILTER (WHERE t.status NOT IN ('done')) AS open_task_count
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id
       GROUP BY u.id
       ORDER BY open_task_count DESC`
    );
    const result = rows.map(r => ({
      ...r,
      open_task_count: parseInt(r.open_task_count, 10),
      over_threshold: parseInt(r.open_task_count, 10) > WORKLOAD_THRESHOLD,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/team — create new user
router.post('/', async (req, res) => {
  const { name, username, email, password, role } = req.body;
  if (!name || !username || !email || !password || !role)
    return res.status(400).json({ error: 'name, username, email, password, role are required' });
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, username, email, password_hash, role, plain_password)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, username, email, role, photo_url, created_at`,
      [name, username.toLowerCase().trim(), email?.toLowerCase()?.trim(), hash, role, password]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const field = err.detail?.includes('username') ? 'Username' : 'Email';
      return res.status(409).json({ error: `${field} already exists` });
    }
    res.status(500).json({ error: err.message });
  }
});


// PUT /api/team/:id — update user
router.put('/:id', async (req, res) => {
  const { name, email, role, photo_url } = req.body;
  if (role && !VALID_ROLES.includes(role))
    return res.status(400).json({ error: `Invalid role: ${role}` });
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           photo_url = COALESCE($4, photo_url)
       WHERE id = $5
       RETURNING id, name, email, role, photo_url`,
      [name, email, role, photo_url, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/team/:id/reset-password — admin resets any member's password
router.post('/:id/reset-password', async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'new_password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, plain_password = $2 WHERE id = $3',
      [hash, new_password, req.params.id]
    );
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/team/:id — deactivate (hard delete for now)
router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Cannot remove your own account' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
