-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 003: QR ATTENDANCE, LATENESS, PARENT NOTIFICATIONS, ADULT STUDENTS
--
-- Additive only. No DROP TABLE, no data loss — safe to run on a live database.
--
-- What this enables:
--   • every student carries a QR code; scanning it on arrival records presence
--   • a scheduled session that ends with no scan is auto-marked absent
--   • a scan after the session start is recorded as late, with the minutes late
--   • guardians are notified of absence and lateness in the parent portal
--   • students of legal age get their own portal instead of a guardian's
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Students: adult flag + a stable scan code ─────────────────────────────
-- portal_token already exists and is unique, but it is a URL secret. The scan
-- code is a separate, short, rotatable value printed on the student card, so
-- revoking a card never invalidates a portal login.
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_adult      BOOLEAN     DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS scan_code     VARCHAR(64);
ALTER TABLE students ADD COLUMN IF NOT EXISTS scan_code_issued_at TIMESTAMPTZ;

-- Give every existing student a scan code.
UPDATE students SET scan_code = encode(gen_random_bytes(12), 'hex'), scan_code_issued_at = NOW()
WHERE scan_code IS NULL;

ALTER TABLE students ALTER COLUMN scan_code SET DEFAULT encode(gen_random_bytes(12), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_scan_code ON students(scan_code);

-- A student is "major" (adult) when they have reached the age of majority.
-- Kept as a stored flag rather than derived from date_of_birth so a school can
-- override it (emancipated minors, missing birth dates).
COMMENT ON COLUMN students.is_adult IS
  'TRUE = student manages their own portal; FALSE = guardians receive notifications';

-- ── 2. Subjects: how the weekly load and the fee are defined ─────────────────
-- sessions_per_week is what the course page shows and what the scheduler uses.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS sessions_per_week INT DEFAULT 1;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS session_minutes   INT DEFAULT 60;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS late_grace_minutes INT DEFAULT 10;

-- ── 3. A recurring weekly timetable ──────────────────────────────────────────
-- class_sessions already exists but holds one-off dated sessions. This table
-- holds the repeating pattern the auto-absence job expands each day.
CREATE TABLE IF NOT EXISTS subject_schedule (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  group_id      UUID          REFERENCES groups(id)   ON DELETE CASCADE,
  teacher_id    UUID          REFERENCES teachers(id) ON DELETE SET NULL,
  -- 0 = Sunday … 6 = Saturday, matching PostgreSQL's EXTRACT(DOW)
  day_of_week   INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  room          VARCHAR(50),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_schedule_subject ON subject_schedule(subject_id);
CREATE INDEX IF NOT EXISTS idx_schedule_group   ON subject_schedule(group_id);
CREATE INDEX IF NOT EXISTS idx_schedule_dow     ON subject_schedule(day_of_week);

-- ── 4. Which students are enrolled in which subject ──────────────────────────
-- Needed to know who was *expected* at a session. Without it there is nobody to
-- mark absent.
CREATE TABLE IF NOT EXISTS student_subjects (
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (student_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject ON student_subjects(subject_id);

-- ── 5. Raw scan events ───────────────────────────────────────────────────────
-- Append-only log of every badge scan. Attendance is derived from this, so a
-- mistaken attendance row can always be recomputed from the source events.
CREATE TABLE IF NOT EXISTS attendance_scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scanner     VARCHAR(50),                    -- gate / office / device id
  raw_code    VARCHAR(64),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scans_student_time ON attendance_scans(student_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_time         ON attendance_scans(scanned_at);

-- ── 6. Derived attendance, one row per student per session ───────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES students(id)         ON DELETE CASCADE,
  subject_id     UUID          REFERENCES subjects(id)         ON DELETE SET NULL,
  schedule_id    UUID          REFERENCES subject_schedule(id) ON DELETE SET NULL,
  session_date   DATE NOT NULL,
  session_start  TIME,
  status         VARCHAR(20) NOT NULL DEFAULT 'absent'
                 CHECK (status IN ('present', 'late', 'absent', 'excused')),
  scanned_at     TIMESTAMPTZ,
  minutes_late   INT DEFAULT 0 CHECK (minutes_late >= 0),
  scan_id        UUID REFERENCES attendance_scans(id) ON DELETE SET NULL,
  notified_at    TIMESTAMPTZ,                 -- when guardians were told
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
-- One attendance record per student per scheduled session per day. This is what
-- makes the auto-absence job safe to re-run: it can never double-insert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_session
  ON attendance(student_id, schedule_id, session_date)
  WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status  ON attendance(status);

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance;
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 7. Notifications for guardians and adult students ────────────────────────
-- The existing `notifications` table is FK'd to users(id) (staff only), so
-- guardians cannot use it. This one addresses a parent OR an adult student.
CREATE TABLE IF NOT EXISTS guardian_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     UUID REFERENCES parents(id)  ON DELETE CASCADE,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  type          VARCHAR(40) NOT NULL,          -- absence | late | payment_due
  title         VARCHAR(255) NOT NULL,
  body          TEXT,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- must reach somebody: a guardian, or the adult student themselves
  CHECK (parent_id IS NOT NULL OR student_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_gnotif_parent  ON guardian_notifications(parent_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gnotif_student ON guardian_notifications(student_id, is_read, created_at DESC);

-- Don't notify the same guardian twice for the same attendance row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gnotif_once
  ON guardian_notifications(attendance_id, COALESCE(parent_id, student_id))
  WHERE attendance_id IS NOT NULL;
