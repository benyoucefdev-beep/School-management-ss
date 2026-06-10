import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { HealthBadge } from '../components/Badges';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, DollarSign, CheckSquare, TrendingUp, TrendingDown,
  Users, Activity, Clock, CalendarClock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

function StatCard({ label, value, icon: Icon, color, sub, to }) {
  const navigate = useNavigate();
  return (
    <div
      className="stat-card"
      onClick={to ? () => navigate(to) : undefined}
      style={{ cursor: to ? 'pointer' : 'default', borderTop: `3px solid ${color || 'var(--accent)'}` }}
    >
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
      <div className="stat-icon" style={{ background: `${color || 'var(--accent)'}20` }}>
        <Icon size={20} style={{ color: color || 'var(--accent)' }} />
      </div>
    </div>
  );
}

const actionIcons = {
  task_created: '📋', task_status_changed: '🔄', invoice_sent: '📧',
  invoice_created: '📄', payment_received: '💰', ad_spend_logged: '📊',
  note_added: '📝', file_uploaded: '📎', client_created: '👤',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
    staleTime: 60_000,                  // cache dashboard for 1 min
    refetchInterval: 120_000,           // refresh dashboard every 2 mins
    refetchIntervalInBackground: false, // do NOT poll in background
  });

  if (isLoading) return (
    <div className="loading-center">
      <div className="loading-spinner" />
      Loading dashboard...
    </div>
  );

  const { stats, recent_activity, clients_health } = data || {};
  const fmt = (n) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name} — here's what's happening today</p>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {isAdmin && (
          <StatCard
            label="Overdue Invoices"
            value={stats?.overdue_invoices ?? 0}
            icon={AlertTriangle}
            color="var(--danger)"
            sub="Require immediate attention"
            to="/finance/invoices?status=overdue"
          />
        )}
        <StatCard
          label="Tasks Due Today"
          value={stats?.tasks_due_today ?? 0}
          icon={CheckSquare}
          color="var(--warning)"
          sub={isAdmin ? 'All team deadlines' : 'Your active deadlines'}
          to="/tasks"
        />
        <StatCard
          label="Due This Week"
          value={stats?.tasks_due_soon ?? 0}
          icon={CalendarClock}
          color="var(--accent)"
          sub="Next 7 days"
          to="/tasks"
        />
        {isAdmin && (
          <>
            <StatCard
              label="Revenue This Month"
              value={`${fmt(stats?.revenue_this_month)} DZD`}
              icon={DollarSign}
              color="var(--success)"
              sub="Payments received"
              to="/finance/invoices"
            />
            <StatCard
              label="Expenses"
              value={`${fmt(stats?.expenses_this_month)} DZD`}
              icon={TrendingDown}
              color="var(--warning)"
              sub="Variable + fixed"
              to="/finance/expenses"
            />
            <StatCard
              label="Net Profit"
              value={`${fmt(stats?.net_profit_this_month)} DZD`}
              icon={(stats?.net_profit_this_month ?? 0) >= 0 ? TrendingUp : TrendingDown}
              color={(stats?.net_profit_this_month ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'}
              sub="Revenue − all costs"
              to="/finance/pl"
            />
            <StatCard
              label="Active Clients"
              value={stats?.active_clients ?? 0}
              icon={Users}
              color="var(--accent)"
              sub="Total accounts"
              to="/clients"
            />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: (clients_health?.length && isAdmin && !isMobile) ? '1fr 340px' : '1fr', gap: 24 }}>
        {/* Recent Activity */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Activity size={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Activity</h2>
          </div>
          <div className="timeline">
            {recent_activity?.length ? recent_activity.map(item => (
              <div key={item.id} className="timeline-item">
                <div style={{ fontSize: 18, flexShrink: 0 }}>
                  {actionIcons[item.action_type] || '⚡'}
                </div>
                <div className="timeline-content">
                  <div className="timeline-description">{item.description}</div>
                  <div className="timeline-meta">
                    {item.user_name && <span>{item.user_name}</span>}
                    {item.client_name && <span>· {item.client_name}</span>}
                    <span>· {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No recent activity recorded yet</div>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}
