-- ============================================================
-- Axialogy Migration 039 — Add status_changed & missing notification types
-- ============================================================
-- Adds the dedicated 'status_changed' type used for team member
-- working-status updates (admin-only via notifyAllOwners).
-- Also adds other types used in code but previously missing from
-- the constraint: ad_campaign_ending, system_alert, task_overdue.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned',
    'task_due_tomorrow',
    'task_status_changed',
    'status_changed',
    'invoice_overdue',
    'ads_budget_alert',
    'ad_campaign_ended',
    'ad_campaign_ending',
    'system_alert',
    'task_overdue'
  ));
