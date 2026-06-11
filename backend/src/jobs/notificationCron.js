// School-edition notificationCron — checks overdue invoices and absent fee payments
const cron = require('node-cron');
const pool = require('../db');

async function runDailyNotificationCheck() {
  console.log('[CRON] Running daily school notification check...');
  try {
    // Mark overdue invoices
    await pool.query(`
      UPDATE invoices SET status = 'overdue'
      WHERE status = 'sent'
        AND due_date < CURRENT_DATE
        AND (
          SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = invoices.id
        ) < invoices.total
    `);

    // Mark overdue subject_payments
    await pool.query(`
      UPDATE subject_payments SET status = 'overdue'
      WHERE status = 'pending' AND due_date < CURRENT_DATE
    `);

    console.log('[CRON] Daily school notification check complete');
  } catch (err) {
    console.error('[CRON] Daily notification error:', err.message);
  }
}

function startDailyNotificationCron() {
  cron.schedule('0 8 * * *', runDailyNotificationCheck);
  console.log('[CRON] Daily notification cron scheduled (08:00 daily).');
}

module.exports = { startDailyNotificationCron, runDailyNotificationCheck };
