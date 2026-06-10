import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import NAV_CONFIG, { ROLE_LABELS } from '../config/roleNav';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Users, Calendar } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TeamTaskStatus — shown only to admin, at the bottom of the sidebar.
// Shows each member's task_status with colour-coded badges:
//   🟠 Working on "Task Name"
//   🟢 Available
//   🗓 Next: "Task Name" starting …
// ─────────────────────────────────────────────────────────────────────────────
function TeamTaskStatus() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const load = () => {
      if (document.hidden) return; // Prevent database queries when PWA is in background
      api.get('/users')
        .then(res => setMembers(res.data.filter(m => m.id !== user.id)))
        .catch(err => console.error('[TeamTaskStatus] load error:', err));
    };

    load();
    // Poll every 30s (saves substantial egress/bandwidth)
    const interval = setInterval(load, 30_000);

    // Also refresh immediately when a status_changed notification arrives
    // (dispatched by NotificationBell when it detects a new status_changed notification)
    window.addEventListener('team-status-changed', load);

    return () => {
      clearInterval(interval);
      window.removeEventListener('team-status-changed', load);
    };
  }, [user]);

  if (!user || user.role !== 'admin') return null;
  if (members.length === 0) return null;

  return (
    <div className="sidebar-team-status">
      <div className="team-status-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={12} style={{ opacity: 0.7 }} />
          <span>Team Status</span>
        </div>
        <span style={{ fontSize: 8, opacity: 0.5, fontWeight: 500 }}>AUTO-REFRESH</span>
      </div>

      <div className="team-status-list">
        {members.map(m => {
          const isWorking   = m.task_status?.startsWith('Working on');
          const isAvailable = !isWorking;

          // Colour scheme: amber=working, green=available
          const statusColor = isWorking ? '#f59e0b' : '#22c55e';
          const statusClass = isWorking ? 'working' : 'active';
          const badgeClass  = isWorking ? 'status-badge-working' : 'status-badge-available';
          const statusIcon  = isWorking ? '⏳' : '✓';

          return (
            <div key={m.id} className="team-member-row">
              {/* Avatar with status dot */}
              <div className="member-avatar-wrapper">
                <div className="member-avatar">
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.name} />
                  ) : (
                    m.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  )}
                </div>
                <span 
                  className={`member-status-dot status-dot-pulse ${statusClass}`}
                  style={{ background: statusColor }}
                />
              </div>

              {/* Info */}
              <div className="member-info">
                <div className="member-name-row">
                  <span className="member-name" title={m.name}>
                    {m.name.split(' ')[0]}
                  </span>
                  <span className="member-role">
                    {ROLE_LABELS[m.role] || m.role?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Status badge */}
                <div className={badgeClass}>
                  <span className="status-badge-text" title={m.task_status || 'Available'}>
                    {statusIcon} {m.task_status || 'Available'}
                  </span>
                </div>

                {/* Next task info */}
                {m.next_task_info && (
                  <div className="member-next-task" title={m.next_task_info}>
                    <Calendar size={9} style={{ flexShrink: 0 }} />
                    <span>{m.next_task_info}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
export default function Sidebar({ onNav, hideLogo }) {
  const { user } = useAuth();
  const navItems = NAV_CONFIG[user?.role] || [];

  return (
    <>
      {!hideLogo && (
        <div className="sidebar-logo">
          <img src="/icons/logo-192.png" alt="Axialogy" className="sidebar-logo-icon" style={{ background: 'none', objectFit: 'cover' }} />
          <span className="sidebar-logo-text">Axialogy</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item, idx) => {
          if (item.divider) {
            return (
              <div key={`divider-${idx}`} className="sidebar-divider">
                <span className="sidebar-divider-label">{item.label}</span>
              </div>
            );
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onNav?.()}
              className={({ isActive }) => {
                const subActive = item.subpaths?.some(sp => window.location.pathname.startsWith(sp));
                return `nav-item ${(isActive || subActive) ? 'active' : ''}`;
              }}
            >
              <item.icon className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Team task status — admin only */}
      <TeamTaskStatus />
    </>
  );
}
