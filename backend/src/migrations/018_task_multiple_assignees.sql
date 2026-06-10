-- Migration 018: Add multiple assignees to tasks

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids UUID[] DEFAULT '{}';

-- Migrate existing single assignee to array
UPDATE tasks SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND assignee_ids = '{}';
