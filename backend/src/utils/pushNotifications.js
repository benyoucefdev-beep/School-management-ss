const pool = require('../db');

// web-push loaded lazily — only when VAPID keys are present at runtime
let _webpush = null;

function getWebPush() {
  if (_webpush) return _webpush;
  if (
    process.env.VAPID_EMAIL &&
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY
  ) {
    try {
      const wp = require('web-push');
      wp.setVapidDetails(
        process.env.VAPID_EMAIL,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      _webpush = wp;
      console.log('[Push] web-push configured successfully');
    } catch (e) {
      console.warn('[Push] Could not initialize web-push:', e.message);
    }
  } else {
    console.warn('[Push] VAPID env vars missing — push notifications disabled');
  }
  return _webpush;
}

/**
 * Send a push notification to one or more users.
 * Returns a result object with details of success/failure for each subscription.
 * @param {string|string[]} userIds
 * @param {object} payload - { title, body, icon, url }
 * @returns {{ sent: number, failed: number, errors: string[], noSubscriptions: boolean }}
 */
async function sendPushNotification(userIds, payload) {
  const result = { sent: 0, failed: 0, errors: [], noSubscriptions: false };

  const wp = getWebPush();
  if (!wp) {
    result.errors.push('VAPID not configured — web-push disabled');
    return result;
  }

  const ids = Array.isArray(userIds) ? userIds : [userIds];

  try {
    const { rows } = await pool.query(
      'SELECT id, subscription FROM push_subscriptions WHERE user_id = ANY($1)',
      [ids]
    );

    if (rows.length === 0) {
      console.log('[Push] No subscriptions found for users:', ids);
      result.noSubscriptions = true;
      return result;
    }

    console.log(`[Push] Sending to ${rows.length} subscription(s) for users:`, ids);

    // Get current unread count for the badge
    const { rows: unreadRows } = await pool.query(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ANY($1) AND is_read = FALSE',
      [ids]
    );
    const badgeCount = parseInt(unreadRows[0]?.cnt || '0', 10);

    const pushPayload = JSON.stringify({
      title: payload.title || 'Axialogy',
      body: payload.body || '',
      icon: payload.icon || '/icons/logo-192.png',
      badge: '/badge-72.png', // Small monochrome icon for Android status bar
      url: payload.url || '/',
      badgeCount,
    });

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        // subscription column is JSONB — comes back as an object already
        const sub = typeof row.subscription === 'string'
          ? JSON.parse(row.subscription)
          : row.subscription;

        try {
          const resp = await wp.sendNotification(sub, pushPayload);
          console.log(`[Push] ✅ Sent to subscription ${row.id}, statusCode: ${resp?.statusCode}`);
          return { ok: true, id: row.id };
        } catch (err) {
          const errMsg = `status=${err.statusCode} body=${JSON.stringify(err.body || err.message)}`;
          console.warn('[Push] ❌ Send error for subscription', row.id, ':', errMsg);

          // Remove expired/invalid subscriptions
          if (err.statusCode === 404 || err.statusCode === 410) {
            await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
            console.log(`[Push] Deleted expired subscription ${row.id}`);
          }
          throw new Error(errMsg);
        }
      })
    );

    results.forEach((r) => {
      if (r.status === 'fulfilled') result.sent++;
      else {
        result.failed++;
        result.errors.push(r.reason?.message || 'Unknown error');
      }
    });

  } catch (err) {
    console.error('[Push] Outer error:', err.message);
    result.errors.push(err.message);
  }

  return result;
}

module.exports = { sendPushNotification };
