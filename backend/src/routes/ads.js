const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canDelete, isAdmin } = require('../middleware/rbac');
const { logActivity } = require('../services/activityLog');

router.use(authenticate);

// GET /api/ads/client/:clientId — spend logs for a client
router.get('/client/:clientId', canView('ads'), async (req, res) => {
  try {
    const { rows: spendLogs } = await pool.query(`
      SELECT sl.*, u.name AS logged_by_name
      FROM ads_spend_logs sl
      LEFT JOIN users u ON u.id = sl.logged_by
      WHERE sl.client_id = $1
      ORDER BY sl.spend_date DESC
    `, [req.params.clientId]);

    const { rows: [totals] } = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_usd,
        COALESCE(SUM(amount_dzd), 0) AS total_dzd
      FROM ads_spend_logs WHERE client_id = $1
    `, [req.params.clientId]);

    res.json({ spend_logs: spendLogs, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ads/spend — log ad spend (USD → auto-convert to DZD, deduct wallet)
router.post('/spend', canCreate('ads'), async (req, res) => {
  const { client_id, platform, amount, spend_date, end_date, notes } = req.body;
  if (!client_id || !platform || !amount || !spend_date)
    return res.status(400).json({ error: 'client_id, platform, amount, spend_date required' });

  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    // Get current DZD/USD rate
    const { rows: [rateRow] } = await db.query(
      'SELECT rate FROM dzd_usd_rates ORDER BY effective_date DESC, created_at DESC LIMIT 1'
    );
    const currentRate = rateRow ? parseFloat(rateRow.rate) : 1;
    const amountUsd = parseFloat(amount);
    const amountDzd = amountUsd * currentRate;

    const { rows: [log] } = await db.query(`
      INSERT INTO ads_spend_logs (client_id, platform, amount, amount_dzd, spend_date, end_date, logged_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [client_id, platform, amountUsd, amountDzd, spend_date, end_date || null, req.user.id, notes || null]);

    // Deduct from client wallet
    await db.query(
      'UPDATE clients SET wallet_balance = COALESCE(wallet_balance, 0) - $1 WHERE id = $2',
      [amountDzd, client_id]
    );

    // Record in transactions ledger (best-effort)
    await db.query(`
      INSERT INTO transactions (type, amount, currency, exchange_rate, amount_dzd, client_id, user_id, reference_id, description, transaction_date)
      VALUES ('ad_spend', $1, 'USD', $2, $3, $4, $5, $6, $7, $8)
    `, [amountUsd, currentRate, amountDzd, client_id, req.user.id, log.id,
        `Ad spend on ${platform}`, spend_date]).catch(() => {});

    await db.query('COMMIT');

    await logActivity({
      clientId: client_id,
      userId: req.user.id,
      actionType: 'ad_spend_logged',
      description: `Ad spend ${Math.round(amountDzd).toLocaleString()} DZD on ${platform}${end_date ? ` — ends ${end_date}` : ''}`,

    });

    res.status(201).json({ ...log, rate_used: currentRate, amount_dzd: amountDzd });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// PUT /api/ads/spend/:id — edit a spend log and adjust wallet by the difference
router.put('/spend/:id', isAdmin(), async (req, res) => {
  const { platform, amount, spend_date, end_date, notes } = req.body;
  if (!platform || !amount || !spend_date)
    return res.status(400).json({ error: 'platform, amount, spend_date required' });

  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    // Fetch existing log
    const { rows: [existing] } = await db.query('SELECT * FROM ads_spend_logs WHERE id = $1', [req.params.id]);
    if (!existing) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    // Get current exchange rate
    const { rows: [rateRow] } = await db.query(
      'SELECT rate FROM dzd_usd_rates ORDER BY effective_date DESC, created_at DESC LIMIT 1'
    );
    const currentRate = rateRow ? parseFloat(rateRow.rate) : 1;
    const newAmountUsd = parseFloat(amount);
    const newAmountDzd = newAmountUsd * currentRate;
    const oldAmountDzd = parseFloat(existing.amount_dzd || existing.amount || 0);

    // Update the log
    const { rows: [updated] } = await db.query(`
      UPDATE ads_spend_logs
      SET platform = $1, amount = $2, amount_dzd = $3, spend_date = $4, end_date = $5, notes = $6
      WHERE id = $7 RETURNING *
    `, [platform, newAmountUsd, newAmountDzd, spend_date, end_date || null, notes || null, req.params.id]);

    // Adjust client wallet: reverse old deduction, apply new deduction (net diff)
    const diff = oldAmountDzd - newAmountDzd; // positive = refund, negative = extra deduction
    await db.query(
      'UPDATE clients SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
      [diff, existing.client_id]
    );

    await db.query('COMMIT');

    await logActivity({
      clientId: existing.client_id,
      userId: req.user.id,
      actionType: 'ad_spend_edited',
      description: `Ad spend updated: ${Math.round(newAmountDzd).toLocaleString()} DZD on ${platform}${end_date ? ` — ends ${end_date}` : ''} (wallet adjusted by ${diff >= 0 ? '+' : ''}${Math.round(Math.abs(diff)).toLocaleString()} DZD)`,

    });

    res.json({ ...updated, rate_used: currentRate });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// DELETE /api/ads/spend/:id — delete and refund wallet
router.delete('/spend/:id', canDelete('ads'), async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows: [log] } = await db.query('SELECT * FROM ads_spend_logs WHERE id = $1', [req.params.id]);
    if (!log) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    await db.query('DELETE FROM ads_spend_logs WHERE id = $1', [req.params.id]);

    const refund = parseFloat(log.amount_dzd || 0) || parseFloat(log.amount || 0);
    if (refund > 0) {
      await db.query('UPDATE clients SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2', [refund, log.client_id]);
    }

    await db.query('COMMIT');
    res.json({ message: 'Spend deleted, wallet refunded', refund_dzd: refund });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.release();
  }
});

// POST /api/ads/rate — Update global exchange rate
router.post('/rate', isAdmin(), async (req, res) => {
  const { rate, effective_date, notes } = req.body;
  if (!rate || parseFloat(rate) <= 0)
    return res.status(400).json({ error: 'rate must be > 0' });

  try {
    const { rows: [row] } = await pool.query(`
      INSERT INTO dzd_usd_rates (rate, set_by, effective_date, notes)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [parseFloat(rate), req.user.id, effective_date || new Date().toISOString().split('T')[0], notes || null]);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ads/rate/history — Rate history
router.get('/rate/history', canView('ads'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, u.name AS set_by_name
      FROM dzd_usd_rates r
      LEFT JOIN users u ON u.id = r.set_by
      ORDER BY r.effective_date DESC, r.created_at DESC
      LIMIT 30
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ads/rate/current — Current active rate
router.get('/rate/current', canView('ads'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, u.name AS set_by_name
      FROM dzd_usd_rates r
      LEFT JOIN users u ON u.id = r.set_by
      ORDER BY r.effective_date DESC, r.created_at DESC
      LIMIT 1
    `);
    if (!rows[0]) return res.json(null);
    const rate = rows[0];
    const days = Math.floor((Date.now() - new Date(rate.effective_date)) / 86400000);
    res.json({ ...rate, days_since_update: days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ads/summary — Global ads/wallet summary
router.get('/summary', canView('ads'), async (req, res) => {
  try {
    // Current rate
    const { rows: [rate] } = await pool.query('SELECT * FROM dzd_usd_rates ORDER BY effective_date DESC, created_at DESC LIMIT 1');
    const currentRate = rate ? parseFloat(rate.rate) : 1;
    const days = rate ? Math.floor((Date.now() - new Date(rate.effective_date)) / 86400000) : 0;

    // Monthly spend
    const { rows: [monthly] } = await pool.query(`
      SELECT
        COALESCE(SUM(amount), 0) AS month_spent_usd,
        COALESCE(SUM(amount_dzd), 0) AS month_spent_dzd
      FROM ads_spend_logs
      WHERE date_trunc('month', spend_date) = date_trunc('month', CURRENT_DATE)
    `);

    // Total wallet balances from clients
    const { rows: [walletTotals] } = await pool.query(`
      SELECT COALESCE(SUM(wallet_balance), 0) AS total_balance_dzd
      FROM clients
    `);

    res.json({
      total_balance_dzd: walletTotals.total_balance_dzd,
      month_spent_usd: monthly.month_spent_usd,
      month_spent_dzd: monthly.month_spent_dzd,
      current_rate: currentRate,
      rate_date: rate?.effective_date,
      rate_days_old: days,
      rate_stale: days >= 7,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ads/wallets — Clients with digital_marketing tasks only
router.get('/wallets', canView('ads'), async (req, res) => {
  try {
    const { rows: [rate] } = await pool.query('SELECT rate FROM dzd_usd_rates ORDER BY effective_date DESC, created_at DESC LIMIT 1');
    const currentRate = rate ? parseFloat(rate.rate) : 1;

    const { rows } = await pool.query(`
      SELECT 
        c.id AS client_id,
        c.company_name AS client_name,
        COALESCE(c.wallet_balance, 0) AS balance_dzd,
        COALESCE(SUM(sl.amount), 0) AS total_spent_usd,
        COALESCE(SUM(sl.amount_dzd), 0) AS total_spent_dzd,
        (
          EXISTS(SELECT 1 FROM tasks t WHERE t.client_id = c.id AND t.service_type = 'digital_marketing')
          OR COALESCE(c.wallet_balance, 0) > 0
          OR COUNT(sl.id) > 0
        ) as has_ads
      FROM clients c
      LEFT JOIN ads_spend_logs sl ON sl.client_id = c.id
      GROUP BY c.id, c.company_name, c.wallet_balance
      ORDER BY COALESCE(c.wallet_balance, 0) ASC
    `);

    const result = rows.map(w => {
      const bal = parseFloat(w.balance_dzd);
      let alert = 'ok';
      if (bal <= 0) alert = 'empty';
      else if (bal < 50000) alert = 'critical'; // under 50k DZD
      else if (bal < 100000) alert = 'low';

      return {
        ...w,
        balance_usd_equivalent: bal / currentRate,
        alert_status: alert
      };
    });

    res.json({ wallets: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
