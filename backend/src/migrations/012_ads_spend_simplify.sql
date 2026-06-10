-- Migration 012: Add simplified ads spend columns and payment logging support
-- Safe to run multiple times (all IF NOT EXISTS)

-- Add amount_dzd and end_date to ads_spend_logs
ALTER TABLE ads_spend_logs ADD COLUMN IF NOT EXISTS amount_dzd NUMERIC(14,2);
ALTER TABLE ads_spend_logs ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE ads_spend_logs ADD COLUMN IF NOT EXISTS notes TEXT;

-- Auto-fill amount_dzd for existing rows using latest rate
UPDATE ads_spend_logs sl
SET amount_dzd = sl.amount * COALESCE(
  (SELECT rate FROM dzd_usd_rates ORDER BY effective_date DESC, created_at DESC LIMIT 1),
  1
)
WHERE amount_dzd IS NULL;

-- Index for end_date cron lookups
CREATE INDEX IF NOT EXISTS idx_ads_spend_logs_end_date ON ads_spend_logs(end_date);
