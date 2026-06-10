-- Migration 043: School Management — Core Tables
-- Groups, Subjects, Parents, Absences, Subject Payments
-- All existing tables use UUID primary keys

-- ── 1. GROUPS (classrooms / year levels) ─────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  level         VARCHAR(50),
  academic_year VARCHAR(20)  DEFAULT '2025-2026',
  max_students  INT          DEFAULT 30,
  room          VARCHAR(50),
  notes         TEXT,
  is_active     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ── 2. SUBJECTS (courses / matières) ─────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100)  NOT NULL,
  name_ar          VARCHAR(100),
  description      TEXT,
  color_code       VARCHAR(7)    DEFAULT '#00b4d8',
  payment_due_day  INT           DEFAULT 1,
  monthly_fee      NUMERIC(10,2) DEFAULT 0,
  hours_per_week   NUMERIC(4,1)  DEFAULT 0,
  is_active        BOOLEAN       DEFAULT TRUE,
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ── 3. SUBJECT_TEACHERS (many teacher → many subject) ────────────
CREATE TABLE IF NOT EXISTS subject_teachers (
  subject_id  UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, teacher_id),
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. STUDENT_GROUPS (student enrolled in a group) ──────────────
CREATE TABLE IF NOT EXISTS student_groups (
  student_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, group_id)
);

-- ── 5. PARENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parents (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  phone         VARCHAR(30),
  password_hash VARCHAR(255),
  notes         TEXT,
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. PARENT_STUDENTS (parent linked to one or more students) ────
CREATE TABLE IF NOT EXISTS parent_students (
  parent_id   UUID NOT NULL REFERENCES parents(id)  ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  relation    VARCHAR(50) DEFAULT 'parent',
  PRIMARY KEY (parent_id, student_id)
);

-- ── 7. CLASS_SESSIONS (scheduled class slots) ────────────────────
CREATE TABLE IF NOT EXISTS class_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID        REFERENCES tasks(id)      ON DELETE SET NULL,
  subject_id   UUID        REFERENCES subjects(id)   ON DELETE SET NULL,
  group_id     UUID        REFERENCES groups(id)     ON DELETE SET NULL,
  teacher_id   UUID        REFERENCES suppliers(id)  ON DELETE SET NULL,
  session_date DATE        NOT NULL,
  start_time   TIME,
  end_time     TIME,
  room         VARCHAR(50),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. ABSENCES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS absences (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID        NOT NULL REFERENCES clients(id)        ON DELETE CASCADE,
  class_session_id UUID                 REFERENCES class_sessions(id) ON DELETE SET NULL,
  subject_id       UUID                 REFERENCES subjects(id)        ON DELETE SET NULL,
  absence_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_justified     BOOLEAN     DEFAULT FALSE,
  justification    TEXT,
  notified_parent  BOOLEAN     DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. SUBJECT_PAYMENTS (per student per subject) ────────────────
CREATE TABLE IF NOT EXISTS subject_payments (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID          NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  subject_id  UUID          NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date    DATE          NOT NULL,
  paid_date   DATE,
  status      VARCHAR(20)   DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
  notes       TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── 10. PARENT PUSH SUBSCRIPTIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID        NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. ALTER CLIENTS TABLE (add student fields) ─────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS student_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS father_phone  VARCHAR(30),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS level         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS group_id      UUID REFERENCES groups(id) ON DELETE SET NULL;

-- ── 12. INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_absences_student         ON absences(student_id);
CREATE INDEX IF NOT EXISTS idx_absences_date            ON absences(absence_date);
CREATE INDEX IF NOT EXISTS idx_subject_payments_student ON subject_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_subject_payments_status  ON subject_payments(status);
CREATE INDEX IF NOT EXISTS idx_class_sessions_date      ON class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_student_groups_group     ON student_groups(group_id);
