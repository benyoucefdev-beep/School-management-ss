const pool = require('../db');

/**
 * Logs a significant action to the activity_log table.
 */
async function logActivity({ clientId, userId, actionType, description, dbClient }) {
  const db = dbClient || pool;
  try {
    await db.query(
      `INSERT INTO activity_log (client_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [clientId || null, userId || null, actionType, description]
    );
  } catch (err) {
    // Non-fatal: log but don't throw
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
