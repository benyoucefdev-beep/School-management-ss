-- Fix: expand notifications type CHECK constraint to include all used types
-- Run this in Supabase SQL Editor

-- Drop old constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add updated constraint with all types used in the codebase
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'task_due_tomorrow',
    'invoice_overdue',
    'ads_budget_alert',
    'ad_campaign_ended'
  ));
