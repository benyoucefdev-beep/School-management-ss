// School-edition portalNotifications — uses student_notifications table
const pool = require('../db');

async function createPortalNotification({ studentId, type, title, message }) {
  if (!studentId) return;
  try {
    await pool.query(
      `INSERT INTO student_notifications (student_id, type, title, body) VALUES ($1, $2, $3, $4)`,
      [studentId, type, title, message]
    );
  } catch (err) {
    console.error('[PortalNotification]', err.message);
  }
}

module.exports = { createPortalNotification };
