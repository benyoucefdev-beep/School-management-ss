const router = require('express').Router();
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { runWeeklyDigest } = require('../jobs/weeklyDigestCron');

// GET /api/digest/weekly-cron — Triggered by Vercel Cron
router.get('/weekly-cron', async (req, res) => {
  // Optional: check for Vercel Cron Secret (x-vercel-cron-auth)
  // if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).end();
  // }
  
  await runWeeklyDigest();
  res.json({ message: 'Weekly digest generation complete' });
});

router.use(authenticate, authorize('admin'));

// GET /api/digest/latest — return the most recently generated digest
router.get('/latest', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM weekly_digest_log ORDER BY generated_at DESC LIMIT 1`
    );
    if (!rows[0]) return res.status(404).json({ error: 'No digest generated yet' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
