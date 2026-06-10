-- ============================================================
-- Migration 025: Expand ads platform constraint
-- Adds 'instagram' and 'other' to the allowed platform values
-- in both ads_spend_logs and ads_budgets tables.
-- ============================================================

-- ads_spend_logs
ALTER TABLE ads_spend_logs
  DROP CONSTRAINT IF EXISTS ads_spend_logs_platform_check;

ALTER TABLE ads_spend_logs
  ADD CONSTRAINT ads_spend_logs_platform_check
  CHECK (platform IN ('facebook', 'tiktok', 'google', 'instagram', 'other'));

-- ads_budgets (same constraint, same fix)
ALTER TABLE ads_budgets
  DROP CONSTRAINT IF EXISTS ads_budgets_platform_check;

ALTER TABLE ads_budgets
  ADD CONSTRAINT ads_budgets_platform_check
  CHECK (platform IN ('facebook', 'tiktok', 'google', 'instagram', 'other'));
