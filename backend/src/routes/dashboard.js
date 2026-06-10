const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { calculateClientHealth } = require('../services/healthScore');

router.use(authenticate); // All authenticated roles can see dashboard

// GET /api/dashboard — summary cards
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    // Task filters — admins see all, specialists see their own
    const taskWhere = isAdmin
      ? `status NOT IN ('done', 'completed')`
      : `assignee_id = '${userId}' AND status NOT IN ('done', 'completed')`;

    const [
      overdueInvoices,
      tasksDueToday,
      tasksDueSoon,
      recentActivity,
      revenueThisMonth,
      activeClients,
      expensesThisMonth,
      adsSpendThisMonth,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM invoices WHERE status = 'overdue'`),

      pool.query(`SELECT COUNT(*) FROM tasks WHERE deadline = $1 AND ${taskWhere}`, [today]),

      pool.query(`SELECT COUNT(*) FROM tasks
        WHERE deadline BETWEEN $1 AND ($1::date + interval '7 days')
        AND ${taskWhere}`, [today]),

      pool.query(`
        SELECT al.*, u.name AS user_name, c.company_name AS client_name
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        LEFT JOIN clients c ON c.id = al.client_id
        ORDER BY al.created_at DESC LIMIT 12
      `),

      pool.query(`
        SELECT COALESCE(SUM(amount_dzd), 0) AS total FROM transactions
        WHERE type = 'invoice_payment' AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
      `),

      pool.query(`SELECT COUNT(*) FROM clients`),

      pool.query(`
        SELECT COALESCE(SUM(amount_dzd), 0) AS total FROM transactions
        WHERE type IN ('manual_expense', 'supplier_payment') AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
      `),

      pool.query(`
        SELECT COALESCE(SUM(amount_dzd), 0) AS total FROM transactions
        WHERE type = 'ad_spend' AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
      `),
    ]);

    // Top 5 clients by health score (admin only — expensive)
    let clientsWithHealth = [];
    if (isAdmin) {
      const { rows: clients } = await pool.query(
        `SELECT id, company_name FROM clients ORDER BY created_at DESC LIMIT 5`
      );
      clientsWithHealth = await Promise.all(
        clients.map(async (c) => ({
          ...c,
          health_score: await calculateClientHealth(c.id),
        }))
      );
    }

    const revenue = parseFloat(revenueThisMonth.rows[0].total);
    const expenses = parseFloat(expensesThisMonth.rows[0].total);
    const adsSpend = parseFloat(adsSpendThisMonth.rows[0].total);

    res.json({
      stats: {
        overdue_invoices:  parseInt(overdueInvoices.rows[0].count),
        tasks_due_today:   parseInt(tasksDueToday.rows[0].count),
        tasks_due_soon:    parseInt(tasksDueSoon.rows[0].count),
        revenue_this_month: revenue,
        expenses_this_month: expenses,
        ads_spend_this_month: adsSpend,
        net_profit_this_month: revenue - expenses - adsSpend,
        active_clients:    parseInt(activeClients.rows[0].count),
      },
      recent_activity: recentActivity.rows,
      clients_health: clientsWithHealth,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

