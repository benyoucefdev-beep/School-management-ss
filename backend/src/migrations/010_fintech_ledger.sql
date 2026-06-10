-- 010_fintech_ledger.sql
-- Upgrades the system to a centralized ledger architecture

-- 1. Create the central Transactions Ledger
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- 'invoice_payment', 'ad_spend', 'supplier_payment', 'manual_expense'
    amount NUMERIC NOT NULL,
    currency VARCHAR(10) DEFAULT 'DZD',
    exchange_rate NUMERIC DEFAULT 1.0, -- Used if currency != DZD
    amount_dzd NUMERIC NOT NULL, -- The normalized value in DZD for strict P&L tracking
    
    -- Relationships
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Who logged it
    
    -- Traceability
    reference_id UUID, -- The ID of the original record (invoice_id, ad_spend_id, etc.)
    description TEXT,
    
    transaction_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast reporting
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

-- 2. Migrate existing payments (invoices)
INSERT INTO transactions (type, amount, currency, amount_dzd, client_id, reference_id, description, transaction_date)
SELECT 
    'invoice_payment', 
    p.amount, 
    'DZD', 
    p.amount, 
    i.client_id, 
    p.id, 
    'Payment for Invoice ' || i.invoice_number, 
    p.payment_date
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.reference_id = p.id AND t.type = 'invoice_payment');

-- 3. Migrate existing ad spend
INSERT INTO transactions (type, amount, currency, exchange_rate, amount_dzd, client_id, user_id, reference_id, description, transaction_date)
SELECT 
    'ad_spend', 
    a.amount, 
    'USD', 
    -- Grab the latest exchange rate before the spend date or fallback to 1
    COALESCE((SELECT rate FROM dzd_usd_rates WHERE created_at <= a.spend_date ORDER BY created_at DESC LIMIT 1), 1),
    a.amount * COALESCE((SELECT rate FROM dzd_usd_rates WHERE created_at <= a.spend_date ORDER BY created_at DESC LIMIT 1), 1),
    a.client_id, 
    a.logged_by,
    a.id, 
    'Ad Spend on ' || a.platform, 
    a.spend_date
FROM ads_spend_logs a
WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.reference_id = a.id AND t.type = 'ad_spend');

-- (Also check ad_spend_entries which was added later, migrate if there are distinct ones)
INSERT INTO transactions (type, amount, currency, exchange_rate, amount_dzd, client_id, user_id, reference_id, description, transaction_date)
SELECT 
    'ad_spend', 
    e.amount_usd, 
    'USD', 
    e.dzd_rate_used,
    e.amount_dzd,
    e.client_id, 
    e.logged_by,
    e.id, 
    'Ad Spend on ' || e.platform, 
    e.spend_date
FROM ad_spend_entries e
WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.reference_id = e.id AND t.type = 'ad_spend');

-- 4. Create Ledger-based Client Wallet View
-- This replaces the manual 'wallet_balance' column with bulletproof data integrity
CREATE OR REPLACE VIEW client_ledger_wallets AS
SELECT 
    c.id AS client_id,
    c.company_name,
    COALESCE(SUM(CASE WHEN t.type = 'invoice_payment' THEN t.amount_dzd ELSE 0 END), 0) AS total_deposited,
    COALESCE(SUM(CASE WHEN t.type = 'ad_spend' THEN t.amount_dzd ELSE 0 END), 0) AS total_spent,
    COALESCE(SUM(CASE WHEN t.type = 'invoice_payment' THEN t.amount_dzd ELSE 0 END), 0) 
    - COALESCE(SUM(CASE WHEN t.type IN ('ad_spend', 'overdue_deduction') THEN t.amount_dzd ELSE 0 END), 0) AS balance_dzd
FROM clients c
LEFT JOIN transactions t ON t.client_id = c.id
GROUP BY c.id;

