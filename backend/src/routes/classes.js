const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete, normalizeRole } = require('../middleware/rbac');

router.use(authenticate);

// ── GET /api/classes ──────────────────────────────────────────────────────────
router.get('/', canView('classes'), async (req, res) => {
  try {
    const { student_id, group_id, subject_id, status } = req.query;
    const params = [];
    const conditions = [];

    // Non-admins only see classes where they're a teacher
    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      conditions.push(`$${params.length} = ANY(c.teacher_ids)`);
    } else {
      if (student_id) { params.push(student_id); conditions.push(`c.student_id = $${params.length}`); }
      if (group_id)   { params.push(group_id);   conditions.push(`c.group_id = $${params.length}`); }
      if (subject_id) { params.push(subject_id); conditions.push(`c.subject_id = $${params.length}`); }
      if (status)     { params.push(status);     conditions.push(`c.status = $${params.length}`); }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT
        c.*,
        s.full_name  AS student_name,
        g.name       AS group_name,
        sub.name     AS subject_name,
        sub.color_code AS subject_color,
        COALESCE(json_agg(
          jsonb_build_object('id', t.id, 'name', t.name)
          ORDER BY t.name
        ) FILTER (WHERE t.id IS NOT NULL), '[]') AS teachers
      FROM classes c
      LEFT JOIN students s   ON s.id   = c.student_id
      LEFT JOIN groups g     ON g.id   = c.group_id
      LEFT JOIN subjects sub ON sub.id = c.subject_id
      LEFT JOIN teachers t   ON t.id = ANY(c.teacher_ids)
      ${where}
      GROUP BY c.id, s.full_name, g.name, sub.name, sub.color_code
      ORDER BY c.created_at DESC
    `, params);

    // No client caching: this list changes the moment a class is created, and a
    // cached empty response made new classes invisible until it expired.
    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/classes/:id ──────────────────────────────────────────────────────
router.get('/:id', canView('classes'), async (req, res) => {
  try {
    const [classRes, attachRes] = await Promise.all([
      pool.query(`
        SELECT c.*,
          s.full_name AS student_name, g.name AS group_name,
          sub.name AS subject_name, sub.color_code AS subject_color,
          COALESCE(json_agg(
            jsonb_build_object('id', t.id, 'name', t.name)
            ORDER BY t.name
          ) FILTER (WHERE t.id IS NOT NULL), '[]') AS teachers
        FROM classes c
        LEFT JOIN students s   ON s.id   = c.student_id
        LEFT JOIN groups g     ON g.id   = c.group_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        LEFT JOIN teachers t   ON t.id = ANY(c.teacher_ids)
        WHERE c.id = $1
        GROUP BY c.id, s.full_name, g.name, sub.name, sub.color_code
      `, [req.params.id]),
      pool.query('SELECT ca.*, u.name AS uploader_name FROM class_attachments ca LEFT JOIN users u ON u.id = ca.uploaded_by WHERE ca.class_id = $1 ORDER BY ca.uploaded_at DESC', [req.params.id]),
    ]);

    if (!classRes.rows[0]) return res.status(404).json({ error: 'Class not found' });
    res.json({ ...classRes.rows[0], attachments: attachRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/classes ─────────────────────────────────────────────────────────
// A class is identified by its subject and group, so no title is asked for.
// One is derived for display and for the reports that still read the column.
async function deriveTitle({ subject_id, group_id, room }) {
  const parts = [];
  if (subject_id) {
    const { rows: [s] } = await pool.query('SELECT name FROM subjects WHERE id = $1', [subject_id]);
    if (s) parts.push(s.name);
  }
  if (group_id) {
    const { rows: [g] } = await pool.query('SELECT name FROM groups WHERE id = $1', [group_id]);
    if (g) parts.push(g.name);
  }
  if (parts.length) return parts.join(' — ');
  return room ? `Class in ${room}` : 'Untitled class';
}

// Accepts teacher_ids (array) or teacher_id (single) — the form sends one teacher.
function normaliseTeacherIds(body) {
  if (Array.isArray(body.teacher_ids)) return body.teacher_ids.filter(Boolean);
  if (body.teacher_id) return [body.teacher_id];
  return [];
}

router.post('/', canCreate('classes'), async (req, res) => {
  const { title, description, subject_id, group_id, student_id, start_date, end_date, status, progress_pct, notes, room } = req.body;
  if (!subject_id && !group_id && !title) {
    return res.status(400).json({ error: 'Pick a subject or a group for this class' });
  }
  const parsedTeacherIds = normaliseTeacherIds(req.body);
  try {
    const finalTitle = title || await deriveTitle({ subject_id, group_id, room });
    const { rows: [c] } = await pool.query(`
      INSERT INTO classes (title, description, subject_id, group_id, student_id, teacher_ids, start_date, end_date, status, progress_pct, notes, room, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [finalTitle, description||null, subject_id||null, group_id||null, student_id||null, parsedTeacherIds, start_date||null, end_date||null, status||'not_started', progress_pct||0, notes||null, room||null, req.user.id]);

    res.status(201).json(c);
  } catch (err) {
    console.error('[classes/create]', err);
    res.status(500).json({ error: 'Could not create the class' });
  }
});

