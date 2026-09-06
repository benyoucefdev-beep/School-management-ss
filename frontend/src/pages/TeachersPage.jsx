import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Users, BookOpen, Phone, Mail, ChevronRight, Percent } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function TeachersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', speciality: '', payment_percentage: 70 });

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers', search],
    queryFn: () => api.get('/teachers', { params: { search, limit: 100 } }).then(r => r.data?.data || r.data?.teachers || r.data || []),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/teachers', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Teacher added successfully');
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', speciality: '', payment_percentage: 70 });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to add teacher'),
  });

  const filtered = teachers.filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.speciality?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">{filtered.length} teacher{filtered.length !== 1 ? 's' : ''} on staff</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Teacher
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Search teachers by name, email or subject…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 38, margin: 0 }}
          />
        </div>
      </div>

      {/* Teachers Grid */}
      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /> Loading teachers…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h3>No teachers yet</h3>
          <p>Add your first teacher to get started</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Teacher</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(teacher => (
            <div
              key={teacher.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => navigate(`/teachers/${teacher.id}`)}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: 'white',
                }}>
                  {teacher.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {teacher.name}
                  </div>
                  {teacher.speciality && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{teacher.speciality}</div>
                  )}
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {teacher.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Mail size={13} style={{ color: 'var(--info)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teacher.email}</span>
                  </div>
                )}
                {teacher.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Phone size={13} style={{ color: 'var(--info)', flexShrink: 0 }} />
                    <span>{teacher.phone}</span>
                  </div>
                )}
                {teacher.subjects_count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <BookOpen size={13} style={{ color: 'var(--info)', flexShrink: 0 }} />
                    <span>{teacher.subjects_count} subject{teacher.subjects_count !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`badge ${teacher.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                  {teacher.status || 'active'}
                </span>
                {/* Payment percentage badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '3px 8px', borderRadius: 20 }}>
                  <Percent size={10} />
                  {parseFloat(teacher.payment_percentage ?? 70).toFixed(0)}% share
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Teacher Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Teacher</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Teacher full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Speciality / Subject</label>
                  <input className="form-input" value={form.speciality} onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))} placeholder="e.g. Mathematics, Physics" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="teacher@school.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+213 …" />
                </div>
                {/* Payment percentage */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">
                    Payment Percentage (%)
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
                      — Share of each student payment allocated to this teacher
                    </span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.payment_percentage}
                      onChange={e => setForm(f => ({ ...f, payment_percentage: e.target.value }))}
                      style={{ maxWidth: 120 }}
                    />
                    <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, form.payment_percentage))}%`, background: 'linear-gradient(90deg, var(--primary), #8b5cf6)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', minWidth: 36 }}>
                      {form.payment_percentage}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? 'Adding…' : 'Add Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
