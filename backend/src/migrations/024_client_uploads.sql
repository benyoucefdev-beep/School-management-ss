-- ============================================================
-- Axialogy Migration 024 — Client Uploads + Notes
-- ============================================================

-- Table for files clients upload via the portal
CREATE TABLE IF NOT EXISTS client_uploads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_type   TEXT,
  note        TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_uploads_client_id ON client_uploads(client_id);

-- Bidirectional notes thread on each uploaded file
CREATE TABLE IF NOT EXISTS client_upload_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id   UUID NOT NULL REFERENCES client_uploads(id) ON DELETE CASCADE,
  author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('admin', 'client')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_upload_notes_upload_id ON client_upload_notes(upload_id);
