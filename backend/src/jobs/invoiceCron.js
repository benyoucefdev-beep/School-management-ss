const cron = require('node-cron');
const pool = require('../db');

/**
 * Daily cron job: auto-update invoice statuses
 * Runs at midnight every day
 * - sent + past due + not fully paid → overdue
 */
function startInvoiceCron() {
  // Run every day at 00:05 AM
  cron.schedule('5 0 * * *', async () => {
    console.log('[CRON] Running invoice status update...');
    try {
      const result = await pool.query(`
        UPDATE invoices i
        SET status = 'overdue'
        WHERE i.status = 'sent'
          AND i.due_date < CURRENT_DATE
          AND (
            SELECT COALESCE(SUM(p.amount), 0)
            FROM payments p WHERE p.invoice_id = i.id
          ) < (
            SELECT COALESCE(SUM(li.total), 0)
            FROM invoice_line_items li WHERE li.invoice_id = i.id
          )
        RETURNING id, invoice_number
      `);

      if (result.rows.length > 0) {
        console.log(`[CRON] Marked ${result.rows.length} invoice(s) as overdue:`,
          result.rows.map(r => r.invoice_number).join(', '));
      } else {
        console.log('[CRON] No invoices to update.');
      }
    } catch (err) {
      console.error('[CRON] Invoice update error:', err.message);
    }
  });

  console.log('[CRON] Invoice status update job scheduled (daily at 00:05)');
}

module.exports = { startInvoiceCron };
