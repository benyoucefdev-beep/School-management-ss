const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendPushNotification } = require('../utils/pushNotifications');

router.use(authenticate);

// ── In-App Notification CRUD ────────────────────────────────────────────────

// GET /api/notifications — fetch current user's notifications
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error('[Notifications GET] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read — mark one notification as read
router.put('/:id/read', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('[Notifications PUT read] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all — mark all as read for current user
router.put('/read-all', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error('[Notifications PUT read-all] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Push Notification Subscription Management ───────────────────────────────

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription with endpoint missing' });
  }

  try {
    // Delete any existing subscription with the same endpoint (handles re-subscription)
    await pool.query(
      `DELETE FROM push_subscriptions WHERE subscription->>'endpoint' = $1`,
      [subscription.endpoint]
    );

    // Insert the fresh subscription
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2)`,
      [req.user.id, subscription]
    );

    console.log(`[Subscribe] Saved push subscription for user ${req.user.id}, endpoint: ${subscription.endpoint.slice(-40)}`);
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    console.error('[Subscribe] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription missing' });

  try {
    await pool.query(`
      DELETE FROM push_subscriptions
      WHERE user_id = $1 AND subscription->>'endpoint' = $2
    `, [req.user.id, subscription.endpoint]);

    res.json({ message: 'Unsubscribed successfully' });
  } catch (err) {
    console.error('[Unsubscribe] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/test — send a test push to the current user
router.post('/test', async (req, res) => {
  try {
    // Check subscriptions first
    const { rows: subs } = await pool.query(
      `SELECT id, subscription->>'endpoint' AS endpoint, created_at FROM push_subscriptions WHERE user_id = $1`,
      [req.user.id]
    );

    if (subs.length === 0) {
      return res.status(400).json({
        error: 'No push subscription found for your account. Please tap "Enable Notifications" in Profile first.',
      });
    }

    const result = await sendPushNotification(req.user.id, {
      title: '🔔 Test Notification',
      body: 'Background push is working! You received this while the app was closed.',
      url: '/my-tasks',
    });

    res.json({
      subscriptionsFound: subs.length,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors,
      noSubscriptions: result.noSubscriptions,
      status: result.sent > 0 ? '✅ Push sent successfully' : '❌ Push failed — see errors',
    });
  } catch (err) {
    console.error('[Test Notification] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/debug — diagnose push notification setup
router.get('/debug', async (req, res) => {
  try {
    const { rows: subs } = await pool.query(
      `SELECT id, subscription->>'endpoint' AS endpoint, created_at FROM push_subscriptions WHERE user_id = $1`,
      [req.user.id]
    );

    const vapidConfigured = !!(
      process.env.VAPID_EMAIL &&
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY
    );

    res.json({
      userId: req.user.id,
      vapidConfigured,
      vapidEmail: process.env.VAPID_EMAIL || '(missing)',
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY
        ? process.env.VAPID_PUBLIC_KEY.slice(0, 20) + '...'
        : '(missing)',
      subscriptionsCount: subs.length,
      subscriptions: subs.map(s => ({
        id: s.id,
        endpointTail: '...' + s.endpoint.slice(-50),
        createdAt: s.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
