-- ============================================================
-- Axialogy Migration 040 — Add active_worker_id to tasks
-- ============================================================
-- Stores which team member has toggled "I'm working on this task".
-- One member per task. A member can claim multiple tasks (one per task).
-- Auto-clears when the user is deleted (ON DELETE SET NULL).

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS active_worker_id UUID
  REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_active_worker ON tasks(active_worker_id);
