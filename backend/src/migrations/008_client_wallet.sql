-- Migration 008: Add wallet balance to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(14,2) DEFAULT 0.00;
