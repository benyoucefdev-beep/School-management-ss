import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, BookOpen, DollarSign, Trash2, Percent, Save, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function TeacherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('info');
  const [editingPct, setEditingPct] = useState(false);
  const [pctValue, setPctValue] = useState('');

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

  const updatePercentageMutation = useMutation({
    mutationFn: (payment_percentage) => api.put(`/teachers/${id}`, { payment_percentage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher', id] });
      qc.invalidateQueries({ queryKey: ['teachers'] });
      setEditingPct(false);
      toast.success('Payment percentage updated!');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  if (isLoading) return <div className="loading-center"><div className="loading-spinner" /></div>;
  if (!teacher) return <div className="empty-state"><h3>Teacher not found</h3><button className="btn btn-ghost" onClick={() => navigate('/teachers')}>← Back</button></div>;

  const t = teacher.teacher || teacher;
  const pct = parseFloat(t.payment_percentage ?? 70);

  const startEditPct = () => {
    setPctValue(pct.toFixed(0));
    setEditingPct(true);
  };

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Basic Info Card */}
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

          {/* Payment Percentage Card */}
          <div className="card" style={{ border: '2px solid var(--primary-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Percent size={18} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Payment Percentage</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Share of each student payment allocated to this teacher</p>
                </div>
              </div>
              {!editingPct && (
                <button className="btn btn-secondary btn-sm" onClick={startEditPct}>Edit</button>
              )}
            </div>

            {editingPct ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={pctValue}
                    onChange={e => setPctValue(e.target.value)}
                    style={{ maxWidth: 120, margin: 0 }}
                    autoFocus
                  />
                  <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, parseFloat(pctValue) || 0))}%`, background: 'linear-gradient(90deg, var(--primary), #8b5cf6)', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', minWidth: 52 }}>
                    {parseFloat(pctValue || 0).toFixed(0)}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={updatePercentageMutation.isPending}
                    onClick={() => updatePercentageMutation.mutate(parseFloat(pctValue))}
                  >
                    <Save size={13} /> {updatePercentageMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingPct(false)}>
                    <X size={13} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, height: 12, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--primary), #8b5cf6)', borderRadius: 6 }} />
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-1px', minWidth: 80, textAlign: 'right' }}>
                  {pct.toFixed(0)}<span style={{ fontSize: 18 }}>%</span>
                </div>
              </div>
            )}

            {!editingPct && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Example: student pays <strong>10,000 DZD</strong></span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>→ Teacher earns {(10000 * pct / 100).toLocaleString()} DZD</span>
              </div>
            )}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={16} style={{ color: 'var(--accent)' }} /> Salary Payments
            </h3>
            {/* Summary chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
              <Percent size={11} /> {pct.toFixed(0)}% per student payment
            </div>
          </div>
          {payments.length === 0 ? (
            <div className="empty-state"><DollarSign size={32} style={{ color: 'var(--text-muted)' }} /><p>No payment records yet</p></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Period</th><th>Amount</th><th>Payment Date</th><th>Notes</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.period || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{Number(p.amount || 0).toLocaleString()} DZD</td>
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
