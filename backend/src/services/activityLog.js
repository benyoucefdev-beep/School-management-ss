const pool = require('../db');

/**
 * Logs a significant action to the activity_log table.
 */
async function logActivity({ studentId, userId, actionType, description, dbClient }) {
  const db = dbClient || pool;
  try {
    await db.query(
      `INSERT INTO activity_log (student_id, user_id, action_type, description) VALUES ($1, $2, $3, $4)`,
      [studentId || null, userId || null, actionType, description]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
