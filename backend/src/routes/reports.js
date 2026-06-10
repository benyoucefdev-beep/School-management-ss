const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, isAdmin } = require('../middleware/rbac');
const PDFDocument = require('pdfkit');
const { createWriteStream } = require('fs');

router.use(authenticate);

// Helper: build date filter clause
function dateFilter(column, from, to, params) {
  const cond = [];
  if (from) { params.push(from); cond.push(`${column} >= $${params.length}`); }
  if (to)   { params.push(to);   cond.push(`${column} <= $${params.length}`); }
  return cond.length ? cond.join(' AND ') : null;
}

// ── Revenue ────────────────────────────────────────────────────
router.get('/revenue', canView('reports'), async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const df = dateFilter('p.payment_date', from, to, params);
  try {
    // Total received
    const { rows: [totals] } = await pool.query(
      `SELECT COALESCE(SUM(p.amount),0) AS total_received
         FROM payments p
         ${df ? `WHERE ${df}` : ''}`,
      params
    );

    // Total invoiced (by issue date)
    const params2 = [];
    const df2 = dateFilter('i.issue_date', from, to, params2);
    const { rows: [inv] } = await pool.query(
      `SELECT COALESCE(SUM(li.total),0) AS total_invoiced
         FROM invoice_line_items li
         JOIN invoices i ON i.id = li.invoice_id
         ${df2 ? `WHERE ${df2}` : ''}`,
      params2
    );

    // By client
    const params3 = [];
    const df3 = dateFilter('p.payment_date', from, to, params3);
    const { rows: byClient } = await pool.query(
      `SELECT c.id, c.company_name, SUM(p.amount) AS received
         FROM payments p
         JOIN clients c ON c.id = p.client_id
         ${df3 ? `WHERE ${df3}` : ''}
         GROUP BY c.id ORDER BY received DESC`,
      params3
    );

    // By service type
    const params4 = [];
    const df4 = dateFilter('p.payment_date', from, to, params4);
    const { rows: byService } = await pool.query(
      `SELECT t.service_type, SUM(p.amount) AS received
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         JOIN tasks t ON t.client_id = i.client_id
         ${df4 ? `WHERE ${df4}` : ''}
         GROUP BY t.service_type ORDER BY received DESC`,
      params4
    );

    // Monthly trend
    const params5 = [];
    const df5 = dateFilter('p.payment_date', from, to, params5);
    const { rows: monthly } = await pool.query(
      `SELECT TO_CHAR(payment_date, 'YYYY-MM') AS month, SUM(amount) AS received
         FROM payments p
         ${df5 ? `WHERE ${df5}` : ''}
         GROUP BY month ORDER BY month`,
      params5
    );

    res.json({ total_invoiced: inv.total_invoiced, total_received: totals.total_received, by_client: byClient, by_service: byService, monthly });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Expenses ───────────────────────────────────────────────────
router.get('/expenses', canView('reports'), async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const df = dateFilter('ve.expense_date', from, to, params);
  try {
    // Fixed expenses (always included — convert to monthly)
    const { rows: fixed } = await pool.query(
      `SELECT name, amount, frequency, category FROM fixed_expenses ORDER BY name`
    );
    const totalFixed = fixed.reduce((sum, f) => {
      const monthly = f.frequency === 'monthly' ? f.amount : f.frequency === 'quarterly' ? f.amount / 3 : f.amount / 12;
      return sum + parseFloat(monthly);
    }, 0);

    // Variable expenses
    const { rows: variable } = await pool.query(
      `SELECT ve.*, c.company_name AS client_name
         FROM variable_expenses ve
         LEFT JOIN clients c ON c.id = ve.client_id
         ${df ? `WHERE ${df}` : ''}
         ORDER BY ve.expense_date DESC`,
      params
    );
    const totalVariable = variable.reduce((sum, v) => sum + parseFloat(v.amount), 0);

    // Monthly trend of variable expenses
    const params2 = [];
    const df2 = dateFilter('expense_date', from, to, params2);
    const { rows: monthly } = await pool.query(
      `SELECT TO_CHAR(expense_date, 'YYYY-MM') AS month, SUM(amount) AS total
         FROM variable_expenses
         ${df2 ? `WHERE ${df2}` : ''}
         GROUP BY month ORDER BY month`,
      params2
    );

    res.json({ fixed_expenses: fixed, total_fixed_monthly: totalFixed, variable_expenses: variable, total_variable: totalVariable, monthly_trend: monthly });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Ads Spend ──────────────────────────────────────────────────
router.get('/ads-spend', canView('reports'), async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const df = dateFilter('sl.spend_date', from, to, params);
  try {
    const { rows } = await pool.query(
      `SELECT ab.client_id, c.company_name, ab.platform,
         ab.allocated_budget,
         COALESCE(SUM(sl.amount) FILTER (${df ? `WHERE ${df}` : 'WHERE TRUE'}), 0) AS spent,
         ab.allocated_budget - COALESCE(SUM(sl.amount) FILTER (${df ? `WHERE ${df}` : 'WHERE TRUE'}), 0) AS remaining,
         ab.currency
       FROM ads_budgets ab
       LEFT JOIN clients c ON c.id = ab.client_id
       LEFT JOIN ads_spend_logs sl ON sl.client_id = ab.client_id AND sl.platform = ab.platform
       GROUP BY ab.client_id, c.company_name, ab.platform, ab.allocated_budget, ab.currency
       ORDER BY c.company_name, ab.platform`,
      params
    );

    const withPct = rows.map(r => ({
      ...r,
      spent_pct: Math.round((parseFloat(r.spent) / parseFloat(r.allocated_budget)) * 100),
    }));

    // Monthly trend
    const params2 = [];
    const df2 = dateFilter('spend_date', from, to, params2);
    const { rows: monthly } = await pool.query(
      `SELECT TO_CHAR(spend_date, 'YYYY-MM') AS month, SUM(amount) AS total
         FROM ads_spend_logs
         ${df2 ? `WHERE ${df2}` : ''}
         GROUP BY month ORDER BY month`,
      params2
    );

    res.json({ by_client_platform: withPct, monthly });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client Profitability (owner only) ─────────────────────────
router.get('/client-profitability', canView('reports'), async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const df = dateFilter('p.payment_date', from, to, params);
  try {
    const { rows: revenues } = await pool.query(
      `SELECT p.client_id, c.company_name, SUM(p.amount) AS total_received
         FROM payments p
         JOIN clients c ON c.id = p.client_id
         ${df ? `WHERE ${df}` : ''}
         GROUP BY p.client_id, c.company_name`,
      params
    );

    const params2 = [];
    const df2 = dateFilter('ve.expense_date', from, to, params2);
    const { rows: costs } = await pool.query(
      `SELECT ve.client_id, SUM(ve.amount) AS total_cost
         FROM variable_expenses ve
         WHERE ve.linked_to_client = TRUE
         ${df2 ? `AND ${df2}` : ''}
         GROUP BY ve.client_id`,
      params2
    );

    const costMap = Object.fromEntries(costs.map(c => [c.client_id, parseFloat(c.total_cost)]));
    const result = revenues.map(r => ({
      client_id: r.client_id,
      company_name: r.company_name,
      total_received: parseFloat(r.total_received),
      total_costs: costMap[r.client_id] || 0,
      gross_profit: parseFloat(r.total_received) - (costMap[r.client_id] || 0),
    })).sort((a, b) => b.gross_profit - a.gross_profit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Team Performance ───────────────────────────────────────────
router.get('/team-performance', canView('reports'), async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const conds = ['t.status = \'done\''];
  if (from) { params.push(from); conds.push(`t.updated_at >= $${params.length}`); }
  if (to)   { params.push(to);   conds.push(`t.updated_at <= $${params.length}`); }
  const where = `WHERE ${conds.join(' AND ')}`;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role,
         COUNT(t.id) AS tasks_closed,
         AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 86400) AS avg_days_to_complete,
         AVG(CASE WHEN t.deadline IS NOT NULL THEN EXTRACT(EPOCH FROM (t.deadline::timestamptz - t.created_at)) / 86400 END) AS avg_days_deadline
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id ${where}
       GROUP BY u.id, u.name, u.role
       ORDER BY tasks_closed DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Export ─────────────────────────────────────────────────────
router.get('/export', canView('reports'), async (req, res) => {
  const { type, format: fmt, from, to } = req.query;

  // Re-use the data from the appropriate endpoint
  const params = { from, to };
  try {
    let data;
    let filename = `axialogy-${type}-report`;

    // Fetch the data by calling the correct DB queries (simplified inline)
    switch (type) {
      case 'revenue': {
        const p = [];
        const df = dateFilter('p.payment_date', from, to, p);
        const { rows } = await pool.query(
          `SELECT c.company_name, SUM(p.amount) AS received
             FROM payments p JOIN clients c ON c.id = p.client_id
             ${df ? `WHERE ${df}` : ''}
             GROUP BY c.company_name ORDER BY received DESC`, p
        );
        data = rows;
        break;
      }
      case 'expenses': {
        const p = [];
        const df = dateFilter('ve.expense_date', from, to, p);
        const { rows } = await pool.query(
          `SELECT name, amount, category, expense_date FROM variable_expenses ve
             ${df ? `WHERE ${df}` : ''} ORDER BY expense_date DESC`, p
        );
        data = rows;
        break;
      }
      case 'ads-spend': {
        const p = [];
        const df = dateFilter('sl.spend_date', from, to, p);
        const { rows } = await pool.query(
          `SELECT c.company_name, ab.platform, ab.allocated_budget,
             COALESCE(SUM(sl.amount),0) AS spent
             FROM ads_budgets ab LEFT JOIN clients c ON c.id = ab.client_id
             LEFT JOIN ads_spend_logs sl ON sl.client_id=ab.client_id AND sl.platform=ab.platform
             GROUP BY c.company_name, ab.platform, ab.allocated_budget ORDER BY c.company_name`, p
        );
        data = rows;
        break;
      }
      case 'client-profitability': {
        const p = [];
        const df = dateFilter('p.payment_date', from, to, p);
        const { rows } = await pool.query(
          `SELECT c.company_name, SUM(p.amount) AS revenue
             FROM payments p JOIN clients c ON c.id = p.client_id
             ${df ? `WHERE ${df}` : ''} GROUP BY c.company_name ORDER BY revenue DESC`, p
        );
        data = rows;
        break;
      }
      case 'team-performance': {
        const p = [];
        const conds = ["t.status = 'done'"];
        if (from) { p.push(from); conds.push(`t.updated_at >= $${p.length}`); }
        if (to)   { p.push(to);   conds.push(`t.updated_at <= $${p.length}`); }
        const { rows } = await pool.query(
          `SELECT u.name, COUNT(t.id) AS tasks_closed,
             AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 86400) AS avg_days
             FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id WHERE ${conds.join(' AND ')}
             GROUP BY u.name ORDER BY tasks_closed DESC`, p
        );
        data = rows;
        break;
      }
      default:
        return res.status(400).json({ error: 'Unknown report type' });
    }

    if (fmt === 'csv') {
      if (!data || data.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send('No data available');
      }
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    if (fmt === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      const doc = new PDFDocument({ margin: 40 });
      doc.pipe(res);
      doc.fontSize(20).font('Helvetica-Bold').text(`Axialogy — ${type.replace(/-/g, ' ').toUpperCase()} Report`, { align: 'center' });
      doc.moveDown();
      if (from || to) doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Period: ${from || 'start'} – ${to || 'now'}`, { align: 'center' });
      doc.moveDown();

      if (data && data.length > 0) {
        const headers = Object.keys(data[0]);
        const colW = Math.floor((doc.page.width - 80) / headers.length);
        // Header row
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
        headers.forEach((h, i) => doc.text(h.replace(/_/g, ' ').toUpperCase(), 40 + i * colW, doc.y, { width: colW, lineBreak: false }));
        doc.moveDown();
        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
        doc.moveDown(0.5);
        // Data rows
        doc.fontSize(8).font('Helvetica').fillColor('#333');
        data.forEach(row => {
          const y = doc.y;
          headers.forEach((h, i) => {
            const val = row[h] != null ? String(parseFloat(row[h]) === parseFloat(row[h]) && typeof row[h] !== 'string' ? parseFloat(row[h]).toFixed(2) : row[h]) : '';
            doc.text(val, 40 + i * colW, y, { width: colW, lineBreak: false });
          });
          doc.moveDown();
        });
      } else {
        doc.fontSize(12).fillColor('#999').text('No data available for the selected period.');
      }

      doc.end();
      return;
    }

    res.status(400).json({ error: 'format must be pdf or csv' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Ads Wallet Report (admin only) ─────────────────────────────
router.get('/ads-wallet', canView('reports'), async (req, res) => {
  try {
    const { rows: byClient } = await pool.query(`
      SELECT c.company_name AS client_name,
        w.total_deposited_dzd,
        w.total_spent_dzd,
        w.total_spent_usd,
        w.balance_dzd AS current_balance_dzd,
        COUNT(DISTINCT ac.id) AS number_of_campaigns,
        COUNT(DISTINCT se.id) AS number_of_spend_entries
      FROM client_ads_wallets w
      LEFT JOIN clients c ON c.id = w.client_id
      LEFT JOIN ad_campaigns ac ON ac.client_id = w.client_id
      LEFT JOIN ad_spend_entries se ON se.client_id = w.client_id
      GROUP BY c.company_name, w.total_deposited_dzd, w.total_spent_dzd,
               w.total_spent_usd, w.balance_dzd
      ORDER BY w.total_spent_dzd DESC
    `);

    const { rows: platforms } = await pool.query(`
      SELECT platform,
        COALESCE(SUM(amount_usd),0) AS total_spent_usd,
        COALESCE(SUM(amount_dzd),0) AS total_spent_dzd,
        COUNT(DISTINCT campaign_id) AS campaign_count
      FROM ad_spend_entries
      GROUP BY platform
    `);

    const { rows: rateHistory } = await pool.query(`
      SELECT r.*, u.name AS set_by_name
      FROM dzd_usd_rates r
      LEFT JOIN users u ON u.id = r.set_by
      ORDER BY r.effective_date DESC
      LIMIT 12
    `);

    res.json({ by_client: byClient, platform_breakdown: platforms, rate_history: rateHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

