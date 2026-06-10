-- ============================================================
-- Axialogy Migration 023 — Client Portal Token + portal_visible
-- ============================================================

-- 1. Add portal_token to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_token UUID UNIQUE DEFAULT gen_random_uuid();

-- Backfill any existing clients without a token
UPDATE clients SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;

-- 2. Make documents visible in portal only when admin explicitly sends them
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices   ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN DEFAULT FALSE;