// ── PUT /api/classes/:id ──────────────────────────────────────────────────────
router.put('/:id', canEdit('classes'), async (req, res) => {
  try {
    const { rows: [existing] } = await pool.query('SELECT * FROM classes WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    // 'member' is the least-privileged staff role (the old specialist roles map
    // onto it): they may only edit classes they are assigned to.
    if (normalizeRole(req.user.role) === 'member' && !(existing.teacher_ids || []).includes(req.user.id)) {
      return res.status(403).json({ error: 'You can only edit classes assigned to you' });
    }

    const { title, description, subject_id, group_id, student_id, start_date, end_date, status, progress_pct, notes, room } = req.body;
    const ids = normaliseTeacherIds(req.body);
    const parsedTeacherIds = (Array.isArray(req.body.teacher_ids) || req.body.teacher_id) ? ids : undefined;

    const { rows: [c] } = await pool.query(`
      UPDATE classes SET
        title        = COALESCE($1,  title),
        description  = COALESCE($2,  description),
        subject_id   = COALESCE($3,  subject_id),
        group_id     = COALESCE($4,  group_id),
        student_id   = COALESCE($5,  student_id),
        teacher_ids  = COALESCE($6,  teacher_ids),
        start_date   = COALESCE($7,  start_date),
        end_date     = COALESCE($8,  end_date),
        status       = COALESCE($9,  status),
        progress_pct = COALESCE($10, progress_pct),
        notes        = COALESCE($11, notes),
        room         = COALESCE($12,  room),
        updated_at   = NOW()
      WHERE id = $13
      RETURNING *
    `, [title, description, subject_id, group_id, student_id, parsedTeacherIds, start_date, end_date, status, progress_pct, notes, room ?? null, req.params.id]);

    res.json(c);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/classes/:id ───────────────────────────────────────────────────
router.delete('/:id', canDelete('classes'), async (req, res) => {
  try {
    await pool.query('DELETE FROM class_attachments WHERE class_id = $1', [req.params.id]);
    await pool.query('DELETE FROM classes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Class deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ATTACHMENTS ───────────────────────────────────────────────────────────────
router.post('/:id/attachments', canView('classes'), async (req, res) => {
  const { file_url, file_name } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url is required' });
  const { rows: [a] } = await pool.query(`
    INSERT INTO class_attachments (class_id, file_url, file_name, uploaded_by)
    VALUES ($1,$2,$3,$4) RETURNING *
  `, [req.params.id, file_url, file_name||null, req.user.id]);
  res.status(201).json(a);
});

module.exports = router;
