-- Migration 037: rename presence_status → task_status and drop custom_status
-- task_status is purely computed from tasks, no manual override

-- Add task_status column (replaces presence_status)
ALTER TABLE users ADD COLUMN IF NOT EXISTS task_status TEXT DEFAULT 'Available';

-- Copy existing presence_status into task_status only if the column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'presence_status'
  ) THEN
    UPDATE users SET task_status = COALESCE(presence_status, 'Available');
  END IF;
END $$;

-- Drop columns that belonged to the old presence concept
ALTER TABLE users DROP COLUMN IF EXISTS presence_status;
ALTER TABLE users DROP COLUMN IF EXISTS custom_status;

-- next_task_info is kept as-is (already correct purpose)
