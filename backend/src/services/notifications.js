const pool = require('../db');
const { sendPushNotification } = require('../utils/pushNotifications');

/**
 * Insert a notification for a user.
 */
async function createNotification({ userId, type, message, relatedId = null }) {
  const TITLE_MAP = {
    task_assigned:        '📋 New Task Assigned',
    task_status_changed:  '🔄 Task Status Updated',
    task_due_tomorrow:    '⏰ Task Due Tomorrow',
    invoice_overdue:      '💸 Invoice Overdue',
    ads_budget_alert:     '📢 Ads Budget Alert',
    ad_campaign_ended:    '🎉 Campaign Ended',
    status_changed:       '👤 Team Status Update',
  };

  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, related_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, type, message, relatedId]
    );

    // Also send PWA push notification
    await sendPushNotification(userId, {
      title: TITLE_MAP[type] || '🔔 Axialogy',
      body: message,
      url: relatedId ? `/tasks` : '/',
    });
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err.message);
  }
}

/**
 * Notify all owners about a given event.
 */
async function notifyAllOwners({ type, message, relatedId = null }) {
  try {
    const { rows: owners } = await pool.query(
      `SELECT id FROM users WHERE role = 'admin'`
    );
    for (const owner of owners) {
      await createNotification({ userId: owner.id, type, message, relatedId });
    }
  } catch (err) {
    console.error('[Notifications] Failed to notify owners:', err.message);
  }
}

module.exports = { createNotification, notifyAllOwners };
