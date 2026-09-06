const router  = require('express').Router();
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete } = require('../middleware/rbac');

const PARENT_SECRET = process.env.PARENT_JWT_SECRET || process.env.JWT_SECRET;

// ── Helper: verify parent token ──────────────────────────────────
function parentAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.parent = jwt.verify(auth.slice(7), PARENT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// ════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth)
// ════════════════════════════════════════════════════════════════

// POST /api/parents/login — parent portal login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  try {
    const { rows: [parent] } = await pool.query(
      'SELECT * FROM parents WHERE email = $1 AND is_active = TRUE', [email.toLowerCase()]
    );
    if (!parent) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = parent.password_hash
      ? await bcrypt.compare(password, parent.password_hash)
      : false;
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: parent.id, name: parent.name, email: parent.email, role: 'parent' },
      PARENT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, parent: { id: parent.id, name: parent.name, email: parent.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════
// PARENT PORTAL ROUTES (parent token required)
// ════════════════════════════════════════════════════════════════

// GET /api/parents/me/children — list parent's children + summary
router.get('/me/children', parentAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT stu.id, stu.full_name AS name, stu.email AS contact_email, stu.student_phone,
             stu.father_phone, stu.date_of_birth, stu.level,
             g.name AS group_name,
             (SELECT COUNT(*) FROM absences a WHERE a.student_id = stu.id)::int AS absence_count,
             (SELECT COUNT(*) FROM subject_payments sp WHERE sp.student_id = stu.id AND sp.status = 'pending')::int AS pending_payments
      FROM students stu
      INNER JOIN parent_students ps ON ps.student_id = stu.id
      LEFT JOIN groups g ON g.id = stu.group_id
      WHERE ps.parent_id = $1
      ORDER BY stu.full_name ASC
    `, [req.parent.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/parents/me/children/:studentId/absences
router.get('/me/children/:studentId/absences', parentAuth, async (req, res) => {
  try {
    // Verify ownership
    const { rows: [link] } = await pool.query(
      'SELECT 1 FROM parent_students WHERE parent_id=$1 AND student_id=$2',
      [req.parent.id, req.params.studentId]
    );
    if (!link) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await pool.query(`
      SELECT a.*, s.name AS subject_name
      FROM absences a
      LEFT JOIN subjects s ON s.id = a.subject_id
      WHERE a.student_id = $1
      ORDER BY a.absence_date DESC
    `, [req.params.studentId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/parents/me/children/:studentId/payments
router.get('/me/children/:studentId/payments', parentAuth, async (req, res) => {
  try {
    const { rows: [link] } = await pool.query(
      'SELECT 1 FROM parent_students WHERE parent_id=$1 AND student_id=$2',
      [req.parent.id, req.params.studentId]
    );
    if (!link) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await pool.query(`
      SELECT sp.*, s.name AS subject_name, s.color_code
      FROM subject_payments sp
      LEFT JOIN subjects s ON s.id = sp.subject_id
      WHERE sp.student_id = $1
      ORDER BY sp.due_date DESC
    `, [req.params.studentId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── GET /api/parents/me/notifications — absence / lateness alerts ────────────
router.get('/me/notifications', parentAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT gn.*, s.full_name AS student_name
         FROM guardian_notifications gn
         LEFT JOIN students s ON s.id = gn.student_id
        WHERE gn.parent_id = $1
        ORDER BY gn.created_at DESC
        LIMIT 100`,
      [req.parent.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[parents/notifications]', err);
    res.status(500).json({ error: 'Could not load notifications' });
  }
});

