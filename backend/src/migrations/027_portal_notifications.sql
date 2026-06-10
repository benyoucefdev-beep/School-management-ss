-- ============================================================
-- Migration 027 — Portal Notifications
-- In-app notifications shown inside the client portal
-- ============================================================

CREATE TABLE IF NOT EXISTS portal_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type         VARCHAR(50) NOT NULL, -- 'invoice_received' | 'quote_received' | 'task_updated'
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_notifications_client_id ON portal_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_notifications_is_read   ON portal_notifications(client_id, is_read);
