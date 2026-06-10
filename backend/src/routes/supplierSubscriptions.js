const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, c.company_name AS client_name 
      FROM supplier_subscriptions s
      LEFT JOIN clients c ON c.id = s.client_id
      WHERE s.supplier_id = $1 
      ORDER BY s.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const { tool_name, amount, currency, frequency, next_billing_date, linked_to_client, client_id } = req.body;
  if (!tool_name || !amount || !frequency) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO supplier_subscriptions (supplier_id, tool_name, amount, currency, frequency, next_billing_date, linked_to_client, client_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [req.params.id, tool_name, amount, currency || 'USD', frequency, next_billing_date || null, linked_to_client || false, client_id || null]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:subId', authorize('admin', 'manager'), async (req, res) => {
  const { tool_name, amount, currency, frequency, next_billing_date, is_active, linked_to_client, client_id } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE supplier_subscriptions
      SET tool_name = COALESCE($1, tool_name), amount = COALESCE($2, amount), currency = COALESCE($3, currency), frequency = COALESCE($4, frequency), 
          next_billing_date = COALESCE($5, next_billing_date), is_active = COALESCE($6, is_active), linked_to_client = COALESCE($7, linked_to_client), client_id = COALESCE($8, client_id)
      WHERE id = $9 RETURNING *
    `, [tool_name, amount, currency, frequency, next_billing_date, is_active, linked_to_client, client_id, req.params.subId]);
    if (!rows[0]) return res.status(404).json({ error: 'Subscription not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:subId', authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM supplier_subscriptions WHERE id = $1', [req.params.subId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
