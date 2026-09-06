const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete, isAdmin } = require('../middleware/rbac');
const bcrypt = require('bcryptjs');

router.use(authenticate);

// ── GET /api/teachers ─────────────────────────────────────────────────────────
router.get('/', canView('teachers'), async (req, res) => {
  try {
    const { search, simple } = req.query;
    if (simple === 'true') {
      const { rows } = await pool.query('SELECT id, name FROM teachers WHERE is_active = TRUE ORDER BY name ASC');
      return res.json({ data: rows });
    }

    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE (t.name ILIKE $1 OR t.email ILIKE $1 OR t.speciality ILIKE $1)`;
    }

    const { rows } = await pool.query(`
      SELECT t.*,
        COUNT(DISTINCT st.subject_id) AS subject_count,
        COALESCE(json_agg(
          DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'color_code', s.color_code)
        ) FILTER (WHERE s.id IS NOT NULL), '[]') AS subjects
      FROM teachers t
      LEFT JOIN subject_teachers st ON st.teacher_id = t.id
      LEFT JOIN subjects s ON s.id = st.subject_id
      ${where}
      GROUP BY t.id
      ORDER BY t.name ASC
    `, params);

    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/teachers/:id ─────────────────────────────────────────────────────
router.get('/:id', canView('teachers'), async (req, res) => {
  try {
    const [teacherRes, docsRes, paymentsRes] = await Promise.all([
      pool.query(`
        SELECT t.*,
          COALESCE(json_agg(
            DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'color_code', s.color_code)
          ) FILTER (WHERE s.id IS NOT NULL), '[]') AS subjects
        FROM teachers t
        LEFT JOIN subject_teachers st ON st.teacher_id = t.id
        LEFT JOIN subjects s ON s.id = st.subject_id
        WHERE t.id = $1 GROUP BY t.id
      `, [req.params.id]),
      pool.query(`SELECT d.*, u.name AS uploader_name FROM teacher_documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.teacher_id = $1 ORDER BY d.uploaded_at DESC`, [req.params.id]),
      pool.query('SELECT * FROM teacher_payments WHERE teacher_id = $1 ORDER BY payment_date DESC LIMIT 20', [req.params.id]),
    ]);

    if (!teacherRes.rows[0]) return res.status(404).json({ error: 'Teacher not found' });
    res.json({ ...teacherRes.rows[0], documents: docsRes.rows, payments: paymentsRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/teachers ────────────────────────────────────────────────────────
router.post('/', canCreate('teachers'), async (req, res) => {
  const { name, email, phone, speciality, address, notes, portal_username, portal_password, payment_percentage } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    let hash = null;
    if (portal_password) { hash = await bcrypt.hash(portal_password, 10); }

    const { rows: [t] } = await pool.query(`
      INSERT INTO teachers (name, email, phone, speciality, address, notes, portal_username, portal_password_hash, payment_percentage)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [name, email||null, phone||null, speciality||null, address||null, notes||null, portal_username||null, hash, payment_percentage ?? 70]);

    res.status(201).json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/teachers/:id ─────────────────────────────────────────────────────
router.put('/:id', canEdit('teachers'), async (req, res) => {
  const { name, email, phone, speciality, address, notes, is_active, portal_username, portal_password, payment_percentage } = req.body;
  try {
    let hash = null;
    if (portal_password) { hash = await bcrypt.hash(portal_password, 10); }

    const { rows: [t] } = await pool.query(`
      UPDATE teachers SET
        name          = COALESCE($1, name),
        email         = COALESCE($2, email),
        phone         = COALESCE($3, phone),
        speciality    = COALESCE($4, speciality),
        address       = COALESCE($5, address),
        notes         = COALESCE($6, notes),
        is_active     = COALESCE($7, is_active),
        portal_username = COALESCE($8, portal_username),
        portal_password_hash  = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE portal_password_hash END,
        payment_percentage    = COALESCE($10, payment_percentage),
        updated_at    = NOW()
      WHERE id = $11
      RETURNING *
    `, [name, email, phone, speciality, address, notes, is_active, portal_username, hash, payment_percentage ?? null, req.params.id]);

    if (!t) return res.status(404).json({ error: 'Teacher not found' });
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/teachers/:id ──────────────────────────────────────────────────
router.delete('/:id', canDelete('teachers'), async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const id = req.params.id;
    await db.query('DELETE FROM teacher_documents WHERE teacher_id = $1', [id]);
    await db.query('DELETE FROM teacher_payments WHERE teacher_id = $1', [id]);
    await db.query('DELETE FROM teacher_push_subscriptions WHERE teacher_id = $1', [id]);
    await db.query('DELETE FROM teacher_notifications WHERE teacher_id = $1', [id]);
    await db.query('DELETE FROM subject_teachers WHERE teacher_id = $1', [id]);
    await db.query('DELETE FROM teachers WHERE id = $1', [id]);
    await db.query('COMMIT');
    res.json({ message: 'Teacher deleted' });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

// ── SUBJECTS ASSIGNMENT ───────────────────────────────────────────────────────
router.put('/:id/subjects', isAdmin(), async (req, res) => {
  const { subject_ids } = req.body;
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids must be an array' });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM subject_teachers WHERE teacher_id = $1', [req.params.id]);
    for (const sid of subject_ids) {
      await db.query('INSERT INTO subject_teachers (subject_id, teacher_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [sid, req.params.id]);
    }
    await db.query('COMMIT');
    res.json({ message: 'Subjects updated' });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

// ── PAYMENTS ──────────────────────────────────────────────────────────────────
router.get('/:id/payments', canView('teachers'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM teacher_payments WHERE teacher_id = $1 ORDER BY payment_date DESC', [req.params.id]);
  res.json(rows);
});

router.post('/:id/payments', canCreate('finance'), async (req, res) => {
  const { amount, currency, payment_date, description, notes } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });
  const { rows: [p] } = await pool.query(`
    INSERT INTO teacher_payments (teacher_id, amount, currency, payment_date, description, notes)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [req.params.id, amount, currency||'DZD', payment_date||null, description||null, notes||null]);
  res.status(201).json(p);
});

router.delete('/:id/payments/:pid', canDelete('finance'), async (req, res) => {
  await pool.query('DELETE FROM teacher_payments WHERE id=$1 AND teacher_id=$2', [req.params.pid, req.params.id]);
  res.json({ message: 'Payment deleted' });
});

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────
router.get('/:id/documents', canView('teachers'), async (req, res) => {
  const { rows } = await pool.query(`SELECT d.*, u.name AS uploader_name FROM teacher_documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.teacher_id = $1 ORDER BY d.uploaded_at DESC`, [req.params.id]);
  res.json(rows);
});

router.post('/:id/documents', canCreate('teachers'), async (req, res) => {
  const { folder, file_name, file_url } = req.body;
  if (!file_name || !file_url) return res.status(400).json({ error: 'file_name and file_url are required' });
  const { rows: [d] } = await pool.query(`INSERT INTO teacher_documents (teacher_id, folder, file_name, file_url, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [req.params.id, folder||'General', file_name, file_url, req.user.id]);
  res.status(201).json(d);
});

router.delete('/:id/documents/:docId', canDelete('teachers'), async (req, res) => {
  await pool.query('DELETE FROM teacher_documents WHERE id=$1 AND teacher_id=$2', [req.params.docId, req.params.id]);
  res.json({ message: 'Document deleted' });
});

module.exports = router;
