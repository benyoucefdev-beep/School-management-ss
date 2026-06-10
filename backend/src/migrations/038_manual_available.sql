-- Migration 038: add manual_available flag for early-finish signals
-- When a team member finishes a task before the deadline, they can toggle
-- manual_available = true to signal admin that they are free.
-- This gets automatically reset to false when the admin assigns them a new task.

ALTER TABLE users ADD COLUMN IF NOT EXISTS manual_available BOOLEAN NOT NULL DEFAULT FALSE;
