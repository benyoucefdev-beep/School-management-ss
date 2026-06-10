const router = require('express').Router();
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/exchange-rates/latest
router.get('/latest', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT rate, effective_date 
      FROM exchange_rates 
      WHERE from_currency = 'EUR' AND to_currency = 'USD' 
        AND effective_date <= CURRENT_DATE
      ORDER BY effective_date DESC 
      LIMIT 1
    `);
    
    if (rows.length > 0) {
      res.json({ EUR_USD: Number(rows[0].rate), effective_date: rows[0].effective_date });
    } else {
      res.json({ EUR_USD: null, effective_date: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exchange-rates/history
router.get('/history', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT er.*, u.name as set_by_name
      FROM exchange_rates er
      LEFT JOIN users u ON er.set_by = u.id
      ORDER BY effective_date DESC, created_at DESC
      LIMIT 30
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exchange-rates
router.post('/', authorize('admin'), async (req, res) => {
  const { from_currency, to_currency, rate, effective_date } = req.body;
  if (!from_currency || !to_currency || !rate) {
    return res.status(400).json({ error: 'from_currency, to_currency, and rate are required' });
  }
  
  try {
    const { rows } = await pool.query(`
      INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, set_by)
      VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5)
      RETURNING *
    `, [from_currency, to_currency, rate, effective_date, req.user.id]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
