// backend/src/routes/attendance.js
const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canEdit } = require('../middleware/rbac');
const { recordScan, markAbsences } = require('../services/attendance');

// ── GET /api/attendance/cron ─────────────────────────────────────────────────
// Called by Vercel Cron. Vercel sends a GET with no user token, so this is gated
// by CRON_SECRET (as a Bearer token or ?key=). If CRON_SECRET is unset the
// endpoint refuses to run rather than defaulting to open.
router.get('/cron', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'CRON_SECRET is not configured' });
  const supplied = (req.headers.authorization || '').replace(/^Bearer /, '') || req.query.key;
  if (supplied !== secret) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const created = await markAbsences({});
    res.json({ ok: true, marked_absent: created.length, ran_at: new Date().toISOString() });
  } catch (err) {
    console.error('[attendance/cron]', err);
    res.status(500).json({ error: 'Absence sweep failed' });
  }
});

// ── POST /api/attendance/scan ────────────────────────────────────────────────
// Called by the scanner at the school gate. Staff-authenticated: a scanner
// device logs in as a staff account, so students cannot mark themselves present.
router.post('/scan', authenticate, canEdit('students'), async (req, res) => {
  const { code, scanner } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });
  try {
    const out = await recordScan({ code: String(code).trim(), scanner });
    const late = out.results.filter(r => r.status === 'late');
    res.status(201).json({
      student: { id: out.student.id, name: out.student.full_name },
      sessions_matched: out.results.length,
      status: out.results.length === 0 ? 'no_session' : (late.length ? 'late' : 'present'),
      results: out.results,
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    console.error('[attendance/scan]', err);
    res.status(500).json({ error: 'Could not record scan' });
  }
});

// ── GET /api/attendance ──────────────────────────────────────────────────────
// Filter by student, subject, status, or date range.
router.get('/', authenticate, canView('students'), async (req, res) => {
  const { student_id, subject_id, status, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  try {
    const params = [];
    const where = [];
    if (student_id) { params.push(student_id); where.push(`a.student_id = $${params.length}`); }
    if (subject_id) { params.push(subject_id); where.push(`a.subject_id = $${params.length}`); }
    if (status)     { params.push(status);     where.push(`a.status = $${params.length}`); }
    if (from)       { params.push(from);       where.push(`a.session_date >= $${params.length}`); }
    if (to)         { params.push(to);         where.push(`a.session_date <= $${params.length}`); }
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT a.*, s.full_name AS student_name, sub.name AS subject_name
         FROM attendance a
         JOIN students s        ON s.id = a.student_id
         LEFT JOIN subjects sub ON sub.id = a.subject_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY a.session_date DESC, a.session_start DESC
        LIMIT $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[attendance/list]', err);
    res.status(500).json({ error: 'Could not load attendance' });
  }
});

// ── GET /api/attendance/summary/:studentId ───────────────────────────────────
// Counts for the student card.
router.get('/summary/:studentId', authenticate, canView('students'), async (req, res) => {
  try {
    const { rows: [summary] } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'present')::int AS present,
         COUNT(*) FILTER (WHERE status = 'late')::int    AS late,
         COUNT(*) FILTER (WHERE status = 'absent')::int  AS absent,
         COUNT(*) FILTER (WHERE status = 'excused')::int AS excused,
         COALESCE(SUM(minutes_late), 0)::int             AS total_minutes_late
       FROM attendance WHERE student_id = $1`,
      [req.params.studentId]
    );
    res.json(summary);
  } catch (err) {
    console.error('[attendance/summary]', err);
    res.status(500).json({ error: 'Could not load summary' });
  }
});

// ── PUT /api/attendance/:id ──────────────────────────────────────────────────
// Staff override — e.g. marking an absence excused after a parent calls in.
router.put('/:id', authenticate, canEdit('students'), async (req, res) => {
  const { status, notes } = req.body;
  const allowed = ['present', 'late', 'absent', 'excused'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE attendance
          SET status = COALESCE($1, status),
              notes  = COALESCE($2, notes)
        WHERE id = $3 RETURNING *`,
      [status || null, notes ?? null, req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Attendance record not found' });
    res.json(row);
  } catch (err) {
    console.error('[attendance/update]', err);
    res.status(500).json({ error: 'Could not update record' });
  }
});

// ── POST /api/attendance/run-absences ────────────────────────────────────────
// Sweeps finished sessions and marks no-shows absent. Safe to call repeatedly.
// Invoked by the cron locally, and by Vercel Cron in production.
router.post('/run-absences', authenticate, canEdit('students'), async (req, res) => {
  try {
    const created = await markAbsences({});
    res.json({ marked_absent: created.length });
  } catch (err) {
    console.error('[attendance/run-absences]', err);
    res.status(500).json({ error: 'Could not run absence sweep' });
  }
});

module.exports = router;
