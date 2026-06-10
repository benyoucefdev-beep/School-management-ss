-- ============================================================
-- Axialogy Migration 003 — Client Portal Tables
-- ============================================================

-- Magic link tokens (permanent, one per client by default)
CREATE TABLE IF NOT EXISTS client_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_cat_token ON client_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_cat_client ON client_access_tokens(client_id);

-- 90-day sessions created on each token verification
CREATE TABLE IF NOT EXISTS client_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES client_access_tokens(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);

CREATE INDEX IF NOT EXISTS idx_cs_client ON client_sessions(client_id);

-- Web Push subscriptions per client device
CREATE TABLE IF NOT EXISTS client_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  language VARCHAR(5) DEFAULT 'en' CHECK (language IN ('en', 'ar')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_cps_client ON client_push_subscriptions(client_id);

-- Bilingual in-app notifications for clients
CREATE TABLE IF NOT EXISTS client_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'invoice_generated',
    'task_started',
    'task_status_changed',
    'service_started',
    'ads_campaign_started',
    'payment_received'
  )),
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_en  TEXT NOT NULL,
  body_ar  TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cn_client ON client_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_cn_unread ON client_notifications(client_id, is_read);
