import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  Plus, Search, Users, UserCheck, Phone, Mail,
  Edit3, Trash2, AlertCircle, CheckCircle2,
  Baby, Link2, Calendar, BookOpen
} from 'lucide-react';

const css = `
  .parents-layout {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 20px;
    min-height: 600px;
  }
  @media (max-width: 900px) {
    .parents-layout { grid-template-columns: 1fr; }
  }

  /* LEFT PANEL — parent list */
  .parents-list-panel {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    overflow: hidden;
    display: flex; flex-direction: column;
  }
  .parents-list-header {
    padding: 16px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    font-size: 13px; font-weight: 700; color: var(--text-primary);
    display: flex; align-items: center; justify-content: space-between;
  }
  .parent-item {
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    cursor: pointer;
    transition: background 0.15s;
    display: flex; align-items: center; gap: 12px;
    animation: fadeSlideUp 0.3s ease both;
  }
  .parent-item:hover { background: rgba(255,255,255,0.04); }
  .parent-item.active { background: rgba(0,180,216,0.08); border-left: 3px solid #00b4d8; }
  .parent-avatar {
    width: 40px; height: 40px; border-radius: 12px;
    background: linear-gradient(135deg, #00b4d8, #0077b6);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 15px; color: white; flex-shrink: 0;
  }
  .parent-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .parent-sub  { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

  /* RIGHT PANEL — detail view */
  .parent-detail-panel {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 28px;
  }
  .parent-detail-header {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 28px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .parent-avatar-lg {
    width: 64px; height: 64px; border-radius: 18px;
    background: linear-gradient(135deg, #00b4d8, #0077b6);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 24px; color: white; flex-shrink: 0;
    box-shadow: 0 4px 20px rgba(0,180,216,0.3);
  }

  /* Children / Absence cards */
  .child-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 16px;
    margin-bottom: 12px;
    transition: transform 0.2s;
  }
  .child-card:hover { transform: translateY(-2px); }
  .child-name { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
  .child-stats {
    display: flex; gap: 12px; flex-wrap: wrap;
  }
  .child-stat {
    display: flex; align-items: center; gap: 5px;
    font-size: 12px; color: var(--text-muted);
    background: rgba(255,255,255,0.05);
    padding: 4px 10px; border-radius: 20px;
  }

  /* Absences table */
  .absences-list { display: flex; flex-direction: column; gap: 8px; }
  .absence-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px;
    background: rgba(255,255,255,0.04);
    border-radius: 10px; font-size: 13px;
    border: 1px solid rgba(255,255,255,0.06);
    animation: fadeSlideUp 0.3s ease both;
  }

  .stats-row-sm {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px; margin-bottom: 24px;
  }
  .stat-sm {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 14px 16px;
    display: flex; align-items: center; gap: 10px;
  }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .empty-panel {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100%; color: var(--text-muted);
    gap: 12px; padding: 60px;
  }
  .tab-pills {
    display: flex; gap: 6px; margin-bottom: 20px;
  }
  .tab-pill {
    padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;
    cursor: pointer; border: 1px solid rgba(255,255,255,0.1);
    background: transparent; color: var(--text-muted);
    transition: all 0.15s;
  }
  .tab-pill.active {
    background: rgba(0,180,216,0.15); color: #00b4d8;
    border-color: rgba(0,180,216,0.3);
  }
`;

function ParentForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name:     initial?.name     || '',
    email:    initial?.email    || '',
    phone:    initial?.phone    || '',
    password: '',
    notes:    initial?.notes    || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <div className="modal-body">
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Parent Name *</label>
            <input className="form-input" value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="Full name" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" type="tel" value={form.phone}
              onChange={e => set('phone', e.target.value)} placeholder="0555 123 456" />
          </div>
          <div className="form-group">
            <label className="form-label">Email (portal login)</label>
            <input className="form-input" type="email" value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="parent@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">{initial ? 'New Password (leave blank to keep)' : 'Portal Password'}</label>
            <input className="form-input" type="password" value={form.password}
              onChange={e => set('password', e.target.value)} placeholder="••••••••" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary"
          onClick={() => { if (form.name) onSave(form); }} disabled={!form.name}>
          {initial ? 'Save Changes' : 'Create Parent Account'}
        </button>
      </div>
    </>
  );
}

