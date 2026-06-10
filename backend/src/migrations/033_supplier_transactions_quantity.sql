-- Migration 033: Add quantity column to supplier_transactions
ALTER TABLE supplier_transactions
  ADD COLUMN IF NOT EXISTS quantity INTEGER;
