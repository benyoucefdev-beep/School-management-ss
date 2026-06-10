-- ============================================================
-- Axialogy Migration 002 — Phase 3 + Phase 4 tables
-- ============================================================

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'task_assigned', 'task_due_tomorrow',
    'invoice_overdue', 'ads_budget_alert'
  )),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- WEEKLY DIGEST LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_digest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_to UUID REFERENCES users(id),
  content JSONB
);

-- ============================================================
-- LEADS (Phase 4)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  source_channel VARCHAR(100),
  assigned_to UUID REFERENCES users(id),
  stage VARCHAR(30) DEFAULT 'new_lead' CHECK (stage IN (
    'new_lead', 'contacted', 'proposal_sent',
    'negotiating', 'won', 'lost'
  )),
  lost_reason TEXT,
  converted_client_id UUID REFERENCES clients(id),
  date_added DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- ============================================================
-- LEAD PROPOSALS (Phase 4)
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id),
  notes TEXT,
  attached_at TIMESTAMPTZ DEFAULT NOW()
);
