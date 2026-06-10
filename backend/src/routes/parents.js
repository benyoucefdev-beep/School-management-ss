const router  = require('express').Router();
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const { authenticate } = require('../middleware/auth');

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
      : password === parent.password_hash; // plain fallback for dev
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
      SELECT c.id, c.company_name AS name, c.contact_email, c.student_phone,
             c.father_phone, c.date_of_birth, c.level,
             g.name AS group_name,
             (SELECT COUNT(*) FROM absences a WHERE a.student_id = c.id)::int AS absence_count,
             (SELECT COUNT(*) FROM subject_payments sp WHERE sp.student_id = c.id AND sp.status = 'pending')::int AS pending_payments
      FROM clients c
      INNER JOIN parent_students ps ON ps.student_id = c.id
      LEFT JOIN groups g ON g.id = c.group_id
      WHERE ps.parent_id = $1
      ORDER BY c.company_name ASC
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

// ════════════════════════════════════════════════════════════════
// ADMIN ROUTES (staff JWT required)
// ════════════════════════════════════════════════════════════════

// GET /api/parents — list all parents (admin)
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
        COALESCE(
          json_agg(json_build_object('id', c.id, 'name', c.company_name))
          FILTER (WHERE c.id IS NOT NULL), '[]'
        ) AS children
      FROM parents p
      LEFT JOIN parent_students ps ON ps.parent_id = p.id
      LEFT JOIN clients c ON c.id = ps.student_id
      GROUP BY p.id
      ORDER BY p.name ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/parents — create parent (admin)
router.post('/', authenticate, async (req, res) => {
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
router.put('/:id', authenticate, async (req, res) => {
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
router.post('/:id/children', authenticate, async (req, res) => {
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
router.delete('/:id/children/:studentId', authenticate, async (req, res) => {
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
router.get('/absences', authenticate, async (req, res) => {
  const { student_id, subject_id } = req.query;
  try {
    let q = `
      SELECT a.*, c.company_name AS student_name, s.name AS subject_name
      FROM absences a
      LEFT JOIN clients c ON c.id = a.student_id
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
router.post('/absences', authenticate, async (req, res) => {
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
router.put('/absences/:id', authenticate, async (req, res) => {
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
router.delete('/absences/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM absences WHERE id = $1', [req.params.id]);
    res.json({ message: 'Absence deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
