-- 002_teacher_payment_percentage.sql
-- Adds payment_percentage to teachers table
-- This represents the share (%) of each student payment that goes to the teacher

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS payment_percentage NUMERIC(5,2) DEFAULT 70.00;

COMMENT ON COLUMN teachers.payment_percentage IS 'Percentage of student payment allocated to this teacher (e.g. 70.00 means 70%)';
