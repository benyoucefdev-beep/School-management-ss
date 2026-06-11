import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, Mail, Phone, Users, FileText, DollarSign, Trash2, Plus } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('info');
  const [noteText, setNoteText] = useState('');

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => api.get(`/students/${id}`).then(r => r.data),
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['student-notes', id],
    queryFn: () => api.get(`/students/${id}/notes`).then(r => r.data?.notes || r.data || []),
    enabled: tab === 'notes',
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['student-payments', id],
    queryFn: () => api.get(`/students/${id}/payments`).then(r => r.data?.payments || r.data || []),
    enabled: tab === 'payments',
  });

  const addNoteMutation = useMutation({
    mutationFn: () => api.post(`/students/${id}/notes`, { content: noteText }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-notes', id] }); setNoteText(''); toast.success('Note added'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to add note'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/students/${id}`).then(r => r.data),
    onSuccess: () => { navigate('/students'); toast.success('Student deleted'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  if (isLoading) return <div className="loading-center"><div className="loading-spinner" /></div>;
  if (!student) return <div className="empty-state"><h3>Student not found</h3><button className="btn btn-ghost" onClick={() => navigate('/students')}>← Back</button></div>;

  const s = student.student || student;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/students')}><ArrowLeft size={18} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white' }}>
              {s.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h1 className="page-title" style={{ marginBottom: 2 }}>{s.full_name}</h1>
              <p className="page-subtitle">{s.grade ? `Grade ${s.grade}` : 'Student'}{s.group_name ? ` · ${s.group_name}` : ''}</p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-danger" onClick={() => { if (window.confirm('Delete this student?')) deleteMutation.mutate(); }}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {[['info', 'Info'], ['notes', 'Notes'], ['payments', 'Payments']].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Info Tab */}
      {tab === 'info' && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Student Information</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{s.full_name || '—'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Grade</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{s.grade || '—'}</div>
            </div>
            {s.email && (
              <div className="form-group">
                <label className="form-label"><Mail size={13} style={{ display: 'inline', marginRight: 4 }} />Email</label>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{s.email}</div>
              </div>
            )}
            {s.phone && (
              <div className="form-group">
                <label className="form-label"><Phone size={13} style={{ display: 'inline', marginRight: 4 }} />Phone</label>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{s.phone}</div>
              </div>
            )}
            {s.group_name && (
              <div className="form-group">
                <label className="form-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Group</label>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>{s.group_name}</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
                <span className={`badge ${s.enrollment_status === 'active' ? 'badge-green' : 'badge-gray'}`}>{s.enrollment_status || 'active'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Tab */}
      {tab === 'notes' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <textarea
              className="input"
              rows={3}
              placeholder="Add a note about this student…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={!noteText.trim() || addNoteMutation.isPending} onClick={() => addNoteMutation.mutate()}>
              <Plus size={15} /> {addNoteMutation.isPending ? 'Adding…' : 'Add Note'}
            </button>
          </div>
          {notes.length === 0 ? (
            <div className="empty-state"><FileText size={32} style={{ color: 'var(--text-muted)' }} /><p>No notes yet</p></div>
          ) : notes.map(note => (
            <div key={note.id} className="card" style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{note.content}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{note.created_by_name || 'Admin'} · {new Date(note.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} style={{ color: 'var(--accent)' }} /> Fee Payments
          </h3>
          {payments.length === 0 ? (
            <div className="empty-state"><DollarSign size={32} style={{ color: 'var(--text-muted)' }} /><p>No payment records yet</p></div>
          ) : (
            <table className="table">
              <thead><tr><th>Subject</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.subject_name || '—'}</td>
                    <td>{Number(p.amount || 0).toLocaleString()} DZD</td>
                    <td>{p.due_date ? new Date(p.due_date).toLocaleDateString() : '—'}</td>
                    <td><span className={`badge ${p.status === 'paid' ? 'badge-green' : p.status === 'overdue' ? 'badge-red' : 'badge-amber'}`}>{p.status || 'pending'}</span></td>
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
