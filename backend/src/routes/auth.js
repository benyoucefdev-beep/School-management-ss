const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Handles: admin/team login (users table) + student portal + teacher portal
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Username/Email and password are required' });

  const loginInput = email.toLowerCase().trim();

  try {
    // ── Step 1: Team members / admin (users table) ───────────────────────────
    const { rows: userRows } = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
      [loginInput]
    );

    if (userRows.length > 0) {
      const user  = userRows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );
      return res.json({
        token,
        user: {
          id:         user.id,
          name:       user.name,
          email:      user.email,
          role:       user.role,
          photo_url:  user.photo_url || null,
        },
      });
    }

    // ── Step 2: Student portal (portal_username) ─────────────────────────────
    const { rows: studentRows } = await pool.query(
      `SELECT id, full_name, portal_token, portal_username, portal_password_hash
       FROM students WHERE LOWER(portal_username) = $1`,
      [loginInput]
    );

    if (studentRows.length > 0) {
      const student = studentRows[0];
      let valid = false;
      if (student.portal_password_hash) {
        valid = await bcrypt.compare(password, student.portal_password_hash);
      }
      if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

      const token = jwt.sign(
        { id: student.id, role: 'student', name: student.full_name, portal_token: student.portal_token },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.json({
        token,
        user: { id: student.id, name: student.full_name, role: 'student', portal_token: student.portal_token },
      });
    }

    // ── Step 3: Teacher portal (portal_username) ─────────────────────────────
    const { rows: teacherRows } = await pool.query(
      `SELECT id, name, portal_token, portal_username, portal_password_hash
       FROM teachers WHERE LOWER(portal_username) = $1`,
      [loginInput]
    );

    if (teacherRows.length > 0) {
      const teacher = teacherRows[0];
      let valid = false;
      if (teacher.portal_password_hash) {
        valid = await bcrypt.compare(password, teacher.portal_password_hash);
      }
      if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

      const token = jwt.sign(
        { id: teacher.id, role: 'teacher', name: teacher.name, portal_token: teacher.portal_token },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.json({
        token,
        user: { id: teacher.id, name: teacher.name, role: 'teacher', portal_token: teacher.portal_token },
      });
    }

    // ── Step 4: Parent portal (email + password) ─────────────────────────────
    const { rows: parentRows } = await pool.query(
      `SELECT id, name, email, password_hash FROM parents WHERE LOWER(email) = $1`,
      [loginInput]
    );

    if (parentRows.length > 0) {
      const parent = parentRows[0];
      const valid  = parent.password_hash
        ? await bcrypt.compare(password, parent.password_hash)
        : false;
      if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

      const token = jwt.sign(
        { id: parent.id, role: 'parent', name: parent.name },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.json({
        token,
        user: { id: parent.id, name: parent.name, role: 'parent' },
      });
    }

    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Login error', detail: err.message });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    // Portal users (student/teacher/parent) are not in users table
    if (['student', 'teacher', 'parent'].includes(req.user.role)) {
      return res.json(req.user);
    }
    const { rows } = await pool.query(
      'SELECT id, name, email, role, photo_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/auth/me — update own profile ─────────────────────────────────────
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

// ── PUT /api/auth/me/password ─────────────────────────────────────────────────
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
