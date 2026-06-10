// backend/src/services/presence.js
// ─────────────────────────────────────────────────────────────────────────────
// Compatibility shim — routes old presence calls to the new taskStatus service.
// This prevents import errors in any file that still references presence.js.
// ─────────────────────────────────────────────────────────────────────────────

const { computeUserTaskStatus, computeUsersTaskStatus } = require('./taskStatus');

// Legacy aliases so existing imports keep working without mass-renaming
module.exports = {
  updateUserPresenceStatus: computeUserTaskStatus,
  updateUsersPresenceStatus: computeUsersTaskStatus,
  computeUserTaskStatus,
  computeUsersTaskStatus,
};
