-- Migration 031: Supplier Portal Authentication
-- Adds portal_token (UUID link), username, hashed password, and plain password to suppliers

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS portal_token         UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS portal_username       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS portal_password_hash  TEXT,
  ADD COLUMN IF NOT EXISTS portal_plain_password TEXT;

-- Back-fill tokens for existing suppliers that don't have one yet
UPDATE suppliers SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_portal_token
  ON suppliers (portal_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_portal_username
  ON suppliers (portal_username)
  WHERE portal_username IS NOT NULL;
