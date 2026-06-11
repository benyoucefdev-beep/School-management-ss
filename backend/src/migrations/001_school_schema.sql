-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 001: EDUMANAGE SCHOOL SCHEMA
-- Canonical schema — matches live Supabase tables exactly.
-- Tables: students, teachers, classes, groups, subjects, parents,
--         absences, class_sessions, subject_payments, invoices, payments,
--         expenses, teacher_payments, student_notes, student_documents,
--         student_uploads, teacher_documents, notifications, activity_log,
--         push_subscriptions, role_permissions, weekly_digest_log, users
-- ══════════════════════════════════════════════════════════════════════════════

-- ── STEP 1: DROP EVERYTHING (CASCADE handles foreign keys) ────────────────────
DROP TABLE IF EXISTS task_time_logs             CASCADE;
DROP TABLE IF EXISTS task_attachments           CASCADE;
DROP TABLE IF EXISTS tasks                      CASCADE;
DROP TABLE IF EXISTS client_upload_notes        CASCADE;
DROP TABLE IF EXISTS client_uploads             CASCADE;
DROP TABLE IF EXISTS client_files               CASCADE;
DROP TABLE IF EXISTS client_notes               CASCADE;
DROP TABLE IF EXISTS client_notifications       CASCADE;
DROP TABLE IF EXISTS client_push_subscriptions  CASCADE;
DROP TABLE IF EXISTS client_access_tokens       CASCADE;
DROP TABLE IF EXISTS client_sessions            CASCADE;
DROP TABLE IF EXISTS client_versements          CASCADE;
DROP TABLE IF EXISTS portal_notifications       CASCADE;
DROP TABLE IF EXISTS clients                    CASCADE;
DROP TABLE IF EXISTS supplier_document_notes    CASCADE;
DROP TABLE IF EXISTS supplier_documents         CASCADE;
DROP TABLE IF EXISTS supplier_notifications     CASCADE;
DROP TABLE IF EXISTS supplier_push_subscriptions CASCADE;
DROP TABLE IF EXISTS supplier_portal_notifications CASCADE;
DROP TABLE IF EXISTS supplier_access_tokens     CASCADE;
DROP TABLE IF EXISTS supplier_sessions          CASCADE;
DROP TABLE IF EXISTS supplier_versements        CASCADE;
DROP TABLE IF EXISTS supplier_orders            CASCADE;
DROP TABLE IF EXISTS supplier_subscriptions     CASCADE;
DROP TABLE IF EXISTS supplier_transactions      CASCADE;
DROP TABLE IF EXISTS supplier_client_links      CASCADE;
DROP TABLE IF EXISTS supplier_types             CASCADE;
DROP TABLE IF EXISTS suppliers                  CASCADE;
DROP TABLE IF EXISTS invoice_line_items         CASCADE;
DROP TABLE IF EXISTS invoices                   CASCADE;
DROP TABLE IF EXISTS payments                   CASCADE;
DROP TABLE IF EXISTS transactions               CASCADE;
DROP TABLE IF EXISTS fixed_expenses             CASCADE;
DROP TABLE IF EXISTS variable_expenses          CASCADE;
DROP TABLE IF EXISTS activity_log               CASCADE;
DROP TABLE IF EXISTS notifications              CASCADE;
DROP TABLE IF EXISTS push_subscriptions         CASCADE;
DROP TABLE IF EXISTS weekly_digest_log          CASCADE;
DROP TABLE IF EXISTS role_permissions           CASCADE;
DROP TABLE IF EXISTS dzd_usd_rates              CASCADE;
DROP TABLE IF EXISTS lead_proposals             CASCADE;

-- Also drop new school tables so we recreate cleanly
DROP TABLE IF EXISTS class_sessions             CASCADE;
DROP TABLE IF EXISTS absences                   CASCADE;
DROP TABLE IF EXISTS subject_payments           CASCADE;
DROP TABLE IF EXISTS subject_teachers           CASCADE;
DROP TABLE IF EXISTS student_groups             CASCADE;
DROP TABLE IF EXISTS parent_students            CASCADE;
DROP TABLE IF EXISTS parent_push_subscriptions  CASCADE;
DROP TABLE IF EXISTS parents                    CASCADE;
DROP TABLE IF EXISTS subjects                   CASCADE;
DROP TABLE IF EXISTS groups                     CASCADE;

-- Drop views if they exist
DROP VIEW IF EXISTS students  CASCADE;
DROP VIEW IF EXISTS teachers  CASCADE;
DROP VIEW IF EXISTS classes   CASCADE;

-- ── STEP 2: RECREATE — SYSTEM / AUTH ─────────────────────────────────────────

