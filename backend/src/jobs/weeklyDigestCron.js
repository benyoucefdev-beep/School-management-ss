const cron = require('node-cron');
const pool = require('../db');
const nodemailer = require('nodemailer');

/**
 * Build the weekly digest content JSON.
 */
async function buildDigestContent() {
  // 1. Tasks due this week (grouped by client)
  const { rows: tasksDueThisWeek } = await pool.query(
    `SELECT t.id, t.title, t.deadline, t.status,
       u.name AS assignee_name,
       c.id AS client_id, c.company_name
     FROM tasks t
     LEFT JOIN clients c ON c.id = t.client_id
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE t.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       AND t.status NOT IN ('done')
     ORDER BY c.company_name, t.deadline`
  );

  // Group by client
  const tasksByClient = {};
  for (const task of tasksDueThisWeek) {
    const key = task.company_name || 'Unknown Client';
    if (!tasksByClient[key]) tasksByClient[key] = [];
    tasksByClient[key].push(task);
  }

  // 2. Unpaid / overdue invoices
  const { rows: overdueInvoices } = await pool.query(
    `SELECT i.id, i.invoice_number, i.due_date, i.status,
       c.company_name,
       COALESCE(SUM(li.total), 0) AS invoice_total,
       COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
     WHERE i.status IN ('sent', 'overdue')
     GROUP BY i.id, c.company_name
     HAVING COALESCE(SUM(li.total), 0) > COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0)
     ORDER BY i.due_date`
  );

  const overdueWithDays = overdueInvoices.map(inv => ({
    ...inv,
    days_overdue: Math.max(0, Math.floor((Date.now() - new Date(inv.due_date)) / 86400000)),
    outstanding: parseFloat(inv.invoice_total) - parseFloat(inv.paid_amount),
  }));

  // 3. Ad budgets at 70%+
  const { rows: adsBudgets } = await pool.query(
    `SELECT ab.platform, ab.allocated_budget, c.company_name,
       COALESCE(SUM(sl.amount), 0) AS total_spent
     FROM ads_budgets ab
     LEFT JOIN clients c ON c.id = ab.client_id
     LEFT JOIN ads_spend_logs sl ON sl.client_id = ab.client_id AND sl.platform = ab.platform
     GROUP BY ab.id, c.company_name
     HAVING ab.allocated_budget > 0`
  );
  const adsAlerts = adsBudgets
    .map(b => ({ ...b, pct: Math.round((parseFloat(b.total_spent) / parseFloat(b.allocated_budget)) * 100) }))
    .filter(b => b.pct >= 70)
    .sort((a, b) => b.pct - a.pct);

  // 4. Team workload
  const { rows: workload } = await pool.query(
    `SELECT u.name, COUNT(t.id) FILTER (WHERE t.status NOT IN ('done')) AS open_tasks
     FROM users u
     LEFT JOIN tasks t ON t.assignee_id = u.id
     GROUP BY u.id, u.name
     ORDER BY open_tasks DESC`
  );

  return {
    generated_at: new Date().toISOString(),
    tasks_due_this_week: tasksByClient,
    overdue_invoices: overdueWithDays,
    ads_budget_alerts: adsAlerts,
    team_workload: workload,
  };
}

/**
 * Build the HTML email body.
 */
