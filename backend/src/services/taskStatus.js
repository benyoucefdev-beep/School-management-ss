// backend/src/services/taskStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// Task-based status engine.
//
// A team member can be "working" on multiple tasks at once by toggling the
// working button on each task they are assigned to. Status is derived from
// which tasks have the user's ID in their active_worker_ids[] array.
//
// States:
//   1. "Working on \"Task A\", \"Task B\""  — user has active_worker_ids entries
//   2. "Available"                           — no tasks claimed
//
// next_task_info — closest-deadline incomplete assigned task NOT yet claimed,
// only shown when the member is fully Available.
// ─────────────────────────────────────────────────────────────────────────────

const pool = require('../db');
const { notifyAllOwners } = require('./notifications');

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Build a human-readable status label from a list of active task titles.
 *   1 task  → Working on "glow and grow branding"
 *   2 tasks → Working on "glow and grow branding", "Axialogy website"
 *   3+ tasks → Working on "Task A", "Task B" +1 more
 */
function buildWorkingLabel(titles) {
  if (!titles || titles.length === 0) return 'Available';
  const MAX_SHOWN = 2;
  const shown = titles.slice(0, MAX_SHOWN).map(t => `"${t}"`).join(', ');
  const extra = titles.length - MAX_SHOWN;
  return extra > 0
    ? `Working on ${shown} +${extra} more`
    : `Working on ${shown}`;
}

/**
 * Recomputes a single user's task_status and next_task_info.
 */
async function computeUserTaskStatus(userId) {
  try {
    const { rows: [user] } = await pool.query(
      'SELECT id, name, task_status, next_task_info FROM users WHERE id = $1',
      [userId]
    );
    if (!user) return;

    // Tasks the user has claimed as "working on"
    const { rows: activeTasks } = await pool.query(
      `SELECT id, title
       FROM tasks
       WHERE $1 = ANY(active_worker_ids)
         AND status NOT IN ('completed', 'done')
       ORDER BY deadline ASC NULLS LAST, created_at ASC`,
      [userId]
    );

    // Next upcoming task: assigned but not yet claimed, for "Available" display
    const { rows: upcomingTasks } = await pool.query(
      `SELECT id, title, start_date, deadline
       FROM tasks
       WHERE $1 = ANY(assignee_ids)
         AND status NOT IN ('completed', 'done')
         AND NOT ($1 = ANY(active_worker_ids))
       ORDER BY deadline ASC NULLS LAST, start_date ASC NULLS FIRST, created_at ASC
       LIMIT 1`,
      [userId]
    );

    const newTaskStatus = buildWorkingLabel(activeTasks.map(t => t.title));

    let newNextTaskInfo = null;
    if (activeTasks.length === 0 && upcomingTasks.length > 0) {
      // Only show "Next:" when member is fully available
      const next = upcomingTasks[0];
      const dateStr = next.deadline
        ? formatDate(next.deadline)
        : next.start_date ? `starting ${formatDate(next.start_date)}` : '';
      newNextTaskInfo = `Next: "${next.title}"${dateStr ? ` — due ${dateStr}` : ''}`;
    }

    // Write + notify only on actual change
    if (newTaskStatus !== user.task_status || newNextTaskInfo !== user.next_task_info) {
      await pool.query(
        'UPDATE users SET task_status = $1, next_task_info = $2 WHERE id = $3',
        [newTaskStatus, newNextTaskInfo, userId]
      );

      const msg = newNextTaskInfo
        ? `${user.name}: ${newTaskStatus} (${newNextTaskInfo})`
        : `${user.name}: ${newTaskStatus}`;

      await notifyAllOwners({
        type: 'status_changed',
        message: msg,
        relatedId: null,
      });

      console.log(`[TaskStatus] ${user.name}: ${newTaskStatus} | ${newNextTaskInfo}`);
    }
  } catch (err) {
    console.error('[TaskStatus] Failed to compute status for user', userId, ':', err.message);
  }
}

/**
 * Recomputes task status for multiple users in parallel.
 */
async function computeUsersTaskStatus(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  await Promise.all(userIds.map(id => computeUserTaskStatus(id)));
}

module.exports = { computeUserTaskStatus, computeUsersTaskStatus };
