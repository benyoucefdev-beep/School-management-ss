const cron = require('node-cron');
const pool = require('../db');
const { createNotification } = require('../services/notifications');

function startSupplierCron() {
  // Run daily at 08:00 AM server time
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Running daily supplier job');
    const db = await pool.connect();
    
    try {
      await db.query('BEGIN');
      const today = new Date().toISOString().split('T')[0];

      // 1. Scheduled versements due today
      const { rows: todaysVersements } = await db.query(`
        SELECT v.id, v.amount, v.currency, s.name as supplier_name, s.id as supplier_id 
        FROM supplier_versements v
        JOIN suppliers s ON s.id = v.supplier_id
        WHERE v.status = 'scheduled' AND v.scheduled_date = $1
      `, [today]);

      for (const v of todaysVersements) {
        // Find internal owners
        const { rows: owners } = await db.query("SELECT id FROM users WHERE role = 'owner'");
        for (const owner of owners) {
          await createNotification(owner.id, 'system_alert', `Payment of ${parseFloat(v.amount).toFixed(2)} ${v.currency} due today to ${v.supplier_name}.`);
        }
      }

      // 2. Scheduled versements missed (past date, still scheduled)
      const { rows: missedVersements } = await db.query(`
        UPDATE supplier_versements 
        SET status = 'missed' 
        WHERE status = 'scheduled' AND scheduled_date < $1 
        RETURNING *
      `, [today]);

      for (const v of missedVersements) {
        const { rows: [{ name: supplier_name }] } = await db.query(`SELECT name FROM suppliers WHERE id = $1`, [v.supplier_id]);
        const { rows: owners } = await db.query("SELECT id FROM users WHERE role = 'owner'");
        for (const owner of owners) {
          await createNotification(owner.id, 'task_overdue', `Scheduled payment of ${parseFloat(v.amount).toFixed(2)} ${v.currency} to ${supplier_name} was missed.`);
        }
      }

      // 3. Subscription renewal reminder (7 days away)
      const in7Days = new Date();
      in7Days.setDate(in7Days.getDate() + 7);
      const in7DaysStr = in7Days.toISOString().split('T')[0];

      const { rows: renewingSubs } = await db.query(`
        SELECT sub.supplier_id, sub.tool_name, s.name as supplier_name
        FROM supplier_subscriptions sub
        JOIN suppliers s ON s.id = sub.supplier_id
        WHERE sub.is_active = TRUE AND sub.next_billing_date = $1
      `, [in7DaysStr]);

      for (const sub of renewingSubs) {
        // notify internal owners
        const { rows: owners } = await db.query("SELECT id FROM users WHERE role = 'owner'");
        for (const owner of owners) {
          await createNotification(owner.id, 'system_alert', `${sub.tool_name} from ${sub.supplier_name} renews in 7 days.`);
        }
      }

      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      console.error('[cron] Supplier daily job error:', err);
    } finally {
      db.release();
    }
  });
}

module.exports = { startSupplierCron };
