import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { format } from 'date-fns';
import {
  GraduationCap, Users, BookOpen, Layers,
  DollarSign, AlertTriangle, TrendingUp, Activity, UserCheck,
} from 'lucide-react';

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

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'owner', 'manager'].includes(user?.role);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  if (isLoading) return (
    <div className="loading-center">
      <div className="loading-spinner" />
      Loading dashboard…
    </div>
  );

  const { stats = {}, recent_activity = [] } = data || {};
  const fmt = (n) => (n ?? 0).toLocaleString('en-US');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name} — {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Students" value={fmt(stats.total_students)} icon={GraduationCap} color="var(--accent)" sub="Enrolled" to="/students" />
        <StatCard label="Teachers" value={fmt(stats.total_teachers)} icon={Users} color="var(--info)" sub="On staff" to="/teachers" />
        <StatCard label="Active Classes" value={fmt(stats.active_classes)} icon={BookOpen} color="var(--success)" sub="This term" to="/classes" />
        <StatCard label="Groups" value={fmt(stats.total_groups)} icon={Layers} color="#8b5cf6" sub="Study groups" to="/groups" />
        {isAdmin && (
          <>
            <StatCard label="Fees Collected" value={`${fmt(stats.revenue_this_month)} DZD`} icon={DollarSign} color="var(--success)" sub="This month" to="/finance/invoices" />
            <StatCard label="Overdue Fees" value={fmt(stats.overdue_invoices)} icon={AlertTriangle} color="var(--danger)" sub="Require attention" to="/finance/invoices" />
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Activity size={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Activity</h2>
          </div>
          <div className="timeline">
            {recent_activity.length ? recent_activity.map(item => (
              <div key={item.id} className="timeline-item">
                <div style={{ fontSize: 18, flexShrink: 0 }}>
                  {item.action_type === 'student_created' ? '🎓' :
                   item.action_type === 'teacher_created' ? '👨‍🏫' :
                   item.action_type === 'payment_received' ? '💰' :
                   item.action_type === 'class_created' ? '📚' :
                   item.action_type === 'absence_logged' ? '📋' : '⚡'}
                </div>
                <div className="timeline-content">
                  <div className="timeline-description">{item.description}</div>
                  <div className="timeline-meta">
                    {item.user_name && <span>{item.user_name}</span>}
                    <span>· {new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '20px 0' }}>
                No recent activity yet — start by adding students and teachers!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
