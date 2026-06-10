const pool = require('../db');

/**
 * Creates a portal notification for a supplier.
 * type: 'transaction_recorded' | 'payment_received' | 'debt_logged'
 */
async function createSupplierPortalNotification({ supplierId, type, title, message }) {
  try {
    await pool.query(
      `INSERT INTO supplier_portal_notifications (supplier_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [supplierId, type, title, message]
    );
  } catch (err) {
    // Non-fatal — never crash the main request
    console.error('[SupplierPortalNotification] Failed to create:', err.message);
  }
}

module.exports = { createSupplierPortalNotification };