function AbsenceForm({ onSave, onClose }) {
  const { data: students = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients', { params: { simple: 'true' } }).then(r => r.data.data),
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get('/subjects').then(r => r.data),
  });

  const [form, setForm] = useState({
    student_id: '', subject_id: '', absence_date: new Date().toISOString().split('T')[0],
    is_justified: false, justification: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <div className="modal-body">
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Student *</label>
            <select className="form-select" value={form.student_id} onChange={e => set('student_id', e.target.value)}>
              <option value="">— Select student —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <select className="form-select" value={form.subject_id} onChange={e => set('subject_id', e.target.value)}>
              <option value="">— Select subject —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input className="form-input" type="date" value={form.absence_date}
              onChange={e => set('absence_date', e.target.value)} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={form.is_justified} onChange={e => set('is_justified', e.target.checked)} />
              <span className="form-label" style={{ margin: 0 }}>Justified absence</span>
            </label>
          </div>
          {form.is_justified && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Justification</label>
              <textarea className="form-textarea" rows={2} value={form.justification}
                onChange={e => set('justification', e.target.value)} placeholder="Medical, family reason..." />
            </div>
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary"
          onClick={() => { if (form.student_id && form.absence_date) onSave(form); }}
          disabled={!form.student_id || !form.absence_date}>
          Record Absence
        </button>
      </div>
    </>
  );
}

export default function ParentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showParentModal, setShowParentModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [editParent, setEditParent] = useState(null);
  const [detailTab, setDetailTab] = useState('children');

  const { data: parents = [], isLoading } = useQuery({
    queryKey: ['parents'],
    queryFn: () => api.get('/parents').then(r => r.data),
  });

  const { data: absences = [] } = useQuery({
    queryKey: ['absences'],
    queryFn: () => api.get('/parents/absences').then(r => r.data),
  });

  const createParentMutation = useMutation({
    mutationFn: body => api.post('/parents', body),
    onSuccess: () => { qc.invalidateQueries(['parents']); setShowParentModal(false); toast.success('Parent account created!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const updateParentMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/parents/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['parents']); setShowParentModal(false); setEditParent(null); toast.success('Updated!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const createAbsenceMutation = useMutation({
    mutationFn: body => api.post('/parents/absences', body),
    onSuccess: () => { qc.invalidateQueries(['absences']); setShowAbsenceModal(false); toast.success('Absence recorded!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const deleteAbsenceMutation = useMutation({
    mutationFn: id => api.delete(`/parents/absences/${id}`),
    onSuccess: () => { qc.invalidateQueries(['absences']); toast.success('Absence removed'); },
  });

  const selectedParent = parents.find(p => p.id === selectedId);

  const filtered = parents.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone && p.phone.includes(search))
  );

  // Stats
  const totalChildren = parents.reduce((s, p) => s + (p.children?.length || 0), 0);
  const unjustified = absences.filter(a => !a.is_justified).length;

  return (
    <div>
      <style>{css}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Parents</h1>
          <p className="page-subtitle">{parents.length} parents · {totalChildren} children linked</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary"
            onClick={() => setShowAbsenceModal(true)}>
            <AlertCircle size={16} /> Record Absence
          </button>
          <button id="create-parent-btn" className="btn btn-primary"
            onClick={() => { setEditParent(null); setShowParentModal(true); }}>
            <Plus size={16} /> New Parent
          </button>
        </div>
      </div>

      {/* Top stats */}
      <div className="stats-row-sm">
        {[
          { icon: <Users size={18} color="#00b4d8" />, bg: 'rgba(0,180,216,0.15)', val: parents.length, lbl: 'Parents' },
          { icon: <Baby size={18} color="#06d6a0" />, bg: 'rgba(6,214,160,0.15)', val: totalChildren, lbl: 'Children Linked' },
          { icon: <AlertCircle size={18} color="#ef4444" />, bg: 'rgba(239,68,68,0.15)', val: unjustified, lbl: 'Unjustified Absences' },
        ].map((s, i) => (
          <div className="stat-sm" key={i}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 3 }}>{s.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="parents-layout">
        {/* Left: parent list */}
        <div className="parents-list-panel">
          <div className="parents-list-header">
            <span>All Parents</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{filtered.length}</span>
          </div>
          {/* Search */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="search-input-wrapper">
              <Search size={14} className="search-icon" />
              <input className="form-input search-input" placeholder="Search parents..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ fontSize: 13 }} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {isLoading ? (
              <div className="loading-center"><div className="loading-spinner" /></div>
            ) : !filtered.length ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
                No parents found
              </div>
            ) : (
              filtered.map((p, i) => (
                <div
                  key={p.id}
                  className={`parent-item ${selectedId === p.id ? 'active' : ''}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                  onClick={() => { setSelectedId(p.id); setDetailTab('children'); }}
                >
                  <div className="parent-avatar">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="parent-name">{p.name}</div>
                    <div className="parent-sub">
                      {p.children?.length || 0} child{(p.children?.length || 0) !== 1 ? 'ren' : ''} · {p.phone || 'No phone'}
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 6px', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); setEditParent(p); setShowParentModal(true); }}>
                    <Edit3 size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="parent-detail-panel">
          {!selectedParent ? (
            <div className="empty-panel">
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(0,180,216,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={28} color="#00b4d8" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Select a parent</div>
              <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 240 }}>
                Click on a parent in the list to view their details, children, and absences.
              </div>
            </div>
          ) : (
            <>
              {/* Parent header */}
              <div className="parent-detail-header">
                <div className="parent-avatar-lg">{selectedParent.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{selectedParent.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                    {selectedParent.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)' }}>
                        <Phone size={12} /> {selectedParent.phone}
                      </div>
                    )}
                    {selectedParent.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)' }}>
                        <Mail size={12} /> {selectedParent.email}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => { setEditParent(selectedParent); setShowParentModal(true); }}>
                    <Edit3 size={13} /> Edit
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="tab-pills">
                {[
                  { id: 'children', label: `Children (${selectedParent.children?.length || 0})`, icon: <Baby size={12} /> },
                  { id: 'absences', label: `Absences (${absences.filter(a => selectedParent.children?.some(c => c.id === a.student_id)).length})`, icon: <AlertCircle size={12} /> },
                ].map(t => (
                  <button key={t.id} className={`tab-pill ${detailTab === t.id ? 'active' : ''}`}
                    onClick={() => setDetailTab(t.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Children tab */}
              {detailTab === 'children' && (
                <div>
                  {(selectedParent.children || []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <Baby size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
                      <div>No children linked yet</div>
                    </div>
                  ) : (
                    (selectedParent.children || []).map(child => {
                      const childAbsences = absences.filter(a => a.student_id === child.id);
                      const unjust = childAbsences.filter(a => !a.is_justified).length;
                      return (
                        <div key={child.id} className="child-card">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10,
                              background: 'rgba(6,214,160,0.15)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <BookOpen size={16} color="#06d6a0" />
                            </div>
                            <div className="child-name">{child.name}</div>
                          </div>
                          <div className="child-stats" style={{ marginTop: 10 }}>
                            <div className="child-stat">
                              <AlertCircle size={10} />
                              {childAbsences.length} absences
                            </div>
                            {unjust > 0 && (
                              <div className="child-stat" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                                <AlertCircle size={10} color="#ef4444" />
                                {unjust} unjustified
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Absences tab */}
              {detailTab === 'absences' && (() => {
                const childIds = new Set((selectedParent.children || []).map(c => c.id));
                const parentAbsences = absences.filter(a => childIds.has(a.student_id));
                return (
                  <div className="absences-list">
                    {parentAbsences.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <CheckCircle2 size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
                        <div>No absences recorded</div>
                      </div>
                    ) : (
                      parentAbsences.map((a, i) => (
                        <div key={a.id} className="absence-row" style={{ animationDelay: `${i * 40}ms` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: a.is_justified ? '#06d6a0' : '#ef4444',
                              flexShrink: 0
                            }} />
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {a.student_name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {a.subject_name || 'General'} · {new Date(a.absence_date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                              background: a.is_justified ? 'rgba(6,214,160,0.12)' : 'rgba(239,68,68,0.12)',
                              color: a.is_justified ? '#06d6a0' : '#ef4444',
                            }}>
                              {a.is_justified ? 'Justified' : 'Unjustified'}
                            </span>
                            <button className="btn btn-sm"
                              style={{ padding: '2px 5px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                              onClick={() => deleteAbsenceMutation.mutate(a.id)}>
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal open={showParentModal} onClose={() => { setShowParentModal(false); setEditParent(null); }}
        title={editParent ? 'Edit Parent' : 'New Parent Account'}>
        <ParentForm
          key={editParent?.id || 'new'}
          initial={editParent}
          onSave={form => {
            if (editParent) updateParentMutation.mutate({ id: editParent.id, ...form });
            else createParentMutation.mutate(form);
          }}
          onClose={() => { setShowParentModal(false); setEditParent(null); }}
        />
      </Modal>

      <Modal open={showAbsenceModal} onClose={() => setShowAbsenceModal(false)} title="Record Absence">
        <AbsenceForm
          onSave={form => createAbsenceMutation.mutate(form)}
          onClose={() => setShowAbsenceModal(false)}
        />
      </Modal>
    </div>
  );
}
