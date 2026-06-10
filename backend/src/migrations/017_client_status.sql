-- Migration 017: Add explicit client_status column
-- Allows admin to set status to: active, inactive, prospect, churned

ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_status VARCHAR(20) DEFAULT 'active'
  CHECK (client_status IN ('active', 'inactive', 'prospect', 'churned'));

-- Backfill based on existing is_active computed value (leave null to use dynamic check)
UPDATE clients SET client_status = 'active';
