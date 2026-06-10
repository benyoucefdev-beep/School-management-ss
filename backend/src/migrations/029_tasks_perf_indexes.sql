-- Migration 029: Add performance indexes to tasks table
-- GIN index for array column assignee_ids (fixes sequential scan on ANY() queries)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_ids ON tasks USING GIN (assignee_ids);

-- B-tree index on deadline (fixes ORDER BY t.deadline ASC NULLS LAST)
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks (deadline ASC NULLS LAST);

-- B-tree index on service_type (fixes specialist-role filter)
CREATE INDEX IF NOT EXISTS idx_tasks_service_type ON tasks (service_type);

-- Composite index for common combined filter (client + status)
CREATE INDEX IF NOT EXISTS idx_tasks_client_status ON tasks (client_id, status);
