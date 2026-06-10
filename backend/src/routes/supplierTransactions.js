const express = require('express');
const router = express.Router({ mergeParams: true }); // Allows /api/suppliers/:id/transactions
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../services/notifications');
const { createSupplierPortalNotification } = require('../services/supplierPortalNotifications');

router.use(authenticate);

async function getUsdAmount(currency, amount, date) {
  if (currency === 'USD') return { amount_in_usd: amount, exchange_rate_used: 1.0 };
  const d = date || new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    `SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = 'USD' AND effective_date <= $2 ORDER BY effective_date DESC LIMIT 1`,
    [currency, d]
  );
  if (!rows[0]) return { amount_in_usd: null, exchange_rate_used: null };
  return { amount_in_usd: amount * Number(rows[0].rate), exchange_rate_used: rows[0].rate };
}

async function updateTransactionStatus(db, txId) {
  const { rows: vs } = await db.query('SELECT SUM(amount) as total_paid FROM supplier_versements WHERE transaction_id = $1 AND status = $2', [txId, 'paid']);
  const { rows: [tx] } = await db.query('SELECT total_amount, status, due_date FROM supplier_transactions WHERE id = $1', [txId]);
  
  if (!tx) return;
  const paid = parseFloat(vs[0].total_paid || 0);
  const total = parseFloat(tx.total_amount);
  
  let newStatus = tx.status;
  if (paid >= total) newStatus = 'paid';
  else if (paid > 0) newStatus = 'partial';
  else if (tx.due_date && new Date(tx.due_date) < new Date()) newStatus = 'overdue';
  else newStatus = 'pending';

  if (newStatus !== tx.status) {
    await db.query('UPDATE supplier_transactions SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, txId]);
  }
}

// ── GET /api/suppliers/:id/transactions ────────────────────────
router.get('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { rows: txs } = await pool.query(`
      SELECT st.*, c.company_name AS client_name 
      FROM supplier_transactions st
      LEFT JOIN clients c ON c.id = st.client_id
      WHERE st.supplier_id = $1 ORDER BY st.created_at DESC
    `, [req.params.id]);

    const { rows: versements } = await pool.query(`
      SELECT * FROM supplier_versements WHERE supplier_id = $1 ORDER BY payment_date DESC, scheduled_date DESC
    `, [req.params.id]);

    const mapped = txs.map(tx => {
      const vs = versements.filter(v => v.transaction_id === tx.id);
      const paid = vs.filter(v => v.status === 'paid').reduce((s, v) => s + parseFloat(v.amount), 0);
      return { ...tx, versements: vs, balance_remaining: parseFloat(tx.total_amount) - paid };
    });

    res.json(mapped);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/suppliers/pending-debts — for P&L dettes section ────
// NOTE: This route is registered at /api/suppliers/:id/transactions
// The global pending-debts endpoint lives in suppliers.js instead.

// ── POST /api/suppliers/:id/transactions ────────────────────────
// payment_intent: 'paid' | 'to_pay_later'
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const { payment_intent, total_amount, currency, payment_method, due_date, notes, client_id, quantity } = req.body;
  if (!payment_intent || !total_amount || !currency)
    return res.status(400).json({ error: 'payment_intent, total_amount, currency are required' });

  // Map payment_intent to internal transaction_type
  const transaction_type = payment_intent === 'paid' ? 'invoice_payment' : 'advance';
  const initialStatus    = payment_intent === 'paid' ? 'paid' : 'pending';

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { amount_in_usd, exchange_rate_used } = await getUsdAmount(currency, total_amount, due_date);

    const { rows: [tx] } = await db.query(`
      INSERT INTO supplier_transactions
        (supplier_id, client_id, transaction_type, total_amount, currency, amount_in_usd,
         exchange_rate_used, payment_method, status, due_date, notes, quantity, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [req.params.id, client_id||null, transaction_type, total_amount, currency,
        amount_in_usd, exchange_rate_used, payment_method||null, initialStatus,
        due_date||null, notes, quantity||null, req.user.id]);

    // If paid immediately → auto-create a paid versement
    if (payment_intent === 'paid') {
      await db.query(`
        INSERT INTO supplier_versements
          (transaction_id, supplier_id, amount, currency, amount_in_usd, exchange_rate_used,
           payment_method, payment_date, status, notes, logged_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,'paid',$8,$9)
      `, [tx.id, req.params.id, total_amount, currency, amount_in_usd, exchange_rate_used,
          payment_method||null, notes, req.user.id]);

      // Notify admins (correct object syntax)
      const { rows: admins } = await db.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        await createNotification({ userId: admin.id, type: 'system_alert',
          message: `Supplier payment of ${total_amount} ${currency} recorded as PAID.` });
      }

      // Notify supplier portal
      await createSupplierPortalNotification({
        supplierId: req.params.id,
        type: 'payment_received',
        title: '✅ Paiement enregistré',
        message: `Un paiement de ${parseFloat(total_amount).toLocaleString('fr-DZ')} ${currency} a été enregistré pour vous.`,
      });
    } else {
      // to_pay_later → remind admins
      const { rows: admins } = await db.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        await createNotification({ userId: admin.id, type: 'system_alert',
          message: `⚠ Supplier debt logged: ${total_amount} ${currency}${due_date ? ` — due ${due_date}` : ''}.` });
      }

      // Notify supplier portal
      await createSupplierPortalNotification({
        supplierId: req.params.id,
        type: 'debt_logged',
        title: '⏳ Transaction enregistrée',
        message: `Une transaction de ${parseFloat(total_amount).toLocaleString('fr-DZ')} ${currency} a été enregistrée — paiement à venir.`,
      });
    }

    await db.query('COMMIT');
    res.status(201).json(tx);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

