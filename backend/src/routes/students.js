const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete } = require('../middleware/rbac');

router.use(authenticate);

// ── GET /api/students ─────────────────────────────────────────────────────────
router.get('/', canView('students'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, simple, group_id } = req.query;

    if (simple === 'true') {
      const { rows } = await pool.query('SELECT id, full_name FROM students ORDER BY full_name ASC');
      return res.json({ data: rows });
    }

    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.full_name ILIKE $${params.length} OR s.email ILIKE $${params.length} OR s.phone ILIKE $${params.length})`);
    }
    if (group_id) {
      params.push(group_id);
      conditions.push(`s.group_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT s.*,
        g.name AS group_name,
        u.name AS assigned_user_name,
        COUNT(*) OVER() AS total_count
      FROM students s
      LEFT JOIN groups g ON g.id = s.group_id
      LEFT JOIN users u ON u.id = s.assigned_user_id
      ${where}
      ORDER BY s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    const total = rows[0]?.total_count || 0;
    res.json({ data: rows, total: parseInt(total), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/students/:id ─────────────────────────────────────────────────────
router.get('/:id', canView('students'), async (req, res) => {
  try {
    const { rows: [student] } = await pool.query(`
      SELECT s.*, g.name AS group_name, u.name AS assigned_user_name
      FROM students s
      LEFT JOIN groups g ON g.id = s.group_id
      LEFT JOIN users u ON u.id = s.assigned_user_id
      WHERE s.id = $1
    `, [req.params.id]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [notes, files, uploads, absences, payments] = await Promise.all([
      pool.query(`SELECT n.*, u.name AS author_name FROM student_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.student_id = $1 ORDER BY n.created_at DESC`, [req.params.id]),
      pool.query(`SELECT d.*, u.name AS uploader_name FROM student_documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.student_id = $1 ORDER BY d.uploaded_at DESC`, [req.params.id]),
      pool.query(`SELECT su.*, json_agg(n ORDER BY n.created_at ASC) FILTER (WHERE n.id IS NOT NULL) AS notes FROM student_uploads su LEFT JOIN student_upload_notes n ON n.upload_id = su.id WHERE su.student_id = $1 GROUP BY su.id ORDER BY su.uploaded_at DESC`, [req.params.id]),
      pool.query(`SELECT a.*, s.name AS subject_name FROM absences a LEFT JOIN subjects s ON s.id = a.subject_id WHERE a.student_id = $1 ORDER BY a.absence_date DESC LIMIT 20`, [req.params.id]),
      pool.query(`SELECT sp.*, s.name AS subject_name FROM subject_payments sp LEFT JOIN subjects s ON s.id = sp.subject_id WHERE sp.student_id = $1 ORDER BY sp.due_date DESC LIMIT 20`, [req.params.id]),
    ]);

    res.json({ ...student, notes: notes.rows, files: files.rows, uploads: uploads.rows, absences: absences.rows, payments: payments.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/students ────────────────────────────────────────────────────────
router.post('/', canCreate('students'), async (req, res) => {
  const { full_name, email, phone, student_phone, father_phone, date_of_birth, level, group_id, enrollment_date, notes, is_adult } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required' });
  try {
    const { rows: [s] } = await pool.query(`
      INSERT INTO students (full_name, email, phone, student_phone, father_phone, date_of_birth, level, group_id, enrollment_date, notes, assigned_user_id, is_adult)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [full_name, email||null, phone||null, student_phone||null, father_phone||null, date_of_birth||null, level||null, group_id||null, enrollment_date||null, notes||null, req.user.id, is_adult === true]);

    // Auto-enroll in group
    if (group_id) {
      await pool.query('INSERT INTO student_groups (student_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [s.id, group_id]);
    }

    res.status(201).json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/students/:id ─────────────────────────────────────────────────────
router.put('/:id', canEdit('students'), async (req, res) => {
  const { full_name, email, phone, student_phone, father_phone, date_of_birth, level, group_id, enrollment_date, status, notes, assigned_user_id, is_adult } = req.body;
  try {
    const { rows: [existing] } = await pool.query('SELECT group_id FROM students WHERE id = $1', [req.params.id]);
    const { rows: [s] } = await pool.query(`
      UPDATE students SET
        full_name       = COALESCE($1,  full_name),
        email           = COALESCE($2,  email),
        phone           = COALESCE($3,  phone),
        student_phone   = COALESCE($4,  student_phone),
        father_phone    = COALESCE($5,  father_phone),
        date_of_birth   = COALESCE($6,  date_of_birth),
        level           = COALESCE($7,  level),
        group_id        = COALESCE($8,  group_id),
        enrollment_date = COALESCE($9,  enrollment_date),
        status          = COALESCE($10, status),
        notes           = COALESCE($11, notes),
        assigned_user_id = COALESCE($12, assigned_user_id),
        is_adult         = COALESCE($13, is_adult)
      WHERE id = $14
      RETURNING *
    `, [full_name, email, phone, student_phone, father_phone, date_of_birth, level, group_id, enrollment_date, status, notes, assigned_user_id, is_adult ?? null, req.params.id]);

    if (!s) return res.status(404).json({ error: 'Student not found' });

    // Sync student_groups if group changed
    if (group_id && group_id !== existing?.group_id) {
      await pool.query('INSERT INTO student_groups (student_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, group_id]);
    }

    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/students/:id ──────────────────────────────────────────────────
router.delete('/:id', canDelete('students'), async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const id = req.params.id;
    await db.query('DELETE FROM activity_log WHERE student_id = $1', [id]);
    await db.query('DELETE FROM student_notes WHERE student_id = $1', [id]);
    await db.query('DELETE FROM student_documents WHERE student_id = $1', [id]);
    await db.query('DELETE FROM student_notifications WHERE student_id = $1', [id]);
    await db.query('DELETE FROM student_push_subscriptions WHERE student_id = $1', [id]);
    await db.query('DELETE FROM student_upload_notes WHERE upload_id IN (SELECT id FROM student_uploads WHERE student_id = $1)', [id]);
    await db.query('DELETE FROM student_uploads WHERE student_id = $1', [id]);
    await db.query('DELETE FROM student_groups WHERE student_id = $1', [id]);
    await db.query('DELETE FROM parent_students WHERE student_id = $1', [id]);
    await db.query('DELETE FROM absences WHERE student_id = $1', [id]);
    await db.query('DELETE FROM subject_payments WHERE student_id = $1', [id]);
    await db.query('DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE student_id = $1)', [id]);
    await db.query('DELETE FROM invoices WHERE student_id = $1', [id]);
    await db.query('DELETE FROM payments WHERE student_id = $1', [id]);
    await db.query('DELETE FROM classes WHERE student_id = $1', [id]);
    await db.query('DELETE FROM students WHERE id = $1', [id]);
    await db.query('COMMIT');
    res.json({ message: 'Student deleted' });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

// ── NOTES ─────────────────────────────────────────────────────────────────────
router.get('/:id/notes', canView('students'), async (req, res) => {
  const { rows } = await pool.query(`SELECT n.*, u.name AS author_name FROM student_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.student_id = $1 ORDER BY n.created_at DESC`, [req.params.id]).catch(e => { throw e; });
  res.json(rows);
});

router.post('/:id/notes', canCreate('students'), async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  const { rows: [n] } = await pool.query(`INSERT INTO student_notes (student_id, author_id, content) VALUES ($1,$2,$3) RETURNING *`, [req.params.id, req.user.id, content]);
  res.status(201).json(n);
});

router.delete('/:id/notes/:noteId', canDelete('students'), async (req, res) => {
  await pool.query('DELETE FROM student_notes WHERE id=$1 AND student_id=$2', [req.params.noteId, req.params.id]);
  res.json({ message: 'Note deleted' });
});

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────
router.get('/:id/documents', canView('students'), async (req, res) => {
  const { folder } = req.query;
  let q = `SELECT d.*, u.name AS uploader_name FROM student_documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.student_id = $1`;
  const params = [req.params.id];
  if (folder) { params.push(folder); q += ` AND d.folder = $2`; }
  q += ' ORDER BY d.uploaded_at DESC';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

router.post('/:id/documents', canCreate('students'), async (req, res) => {
  const { folder, file_name, file_url } = req.body;
  if (!folder || !file_name || !file_url) return res.status(400).json({ error: 'folder, file_name, file_url are required' });
  const { rows: [d] } = await pool.query(`INSERT INTO student_documents (student_id, folder, file_name, file_url, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [req.params.id, folder, file_name, file_url, req.user.id]);
  res.status(201).json(d);
});

router.delete('/:id/documents/:docId', canDelete('students'), async (req, res) => {
  await pool.query('DELETE FROM student_documents WHERE id=$1 AND student_id=$2', [req.params.docId, req.params.id]);
  res.json({ message: 'Document deleted' });
});

// ── UPLOADS (portal) ──────────────────────────────────────────────────────────
router.get('/:id/uploads', canView('students'), async (req, res) => {
  const { rows } = await pool.query(`
    SELECT su.*, json_agg(n ORDER BY n.created_at ASC) FILTER (WHERE n.id IS NOT NULL) AS notes
    FROM student_uploads su
    LEFT JOIN student_upload_notes n ON n.upload_id = su.id
    WHERE su.student_id = $1
    GROUP BY su.id ORDER BY su.uploaded_at DESC
  `, [req.params.id]);
  res.json(rows);
});

router.post('/:id/uploads/:uploadId/notes', canCreate('students'), async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  const { rows: [n] } = await pool.query(`INSERT INTO student_upload_notes (upload_id, author_type, content) VALUES ($1,'admin',$2) RETURNING *`, [req.params.uploadId, content.trim()]);
  res.status(201).json(n);
});

// ── PHOTO ─────────────────────────────────────────────────────────────────────
// The client resizes to passport proportions and posts a data URI, so no
// multipart handling or object-storage configuration is needed. An external
// photo_url on the student row takes precedence when present.

// GET /api/students/:id/photo — serves the image bytes
router.get('/:id/photo', canView('students'), async (req, res) => {
  try {
    const { rows: [row] } = await pool.query(
      `SELECT p.data, p.mime_type, s.photo_url
         FROM students s
         LEFT JOIN student_photos p ON p.student_id = s.id
        WHERE s.id = $1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Student not found' });
    if (row.photo_url) return res.redirect(row.photo_url);
    if (!row.data) return res.status(404).json({ error: 'No photo on file' });

    res.setHeader('Content-Type', row.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(Buffer.from(row.data, 'base64'));
  } catch (err) {
    console.error('[students/photo:get]', err);
    res.status(500).json({ error: 'Could not load photo' });
  }
});

// POST /api/students/:id/photo — body: { data: "data:image/jpeg;base64,..." }
router.post('/:id/photo', canEdit('students'), async (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data (a data: URI) is required' });

  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(data));
  if (!m) return res.status(400).json({ error: 'Expected a base64 data URI for a JPEG, PNG or WebP image' });

  const [, mime, b64] = m;
  const bytes = Buffer.byteLength(b64, 'base64');
  // Generous for a resized passport photo, small enough to keep rows sane.
  if (bytes > 2 * 1024 * 1024) {
    return res.status(413).json({ error: 'Photo must be under 2 MB after resizing' });
  }

  try {
    const { rows: [student] } = await pool.query('SELECT id FROM students WHERE id = $1', [req.params.id]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    await pool.query(
      `INSERT INTO student_photos (student_id, data, mime_type, byte_size, uploaded_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (student_id) DO UPDATE
         SET data = EXCLUDED.data, mime_type = EXCLUDED.mime_type,
             byte_size = EXCLUDED.byte_size, uploaded_by = EXCLUDED.uploaded_by,
             updated_at = NOW()`,
      [req.params.id, b64, mime, bytes, req.user.id]
    );
    res.status(201).json({ message: 'Photo saved', byte_size: bytes, mime_type: mime });
  } catch (err) {
    console.error('[students/photo:post]', err);
    res.status(500).json({ error: 'Could not save photo' });
  }
});

// DELETE /api/students/:id/photo
router.delete('/:id/photo', canEdit('students'), async (req, res) => {
  try {
    await pool.query('DELETE FROM student_photos WHERE student_id = $1', [req.params.id]);
    await pool.query('UPDATE students SET photo_url = NULL WHERE id = $1', [req.params.id]);
    res.json({ message: 'Photo removed' });
  } catch (err) {
    console.error('[students/photo:delete]', err);
    res.status(500).json({ error: 'Could not remove photo' });
  }
});

// ── QR CODE ───────────────────────────────────────────────────────────────────
// Encodes the student's scan_code — the value the gate scanner reads to record
// attendance. Deliberately NOT the portal_token: reissuing a lost badge must not
// invalidate the student's portal login.
router.get('/:id/qr', canView('students'), async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const { rows: [s] } = await pool.query('SELECT scan_code FROM students WHERE id = $1', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Student not found' });
    if (!s.scan_code) return res.status(409).json({ error: 'Student has no scan code yet' });
    const png = await QRCode.toBuffer(s.scan_code, { width: 400, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(png);
  } catch (err) {
    console.error('[students/qr]', err);
    res.status(500).json({ error: 'Could not generate QR code' });
  }
});

// ── POST /:id/reissue-scan-code — invalidate a lost student card ─────────────
router.post('/:id/reissue-scan-code', canEdit('students'), async (req, res) => {
  try {
    const { rows: [s] } = await pool.query(
      `UPDATE students SET scan_code = encode(gen_random_bytes(12), 'hex'),
                           scan_code_issued_at = NOW()
        WHERE id = $1 RETURNING id, scan_code, scan_code_issued_at`,
      [req.params.id]
    );
    if (!s) return res.status(404).json({ error: 'Student not found' });
    res.json(s);
  } catch (err) {
    console.error('[students/reissue]', err);
    res.status(500).json({ error: 'Could not reissue scan code' });
  }
});

// ── SUBJECT ENROLMENT — who is expected at which course ─────────────────────
router.get('/:id/subjects', canView('students'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sub.*, ss.enrolled_at, ss.is_active
         FROM student_subjects ss
         JOIN subjects sub ON sub.id = ss.subject_id
        WHERE ss.student_id = $1
        ORDER BY sub.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[students/subjects]', err);
    res.status(500).json({ error: 'Could not load subjects' });
  }
});

router.post('/:id/subjects', canEdit('students'), async (req, res) => {
  const { subject_id } = req.body;
  if (!subject_id) return res.status(400).json({ error: 'subject_id is required' });
  try {
    await pool.query(
      `INSERT INTO student_subjects (student_id, subject_id) VALUES ($1,$2)
       ON CONFLICT (student_id, subject_id) DO UPDATE SET is_active = TRUE`,
      [req.params.id, subject_id]
    );
    res.status(201).json({ message: 'Student enrolled in subject' });
  } catch (err) {
    console.error('[students/enrol]', err);
    res.status(500).json({ error: 'Could not enrol student' });
  }
});

router.delete('/:id/subjects/:subjectId', canEdit('students'), async (req, res) => {
  try {
    await pool.query('DELETE FROM student_subjects WHERE student_id=$1 AND subject_id=$2',
      [req.params.id, req.params.subjectId]);
    res.json({ message: 'Student removed from subject' });
  } catch (err) {
    console.error('[students/unenrol]', err);
    res.status(500).json({ error: 'Could not remove student' });
  }
});

// ── ACTIVITY LOG ──────────────────────────────────────────────────────────────
router.get('/:id/activity', canView('students'), async (req, res) => {
  const { rows } = await pool.query(`SELECT al.*, u.name AS user_name FROM activity_log al LEFT JOIN users u ON u.id = al.user_id WHERE al.student_id = $1 ORDER BY al.created_at DESC LIMIT 50`, [req.params.id]);
  res.json(rows);
});

module.exports = router;
