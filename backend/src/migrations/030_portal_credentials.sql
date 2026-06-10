-- Migration 030: Add portal login credentials to clients table
-- Allows clients to register with username/password via the QR portal

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_username    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS portal_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS portal_plain_password TEXT;

-- Ensure usernames are unique across all clients (only where set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_portal_username
  ON clients (portal_username)
  WHERE portal_username IS NOT NULL;
