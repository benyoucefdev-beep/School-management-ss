-- ============================================================
-- Axialogy Migration 015 — Allow DZD Currency in Supplier Tables
-- ============================================================

ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_currency_check;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_currency_check CHECK (currency IN ('EUR', 'USD', 'DZD'));

ALTER TABLE supplier_subscriptions DROP CONSTRAINT IF EXISTS supplier_subscriptions_currency_check;
ALTER TABLE supplier_subscriptions ADD CONSTRAINT supplier_subscriptions_currency_check CHECK (currency IN ('EUR', 'USD', 'DZD'));

ALTER TABLE supplier_orders DROP CONSTRAINT IF EXISTS supplier_orders_currency_check;
ALTER TABLE supplier_orders ADD CONSTRAINT supplier_orders_currency_check CHECK (currency IN ('EUR', 'USD', 'DZD'));

ALTER TABLE supplier_transactions DROP CONSTRAINT IF EXISTS supplier_transactions_currency_check;
ALTER TABLE supplier_transactions ADD CONSTRAINT supplier_transactions_currency_check CHECK (currency IN ('EUR', 'USD', 'DZD'));

ALTER TABLE supplier_versements DROP CONSTRAINT IF EXISTS supplier_versements_currency_check;
ALTER TABLE supplier_versements ADD CONSTRAINT supplier_versements_currency_check CHECK (currency IN ('EUR', 'USD', 'DZD'));

