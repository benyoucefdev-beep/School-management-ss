-- ============================================================
-- Axialogy Migration 021 — Add Kanban statuses to tasks
-- ============================================================
-- Adds 'in_review' and 'done' back to the allowed task statuses
-- so the Kanban board drag-and-drop can use them.

-- Drop old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Re-add with in_review and done included
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'not_started',
    'in_progress',
    'in_review',
    'done',
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
