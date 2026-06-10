-- Migration 032: Supplier Portal Notifications
-- In-app notifications shown inside the supplier portal

CREATE TABLE IF NOT EXISTS supplier_portal_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type         VARCHAR(50) NOT NULL,  -- 'transaction_recorded' | 'payment_received' | 'debt_logged'
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_portal_notifs_supplier_id
  ON supplier_portal_notifications(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_portal_notifs_is_read
  ON supplier_portal_notifications(supplier_id, is_read);