function buildEmailHtml(content) {
  const { tasks_due_this_week, overdue_invoices, ads_budget_alerts, team_workload, generated_at } = content;

  const tasksHtml = Object.entries(tasks_due_this_week).map(([client, tasks]) => `
    <h4 style="margin:8px 0 4px;color:#6366f1;">${client}</h4>
    <ul style="margin:0;padding-left:16px;">
      ${tasks.map(t => `<li>${t.title} — due ${t.deadline} (${t.assignee_name || 'unassigned'})</li>`).join('')}
    </ul>
  `).join('') || '<p style="color:#999;">No tasks due this week.</p>';

  const invoicesHtml = overdue_invoices.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:#f3f4f6;"><th style="padding:6px;text-align:left;">Client</th><th style="padding:6px;text-align:left;">Invoice</th><th style="padding:6px;text-align:right;">Outstanding</th><th style="padding:6px;text-align:right;">Days Overdue</th></tr>
      ${overdue_invoices.map(i => `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;">${i.company_name}</td>
          <td style="padding:6px;">${i.invoice_number}</td>
          <td style="padding:6px;text-align:right;">$${parseFloat(i.outstanding).toFixed(2)}</td>
          <td style="padding:6px;text-align:right;color:${i.days_overdue > 0 ? '#ef4444' : '#22c55e'};">${i.days_overdue}</td>
        </tr>`).join('')}
    </table>
  ` : '<p style="color:#999;">No overdue invoices.</p>';

  const adsHtml = ads_budget_alerts.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:#f3f4f6;"><th style="padding:6px;text-align:left;">Client</th><th style="padding:6px;text-align:left;">Platform</th><th style="padding:6px;text-align:right;">% Used</th></tr>
      ${ads_budget_alerts.map(a => `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;">${a.company_name}</td>
          <td style="padding:6px;">${a.platform}</td>
          <td style="padding:6px;text-align:right;color:${a.pct >= 90 ? '#ef4444' : '#f59e0b'};">${a.pct}%</td>
        </tr>`).join('')}
    </table>
  ` : '<p style="color:#999;">No budget alerts this week.</p>';

  const workloadHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:#f3f4f6;"><th style="padding:6px;text-align:left;">Team Member</th><th style="padding:6px;text-align:right;">Open Tasks</th></tr>
      ${team_workload.map(m => `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:6px;">${m.name}</td>
          <td style="padding:6px;text-align:right;">${m.open_tasks}</td>
        </tr>`).join('')}
    </table>
  `;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="font-family:Inter,Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#1f2937;">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;border-radius:12px;text-align:center;margin-bottom:24px;">
    <h1 style="color:white;margin:0;font-size:24px;">Axialogy Weekly Digest</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">Generated ${new Date(generated_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <div style="margin-bottom:24px;">
    <h2 style="font-size:16px;border-bottom:2px solid #6366f1;padding-bottom:8px;">📋 Tasks Due This Week</h2>
    ${tasksHtml}
  </div>

  <div style="margin-bottom:24px;">
    <h2 style="font-size:16px;border-bottom:2px solid #ef4444;padding-bottom:8px;">💰 Unpaid / Overdue Invoices</h2>
    ${invoicesHtml}
  </div>

  <div style="margin-bottom:24px;">
    <h2 style="font-size:16px;border-bottom:2px solid #f59e0b;padding-bottom:8px;">📢 Ads Budget Alerts (70%+)</h2>
    ${adsHtml}
  </div>

  <div style="margin-bottom:24px;">
    <h2 style="font-size:16px;border-bottom:2px solid #22c55e;padding-bottom:8px;">👥 Team Workload</h2>
    ${workloadHtml}
  </div>

  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:32px;">Axialogy Internal Platform — Confidential</p>
</body></html>`;
}

/**
 * Run the weekly digest: compile, store, and email.
 */
async function runWeeklyDigest() {
  console.log('[CRON] Running weekly digest...');
  let content;
  try {
    content = await buildDigestContent();
  } catch (err) {
    console.error('[CRON] Failed to build digest content:', err.message);
    return;
  }

  // Get all owners to deliver to
  const { rows: owners } = await pool.query(`SELECT * FROM users WHERE role = 'admin'`);

  // Store in DB for each owner
  for (const owner of owners) {
    try {
      await pool.query(
        `INSERT INTO weekly_digest_log (delivered_to, content) VALUES ($1, $2)`,
        [owner.id, JSON.stringify(content)]
      );
    } catch (err) {
      console.error('[CRON] Failed to store digest log:', err.message);
    }
  }

  // Send email to owners (Phase 4)
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DIGEST_FROM_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('[CRON] SMTP not configured — skipping email delivery');
  } else {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587', 10),
      secure: parseInt(SMTP_PORT || '587', 10) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const html = buildEmailHtml(content);

    for (const owner of owners) {
      try {
        await transporter.sendMail({
          from: DIGEST_FROM_EMAIL || SMTP_USER,
          to: owner.email,
          subject: `Axialogy Weekly Digest — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
          html,
        });
        console.log(`[CRON] Digest email sent to ${owner.email}`);
      } catch (err) {
        // Do NOT crash the cron — log and continue
        console.error(`[CRON] Failed to send digest email to ${owner.email}:`, err.message);
      }
    }
  }

  console.log('[CRON] Weekly digest complete');
}

function startWeeklyDigestCron() {
  // Run every Monday at 08:00
  cron.schedule('0 8 * * 1', runWeeklyDigest);
  console.log('[CRON] Weekly digest scheduled (Monday 08:00)');
}

module.exports = { startWeeklyDigestCron, runWeeklyDigest, buildDigestContent };
