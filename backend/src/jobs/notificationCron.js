const cron = require('node-cron');
const pool = require('../db');
const { createNotification, notifyAllOwners } = require('../services/notifications');
const { computeUsersTaskStatus } = require('../services/taskStatus');

/**
 * Daily cron at 08:00 — check tasks due tomorrow and notify assignees.
 */
async function runDailyNotificationCheck() {
  console.log('[CRON] Running daily notification check...');
  try {
    // Tasks due tomorrow
    const { rows: dueTomorrow } = await pool.query(
      `SELECT t.id, t.title, t.assignee_id, c.company_name
         FROM tasks t
         LEFT JOIN clients c ON c.id = t.client_id
         WHERE t.deadline = CURRENT_DATE + INTERVAL '1 day'
           AND t.status NOT IN ('done')
           AND t.assignee_id IS NOT NULL`
    );
    for (const task of dueTomorrow) {
      await createNotification({
        userId: task.assignee_id,
        type: 'task_due_tomorrow',
        message: `Task "${task.title}" for ${task.company_name} is due tomorrow!`,
        relatedId: task.id,
      });
    }
    if (dueTomorrow.length > 0)
      console.log(`[CRON] Sent ${dueTomorrow.length} task due-tomorrow notification(s)`);

    // Mark overdue invoices and notify owners
    const { rows: overdueInvoices } = await pool.query(
      `UPDATE invoices i
       SET status = 'overdue'
       WHERE i.status = 'sent'
         AND i.due_date < CURRENT_DATE
         AND (
           SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id
         ) < (
           SELECT COALESCE(SUM(li.total), 0) FROM invoice_line_items li WHERE li.invoice_id = i.id
         )
       RETURNING id, invoice_number, client_id`
    );
    for (const inv of overdueInvoices) {
      const { rows: [client] } = await pool.query(
        `SELECT company_name FROM clients WHERE id = $1`, [inv.client_id]
      );
      await notifyAllOwners({
        type: 'invoice_overdue',
        message: `Invoice ${inv.invoice_number} for ${client?.company_name || 'unknown client'} is now overdue.`,
        relatedId: inv.id,
      });
    }

    // Ads budget alerts (70% & 90%)
    const { rows: adsBudgets } = await pool.query(
      `SELECT ab.id, ab.client_id, ab.platform, ab.allocated_budget,
         COALESCE(SUM(sl.amount), 0) AS total_spent
       FROM ads_budgets ab
       LEFT JOIN ads_spend_logs sl ON sl.client_id = ab.client_id AND sl.platform = ab.platform
       GROUP BY ab.id, ab.client_id, ab.platform, ab.allocated_budget`
    );
    for (const budget of adsBudgets) {
      const pct = parseFloat(budget.total_spent) / parseFloat(budget.allocated_budget);
      if (pct >= 0.70) {
        const { rows: [client] } = await pool.query(
          `SELECT company_name FROM clients WHERE id = $1`, [budget.client_id]
        );
        const level = pct >= 0.90 ? '90%' : '70%';
        await notifyAllOwners({
          type: 'ads_budget_alert',
          message: `${client?.company_name} ${budget.platform} budget is at ${Math.round(pct * 100)}% consumed (${level} threshold reached).`,
          relatedId: budget.id,
        });
      }
    }

    // Ads ending today or tomorrow
    const { rows: endingAds } = await pool.query(
      `SELECT sl.id, sl.platform, sl.end_date, c.company_name,
              CASE WHEN sl.end_date = CURRENT_DATE THEN 'today' ELSE 'tomorrow' END as when_ends
       FROM ads_spend_logs sl
       JOIN clients c ON c.id = sl.client_id
       WHERE sl.end_date = CURRENT_DATE OR sl.end_date = CURRENT_DATE + INTERVAL '1 day'`
    );
    for (const ad of endingAds) {
      const { rows: existing } = await pool.query(
        `SELECT id FROM notifications WHERE related_id = $1 AND type = $2 AND DATE(created_at) = CURRENT_DATE`,
        [ad.id, 'ad_campaign_ending']
      );
      if (existing.length === 0) {
        const dateStr = ad.end_date instanceof Date ? ad.end_date.toISOString().split('T')[0] : ad.end_date;
        await notifyAllOwners({
          type: 'ad_campaign_ending',
          message: `📢 Ad Reminder: ${ad.company_name} campaign on ${ad.platform} ends ${ad.when_ends} (${dateStr}).`,
          relatedId: ad.id,
        });
      }
    }

    console.log('[CRON] Daily notification check complete');
  } catch (err) {
    console.error('[CRON] Daily notification check error:', err.message);
  }
}

/**
 * Hourly task-status refresh — recomputes every team member's task status so that
 * tasks becoming active during the day are automatically reflected.
 */
async function runHourlyTaskStatusRefresh() {
  console.log('[CRON] Running hourly task-status refresh...');
  try {
    const { rows: users } = await pool.query(
      `SELECT id FROM users WHERE role NOT IN ('client', 'supplier')`
    );
    const userIds = users.map(u => u.id);
    if (userIds.length > 0) {
      await computeUsersTaskStatus(userIds);
    }
    console.log(`[CRON] Task-status refresh complete for ${userIds.length} team member(s).`);
  } catch (err) {
    console.error('[CRON] Hourly task-status refresh error:', err.message);
  }
}

function startDailyNotificationCron() {
  // Run every day at 08:00
  cron.schedule('0 8 * * *', runDailyNotificationCheck);
  console.log('[CRON] Daily notification check scheduled (08:00 daily).');

  // Refresh all team task statuses every hour so they stay current
  cron.schedule('0 * * * *', runHourlyTaskStatusRefresh);
  console.log('[CRON] Hourly task-status refresh scheduled.');
}

module.exports = { startDailyNotificationCron, runDailyNotificationCheck, runHourlyTaskStatusRefresh };
