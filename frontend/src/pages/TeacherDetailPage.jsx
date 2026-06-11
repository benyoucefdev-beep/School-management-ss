import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, BookOpen, DollarSign, Trash2, Plus } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function TeacherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('info');

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher', id],
    queryFn: () => api.get(`/teachers/${id}`).then(r => r.data),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['teacher-subjects', id],
    queryFn: () => api.get(`/teachers/${id}/subjects`).then(r => r.data?.subjects || r.data || []),
    enabled: tab === 'subjects',
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['teacher-payments', id],
    queryFn: () => api.get(`/teachers/${id}/payments`).then(r => r.data?.payments || r.data || []),
    enabled: tab === 'payments',
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/teachers/${id}`).then(r => r.data),
    onSuccess: () => { navigate('/teachers'); toast.success('Teacher deleted'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  if (isLoading) return <div className="loading-center"><div className="loading-spinner" /></div>;
  if (!teacher) return <div className="empty-state"><h3>Teacher not found</h3><button className="btn btn-ghost" onClick={() => navigate('/teachers')}>← Back</button></div>;

  const t = teacher.teacher || teacher;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/teachers')}><ArrowLeft size={18} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white' }}>
              {t.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h1 className="page-title" style={{ marginBottom: 2 }}>{t.name}</h1>
              <p className="page-subtitle">{t.speciality || 'Teacher'}</p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-danger" onClick={() => { if (window.confirm('Delete this teacher?')) deleteMutation.mutate(); }}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {[['info', 'Info'], ['subjects', 'Subjects'], ['payments', 'Salary Payments']].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Info Tab */}
      {tab === 'info' && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Teacher Information</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{t.name || '—'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Speciality</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{t.speciality || '—'}</div>
            </div>
            {t.email && (
              <div className="form-group">
                <label className="form-label"><Mail size={13} style={{ display: 'inline', marginRight: 4 }} />Email</label>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{t.email}</div>
              </div>
            )}
            {t.phone && (
              <div className="form-group">
                <label className="form-label"><Phone size={13} style={{ display: 'inline', marginRight: 4 }} />Phone</label>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{t.phone}</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
                <span className={`badge ${t.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{t.status || 'active'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subjects Tab */}
      {tab === 'subjects' && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} style={{ color: 'var(--accent)' }} /> Assigned Subjects
          </h3>
          {subjects.length === 0 ? (
            <div className="empty-state"><BookOpen size={32} style={{ color: 'var(--text-muted)' }} /><p>No subjects assigned yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subjects.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={16} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} style={{ color: 'var(--accent)' }} /> Salary Payments
          </h3>
          {payments.length === 0 ? (
            <div className="empty-state"><DollarSign size={32} style={{ color: 'var(--text-muted)' }} /><p>No payment records yet</p></div>
          ) : (
            <table className="table">
              <thead><tr><th>Period</th><th>Amount</th><th>Payment Date</th><th>Notes</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.period || '—'}</td>
                    <td>{Number(p.amount || 0).toLocaleString()} DZD</td>
                    <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
