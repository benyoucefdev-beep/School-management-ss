const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
// Mocking supplier notification until implemented
const sendSupplierNotification = (id, type, data) => console.log(`[Mock] Supplier ${id} notification: ${type}`, data);

router.use(authenticate);

// ── GET /api/suppliers/:id/orders ───────────────────────────────
router.get('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*, c.company_name AS client_name
      FROM supplier_orders o
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.supplier_id = $1
      ORDER BY o.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/suppliers/:id/orders ──────────────────────────────
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const { client_id, description, quantity, unit, total_amount, currency, order_date, expected_delivery } = req.body;
  if (!description || !total_amount) return res.status(400).json({ error: 'Missing description or total_amount' });
  
  try {
    // Generate order_reference
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM supplier_orders');
    const order_reference = `S-ORD-${new Date().getFullYear()}-${String(parseInt(count) + 1).padStart(3, '0')}`;

    const { rows } = await pool.query(`
      INSERT INTO supplier_orders (supplier_id, client_id, order_reference, description, quantity, unit, total_amount, currency, order_date, expected_delivery)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [req.params.id, client_id || null, order_reference, description, quantity || null, unit || null, total_amount, currency || 'EUR', order_date || null, expected_delivery || null]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/suppliers/:id/orders/:orderId ──────────────────────
router.put('/:orderId', authorize('admin', 'manager'), async (req, res) => {
  const { status, actual_delivery, notes } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE supplier_orders
      SET status = COALESCE($1, status), actual_delivery = COALESCE($2, actual_delivery), notes = COALESCE($3, notes)
      WHERE id = $4 RETURNING *
    `, [status, actual_delivery, notes, req.params.orderId]);
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/suppliers/:id/orders/:orderId/status ─────────────
router.patch('/:orderId/status', authorize('admin', 'manager'), async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(`UPDATE supplier_orders SET status = $1 WHERE id = $2 RETURNING *`, [status, req.params.orderId]);
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });

    if (status === 'confirmed') sendSupplierNotification(req.params.id, 'order_confirmed', { description: rows[0].description });
    else sendSupplierNotification(req.params.id, 'order_status_changed', { description: rows[0].description, status });

    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
