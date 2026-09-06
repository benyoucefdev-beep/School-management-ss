// backend/src/services/attendance.js
//
// Turns raw QR scans into attendance, and marks no-shows absent.
//
// The rules, in one place:
//   • a scan at or before (session start + grace) → present
//   • a scan after that, while the session is still running → late, with minutes
//   • a session that has ended with no scan → absent
//   • absence and lateness notify the student's guardians, or the student
//     themselves when they are an adult
//
// Attendance is DERIVED from attendance_scans, which is append-only, so a row
// can always be recomputed from the source events.

const pool = require('../db');

/** Postgres EXTRACT(DOW): 0 = Sunday … 6 = Saturday. JS getDay() matches. */
const dowOf = (date) => date.getDay();

/**
 * Every scheduled session a student is expected at on a given date, based on
 * the subjects they are enrolled in and that subject's weekly timetable.
 */
async function expectedSessions(db, studentId, date) {
  const { rows } = await db.query(
    `SELECT sch.id   AS schedule_id,
            sch.subject_id,
            sch.start_time,
            sch.end_time,
            COALESCE(sub.late_grace_minutes, 10) AS grace
       FROM subject_schedule sch
       JOIN student_subjects ss ON ss.subject_id = sch.subject_id AND ss.is_active
       JOIN subjects sub        ON sub.id = sch.subject_id
      WHERE ss.student_id = $1
        AND sch.is_active
        AND sch.day_of_week = $2
      ORDER BY sch.start_time`,
    [studentId, dowOf(date)]
  );
  return rows;
}

/** Minutes between two "HH:MM:SS" / Date pairs on the same calendar day. */
function minutesAfter(scanAt, sessionDate, startTime) {
  const [h, m, s] = String(startTime).split(':').map(Number);
  const start = new Date(sessionDate);
  start.setHours(h, m, s || 0, 0);
  return Math.round((scanAt.getTime() - start.getTime()) / 60000);
}

/**
 * Record a scan and settle attendance for whichever session it belongs to.
 *
 * Returns { student, results: [{ subject_id, status, minutes_late }] }.
 * Throws { status: 404 } for an unknown code.
 */
async function recordScan({ code, scanner = 'gate', at = new Date() }) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    const { rows: [student] } = await db.query(
      `SELECT id, full_name, is_adult FROM students
        WHERE scan_code = $1 AND status <> 'inactive'`,
      [code]
    );
    if (!student) {
      const err = new Error('Unknown or inactive scan code');
      err.status = 404;
      throw err;
    }

    const { rows: [scan] } = await db.query(
      `INSERT INTO attendance_scans (student_id, scanned_at, scanner, raw_code)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [student.id, at, scanner, code]
    );

    const sessionDate = new Date(at);
    sessionDate.setHours(0, 0, 0, 0);
    const sessions = await expectedSessions(db, student.id, sessionDate);

    const results = [];
    for (const s of sessions) {
      const lateBy = minutesAfter(at, sessionDate, s.start_time);
      const endsIn = minutesAfter(at, sessionDate, s.end_time);

      // Ignore sessions that have not started yet or already finished; the scan
      // belongs to whichever session is currently running.
      if (lateBy < 0 || endsIn > 0) continue;

      const status = lateBy <= s.grace ? 'present' : 'late';
      const minutesLate = status === 'late' ? lateBy : 0;

      const { rows: [row] } = await db.query(
        `INSERT INTO attendance
           (student_id, subject_id, schedule_id, session_date, session_start,
            status, scanned_at, minutes_late, scan_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (student_id, schedule_id, session_date)
           WHERE schedule_id IS NOT NULL
         DO UPDATE SET status       = EXCLUDED.status,
                       scanned_at   = EXCLUDED.scanned_at,
                       minutes_late = EXCLUDED.minutes_late,
                       scan_id      = EXCLUDED.scan_id
         RETURNING id, status, minutes_late, subject_id`,
        [student.id, s.subject_id, s.schedule_id, sessionDate, s.start_time,
         status, at, minutesLate, scan.id]
      );
      results.push(row);
    }

    await db.query('COMMIT');

    // Notify outside the transaction: a notification failure must not undo a
    // recorded scan.
    for (const r of results) {
      if (r.status === 'late') await notifyGuardians(r.id, 'late').catch(() => {});
    }

    return { student, scan_id: scan.id, results };
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    db.release();
  }
}

/**
 * Mark absent every enrolled student who had a session that has now ended and
 * never scanned. Idempotent: the unique index makes re-runs a no-op.
 *
 * Returns the attendance rows newly created.
 */
async function markAbsences({ now = new Date() } = {}) {
  const sessionDate = new Date(now);
  sessionDate.setHours(0, 0, 0, 0);
  const clock = now.toTimeString().slice(0, 8); // HH:MM:SS

  const { rows } = await pool.query(
    `INSERT INTO attendance
       (student_id, subject_id, schedule_id, session_date, session_start, status)
     SELECT ss.student_id, sch.subject_id, sch.id, $1::date, sch.start_time, 'absent'
       FROM subject_schedule sch
       JOIN student_subjects ss ON ss.subject_id = sch.subject_id AND ss.is_active
      WHERE sch.is_active
        AND sch.day_of_week = EXTRACT(DOW FROM $1::date)
        AND sch.end_time <= $2::time
     ON CONFLICT (student_id, schedule_id, session_date)
       WHERE schedule_id IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [sessionDate, clock]
  );

  for (const r of rows) {
    await notifyGuardians(r.id, 'absence').catch(() => {});
  }
  return rows;
}

/**
 * Tell the people responsible for a student about an attendance event.
 * Guardians for a minor; the student themselves once they are an adult.
 */
async function notifyGuardians(attendanceId, type) {
  const { rows: [a] } = await pool.query(
    `SELECT a.id, a.status, a.minutes_late, a.session_date, a.session_start,
            s.id AS student_id, s.full_name, s.is_adult,
            sub.name AS subject_name
       FROM attendance a
       JOIN students s   ON s.id = a.student_id
       LEFT JOIN subjects sub ON sub.id = a.subject_id
      WHERE a.id = $1`,
    [attendanceId]
  );
  if (!a) return [];

  const subject = a.subject_name || 'class';
  const when = new Date(a.session_date).toISOString().slice(0, 10);

  const { title, body } = type === 'late'
    ? {
        title: `${a.full_name} arrived late`,
        body: `${a.full_name} arrived ${a.minutes_late} minute(s) late for ${subject} on ${when}.`,
      }
    : {
        title: `${a.full_name} was absent`,
        body: `${a.full_name} did not attend ${subject} on ${when}.`,
      };

  const created = [];

  if (a.is_adult) {
    // Adult students manage themselves — the notification goes to their portal.
    const { rows } = await pool.query(
      `INSERT INTO guardian_notifications (student_id, attendance_id, type, title, body)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING RETURNING id`,
      [a.student_id, a.id, type, title, body]
    );
    created.push(...rows);
  } else {
    const { rows: guardians } = await pool.query(
      'SELECT parent_id FROM parent_students WHERE student_id = $1',
      [a.student_id]
    );
    for (const g of guardians) {
      const { rows } = await pool.query(
        `INSERT INTO guardian_notifications (parent_id, student_id, attendance_id, type, title, body)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING RETURNING id`,
        [g.parent_id, a.student_id, a.id, type, title, body]
      );
      created.push(...rows);
    }
  }

  if (created.length) {
    await pool.query('UPDATE attendance SET notified_at = NOW() WHERE id = $1', [a.id]);
  }
  return created;
}

module.exports = { recordScan, markAbsences, notifyGuardians, expectedSessions };
