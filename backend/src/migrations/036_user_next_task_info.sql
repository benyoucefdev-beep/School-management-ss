-- migrations/036_user_next_task_info.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS next_task_info VARCHAR(255) DEFAULT NULL;
