const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { isStaff } = require('../middleware/rbac');
const { computeUsersTaskStatus } = require('../services/taskStatus');

// Authenticate all routes
router.use(authenticate);

// GET /api/users - task-based status for all team members (admin uses this to see who is free)
router.get('/', isStaff(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, photo_url, task_status, next_task_info, manual_available, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/refresh-task-status — admin triggers immediate task-status recompute for all members
router.post('/refresh-task-status', isStaff(), authorize('admin'), async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      `SELECT id FROM users WHERE role IN ('admin', 'manager', 'member')`
    );
    const userIds = users.map(u => u.id);
    if (userIds.length > 0) {
      await computeUsersTaskStatus(userIds);
    }
    res.json({ message: `Task status refreshed for ${userIds.length} team member(s).` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// All write operations are admin-only
router.use(authorize('admin'));

// POST /api/users
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password, role are required' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase().trim(), hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  const { name, email, role, photo_url } = req.body;
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

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
