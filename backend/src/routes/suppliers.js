const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete } = require('../middleware/rbac');
const crypto = require('crypto');
const QRCode = require('qrcode');

router.use(authenticate);

// Utility: get or create QR (used when returning full supplier record)
// SUPPLIER_PORTAL_URL resolution order:
// 1. SUPPLIER_PWA_URL env var (explicit supplier PWA domain)
// 2. VERCEL_PROJECT_PRODUCTION_URL (auto-injected by Vercel)
// 3. FRONTEND_URL
// 4. Hard fallback
const SUPPLIER_PORTAL_URL = process.env.SUPPLIER_PWA_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
  || process.env.FRONTEND_URL
  || 'https://axialogy.vercel.app';

// ── GET /api/suppliers ──────────────────────────────────────────
router.get('/', canView('suppliers'), async (req, res) => {
  const { type, is_active, client_id } = req.query;
  try {
    const params = [];
    const conditions = [];

    if (type) { params.push(type); conditions.push(`st.name = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); conditions.push(`s.is_active = $${params.length}`); }
    if (client_id) {
      params.push(client_id);
      conditions.push(`EXISTS (SELECT 1 FROM supplier_client_links scl WHERE scl.supplier_id = s.id AND scl.client_id = $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT 
        s.id, s.name, s.country, s.currency, s.is_active,
        st.name AS type_name,
        COALESCE((SELECT SUM(total_amount) FROM supplier_transactions WHERE supplier_id = s.id AND status != 'cancelled'), 0) AS total_owed,
        COALESCE((
          SELECT SUM(sv.amount) FROM supplier_versements sv 
          JOIN supplier_transactions st ON st.id = sv.transaction_id 
          WHERE sv.supplier_id = s.id AND sv.status = 'paid' AND st.status != 'cancelled'
        ), 0) AS total_paid
      FROM suppliers s
      LEFT JOIN supplier_types st ON st.id = s.supplier_type_id
      ${where}
      ORDER BY s.created_at DESC
    `, params);
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/suppliers/pending-debts ── for P&L Dettes section ──
router.get('/pending-debts', canView('suppliers'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        st.id, st.total_amount, st.currency, st.amount_in_usd, st.due_date,
        st.notes, st.status, st.created_at,
        s.name AS supplier_name,
        st.total_amount - COALESCE((
          SELECT SUM(sv.amount) FROM supplier_versements sv
          WHERE sv.transaction_id = st.id AND sv.status = 'paid'
        ), 0) AS amount_remaining
      FROM supplier_transactions st
      JOIN suppliers s ON s.id = st.supplier_id
      WHERE st.status IN ('pending', 'partial', 'overdue')
      ORDER BY st.due_date ASC NULLS LAST, st.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── GET /api/suppliers/:id ──────────────────────────────────────
router.get('/:id', canView('suppliers'), async (req, res) => {
  try {
    const { rows: [supplier] } = await pool.query(`
      SELECT s.*, st.name AS type_name, st.description AS type_description
      FROM suppliers s
      LEFT JOIN supplier_types st ON st.id = s.supplier_type_id
      WHERE s.id = $1
    `, [req.params.id]);

    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    // Linked clients
    const { rows: linked_clients } = await pool.query(`
      SELECT c.id, c.company_name, scl.project_description
      FROM supplier_client_links scl
      JOIN clients c ON c.id = scl.client_id
      WHERE scl.supplier_id = $1
    `, [req.params.id]);

    // Summary logic
    const { rows: txs } = await pool.query(`SELECT status, total_amount, amount_in_usd FROM supplier_transactions WHERE supplier_id = $1 AND status != 'cancelled'`, [supplier.id]);
    const { rows: vs } = await pool.query(`
      SELECT sv.status, sv.amount, sv.amount_in_usd 
      FROM supplier_versements sv
      JOIN supplier_transactions st ON st.id = sv.transaction_id
      WHERE sv.supplier_id = $1 AND st.status != 'cancelled'
    `, [supplier.id]);

    const total_owed = txs.reduce((sum, tx) => sum + parseFloat(tx.total_amount), 0);
    const total_owed_usd = txs.reduce((sum, tx) => sum + parseFloat(tx.amount_in_usd || 0), 0);
    const total_paid = vs.filter(v => v.status === 'paid').reduce((sum, v) => sum + parseFloat(v.amount), 0);
    const balance = total_owed - total_paid;

    res.json({
      ...supplier,
      linked_clients,
      summary: { total_owed, total_owed_usd, total_paid, balance }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/suppliers ──────────────────────────────────────────
router.post('/', canCreate('suppliers'), async (req, res) => {
  const { name, type_name, contact_name, contact_email, contact_phone, country, address, website, tax_number, currency, payment_terms, notes, linked_client_ids } = req.body;
  if (!name || !type_name) return res.status(400).json({ error: 'name and type_name are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get type ID
    const { rows: [type] } = await client.query('SELECT id FROM supplier_types WHERE name = $1', [type_name]);
    if (!type) throw new Error('Invalid supplier type');

    const { rows: [supplier] } = await client.query(`
      INSERT INTO suppliers (name, supplier_type_id, contact_name, contact_email, contact_phone, country, address, website, tax_number, currency, payment_terms, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [name, type.id, contact_name, contact_email, contact_phone, country, address, website, tax_number, currency || 'EUR', payment_terms, notes]);

    if (linked_client_ids && Array.isArray(linked_client_ids)) {
      for (const clientId of linked_client_ids) {
        await client.query(`INSERT INTO supplier_client_links (supplier_id, client_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [supplier.id, clientId]);
      }
    }

    // Auto generate QR Token
    const token = crypto.randomBytes(48).toString('hex');
    await client.query('INSERT INTO supplier_access_tokens (supplier_id, token) VALUES ($1, $2)', [supplier.id, token]);
    const magic_link_url = `${SUPPLIER_PORTAL_URL}/supplier/access?token=${token}`;
    const qr_image_base64 = await QRCode.toDataURL(magic_link_url, { width: 300, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });

    await client.query('COMMIT');
    res.status(201).json({ ...supplier, qr: { qr_image_base64, magic_link_url, token } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/suppliers/:id ──────────────────────────────────────
router.put('/:id', canEdit('suppliers'), async (req, res) => {
  const { name, contact_name, contact_email, contact_phone, country, address, website, tax_number, currency, payment_terms, notes, is_active } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE suppliers
      SET name = COALESCE($1, name),
          contact_name = COALESCE($2, contact_name),
          contact_email = COALESCE($3, contact_email),
          contact_phone = COALESCE($4, contact_phone),
          country = COALESCE($5, country),
          address = COALESCE($6, address),
          website = COALESCE($7, website),
          tax_number = COALESCE($8, tax_number),
          currency = COALESCE($9, currency),
          payment_terms = COALESCE($10, payment_terms),
          notes = COALESCE($11, notes),
          is_active = COALESCE($12, is_active),
          updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `, [name, contact_name, contact_email, contact_phone, country, address, website, tax_number, currency, payment_terms, notes, is_active, req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Supplier not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/suppliers/:id ───────────────────────────────────
router.delete('/:id', canDelete('suppliers'), async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const id = req.params.id;

    // Clean up all related records first
    await db.query('DELETE FROM supplier_access_tokens WHERE supplier_id = $1', [id]);
    await db.query('DELETE FROM supplier_client_links WHERE supplier_id = $1', [id]);
    await db.query('DELETE FROM supplier_documents WHERE supplier_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM supplier_orders WHERE supplier_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM supplier_subscriptions WHERE supplier_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM supplier_versements WHERE supplier_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM supplier_transactions WHERE supplier_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM suppliers WHERE id = $1', [id]);

    await db.query('COMMIT');
    res.json({ success: true, deleted: true });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

module.exports = router;
