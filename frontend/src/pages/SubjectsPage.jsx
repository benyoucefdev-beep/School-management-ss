import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  Plus, Search, BookOpen, Clock, DollarSign,
  Users, Edit3, Trash2, ChevronRight, UserCheck, Palette
} from 'lucide-react';

/* ── Styles ─────────────────────────────────────────────────────── */
const css = `
  .subjects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 18px;
  }
  .subject-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px;
    padding: 22px;
    transition: all 0.22s ease;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    animation: fadeSlideUp 0.35s ease both;
  }
  .subject-card:hover {
    transform: translateY(-3px);
    border-color: rgba(255,255,255,0.16);
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    background: rgba(255,255,255,0.07);
  }
  .subject-card-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    border-radius: 18px 18px 0 0;
  }
  .subject-icon-wrap {
    width: 48px; height: 48px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 14px; flex-shrink: 0;
  }
  .subject-name { font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
  .subject-name-ar { font-size: 13px; color: var(--text-muted); direction: rtl; }
  .subject-chips {
    display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px;
  }
  .subject-chip {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 600;
    background: rgba(255,255,255,0.07); color: var(--text-secondary);
  }
  .subject-teachers-row {
    display: flex; flex-wrap: wrap; gap: 5px;
    margin-top: 12px; padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .subject-teacher-pill {
    font-size: 11px; padding: 2px 9px; border-radius: 12px;
    background: rgba(139,92,246,0.12); color: #a78bfa; font-weight: 500;
  }
  .subject-actions {
    display: flex; gap: 6px; opacity: 0;
    transition: opacity 0.15s; position: absolute; top: 16px; right: 16px;
  }
  .subject-card:hover .subject-actions { opacity: 1; }
  .payment-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 13px;
  }
  .payment-badge {
    padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
  }
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 14px; margin-bottom: 24px;
  }
  .stat-glass {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 16px 20px;
    display: flex; align-items: center; gap: 12px;
    transition: transform 0.2s;
  }
  .stat-glass:hover { transform: translateY(-2px); }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const COLOR_PRESETS = [
  '#00b4d8','#8b5cf6','#06d6a0','#f59e0b','#ef4444',
  '#ec4899','#0ea5e9','#14b8a6','#a855f7','#22c55e',
];

function SubjectForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name:            initial?.name            || '',
    name_ar:         initial?.name_ar         || '',
    description:     initial?.description     || '',
    color_code:      initial?.color_code      || '#00b4d8',
    payment_due_day: initial?.payment_due_day || 1,
    monthly_fee:     initial?.monthly_fee     || 0,
    hours_per_week:  initial?.hours_per_week  || 0,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <div className="modal-body">
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Subject Name *</label>
            <input className="form-input" value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="e.g. Mathematics" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Name in Arabic (optional)</label>
            <input className="form-input" value={form.name_ar}
              onChange={e => set('name_ar', e.target.value)}
              placeholder="الرياضيات" style={{ direction: 'rtl' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Monthly Fee (DZD)</label>
            <input className="form-input" type="number" min={0}
              value={form.monthly_fee} onChange={e => set('monthly_fee', parseFloat(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Due Day</label>
            <input className="form-input" type="number" min={1} max={28}
              value={form.payment_due_day} onChange={e => set('payment_due_day', parseInt(e.target.value))}
              placeholder="Day of month (1-28)" />
          </div>
          <div className="form-group">
            <label className="form-label">Hours / Week</label>
            <input className="form-input" type="number" min={0} step={0.5}
              value={form.hours_per_week} onChange={e => set('hours_per_week', parseFloat(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {COLOR_PRESETS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => set('color_code', c)}
                  style={{
                    width: 28, height: 28, borderRadius: 8, background: c, border: 'none',
                    cursor: 'pointer', outline: form.color_code === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2, transform: form.color_code === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform 0.15s',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={2} value={form.description}
              onChange={e => set('description', e.target.value)} placeholder="Optional description..." />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => { if (form.name) onSave(form); }} disabled={!form.name}>
          {initial ? 'Save Changes' : 'Create Subject'}
        </button>
      </div>
    </>
  );
}

export default function SubjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get('/subjects').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: body => api.post('/subjects', body),
    onSuccess: () => { qc.invalidateQueries(['subjects']); setShowModal(false); toast.success('Subject created!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/subjects/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['subjects']); setShowModal(false); setEditSubject(null); toast.success('Subject updated!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/subjects/${id}`),
    onSuccess: () => { qc.invalidateQueries(['subjects']); setSelectedSubject(null); toast.success('Subject deleted'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const handleSave = (form) => {
    if (editSubject) updateMutation.mutate({ id: editSubject.id, ...form });
    else createMutation.mutate(form);
  };

  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.name_ar && s.name_ar.includes(search))
  );

  const totalFee = subjects.reduce((s, sub) => s + parseFloat(sub.monthly_fee || 0), 0);
  const totalHours = subjects.reduce((s, sub) => s + parseFloat(sub.hours_per_week || 0), 0);

  return (
    <div>
      <style>{css}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.length} subjects · {totalHours.toFixed(1)} hrs/week total</p>
        </div>
        <div className="page-actions">
          <button id="create-subject-btn" className="btn btn-primary"
            onClick={() => { setEditSubject(null); setShowModal(true); }}>
            <Plus size={16} /> New Subject
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        {[
          { icon: <BookOpen size={18} color="#00b4d8" />, bg: 'rgba(0,180,216,0.15)',
            val: subjects.length, lbl: 'Total Subjects' },
          { icon: <Clock size={18} color="#8b5cf6" />, bg: 'rgba(139,92,246,0.15)',
            val: `${totalHours.toFixed(1)}h`, lbl: 'Hours / Week' },
          { icon: <DollarSign size={18} color="#06d6a0" />, bg: 'rgba(6,214,160,0.15)',
            val: `${totalFee.toFixed(0)} DZD`, lbl: 'Total Monthly Fees' },
          { icon: <UserCheck size={18} color="#f59e0b" />, bg: 'rgba(245,158,11,0.15)',
            val: subjects.reduce((s,x) => s + (x.teachers?.length || 0), 0), lbl: 'Teacher Assignments' },
        ].map((s, i) => (
          <div className="stat-glass" key={i}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg,
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

      {/* Search */}
      <div className="filters-bar" style={{ marginBottom: 20 }}>
        <div className="search-input-wrapper" style={{ maxWidth: 320 }}>
          <Search size={16} className="search-icon" />
          <input className="form-input search-input" placeholder="Search subjects..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : !filtered.length ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(0,180,216,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={28} color="#00b4d8" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {search ? 'No subjects found' : 'No subjects yet'}
          </div>
          {!search && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create First Subject
            </button>
          )}
        </div>
      ) : (
        <div className="subjects-grid">
          {filtered.map((subj, idx) => (
            <div
              key={subj.id}
              className="subject-card"
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => setSelectedSubject(subj.id === selectedSubject ? null : subj.id)}
            >
              <div className="subject-card-accent" style={{ background: subj.color_code || '#00b4d8' }} />

              <div className="subject-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-secondary btn-sm" style={{ padding: '4px 7px' }}
                  onClick={() => { setEditSubject(subj); setShowModal(true); }} title="Edit">
                  <Edit3 size={12} />
                </button>
                <button className="btn btn-sm"
                  style={{ padding: '4px 7px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                  onClick={() => { if (window.confirm(`Delete "${subj.name}"?`)) deleteMutation.mutate(subj.id); }} title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Icon + name */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div className="subject-icon-wrap"
                  style={{ background: `${subj.color_code || '#00b4d8'}18` }}>
                  <Palette size={22} color={subj.color_code || '#00b4d8'} />
                </div>
                <div>
                  <div className="subject-name">{subj.name}</div>
                  {subj.name_ar && <div className="subject-name-ar">{subj.name_ar}</div>}
                </div>
              </div>

              {/* Chips */}
              <div className="subject-chips">
                {subj.monthly_fee > 0 && (
                  <div className="subject-chip">
                    <DollarSign size={10} />
                    {parseFloat(subj.monthly_fee).toFixed(0)} DZD/mo
                  </div>
                )}
                {subj.hours_per_week > 0 && (
                  <div className="subject-chip">
                    <Clock size={10} />
                    {subj.hours_per_week}h/wk
                  </div>
                )}
                {subj.payment_due_day && (
                  <div className="subject-chip">
                    Due day {subj.payment_due_day}
                  </div>
                )}
              </div>

              {/* Teachers */}
              {(subj.teachers || []).length > 0 && (
                <div className="subject-teachers-row">
                  {(subj.teachers || []).map(t => (
                    <span key={t.id} className="subject-teacher-pill">
                      <Users size={10} style={{ display: 'inline', marginRight: 3 }} />
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditSubject(null); }}
        title={editSubject ? 'Edit Subject' : 'New Subject'}
      >
        <SubjectForm
          key={editSubject?.id || 'new'}
          initial={editSubject}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditSubject(null); }}
        />
      </Modal>
    </div>
  );
}