// ── DELETE /api/suppliers/:id/transactions/:txId (Soft Delete) ──
router.delete('/:txId', authorize('admin', 'manager'), async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("UPDATE supplier_transactions SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [req.params.txId]);
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// ── VERSEMENTS CRUD ─────────────────────────────────────────────

router.get('/:txId/versements', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM supplier_versements WHERE transaction_id = $1 ORDER BY COALESCE(payment_date, scheduled_date) DESC', [req.params.txId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:txId/versements', authorize('admin', 'manager'), async (req, res) => {
  const { amount, currency, payment_method, payment_date, scheduled_date, status, notes } = req.body;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { amount_in_usd, exchange_rate_used } = await getUsdAmount(currency, amount, payment_date || scheduled_date);
    
    const { rows } = await db.query(`
      INSERT INTO supplier_versements (transaction_id, supplier_id, amount, currency, amount_in_usd, exchange_rate_used, payment_method, payment_date, scheduled_date, status, notes, logged_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `, [req.params.txId, req.params.id, amount, currency, amount_in_usd, exchange_rate_used, payment_method, payment_date || null, scheduled_date || null, status || 'paid', notes, req.user.id]);
    
    await updateTransactionStatus(db, req.params.txId);
    await db.query('COMMIT');

    if ((status || 'paid') === 'paid') {
      // Notify admins
      const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        await createNotification({ userId: admin.id, type: 'system_alert',
          message: `Supplier versement of ${amount} ${currency} marked as paid.` });
      }
      // Notify supplier portal
      await createSupplierPortalNotification({
        supplierId: req.params.id,
        type: 'payment_received',
        title: '✅ Versement confirmé',
        message: `Un versement de ${parseFloat(amount).toLocaleString('fr-DZ')} ${currency} a été enregistré comme payé.`,
      });
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

router.put('/:txId/versements/:vId', authorize('admin', 'manager'), async (req, res) => {
  const { status, payment_date, receipt_url, notes } = req.body;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    
    const { rows: [v] } = await db.query('SELECT * FROM supplier_versements WHERE id = $1', [req.params.vId]);
    const prevStatus = v.status;
    
    const { rows } = await db.query(`
      UPDATE supplier_versements SET status = COALESCE($1, status), payment_date = COALESCE($2, payment_date), receipt_url = COALESCE($3, receipt_url), notes = COALESCE($4, notes)
      WHERE id = $5 RETURNING *
    `, [status, payment_date, receipt_url, notes, req.params.vId]);
    
    await updateTransactionStatus(db, req.params.txId);
    await db.query('COMMIT');

    if (status === 'paid' && prevStatus !== 'paid') {
      // Notify admins
      const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        await createNotification({ userId: admin.id, type: 'system_alert',
          message: `Supplier versement of ${rows[0].amount} ${rows[0].currency} confirmed paid.` });
      }
      // Notify supplier portal that a scheduled payment was confirmed
      await createSupplierPortalNotification({
        supplierId: req.params.id,
        type: 'payment_received',
        title: '✅ Paiement confirmé',
        message: `Votre versement de ${parseFloat(rows[0].amount).toLocaleString('fr-DZ')} ${rows[0].currency} a été confirmé comme payé.`,
      });
    }

    res.json(rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { db.release(); }
});

module.exports = router;
