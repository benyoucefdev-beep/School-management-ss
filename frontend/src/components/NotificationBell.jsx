import asArray from '../lib/asArray';
import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check } from 'lucide-react';
import api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const TYPE_ICON = {
  task_assigned: '📋',
  task_status_changed: '🔄',
  status_changed: '👤',
  task_due_tomorrow: '⏰',
  invoice_overdue: '💸',
  ads_budget_alert: '📢',
  ad_campaign_ended: '🎉',
};

const TYPE_LINK = {
  task_assigned: (id) => `/tasks`,
  task_due_tomorrow: (id) => `/tasks`,
  invoice_overdue: (id) => `/finance/pl`,
  ads_budget_alert: (id) => `/ads`,
  ad_campaign_ended: (id) => `/finance/pl`,
};

// A short, subtle "pop" notification sound
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  
  // Keep track of previous unread count to know when to play sound
  const prevUnreadRef = useRef(0);
  const audioRef = useRef(new Audio(NOTIFICATION_SOUND_URL));

  const unreadCount = asArray(notifications).filter(n => !n.is_read).length;

  // Sync the home screen app badge with current unread count
  const syncBadge = (count) => {
    try {
      if ('setAppBadge' in navigator) {
        if (count > 0) navigator.setAppBadge(count).catch(() => {});
        else navigator.clearAppBadge().catch(() => {});
      }
    } catch (_) {}
  };

  const fetchNotifications = async () => {
    if (document.hidden) return; // Prevent database queries when PWA is in background
    try {
      const { data } = await api.get('/notifications');
      const items = data.slice(0, 20);
      setNotifications(items);
      // Always sync badge immediately after every fetch
      const unread = items.filter(n => !n.is_read).length;
      syncBadge(unread);
    } catch (_) {}
  };

  // Initial fetch + poll every 20s (saves substantial egress/bandwidth)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20_000);
    return () => clearInterval(interval);
  }, []);

  // Re-fetch immediately when user brings the app to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Play sound + emit sidebar refresh event when NEW unread notification arrives
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && unreadCount > 0) {
      audioRef.current.play().catch(() => {});
      // If any of the new notifications are status_changed, tell sidebar to refresh immediately
      const hasStatusChange = asArray(notifications).some(
        n => !n.is_read && n.type === 'status_changed'
      );
      if (hasStatusChange) {
        window.dispatchEvent(new CustomEvent('team-status-changed'));
      }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, notifications]);

  // Close on outside click
  useEffect(() => {

    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    setLoading(true);
    await api.put('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    syncBadge(0); // Clear the home screen badge
    setLoading(false);
  };

  const handleNotificationClick = (n) => {
    if (!n.is_read) markRead(n.id);
    const linkFn = TYPE_LINK[n.type];
    if (linkFn) navigate(linkFn(n.related_id));
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        id="notification-bell-btn"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          transition: 'all 0.2s',
        }}
        onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseOut={e => e.currentTarget.style.background = 'var(--bg-surface)'}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: 'var(--danger)',
            color: 'white',
            borderRadius: '50%',
            width: 18,
            height: 18,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-main)',
            animation: 'pulse-ring 2s infinite',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: 56,
          right: 8,
          width: 'min(380px, calc(100vw - 16px))',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'fadeInDown 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
              {unreadCount > 0 && (
                <span className="badge badge-blue" style={{ fontSize: 11 }}>{unreadCount} new</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  title="Mark all as read"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                >
                  <Check size={14} /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 6, padding: 4 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: 13 }}>You're all caught up!</p>
              </div>
            ) : asArray(notifications).map(n => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.06)',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseOut={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(99,102,241,0.06)'}
              >
                <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>
                  {TYPE_ICON[n.type] || '🔔'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontWeight: n.is_read ? 400 : 600,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </div>
                </div>
                {!n.is_read && (
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    flexShrink: 0,
                    marginTop: 6,
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
