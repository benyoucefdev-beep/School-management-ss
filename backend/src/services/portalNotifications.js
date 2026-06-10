const pool = require('../db');

/**
 * Creates a portal notification for a client.
 * type: 'invoice_received' | 'quote_received' | 'task_updated'
 */
async function createPortalNotification({ clientId, type, title, message }) {
  try {
    await pool.query(
      `INSERT INTO portal_notifications (client_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [clientId, type, title, message]
    );
  } catch (err) {
    // Non-fatal
    console.error('[PortalNotification] Failed to create:', err.message);
  }
}

module.exports = { createPortalNotification };
