-- 016_fix_quotation_deletes.sql
-- Change foreign keys referencing quotations to ON DELETE SET NULL to allow deleting quotes without crashing DB

BEGIN;

-- 1. Invoices table
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_quotation_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_quotation_id_fkey 
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;

-- 2. Lead proposals table (if exists)
ALTER TABLE lead_proposals DROP CONSTRAINT IF EXISTS lead_proposals_quotation_id_fkey;
ALTER TABLE lead_proposals ADD CONSTRAINT lead_proposals_quotation_id_fkey 
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;

COMMIT;
