-- ============================================================
-- Migration 026: Backfill portal_visible for sent documents
-- Any invoice or quotation already in 'sent' (or beyond) status
-- should be visible in the client portal immediately.
-- ============================================================

-- Invoices: sent, paid, overdue → all should be portal-visible
UPDATE invoices
SET portal_visible = TRUE
WHERE status IN ('sent', 'paid', 'overdue')
  AND portal_visible = FALSE;

-- Quotations: sent, accepted → should be portal-visible
UPDATE quotations
SET portal_visible = TRUE
WHERE status IN ('sent', 'accepted')
  AND portal_visible = FALSE;
