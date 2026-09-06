const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete } = require('../middleware/rbac');

router.use(authenticate);

// ── GET /api/groups ──────────────────────────────────────────────
router.get('/', canView('classes'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.*,
        COUNT(DISTINCT sg.student_id)::int AS student_count
      FROM groups g
      LEFT JOIN student_groups sg ON sg.group_id = g.id
      GROUP BY g.id
      ORDER BY g.academic_year DESC, g.name ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/groups/:id ──────────────────────────────────────────
router.get('/:id', canView('classes'), async (req, res) => {
  try {
    const { rows: [group] } = await pool.query(
      'SELECT * FROM groups WHERE id = $1', [req.params.id]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Students in this group
    const { rows: students } = await pool.query(`
      SELECT s.id, s.full_name AS name, s.email AS contact_email, s.phone AS contact_phone,
             s.student_phone, s.father_phone, s.level
      FROM students s
      INNER JOIN student_groups sg ON sg.student_id = s.id
      WHERE sg.group_id = $1
      ORDER BY s.full_name ASC
    `, [req.params.id]);

    res.json({ ...group, students });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/groups ─────────────────────────────────────────────
router.post('/', canCreate('classes'), async (req, res) => {
  const { name, level, academic_year, max_students, room, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows: [g] } = await pool.query(`
      INSERT INTO groups (name, level, academic_year, max_students, room, notes)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [name, level||null, academic_year||'2025-2026', max_students||30, room||null, notes||null]);
    res.status(201).json(g);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/groups/:id ──────────────────────────────────────────
router.put('/:id', canEdit('classes'), async (req, res) => {
  const { name, level, academic_year, max_students, room, notes, is_active } = req.body;
  try {
    const { rows: [g] } = await pool.query(`
      UPDATE groups SET
        name          = COALESCE($1, name),
        level         = COALESCE($2, level),
        academic_year = COALESCE($3, academic_year),
        max_students  = COALESCE($4, max_students),
        room          = COALESCE($5, room),
        notes         = COALESCE($6, notes),
        is_active     = COALESCE($7, is_active)
      WHERE id = $8 RETURNING *
    `, [name, level, academic_year, max_students, room, notes, is_active, req.params.id]);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    res.json(g);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/groups/:id ───────────────────────────────────────
router.delete('/:id', canDelete('classes'), async (req, res) => {
  try {
    await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
    res.json({ message: 'Group deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/groups/:id/students — enroll student in group ──────
router.post('/:id/students', canEdit('students'), async (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id is required' });
  try {
    await pool.query(
      'INSERT INTO student_groups (group_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, student_id]
    );
    // Keep students.group_id in step with the join table
    await pool.query('UPDATE students SET group_id = $1 WHERE id = $2', [req.params.id, student_id]);
    res.status(201).json({ message: 'Student enrolled in group' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/groups/:id/students/:studentId ───────────────────
router.delete('/:id/students/:studentId', canEdit('students'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM student_groups WHERE group_id=$1 AND student_id=$2',
      [req.params.id, req.params.studentId]
    );
    await pool.query(
      'UPDATE students SET group_id = NULL WHERE id=$1 AND group_id=$2',
      [req.params.studentId, req.params.id]
    );
    res.json({ message: 'Student removed from group' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
