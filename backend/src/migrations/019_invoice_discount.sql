-- Migration to add discount_pct to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) DEFAULT 0;
