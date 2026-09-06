const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete } = require('../middleware/rbac');

router.use(authenticate);

// ── GET /api/subjects ────────────────────────────────────────────
router.get('/', canView('classes'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        COALESCE(
          json_agg(
            json_build_object('id', sup.id, 'name', sup.name)
          ) FILTER (WHERE sup.id IS NOT NULL),
          '[]'
        ) AS teachers
      FROM subjects s
      LEFT JOIN subject_teachers st ON st.subject_id = s.id
      LEFT JOIN teachers sup ON sup.id = st.teacher_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/subjects/:id ────────────────────────────────────────
router.get('/:id', canView('classes'), async (req, res) => {
  try {
    const { rows: [subject] } = await pool.query(
      'SELECT * FROM subjects WHERE id = $1', [req.params.id]
    );
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const { rows: teachers } = await pool.query(`
      SELECT sup.id, sup.name, sup.email AS contact_email, sup.phone AS contact_phone
      FROM teachers sup
      INNER JOIN subject_teachers st ON st.teacher_id = sup.id
      WHERE st.subject_id = $1
    `, [req.params.id]);

    const { rows: payments } = await pool.query(`
      SELECT sp.*, stu.full_name AS student_name
      FROM subject_payments sp
      LEFT JOIN students stu ON stu.id = sp.student_id
      WHERE sp.subject_id = $1
      ORDER BY sp.due_date DESC
      LIMIT 50
    `, [req.params.id]);

    res.json({ ...subject, teachers, payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/subjects ───────────────────────────────────────────
router.post('/', canCreate('classes'), async (req, res) => {
  const { name, name_ar, description, color_code, payment_due_day, monthly_fee, hours_per_week, sessions_per_week, session_minutes, late_grace_minutes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows: [s] } = await pool.query(`
      INSERT INTO subjects (name, name_ar, description, color_code, payment_due_day, monthly_fee, hours_per_week,
                            sessions_per_week, session_minutes, late_grace_minutes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [name, name_ar||null, description||null, color_code||'#00b4d8',
        payment_due_day||1, monthly_fee||0, hours_per_week||0,
        sessions_per_week||1, session_minutes||60, late_grace_minutes ?? 10]);
    res.status(201).json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/subjects/:id ────────────────────────────────────────
router.put('/:id', canEdit('classes'), async (req, res) => {
  const { name, name_ar, description, color_code, payment_due_day, monthly_fee, hours_per_week, is_active, sessions_per_week, session_minutes, late_grace_minutes } = req.body;
  try {
    const { rows: [s] } = await pool.query(`
      UPDATE subjects SET
        name             = COALESCE($1, name),
        name_ar          = COALESCE($2, name_ar),
        description      = COALESCE($3, description),
        color_code       = COALESCE($4, color_code),
        payment_due_day  = COALESCE($5, payment_due_day),
        monthly_fee      = COALESCE($6, monthly_fee),
        hours_per_week   = COALESCE($7, hours_per_week),
        is_active        = COALESCE($8, is_active),
        sessions_per_week  = COALESCE($9, sessions_per_week),
        session_minutes    = COALESCE($10, session_minutes),
        late_grace_minutes = COALESCE($11, late_grace_minutes)
      WHERE id = $12 RETURNING *
    `, [name, name_ar, description, color_code, payment_due_day, monthly_fee, hours_per_week, is_active,
        sessions_per_week ?? null, session_minutes ?? null, late_grace_minutes ?? null, req.params.id]);
    if (!s) return res.status(404).json({ error: 'Subject not found' });
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/subjects/:id ─────────────────────────────────────
router.delete('/:id', canDelete('classes'), async (req, res) => {
  try {
    await pool.query('DELETE FROM subjects WHERE id = $1', [req.params.id]);
    res.json({ message: 'Subject deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/subjects/:id/teachers — assign teacher ────────────
router.post('/:id/teachers', canEdit('teachers'), async (req, res) => {
  const { teacher_id } = req.body;
  if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });
  try {
    await pool.query(
      'INSERT INTO subject_teachers (subject_id, teacher_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, teacher_id]
    );
    res.status(201).json({ message: 'Teacher assigned to subject' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/subjects/:id/teachers/:teacherId ─────────────────
router.delete('/:id/teachers/:teacherId', canEdit('teachers'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM subject_teachers WHERE subject_id=$1 AND teacher_id=$2',
      [req.params.id, req.params.teacherId]
    );
    res.json({ message: 'Teacher removed from subject' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/subjects/:id/payments ───────────────────────────────
router.get('/:id/payments', canView('finance'), async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT sp.*, stu.full_name AS student_name
      FROM subject_payments sp
      LEFT JOIN students stu ON stu.id = sp.student_id
      WHERE sp.subject_id = $1
    `;
    const params = [req.params.id];
    if (status) { query += ` AND sp.status = $2`; params.push(status); }
    query += ' ORDER BY sp.due_date DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/subjects/:id/payments ──────────────────────────────
router.post('/:id/payments', canCreate('finance'), async (req, res) => {
  const { student_id, amount, due_date, notes } = req.body;
  if (!student_id || !due_date) return res.status(400).json({ error: 'student_id and due_date are required' });
  try {
    const { rows: [p] } = await pool.query(`
      INSERT INTO subject_payments (student_id, subject_id, amount, due_date, notes)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `, [student_id, req.params.id, amount||0, due_date, notes||null]);
    res.status(201).json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/subjects/payments/:paymentId — mark paid/overdue ────
router.put('/payments/:paymentId', canEdit('finance'), async (req, res) => {
  const { status, paid_date, notes } = req.body;
  try {
    const { rows: [p] } = await pool.query(`
      UPDATE subject_payments SET
        status    = COALESCE($1, status),
        paid_date = COALESCE($2, paid_date),
        notes     = COALESCE($3, notes)
      WHERE id = $4 RETURNING *
    `, [status, paid_date||null, notes, req.params.paymentId]);
    if (!p) return res.status(404).json({ error: 'Payment not found' });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