CREATE TABLE role_permissions (
  role VARCHAR(50) PRIMARY KEY,
  students  JSONB DEFAULT '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  teachers  JSONB DEFAULT '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  classes   JSONB DEFAULT '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  finance   JSONB DEFAULT '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  parents   JSONB DEFAULT '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  team      JSONB DEFAULT '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  settings  JSONB DEFAULT '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default permissions
INSERT INTO role_permissions (role, students, teachers, classes, finance, parents, team, settings) VALUES
('admin',
  '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb,
  '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb,
  '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb,
  '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb,
  '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb,
  '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb,
  '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb
),
('graphic_designer',
  '{"view":true,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":true,"create":false,"edit":true,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb
),
('software_developer',
  '{"view":true,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":true,"create":false,"edit":true,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb
),
('printer',
  '{"view":true,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":true,"create":false,"edit":true,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb
),
('ads_manager',
  '{"view":true,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":true,"create":false,"edit":true,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb
);

-- ── STEP 3: GROUPS ────────────────────────────────────────────────────────────
CREATE TABLE groups (
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

-- ── STEP 4: SUBJECTS ──────────────────────────────────────────────────────────
CREATE TABLE subjects (
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

-- ── STEP 5: STUDENTS (replaces clients) ───────────────────────────────────────
CREATE TABLE students (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name            VARCHAR(150) NOT NULL,
  email                VARCHAR(255),
  phone                VARCHAR(30),
  student_phone        VARCHAR(30),
  father_phone         VARCHAR(30),
  date_of_birth        DATE,
  level                VARCHAR(50),
  group_id             UUID         REFERENCES groups(id) ON DELETE SET NULL,
  enrollment_date      DATE         DEFAULT CURRENT_DATE,
  status               VARCHAR(30)  DEFAULT 'active',
  notes                TEXT,
  portal_token         VARCHAR(255) UNIQUE DEFAULT gen_random_uuid()::text,
  portal_username      VARCHAR(100),
  portal_password_hash VARCHAR(255),
  portal_plain_password VARCHAR(255),
  assigned_user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ  DEFAULT NOW()
);

-- ── STEP 6: TEACHERS (replaces suppliers) ─────────────────────────────────────
CREATE TABLE teachers (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(150) NOT NULL,
  email                VARCHAR(255),
  phone                VARCHAR(30),
  speciality           VARCHAR(100),
  address              TEXT,
  notes                TEXT,
  is_active            BOOLEAN      DEFAULT TRUE,
  portal_token         VARCHAR(255) UNIQUE DEFAULT gen_random_uuid()::text,
  portal_username      VARCHAR(100),
  portal_password_hash VARCHAR(255),
  portal_plain_password VARCHAR(255),
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

-- ── STEP 7: PARENTS ───────────────────────────────────────────────────────────
CREATE TABLE parents (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  phone         VARCHAR(30),
  password_hash VARCHAR(255),
  notes         TEXT,
  is_active     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ── STEP 8: CLASSES (replaces tasks) ──────────────────────────────────────────
CREATE TABLE classes (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  subject_id       UUID         REFERENCES subjects(id) ON DELETE SET NULL,
  group_id         UUID         REFERENCES groups(id)   ON DELETE SET NULL,
  student_id       UUID         REFERENCES students(id) ON DELETE SET NULL,
  teacher_ids      UUID[]       DEFAULT '{}',
  active_teacher_ids UUID[]     DEFAULT '{}',
  status           VARCHAR(50)  DEFAULT 'not_started',
  start_date       DATE,
  end_date         DATE,
  progress_pct     INT          DEFAULT 0,
  notes            TEXT,
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- ── STEP 9: JOIN TABLES ───────────────────────────────────────────────────────
CREATE TABLE subject_teachers (
  subject_id  UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES teachers(id)  ON DELETE CASCADE,
  PRIMARY KEY (subject_id, teacher_id),
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_groups (
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES groups(id)   ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, group_id)
);

CREATE TABLE parent_students (
  parent_id   UUID NOT NULL REFERENCES parents(id)  ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation    VARCHAR(50) DEFAULT 'parent',
  PRIMARY KEY (parent_id, student_id)
);

-- ── STEP 10: CLASS SESSIONS & ABSENCES ───────────────────────────────────────
CREATE TABLE class_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID        REFERENCES classes(id)   ON DELETE SET NULL,
  subject_id   UUID        REFERENCES subjects(id)  ON DELETE SET NULL,
  group_id     UUID        REFERENCES groups(id)    ON DELETE SET NULL,
  teacher_id   UUID        REFERENCES teachers(id)  ON DELETE SET NULL,
  session_date DATE        NOT NULL,
  start_time   TIME,
  end_time     TIME,
  room         VARCHAR(50),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE absences (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID        NOT NULL REFERENCES students(id)      ON DELETE CASCADE,
  class_session_id UUID                 REFERENCES class_sessions(id) ON DELETE SET NULL,
  subject_id       UUID                 REFERENCES subjects(id)       ON DELETE SET NULL,
  absence_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_justified     BOOLEAN     DEFAULT FALSE,
  justification    TEXT,
  notified_parent  BOOLEAN     DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── STEP 11: PAYMENTS ─────────────────────────────────────────────────────────
CREATE TABLE subject_payments (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID          NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  subject_id  UUID          NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date    DATE          NOT NULL,
  paid_date   DATE,
  status      VARCHAR(20)   DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','waived')),
  notes       TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE invoices (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50)   UNIQUE,
  student_id     UUID          REFERENCES students(id) ON DELETE SET NULL,
  subtotal       NUMERIC(10,2) DEFAULT 0,
  discount       NUMERIC(10,2) DEFAULT 0,
  total          NUMERIC(10,2) DEFAULT 0,
  status         VARCHAR(30)   DEFAULT 'draft'
    CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  due_date       DATE,
  paid_date      DATE,
  notes          TEXT,
  created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(255),
  quantity    NUMERIC(10,2) DEFAULT 1,
  unit_price  NUMERIC(10,2) DEFAULT 0,
  total       NUMERIC(10,2) DEFAULT 0
);

CREATE TABLE payments (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID          REFERENCES students(id) ON DELETE SET NULL,
  invoice_id   UUID          REFERENCES invoices(id) ON DELETE SET NULL,
  amount       NUMERIC(10,2) NOT NULL,
  payment_date DATE          DEFAULT CURRENT_DATE,
  method       VARCHAR(50)   DEFAULT 'cash',
  reference    VARCHAR(100),
  notes        TEXT,
  created_by   UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE expenses (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(255)  NOT NULL,
  category     VARCHAR(100),
  amount       NUMERIC(10,2) NOT NULL,
  expense_date DATE          DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN       DEFAULT FALSE,
  recurrence   VARCHAR(30),
  notes        TEXT,
  created_by   UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE teacher_payments (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID          NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL,
  currency     VARCHAR(10)   DEFAULT 'DZD',
  payment_date DATE          DEFAULT CURRENT_DATE,
  description  TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- ── STEP 12: STUDENT PORTAL ───────────────────────────────────────────────────
CREATE TABLE student_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token      TEXT        UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE student_push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_uploads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  folder      VARCHAR(100),
  file_name   VARCHAR(255) NOT NULL,
  file_url    TEXT        NOT NULL,
  description TEXT,
  status      VARCHAR(30) DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_upload_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id   UUID        NOT NULL REFERENCES student_uploads(id) ON DELETE CASCADE,
  author_type VARCHAR(20) DEFAULT 'admin',
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  author_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  folder      VARCHAR(100),
  file_name   VARCHAR(255) NOT NULL,
  file_url    TEXT        NOT NULL,
  uploaded_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type       VARCHAR(50),
  title      VARCHAR(255),
  body       TEXT,
  is_read    BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── STEP 13: TEACHER PORTAL ───────────────────────────────────────────────────
CREATE TABLE teacher_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  token      TEXT        UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE teacher_push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teacher_documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  folder      VARCHAR(100),
  file_name   VARCHAR(255) NOT NULL,
  file_url    TEXT        NOT NULL,
  uploaded_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teacher_notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  type       VARCHAR(50),
  title      VARCHAR(255),
  body       TEXT,
  is_read    BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── STEP 14: PARENT PORTAL ────────────────────────────────────────────────────
CREATE TABLE parent_push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  UUID        NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── STEP 15: CLASS ATTACHMENTS ────────────────────────────────────────────────
CREATE TABLE class_attachments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  file_url    TEXT        NOT NULL,
  file_name   VARCHAR(255),
  uploaded_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── STEP 16: NOTIFICATIONS & LOGS ────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50),
  title      VARCHAR(255),
  message    TEXT,
  is_read    BOOLEAN     DEFAULT FALSE,
  related_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        REFERENCES students(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES users(id)    ON DELETE SET NULL,
  action_type VARCHAR(100),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE weekly_digest_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at    TIMESTAMPTZ DEFAULT NOW(),
  recipient_count INT    DEFAULT 0,
  notes      TEXT
);

-- ── STEP 17: INDEXES ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_group      ON students(group_id);
CREATE INDEX IF NOT EXISTS idx_students_status     ON students(status);
CREATE INDEX IF NOT EXISTS idx_classes_status      ON classes(status);
CREATE INDEX IF NOT EXISTS idx_classes_student     ON classes(student_id);
CREATE INDEX IF NOT EXISTS idx_classes_group       ON classes(group_id);
CREATE INDEX IF NOT EXISTS idx_absences_student    ON absences(student_id);
CREATE INDEX IF NOT EXISTS idx_absences_date       ON absences(absence_date);
CREATE INDEX IF NOT EXISTS idx_subject_pay_student ON subject_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_subject_pay_status  ON subject_payments(status);
CREATE INDEX IF NOT EXISTS idx_invoices_student    ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_activity_student    ON activity_log(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_student_groups_grp  ON student_groups(group_id);

-- ── DONE ──────────────────────────────────────────────────────────────────────
SELECT 'Schema reset complete ✓' AS result;
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
