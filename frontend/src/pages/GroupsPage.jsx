import asArray from '../lib/asArray';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Users, BookOpen, Layers, Edit3, Trash2,
  Search, ChevronRight, GraduationCap, Hash, Loader2
} from 'lucide-react';

/* ── Inline styles / design tokens ─────────────────────────────── */
const css = `
  .groups-page { padding: 0; }

  /* STAT CARDS */
  .groups-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }
  .stat-card-glass {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px;
    padding: 20px;
    display: flex; align-items: center; gap: 14px;
    backdrop-filter: blur(8px);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .stat-card-glass:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  .stat-icon {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .stat-val { font-size: 26px; font-weight: 800; line-height: 1; color: var(--text-primary); }
  .stat-lbl { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 3px; }

  /* GROUP CARDS */
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 18px;
  }
  .group-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px;
    padding: 22px;
    cursor: pointer;
    transition: all 0.22s ease;
    position: relative;
    overflow: hidden;
    animation: fadeSlideUp 0.35s ease both;
  }
  .group-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--gc-color1), var(--gc-color2));
    border-radius: 18px 18px 0 0;
  }
  .group-card:hover {
    transform: translateY(-3px);
    border-color: rgba(255,255,255,0.16);
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    background: rgba(255,255,255,0.07);
  }
  .group-card-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 10px;
    margin-bottom: 14px;
  }
  .group-name { font-size: 17px; font-weight: 700; color: var(--text-primary); }
  .group-level {
    font-size: 11px; font-weight: 600; padding: 3px 10px;
    border-radius: 20px; background: rgba(0,180,216,0.12);
    color: #00b4d8; margin-top: 4px; display: inline-block;
  }
  .group-meta {
    display: flex; gap: 12px; margin-top: 12px;
    padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.07);
  }
  .group-meta-item {
    display: flex; align-items: center; gap: 5px;
    font-size: 12px; color: var(--text-muted);
  }
  .group-student-bar {
    margin-top: 12px;
    height: 5px; background: rgba(255,255,255,0.08); border-radius: 99px;
    overflow: hidden;
  }
  .group-student-bar-fill {
    height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, #00b4d8, #06d6a0);
    transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
  }
  .group-actions {
    display: flex; gap: 6px; opacity: 0;
    transition: opacity 0.15s;
  }
  .group-card:hover .group-actions { opacity: 1; }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* EMPTY */
  .groups-empty {
    text-align: center; padding: 80px 20px;
    color: var(--text-muted);
    animation: fadeSlideUp 0.4s ease;
  }
  .groups-empty-icon {
    width: 72px; height: 72px; border-radius: 20px;
    background: rgba(0,180,216,0.1);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
  }
`;

function GroupForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name:          initial?.name           || '',
    level:         initial?.level          || '',
    academic_year: initial?.academic_year  || '2025-2026',
    max_students:  initial?.max_students   || 30,
    room:          initial?.room           || '',
    notes:         initial?.notes          || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <div className="modal-body">
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Group Name *</label>
            <input className="form-input" value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="e.g. 3ème A" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Academic Level</label>
            <input className="form-input" value={form.level}
              onChange={e => set('level', e.target.value)} placeholder="e.g. 3ème, Terminale" />
          </div>
          <div className="form-group">
            <label className="form-label">Academic Year</label>
            <input className="form-input" value={form.academic_year}
              onChange={e => set('academic_year', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Max Students</label>
            <input className="form-input" type="number" min={1} max={100}
              value={form.max_students} onChange={e => set('max_students', parseInt(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">Room / Location</label>
            <input className="form-input" value={form.room}
              onChange={e => set('room', e.target.value)} placeholder="e.g. Room 12-B" />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={() => { if (form.name) onSave(form); }}
          disabled={!form.name}
        >
          {initial ? 'Save Changes' : 'Create Group'}
        </button>
      </div>
    </>
  );
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: body => api.post('/groups', body),
    onSuccess: () => { qc.invalidateQueries(['groups']); setShowModal(false); toast.success('Group created!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to create group'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/groups/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['groups']); setShowModal(false); setEditGroup(null); toast.success('Group updated!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to update group'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/groups/${id}`),
    onSuccess: () => { qc.invalidateQueries(['groups']); toast.success('Group deleted'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to delete group'),
  });

  const handleSave = (form) => {
    if (editGroup) updateMutation.mutate({ id: editGroup.id, ...form });
    else createMutation.mutate(form);
  };

  const filtered = asArray(groups).filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.level && g.level.toLowerCase().includes(search.toLowerCase()))
  );

  const totalStudents = asArray(groups).reduce((sum, g) => sum + (g.student_count || 0), 0);
  const totalCapacity = asArray(groups).reduce((sum, g) => sum + (g.max_students || 0), 0);
  const activeGroups  = asArray(groups).filter(g => g.is_active).length;

  const CARD_GRADIENTS = [
    ['#00b4d8', '#0077b6'],
    ['#8b5cf6', '#6d28d9'],
    ['#06d6a0', '#059669'],
    ['#f59e0b', '#d97706'],
    ['#ef4444', '#dc2626'],
    ['#ec4899', '#db2777'],
  ];

  return (
    <div className="groups-page">
      <style>{css}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">{groups.length} classrooms · {totalStudents} students enrolled</p>
        </div>
        <div className="page-actions">
          <button id="create-group-btn" className="btn btn-primary"
            onClick={() => { setEditGroup(null); setShowModal(true); }}>
            <Plus size={16} /> New Group
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="groups-stats">
        {[
          { icon: <Layers size={20} color="#00b4d8" />, bg: 'rgba(0,180,216,0.15)',
            val: groups.length, lbl: 'Total Groups' },
          { icon: <GraduationCap size={20} color="#06d6a0" />, bg: 'rgba(6,214,160,0.15)',
            val: totalStudents, lbl: 'Students Enrolled' },
          { icon: <Users size={20} color="#8b5cf6" />, bg: 'rgba(139,92,246,0.15)',
            val: totalCapacity, lbl: 'Total Capacity' },
          { icon: <BookOpen size={20} color="#f59e0b" />, bg: 'rgba(245,158,11,0.15)',
            val: activeGroups, lbl: 'Active Groups' },
        ].map((s, i) => (
          <div className="stat-card-glass" key={i}>
            <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
            <div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="filters-bar" style={{ marginBottom: 20 }}>
        <div className="search-input-wrapper" style={{ maxWidth: 320 }}>
          <Search size={16} className="search-icon" />
          <input className="form-input search-input" placeholder="Search groups..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : !filtered.length ? (
        <div className="groups-empty">
          <div className="groups-empty-icon">
            <Layers size={32} color="#00b4d8" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {search ? 'No groups found' : 'No groups yet'}
          </div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>
            {search ? 'Try a different search term' : 'Create your first classroom group to get started'}
          </div>
          {!search && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create First Group
            </button>
          )}
        </div>
      ) : (
        <div className="groups-grid">
          {filtered.map((group, idx) => {
            const [c1, c2] = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
            const fillPct = group.max_students > 0
              ? Math.min(100, ((group.student_count || 0) / group.max_students) * 100)
              : 0;
            return (
              <div
                key={group.id}
                className="group-card"
                style={{ '--gc-color1': c1, '--gc-color2': c2, animationDelay: `${idx * 50}ms` }}
                onClick={() => navigate(`/groups/${group.id}`)}
              >
                <div className="group-card-header">
                  <div>
                    <div className="group-name">{group.name}</div>
                    {group.level && <div className="group-level">{group.level}</div>}
                  </div>
                  <div className="group-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 7px' }}
                      onClick={() => { setEditGroup(group); setShowModal(true); }} title="Edit group">
                      <Edit3 size={12} />
                    </button>
                    <button className="btn btn-sm"
                      style={{ padding: '4px 7px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                      onClick={() => { if (window.confirm(`Delete "${group.name}"?`)) deleteMutation.mutate(group.id); }}
                      title="Delete group">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Fill bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>{group.student_count || 0} students</span>
                  <span>{group.max_students} max</span>
                </div>
                <div className="group-student-bar">
                  <div className="group-student-bar-fill" style={{ width: `${fillPct}%` }} />
                </div>

                <div className="group-meta">
                  {group.room && (
                    <div className="group-meta-item">
                      <Hash size={11} />
                      <span>{group.room}</span>
                    </div>
                  )}
                  <div className="group-meta-item">
                    <BookOpen size={11} />
                    <span>{group.academic_year}</span>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditGroup(null); }}
        title={editGroup ? 'Edit Group' : 'New Classroom Group'}
      >
        <GroupForm
          key={editGroup?.id || 'new'}
          initial={editGroup}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditGroup(null); }}
        />
      </Modal>
    </div>
  );
}
