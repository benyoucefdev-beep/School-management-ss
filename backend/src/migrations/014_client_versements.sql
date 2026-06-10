-- 014_client_versements.sql
-- Introduces "Bon de Versement" as the ONLY way to credit a client wallet.
-- Invoices DEDUCT from the wallet. The flow is:
--   1. Client pays a Bon de Versement  → wallet increases (credit)
--   2. Work is done, Invoice is created → (no wallet change yet)
--   3. Invoice is manually marked "paid" (wallet deduction) → wallet decreases (debit)

-- ── 1. Create client_versements table ─────────────────────────────
CREATE TABLE IF NOT EXISTS client_versements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    logged_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Reference number  e.g. BV-2026-001
    versement_number VARCHAR(50) UNIQUE NOT NULL,

    amount_dzd NUMERIC(15, 2) NOT NULL CHECK (amount_dzd > 0),
    versement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_versements_client ON client_versements(client_id);
CREATE INDEX IF NOT EXISTS idx_versements_date   ON client_versements(versement_date);

-- ── 2. Fix the existing "Log Payment" entries in the payments table ─
--    Historically these were **credits** — we must NOT lose that history.
--    We migrate them to versements so the wallet math stays correct.
--    (Run only for existing rows that were treated as deposits)
INSERT INTO client_versements (client_id, logged_by, versement_number, amount_dzd, versement_date, notes)
SELECT
    p.client_id,
    NULL,
    'BV-MIGRATED-' || p.id,
    p.amount,
    p.payment_date::DATE,
    'Migrated from legacy payment record for invoice ' || COALESCE(i.invoice_number, p.invoice_id::text)
FROM payments p
LEFT JOIN invoices i ON i.id = p.invoice_id
WHERE p.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM client_versements v WHERE v.versement_number = 'BV-MIGRATED-' || p.id
  );

-- ── 3. Re-create the ledger wallet view ───────────────────────────
--    Credits: client_versements (bon de versement payments)
--    Debits:  invoice payments registered via the payments table
--             + ad_spend + overdue_deductions in transactions table
DROP VIEW IF EXISTS client_ledger_wallets;
CREATE OR REPLACE VIEW client_ledger_wallets AS
SELECT
    c.id AS client_id,
    c.company_name,

    -- Total deposited via Bon de Versement
    COALESCE((
        SELECT SUM(v.amount_dzd)
        FROM client_versements v
        WHERE v.client_id = c.id
    ), 0) AS total_deposited,

    -- Total billed (paid invoices settled against wallet)
    COALESCE((
        SELECT SUM(p.amount)
        FROM payments p
        WHERE p.client_id = c.id
    ), 0) AS total_invoiced,

    -- Total ad spend (DZD) from transactions ledger
    COALESCE((
        SELECT SUM(t.amount_dzd)
        FROM transactions t
        WHERE t.client_id = c.id
          AND t.type IN ('ad_spend', 'overdue_deduction')
    ), 0) AS total_spent,

    -- Net wallet balance
    COALESCE((
        SELECT SUM(v.amount_dzd)
        FROM client_versements v
        WHERE v.client_id = c.id
    ), 0)
    - COALESCE((
        SELECT SUM(p.amount)
        FROM payments p
        WHERE p.client_id = c.id
    ), 0)
    - COALESCE((
        SELECT SUM(t.amount_dzd)
        FROM transactions t
        WHERE t.client_id = c.id
          AND t.type IN ('ad_spend', 'overdue_deduction')
    ), 0) AS balance_dzd

FROM clients c;

-- ── 4. Update the wallet_balance column on existing clients ──────
--    So legacy code reading wallet_balance stays consistent.
UPDATE clients c
SET wallet_balance = (
    SELECT COALESCE(SUM(v.amount_dzd), 0)
    FROM client_versements v
    WHERE v.client_id = c.id
) - (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.client_id = c.id
);
