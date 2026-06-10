-- Migration 034: Supplier portal document enhancements
-- Add note column to supplier_documents for upload context
ALTER TABLE supplier_documents
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Notes thread for supplier documents (mirrors client_upload_notes)
CREATE TABLE IF NOT EXISTS supplier_document_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      UUID NOT NULL REFERENCES supplier_documents(id) ON DELETE CASCADE,
  author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('staff', 'supplier')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_doc_notes_doc_id ON supplier_document_notes(doc_id);
