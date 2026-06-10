const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { canView, canCreate, canEdit, canDelete, ROLE_SERVICE_TYPE, SPECIALIST_ROLES } = require('../middleware/rbac');
const { logActivity } = require('../services/activityLog');
const { createNotification } = require('../services/notifications');
const { createPortalNotification } = require('../services/portalNotifications');
const { updateUsersPresenceStatus } = require('../services/presence');
const { computeUserTaskStatus } = require('../services/taskStatus');

router.use(authenticate);

// ── Shared LATERAL JOIN fragment for assignees (active_worker_ids is in t.* via SELECT t.*) ──
const ASSIGNEE_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT json_agg(
      json_build_object('id', u.id, 'name', u.name, 'role', u.role, 'photo_url', u.photo_url)
      ORDER BY u.name
    ) AS assignees
    FROM users u
    WHERE u.id = ANY(t.assignee_ids)
  ) agg ON true
`;

// GET /api/tasks — full task list with filters
router.get('/', canView('tasks'), async (req, res) => {
  const { client_id, service_type, assignee_id, status } = req.query;
  try {
    const params = [];
    const conditions = [];

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      conditions.push(`$${params.length} = ANY(t.assignee_ids)`);
    } else {
      if (assignee_id) { params.push(assignee_id); conditions.push(`$${params.length} = ANY(t.assignee_ids)`); }
    }
    if (client_id)    { params.push(client_id);    conditions.push(`t.client_id = $${params.length}`); }
    if (service_type) { params.push(service_type); conditions.push(`t.service_type = $${params.length}`); }
    if (status)       { params.push(status);        conditions.push(`t.status = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Explicit column list avoids fetching unused large columns (SELECT t.* fetches everything)
    const { rows } = await pool.query(`
      SELECT
        t.id, t.client_id, t.title, t.description, t.service_type,
        t.assignee_ids, t.active_worker_ids,
        t.deadline, t.start_date, t.status, t.progress_pct,
        t.notes, t.needs_after, t.review_status,
        t.is_locked, t.created_at, t.updated_at,
        c.company_name AS client_name,
        agg.assignees
      FROM tasks t
      LEFT JOIN clients c ON c.id = t.client_id
      ${ASSIGNEE_LATERAL}
      ${where}
      ORDER BY t.deadline ASC NULLS LAST, t.created_at DESC
    `, params);

    // Allow browser to serve cached response for 15s before re-validating
    res.set('Cache-Control', 'private, max-age=15');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/tasks/my — tasks for current user by role specialty
