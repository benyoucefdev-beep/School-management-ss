-- ============================================================
-- Axialogy Migration 041 — Replace active_worker_id with active_worker_ids[]
-- ============================================================
-- Each assignee can independently mark themselves as "working on" a task.
-- Multiple members assigned to the same task can all be working simultaneously.

-- Drop the single-value column from migration 040
ALTER TABLE tasks DROP COLUMN IF EXISTS active_worker_id;
DROP INDEX IF EXISTS idx_tasks_active_worker;

-- Add array column: any subset of assignee_ids can be "active workers"
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS active_worker_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tasks_active_workers ON tasks USING GIN(active_worker_ids);
