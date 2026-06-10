-- ============================================================
-- Axialogy Migration 006 — New Task Statuses + Progress Column
-- ============================================================
-- Run in Neon SQL Editor AFTER migration 005.

-- Step 1: Drop old status constraint on tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Step 2: Add progress_pct column if not already present
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes       TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date  DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS needs_after TEXT;

-- Step 3: Map old statuses to new ones
UPDATE tasks SET status = 'not_started'  WHERE status = 'todo';
UPDATE tasks SET status = 'in_progress'  WHERE status = 'in_progress';   -- No-op (same)
UPDATE tasks SET status = 'completed'    WHERE status = 'done';
UPDATE tasks SET status = 'in_progress'  WHERE status = 'in_review';

-- Step 4: Apply new constraint
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'not_started',
    'in_progress',
    'blocked',
    'waiting_client',
    'ready_for_delivery',
    'need_team_help',
    'completed',
    'paused',
    'need_more_info',
    'to_be_followed',
    'urgent'
  ));