// ── PUT /api/parents/me/notifications/:id/read ──────────────────────────────
router.put('/me/notifications/:id/read', parentAuth, async (req, res) => {
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE guardian_notifications SET is_read = TRUE
        WHERE id = $1 AND parent_id = $2 RETURNING id`,
      [req.params.id, req.parent.id]
    );
    if (!row) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('[parents/notifications/read]', err);
    res.status(500).json({ error: 'Could not update notification' });
  }
});

// ── GET /api/parents/me/children/:studentId/attendance ──────────────────────
router.get('/me/children/:studentId/attendance', parentAuth, async (req, res) => {
  try {
    const { rows: [link] } = await pool.query(
      'SELECT 1 FROM parent_students WHERE parent_id=$1 AND student_id=$2',
      [req.parent.id, req.params.studentId]
    );
    if (!link) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await pool.query(
      `SELECT a.*, sub.name AS subject_name
         FROM attendance a
         LEFT JOIN subjects sub ON sub.id = a.subject_id
        WHERE a.student_id = $1
        ORDER BY a.session_date DESC, a.session_start DESC
        LIMIT 100`,
      [req.params.studentId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[parents/child-attendance]', err);
    res.status(500).json({ error: 'Could not load attendance' });
  }
});

// ════════════════════════════════════════════════════════════════
// ADMIN ROUTES (staff JWT required)
// ════════════════════════════════════════════════════════════════

// GET /api/parents — list all parents (admin)
router.get('/', authenticate, canView('parents'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
        COALESCE(
          json_agg(json_build_object('id', stu.id, 'name', stu.full_name))
          FILTER (WHERE stu.id IS NOT NULL), '[]'
        ) AS children
      FROM parents p
      LEFT JOIN parent_students ps ON ps.parent_id = p.id
      LEFT JOIN students stu ON stu.id = ps.student_id
      GROUP BY p.id
      ORDER BY p.name ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/parents — create parent (admin)
router.post('/', authenticate, canCreate('parents'), async (req, res) => {
  const { name, email, phone, password, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const { rows: [p] } = await pool.query(`
      INSERT INTO parents (name, email, phone, password_hash, notes)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, name, email, phone, notes, is_active, created_at
    `, [name, email?.toLowerCase()||null, phone||null, hash, notes||null]);
    res.status(201).json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/parents/:id — update parent (admin)
router.put('/:id', authenticate, canEdit('parents'), async (req, res) => {
  const { name, email, phone, password, notes, is_active } = req.body;
  try {
    const hash = password ? await bcrypt.hash(password, 10) : undefined;
    const { rows: [p] } = await pool.query(`
      UPDATE parents SET
        name          = COALESCE($1, name),
        email         = COALESCE($2, email),
        phone         = COALESCE($3, phone),
        password_hash = COALESCE($4, password_hash),
        notes         = COALESCE($5, notes),
        is_active     = COALESCE($6, is_active)
      WHERE id = $7
      RETURNING id, name, email, phone, notes, is_active, created_at
    `, [name, email?.toLowerCase()||null, phone||null, hash||null, notes, is_active, req.params.id]);
    if (!p) return res.status(404).json({ error: 'Parent not found' });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/parents/:id/children — link child to parent (admin)
router.post('/:id/children', authenticate, canEdit('parents'), async (req, res) => {
  const { student_id, relation } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id is required' });
  try {
    await pool.query(
      'INSERT INTO parent_students (parent_id, student_id, relation) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [req.params.id, student_id, relation||'parent']
    );
    res.status(201).json({ message: 'Child linked to parent' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/parents/:id/children/:studentId
router.delete('/:id/children/:studentId', authenticate, canEdit('parents'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM parent_students WHERE parent_id=$1 AND student_id=$2',
      [req.params.id, req.params.studentId]
    );
    res.json({ message: 'Child unlinked from parent' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ABSENCES (admin CRUD) ────────────────────────────────────────

// GET /api/parents/absences?student_id=&subject_id=
router.get('/absences', authenticate, canView('students'), async (req, res) => {
  const { student_id, subject_id } = req.query;
  try {
    let q = `
      SELECT a.*, stu.full_name AS student_name, s.name AS subject_name
      FROM absences a
      LEFT JOIN students stu ON stu.id = a.student_id
      LEFT JOIN subjects s ON s.id = a.subject_id
      WHERE 1=1
    `;
    const params = [];
    if (student_id) { params.push(student_id); q += ` AND a.student_id = $${params.length}`; }
    if (subject_id) { params.push(subject_id); q += ` AND a.subject_id = $${params.length}`; }
    q += ' ORDER BY a.absence_date DESC LIMIT 100';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/parents/absences
router.post('/absences', authenticate, canEdit('students'), async (req, res) => {
  const { student_id, subject_id, absence_date, is_justified, justification } = req.body;
  if (!student_id || !absence_date) return res.status(400).json({ error: 'student_id and absence_date are required' });
  try {
    const { rows: [a] } = await pool.query(`
      INSERT INTO absences (student_id, subject_id, absence_date, is_justified, justification)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `, [student_id, subject_id||null, absence_date, is_justified||false, justification||null]);
    res.status(201).json(a);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/parents/absences/:id
router.put('/absences/:id', authenticate, canEdit('students'), async (req, res) => {
  const { is_justified, justification, notified_parent } = req.body;
  try {
    const { rows: [a] } = await pool.query(`
      UPDATE absences SET
        is_justified    = COALESCE($1, is_justified),
        justification   = COALESCE($2, justification),
        notified_parent = COALESCE($3, notified_parent)
      WHERE id = $4 RETURNING *
    `, [is_justified, justification, notified_parent, req.params.id]);
    if (!a) return res.status(404).json({ error: 'Absence not found' });
    res.json(a);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/parents/absences/:id
router.delete('/absences/:id', authenticate, canDelete('students'), async (req, res) => {
  try {
    await pool.query('DELETE FROM absences WHERE id = $1', [req.params.id]);
    res.json({ message: 'Absence deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
