import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, GraduationCap, Phone, Mail, Users, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function StudentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', grade: '', group_id: '' });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', search],
    queryFn: () => api.get('/students', { params: { search, limit: 100 } }).then(r => r.data?.students || r.data || []),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups-list'],
    queryFn: () => api.get('/groups').then(r => r.data?.groups || r.data || []),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/students', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student added successfully');
      setShowModal(false);
      setForm({ full_name: '', email: '', phone: '', grade: '', group_id: '' });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to add student'),
  });

  const filtered = students.filter(s =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{filtered.length} student{filtered.length !== 1 ? 's' : ''} enrolled</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            placeholder="Search students by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
      </div>

      {/* Students Grid */}
      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /> Loading students…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <GraduationCap size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h3>No students yet</h3>
          <p>Add your first student to get started</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Student</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(student => (
            <div
              key={student.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => navigate(`/students/${student.id}`)}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: 'white',
                }}>
                  {student.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {student.full_name}
                  </div>
                  {student.grade && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Grade {student.grade}</div>
                  )}
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {student.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Mail size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.email}</span>
                  </div>
                )}
                {student.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Phone size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span>{student.phone}</span>
                  </div>
                )}
                {student.group_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Users size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span>{student.group_name}</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span className={`badge ${student.enrollment_status === 'active' ? 'badge-green' : student.enrollment_status === 'inactive' ? 'badge-red' : 'badge-gray'}`}>
                  {student.enrollment_status || 'active'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Student Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Student</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Student full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Grade</label>
                  <input className="input" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} placeholder="e.g. 3A, Year 2" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="student@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+213 …" />
                </div>
                <div className="form-group">
                  <label className="form-label">Group</label>
                  <select className="input" value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                    <option value="">— No group —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!form.full_name || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? 'Adding…' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