router.get('/my', canView('tasks'), async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const serviceType = ROLE_SERVICE_TYPE[role];

    let query;
    let params;

    if (role === 'admin') {
      query = `
        SELECT t.*, c.company_name AS client_name, agg.assignees
        FROM tasks t
        LEFT JOIN clients c ON c.id = t.client_id
        ${ASSIGNEE_LATERAL}
        ORDER BY t.deadline ASC NULLS LAST, t.created_at DESC
      `;
      params = [];
    } else if (serviceType) {
      query = `
        SELECT t.*, c.company_name AS client_name, agg.assignees
        FROM tasks t
        LEFT JOIN clients c ON c.id = t.client_id
        ${ASSIGNEE_LATERAL}
        WHERE $1 = ANY(t.assignee_ids)
          AND t.service_type = $2
        ORDER BY t.deadline ASC NULLS LAST, t.created_at DESC
      `;
      params = [userId, serviceType];
    } else {
      query = `
        SELECT t.*, c.company_name AS client_name, agg.assignees
        FROM tasks t
        LEFT JOIN clients c ON c.id = t.client_id
        ${ASSIGNEE_LATERAL}
        WHERE $1 = ANY(t.assignee_ids)
        ORDER BY t.deadline ASC NULLS LAST, t.created_at DESC
      `;
      params = [userId];
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', canView('tasks'), async (req, res) => {
  try {
    // Run all three queries in parallel
    const [taskResult, timeLogsResult, attachmentsResult] = await Promise.all([
      pool.query(`
        SELECT t.*, c.company_name AS client_name, agg.assignees
        FROM tasks t
        LEFT JOIN clients c ON c.id = t.client_id
        ${ASSIGNEE_LATERAL}
        WHERE t.id = $1
      `, [req.params.id]),
      pool.query(`
        SELECT tl.*, u.name AS user_name FROM task_time_logs tl
        LEFT JOIN users u ON u.id = tl.user_id
        WHERE tl.task_id = $1 ORDER BY tl.logged_at DESC
      `, [req.params.id]),
      pool.query(
        'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY uploaded_at DESC',
        [req.params.id]
      ),
    ]);

    if (!taskResult.rows[0]) return res.status(404).json({ error: 'Task not found' });
    const task = taskResult.rows[0];

    // Specialist can only view tasks they have access to
    if (SPECIALIST_ROLES.includes(req.user.role)) {
      const serviceType = ROLE_SERVICE_TYPE[req.user.role];
      const allowed = (task.assignee_ids || []).includes(req.user.id) || task.service_type === serviceType;
      if (!allowed) return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ ...task, time_logs: timeLogsResult.rows, attachments: attachmentsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks (admin only)
router.post('/', canCreate('tasks'), async (req, res) => {
  const { client_id, title, description, service_type, assignee_ids, deadline, start_date, status, progress_pct, notes, needs_after } = req.body;
  if (!client_id || !title) return res.status(400).json({ error: 'client_id and title are required' });

  const parsedAssigneeIds = Array.isArray(assignee_ids) ? assignee_ids : [];

  try {
    const { rows } = await pool.query(`
      INSERT INTO tasks (client_id, title, description, service_type, assignee_ids, deadline, start_date, status, progress_pct, notes, needs_after)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [client_id, title, description || null, service_type || null, parsedAssigneeIds, deadline || null, start_date || null, status || 'not_started', progress_pct || 0, notes || null, needs_after || null]);

    // Log + notify in parallel
    const notifyOps = [
      logActivity({
        clientId: client_id,
        userId: req.user.id,
        actionType: 'task_created',
        description: `Task "${title}" created`,
      }),
      ...parsedAssigneeIds.map(aid =>
        createNotification({
          userId: aid,
          type: 'task_assigned',
          message: `You have been assigned to task "${title}".`,
          relatedId: rows[0].id,
        })
      ),
    ];

    // Also notify client portal if this task belongs to a client
    if (client_id) {
      notifyOps.push(
        createPortalNotification({
          clientId: client_id,
          type: 'task_updated',
          title: '📋 Nouvelle tâche assignée',
          message: `Une nouvelle tâche "${title}" a été créée pour vous.`,
        })
      );
    }

    if (parsedAssigneeIds.length > 0) {
      // Reset manual_available for newly assigned users (new task cancels their "finished early" signal)
      await pool.query(
        'UPDATE users SET manual_available = FALSE WHERE id = ANY($1)',
        [parsedAssigneeIds]
      );
      notifyOps.push(updateUsersPresenceStatus(parsedAssigneeIds));
    }

    await Promise.all(notifyOps);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', canEdit('tasks'), async (req, res) => {
  try {
    const { rows: [existing] } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const role = req.user.role;
    const isSpecialist = SPECIALIST_ROLES.includes(role);

    if (isSpecialist && !(existing.assignee_ids || []).includes(req.user.id)) {
      return res.status(403).json({ error: 'You can only edit tasks assigned directly to you' });
    }

    if (existing.is_locked && role !== 'admin') {
      return res.status(403).json({ error: 'Task is locked — only admin can modify' });
    }

    const updateData = req.body;

    const { title, description, service_type, assignee_ids, deadline, start_date, status, progress_pct, notes, needs_after, review_status } = updateData;
    const parsedAssigneeIds = Array.isArray(assignee_ids) ? assignee_ids : undefined;
    const prevStatus = existing.status;
    let isLocked = existing.is_locked;
    if (review_status === 'approved') isLocked = true;

    const { rows } = await pool.query(`
      UPDATE tasks
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          service_type = COALESCE($3, service_type),
          assignee_ids = COALESCE($4, assignee_ids),
          deadline = COALESCE($5, deadline),
          start_date = COALESCE($6, start_date),
          status = COALESCE($7, status),
          progress_pct = COALESCE($8, progress_pct),
          notes = COALESCE($9, notes),
          needs_after = COALESCE($10, needs_after),
          review_status = COALESCE($11, review_status),
          is_locked = $12,
          updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `, [title, description || null, service_type || null, parsedAssigneeIds, deadline || null, start_date || null, status, progress_pct, notes || null, needs_after || null, review_status || null, isLocked, req.params.id]);

    // Fire side-effects in parallel
    const sideEffects = [];

    if (status && status !== prevStatus) {
      const currentAssignees = existing.assignee_ids || [];
      const statusLabel = status.replace(/_/g, ' ');

      sideEffects.push(
        logActivity({
          clientId: existing.client_id,
          userId: req.user.id,
          actionType: 'task_status_changed',
          description: `Task "${existing.title}" moved from ${prevStatus} to ${status}`,
        }),
        // Notify all other assignees in parallel
        ...currentAssignees
          .filter(aid => aid !== req.user.id)
          .map(aid => createNotification({
            userId: aid,
            type: 'task_status_changed',
            message: `Task "${existing.title}" was moved to "${statusLabel}" by ${req.user.name || 'a teammate'}.`,
            relatedId: rows[0].id,
          }))
      );

      // Auto-clear active_worker_ids when task is completed/done
      if (['completed', 'done'].includes(status) && existing.active_worker_ids?.length > 0) {
        const workerIds = existing.active_worker_ids;
        sideEffects.push(
          pool.query('UPDATE tasks SET active_worker_ids = $1 WHERE id = $2', ['{}', req.params.id])
            .then(() => require('../services/taskStatus').computeUsersTaskStatus(workerIds))
        );
      }

      if (existing.client_id) {
        const STATUS_LABELS = {
          not_started: 'Non commencé',
          in_progress: 'En cours',
          in_review: 'En révision',
          done: 'Terminé',
          completed: 'Terminé',
          blocked: 'Bloqué',
          waiting_client: 'En attente client',
          urgent: 'Urgent',
          paused: 'En pause',
        };
        const label = STATUS_LABELS[status] || statusLabel;
        sideEffects.push(
          createPortalNotification({
            clientId: existing.client_id,
            type: 'task_updated',
            title: `✅ Tâche mise à jour`,
            message: `"${existing.title}" est maintenant « ${label} ».`,
          })
        );
      }
    }

    if (parsedAssigneeIds) {
      const newAssignees = parsedAssigneeIds.filter(aid => !(existing.assignee_ids || []).includes(aid));
      if (newAssignees.length > 0) {
        // Reset "finished early" flag for users newly assigned to this task
        sideEffects.push(
          pool.query('UPDATE users SET manual_available = FALSE WHERE id = ANY($1)', [newAssignees])
        );
      }
      sideEffects.push(
        ...newAssignees.map(aid => createNotification({
          userId: aid,
          type: 'task_assigned',
          message: `You have been assigned to task "${rows[0].title}".`,
          relatedId: rows[0].id,
        }))
      );
    }

    const affectedUserIds = Array.from(new Set([
      ...(existing.assignee_ids || []),
      ...(rows[0].assignee_ids || [])
    ]));
    if (affectedUserIds.length > 0) {
      sideEffects.push(updateUsersPresenceStatus(affectedUserIds));
    }


    // Run all notifications/logs concurrently — don't block the response
    if (sideEffects.length > 0) {
      Promise.all(sideEffects).catch(err => console.error('[tasks PUT] side-effect error:', err));
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id/working — toggle self in/out of active_worker_ids[]
// Any assignee can call this (not admin). All assignees can be working simultaneously.
router.put('/:id/working', canView('tasks'), async (req, res) => {
  try {
    const { rows: [task] } = await pool.query(
      'SELECT id, title, active_worker_ids, assignee_ids FROM tasks WHERE id = $1',
      [req.params.id]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const userId = req.user.id;
    const workerIds = task.active_worker_ids || [];
    const isWorking = workerIds.includes(userId);

    // Toggle: add or remove self from the array
    let newWorkerIds;
    let newAssigneeIds = task.assignee_ids || [];
    let assigneeIdsChanged = false;

    if (isWorking) {
      // Release — remove self
      newWorkerIds = workerIds.filter(id => id !== userId);
    } else {
      // Claim — add self
      if (!newAssigneeIds.includes(userId)) {
        if (req.user.role === 'admin') {
          // Auto-assign the admin to this task!
          newAssigneeIds = [...newAssigneeIds, userId];
          assigneeIdsChanged = true;
        } else {
          return res.status(403).json({ error: 'You are not assigned to this task' });
        }
      }
      newWorkerIds = [...workerIds, userId];
    }

    if (assigneeIdsChanged) {
      await pool.query(
        'UPDATE tasks SET active_worker_ids = $1, assignee_ids = $2 WHERE id = $3',
        [newWorkerIds, newAssigneeIds, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE tasks SET active_worker_ids = $1 WHERE id = $2',
        [newWorkerIds, req.params.id]
      );
    }

    // Await status computation so the notification is sent BEFORE we respond.
    // This ensures admin's sidebar will see the updated status on next poll.
    await computeUserTaskStatus(userId);

    // Return updated field so the frontend cache can reflect it immediately
    res.json({ id: task.id, active_worker_ids: newWorkerIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id (admin only)
router.delete('/:id', canDelete('tasks'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT assignee_ids, active_worker_ids FROM tasks WHERE id = $1',
      [req.params.id]
    );
    const assigneeIds = rows[0]?.assignee_ids || [];
    const activeWorkerIds = rows[0]?.active_worker_ids || [];

    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);

    // Recompute presence for all affected users (assignees + active workers)
    const toRefresh = [...new Set([...assigneeIds, ...activeWorkerIds])];
    if (toRefresh.length > 0) {
      updateUsersPresenceStatus(toRefresh).catch(err => console.error('[tasks DELETE] presence error:', err));
    }

    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/time-logs
router.post('/:id/time-logs', canView('tasks'), async (req, res) => {
  const { hours } = req.body;
  if (!hours) return res.status(400).json({ error: 'hours is required' });
  try {
    const { rows: [task] } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (SPECIALIST_ROLES.includes(req.user.role) && !(task.assignee_ids || []).includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await pool.query(`
      INSERT INTO task_time_logs (task_id, user_id, hours)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, req.user.id, hours]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/attachments
router.post('/:id/attachments', canView('tasks'), async (req, res) => {
  const { file_url, file_name } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url is required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO task_attachments (task_id, file_url, file_name)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, file_url, file_name]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
