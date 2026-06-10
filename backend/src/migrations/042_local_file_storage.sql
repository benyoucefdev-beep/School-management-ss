-- ============================================================
-- Axialogy Migration 042 — Local File Storage (remove Supabase dependency)
-- Files are now stored as binary data directly in PostgreSQL.
-- This eliminates all Supabase Storage egress costs.
-- ============================================================

-- Add binary storage columns to client_uploads
ALTER TABLE client_uploads
  ADD COLUMN IF NOT EXISTS file_data BYTEA,
  ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Add binary storage columns to supplier_documents
ALTER TABLE supplier_documents
  ADD COLUMN IF NOT EXISTS file_data BYTEA,
  ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- file_url is kept for backwards compatibility with files already on Supabase.
-- New uploads will have file_url = NULL and file_data populated instead.
