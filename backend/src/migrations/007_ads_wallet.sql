-- ============================================================
-- Axialogy Migration 007 — Client Ads Wallet System
-- ============================================================
-- Run in Neon SQL Editor AFTER migration 006.
-- Do NOT modify existing tables.

-- ── 1. DZD/USD Rate table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS dzd_usd_rates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate           NUMERIC(10,2) NOT NULL,
  set_by         UUID NOT NULL REFERENCES users(id),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default rate (replace <admin_id> after running migration 005/006)
-- We use a subquery to get the admin user id automatically
INSERT INTO dzd_usd_rates (rate, set_by, effective_date, notes)
SELECT 250.00, id, CURRENT_DATE, 'Default rate — update via Ads page'
FROM users WHERE role = 'admin' LIMIT 1;

-- ── 2. Client Ads Wallets (one per client) ─────────────────────
CREATE TABLE IF NOT EXISTS client_ads_wallets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  balance_dzd         NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_deposited_dzd NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_spent_dzd     NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_spent_usd     NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  currency            VARCHAR(3) DEFAULT 'DZD',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Wallet Deposits ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_deposits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id      UUID NOT NULL REFERENCES client_ads_wallets(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id),
  amount_dzd     NUMERIC(14,2) NOT NULL,
  payment_method VARCHAR(30) CHECK (payment_method IN (
    'cash', 'bank_transfer', 'cheque', 'ccp', 'other'
  )),
  reference      VARCHAR(100),
  notes          TEXT,
  logged_by      UUID NOT NULL REFERENCES users(id),
  deposit_date   DATE DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Ad Campaigns ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  wallet_id          UUID NOT NULL REFERENCES client_ads_wallets(id),
  platform           VARCHAR(20) NOT NULL CHECK (platform IN (
    'facebook', 'tiktok', 'google'
  )),
  campaign_name      VARCHAR(255) NOT NULL,
  objective          TEXT,
  budget_usd         NUMERIC(12,2) NOT NULL,
  budget_dzd         NUMERIC(14,2) NOT NULL,
  rate_at_creation   NUMERIC(10,2) NOT NULL,
  status             VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft', 'active', 'paused', 'completed', 'cancelled'
  )),
  start_date         DATE,
  end_date           DATE,
  created_by         UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Ad Spend Entries ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_spend_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id),
  wallet_id     UUID NOT NULL REFERENCES client_ads_wallets(id),
  platform      VARCHAR(20) NOT NULL CHECK (platform IN (
    'facebook', 'tiktok', 'google'
  )),
  spend_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_usd    NUMERIC(12,2) NOT NULL,
  dzd_rate_used NUMERIC(10,2) NOT NULL,
  amount_dzd    NUMERIC(14,2) NOT NULL,
  notes         TEXT,
  logged_by     UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Wallet Transactions (master ledger) ─────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        UUID NOT NULL REFERENCES client_ads_wallets(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
    'deposit', 'spend', 'refund', 'adjustment'
  )),
  amount_dzd       NUMERIC(14,2) NOT NULL,
  amount_usd       NUMERIC(12,2),
  dzd_rate_used    NUMERIC(10,2),
  balance_after    NUMERIC(14,2) NOT NULL,
  reference_id     UUID,
  reference_type   VARCHAR(20),
  description      TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Useful indexes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_client_id ON wallet_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_client ON ad_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_spend_campaign ON ad_spend_entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_spend_client ON ad_spend_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_client ON wallet_deposits(client_id);

-- ── 8. Auto-create wallet for existing digital_marketing clients ─
INSERT INTO client_ads_wallets (client_id)
SELECT DISTINCT client_id
FROM client_services
WHERE service_type = 'digital_marketing'
ON CONFLICT (client_id) DO NOTHING;
