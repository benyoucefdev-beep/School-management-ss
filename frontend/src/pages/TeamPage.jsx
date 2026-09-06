import asArray from '../lib/asArray';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, AlertTriangle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { format } from 'date-fns';

import { ROLE_LABELS, ROLE_BADGE_CLASS } from '../config/roleNav';

const VALID_ROLES = [
  { value: 'admin',   label: 'Admin — Full access' },
  { value: 'manager', label: 'Manager — School operations' },
];

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

const EMPTY_FORM = { name: '', username: '', email: '', password: '', role: 'manager' };

export default function TeamPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate]     = useState(false);
  const [editUser, setEditUser]         = useState(null);
  const [resetUser, setResetUser]       = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [newPassword, setNewPassword]   = useState('');
  const [revealedId, setRevealedId]     = useState(null);

  const [expandedTeam, setExpandedTeam] = useState({});
  const toggleTeam = (id) => setExpandedTeam(prev => ({ ...prev, [id]: !prev[id] }));

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get('/team').then(r => r.data),
  });

  const { data: workload = [] } = useQuery({
    queryKey: ['team-workload'],
    queryFn: () => api.get('/team/workload').then(r => r.data),
  });

  const workloadMap = Object.fromEntries(asArray(workload).map(w => [w.user_id, w]));

  const createMutation = useMutation({
    mutationFn: body => api.post('/team', body),
    onSuccess: () => { qc.invalidateQueries(['team']); qc.invalidateQueries(['team-workload']); setShowCreate(false); setForm(EMPTY_FORM); toast.success('Team member added'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/team/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['team']); setEditUser(null); toast.success('Member updated'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/team/${id}`),
    onSuccess: () => { qc.invalidateQueries(['team']); qc.invalidateQueries(['team-workload']); toast.success('Member removed'); },
    onError: e => toast.error(e.response?.data?.error || 'Cannot remove user'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, new_password }) => api.post(`/team/${id}/reset-password`, { new_password }),
    onSuccess: () => { qc.invalidateQueries(['team']); setResetUser(null); setNewPassword(''); toast.success('Password reset successfully'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ name: u.name, username: u.username, email: u.email || '', password: '', role: u.role });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Management</h1>
          <p className="page-subtitle">{team.length} team members</p>
        </div>
        <button id="add-member-btn" className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}>
          <Plus size={16} /> Add Member
        </button>
      </div>

      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {team.map(u => {
            const wl = workloadMap[u.id];
            const overloaded = wl?.over_threshold;
            const openTasks = parseInt(u.open_task_count || 0, 10);
            const isRevealed = revealedId === u.id;
            const isExpanded = !!expandedTeam[u.id];
            return (
              <div
                key={u.id}
                className="card card-sm sp-fadeup"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isExpanded ? 12 : 0,
                  background: 'var(--bg-card)',
                  border: overloaded ? '1px solid var(--warning)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  boxShadow: 'var(--shadow-card)',
                  position: 'relative',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {/* Header: Avatar, Name, and Role (Clickable to Toggle) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleTeam(u.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>
                      {u.photo_url
                        ? <img src={u.photo_url} alt={u.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                        : initials(u.name)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{u.name}</span>
                        {overloaded && <span title="Workload threshold exceeded"><AlertTriangle size={12} style={{ color: 'var(--warning)' }} /></span>}
                      </div>
                      <span className={`badge ${ROLE_BADGE_CLASS[u.role] || 'badge-gray'}`} style={{ width: 'fit-content', fontSize: 10 }}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTeam(u.id); }}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        width: 28, height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-primary)',
                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)'
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded Drawer */}
                {isExpanded && (
                  <div className="sp-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                    {/* Details Panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-surface)', borderRadius: 10, padding: 12, border: '1px solid var(--border)', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Username:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{u.username}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{u.email || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Open Tasks:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 700, color: overloaded ? 'var(--warning)' : 'var(--text-primary)' }}>
                            {openTasks}
                          </span>
                          {overloaded && <span title="Workload threshold exceeded"><AlertTriangle size={12} style={{ color: 'var(--warning)' }} /></span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Password:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: isRevealed ? 0 : 2, fontSize: 11 }}>
                            {isRevealed ? (u.plain_password || '—') : '••••••••'}
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setRevealedId(isRevealed ? null : u.id)}
                            title={isRevealed ? 'Hide password' : 'Reveal password'}
                            style={{ padding: '2px 4px' }}
                          >
                            {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Joined:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{format(new Date(u.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => openEdit(u)} title="Edit member">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => { setResetUser(u); setNewPassword(''); }} title="Reset password">
                        <KeyRound size={12} /> Reset
                      </button>
                      <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => { if (confirm(`Remove ${u.name}?`)) deleteMutation.mutate(u.id); }} title="Remove member">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Open Tasks</th>
                <th>Password</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {team.map(u => {
                const wl = workloadMap[u.id];
                const overloaded = wl?.over_threshold;
                const openTasks = parseInt(u.open_task_count || 0, 10);
                const isRevealed = revealedId === u.id;
                return (
                  <tr key={u.id} style={overloaded ? { background: 'rgba(245, 158, 11, 0.07)' } : {}}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
                        }}>
                          {u.photo_url
                            ? <img src={u.photo_url} alt={u.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                            : initials(u.name)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{u.username}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.email || '-'}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE_CLASS[u.role] || 'badge-gray'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: overloaded ? 'var(--warning)' : 'var(--text-primary)' }}>
                          {openTasks}
                        </span>
                        {overloaded && <span title="Workload threshold exceeded"><AlertTriangle size={14} style={{ color: 'var(--warning)' }} /></span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: isRevealed ? 0 : 2 }}>
                          {isRevealed ? (u.plain_password || '—') : '••••••••'}
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setRevealedId(isRevealed ? null : u.id)}
                          title={isRevealed ? 'Hide password' : 'Reveal password'}
                          style={{ padding: '2px 6px' }}
                        >
                          {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {format(new Date(u.created_at), 'MMM d, yyyy')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)} title="Edit member">
                          <Edit2 size={12} />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setResetUser(u); setNewPassword(''); }} title="Reset password">
                          <KeyRound size={12} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Remove ${u.name}?`)) deleteMutation.mutate(u.id); }} title="Remove member">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {asArray(workload).some(w => w.over_threshold) && (
        <div className="card" style={{ marginTop: 16, borderLeft: '4px solid var(--warning)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            <strong>{asArray(workload).filter(w => w.over_threshold).length} member(s)</strong> exceed the workload threshold. Consider reassigning some tasks.
          </span>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Team Member">
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
          </div>
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="jane123" />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@axialogy.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password *</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 chars" />
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {VALID_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => createMutation.mutate(form)}
            disabled={!form.name || !form.username || !form.email || !form.password || createMutation.isPending}
          >
            {createMutation.isPending ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit Team Member">
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {VALID_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => updateMutation.mutate({ id: editUser.id, name: form.name, email: form.email, role: form.role, username: form.username })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetUser} onClose={() => { setResetUser(null); setNewPassword(''); }} title={`Reset Password — ${resetUser?.name}`}>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Set a new password for <strong>{resetUser?.name}</strong>. They will need to use this to log in.
          </p>
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <input
              className="form-input"
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setResetUser(null); setNewPassword(''); }}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => resetPasswordMutation.mutate({ id: resetUser.id, new_password: newPassword })}
            disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending}
          >
            {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
