import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, Search, Users, Clock } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  active:    { bg: 'var(--success-bg)',  text: 'var(--success)' },
  completed: { bg: 'var(--info-bg)',     text: 'var(--info)' },
  cancelled: { bg: 'var(--danger-bg)',   text: 'var(--danger)' },
  scheduled: { bg: 'var(--warning-bg)', text: 'var(--warning)' },
};

export default function ClassesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', teacher_id: '', group_id: '', subject_id: '', room: '' });

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes', search],
    queryFn: () => api.get('/classes', { params: { search, limit: 100 } }).then(r => (Array.isArray(r.data) ? r.data : r.data?.data ?? r.data?.classes ?? [])),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: () => api.get('/teachers', { params: { limit: 100 } }).then(r => (Array.isArray(r.data) ? r.data : r.data?.data ?? r.data?.teachers ?? [])),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups-list'],
    queryFn: () => api.get('/groups').then(r => (Array.isArray(r.data) ? r.data : r.data?.data ?? r.data?.groups ?? [])),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: () => api.get('/subjects').then(r => (Array.isArray(r.data) ? r.data : r.data?.data ?? r.data?.subjects ?? [])),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/classes', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class created');
      setShowModal(false);
      setForm({ name: '', description: '', teacher_id: '', group_id: '', subject_id: '', room: '' });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create class'),
  });

  const filtered = classes.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.teacher_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.subject_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">{filtered.length} class{filtered.length !== 1 ? 'es' : ''} scheduled</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Class
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            placeholder="Search classes by name, teacher or subject…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
      </div>

      {/* Classes List */}
      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /> Loading classes…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h3>No classes yet</h3>
          <p>Create your first class to get started</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New Class</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(cls => {
            const sc = STATUS_COLORS[cls.status] || STATUS_COLORS.active;
            return (
              <div key={cls.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'var(--accent-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <BookOpen size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{cls.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 4 }}>
                    {cls.teacher_name && (
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={12} /> {cls.teacher_name}
                      </span>
                    )}
                    {cls.subject_name && (
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <BookOpen size={12} /> {cls.subject_name}
                      </span>
                    )}
                    {cls.room && (
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> Room {cls.room}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.text, flexShrink: 0 }}>
                  {cls.status || 'active'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Class Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Class</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Class Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Math – Group A, Monday" />
                </div>
                <div className="form-group">
                  <label className="form-label">Teacher</label>
                  <select className="input" value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                    <option value="">— Select teacher —</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select className="input" value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
                    <option value="">— Select subject —</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Group</label>
                  <select className="input" value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                    <option value="">— Select group —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Room</label>
                  <input className="input" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="Room 101" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Description</label>
                  <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes…" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? 'Creating…' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
