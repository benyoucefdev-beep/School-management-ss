-- ============================================================
-- Axialogy Migration 022 — Extend notification types
-- ============================================================
-- Adds task_status_changed and ad_campaign_ended to the
-- notifications type CHECK constraint.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'task_due_tomorrow',
    'task_status_changed',
    'invoice_overdue',
    'ads_budget_alert',
    'ad_campaign_ended'
  ));
