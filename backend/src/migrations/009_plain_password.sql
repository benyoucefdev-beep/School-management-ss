-- Migration: Add plain_password column to users table
-- Run this against your PostgreSQL database

ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT;

-- Indexes for performance (already exist but ensure)
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_ad_spend_entries_spend_date ON ad_spend_entries(spend_date);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'plain_password';
