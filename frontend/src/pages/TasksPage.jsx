import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Search, Filter, Lock, ChevronDown, X, Edit3, Trash2 } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { useAuth } from '../context/AuthContext';

// ── STATUS CONFIG ────────────────────────────────────────────────
export const TASK_STATUSES = [
  { value: 'not_started',        label: 'Not Started',              color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  { value: 'in_progress',        label: 'In Progress',              color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  { value: 'blocked',            label: 'Blocked',                  color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  { value: 'waiting_client',     label: 'Waiting Client',           color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)'  },
  { value: 'ready_for_delivery', label: 'Ready for Delivery',       color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  { value: 'need_team_help',     label: 'Need Team Help',           color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  { value: 'completed',          label: 'Completed',                color: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
  { value: 'paused',             label: 'Paused',                   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  { value: 'need_more_info',     label: 'Need More Info',           color: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
  { value: 'to_be_followed',     label: 'To Be Followed',           color: '#06b6d4', bg: 'rgba(6,182,212,0.15)'   },
  { value: 'urgent',             label: 'Urgent — Must Complete',   color: '#dc2626', bg: 'rgba(220,38,38,0.18)'   },
];

const STATUS_MAP = Object.fromEntries(TASK_STATUSES.map(s => [s.value, s]));

export const SERVICE_OPTIONS = [
  { value: 'graphic_design',    label: 'Graphic Design' },
  { value: 'digital_marketing', label: 'Digital Marketing' },
  { value: 'dev_transformation',label: 'Software Dev' },
  { value: 'content_courses',   label: 'Content & Courses' },
  { value: 'printing',          label: 'Printing' },
  { value: 'branding',          label: 'Branding' },
  { value: 'sm_plan',           label: 'SM Plan' },
  { value: 'web_dev',           label: 'Web Dev' },
];
const SERVICE_MAP = Object.fromEntries(SERVICE_OPTIONS.map(s => [s.value, s.label]));

// ── STATUS DROPDOWN (inline) ──────────────────────────────────────
function StatusDropdown({ value, onChange, readOnly }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef();
  const current = STATUS_MAP[value] || TASK_STATUSES[0];

  if (readOnly) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '3px 10px', borderRadius: 20,
        fontSize: 11, fontWeight: 700,
        background: current.bg, color: current.color,
        whiteSpace: 'nowrap',
      }}>
        {current.label}
      </span>
    );
  }

  // Compute fixed position from button rect to escape overflow:hidden containers
  const getDropdownStyle = () => {
    if (!btnRef.current) return { position: 'fixed', zIndex: 9999 };
    const rect = btnRef.current.getBoundingClientRect();
    return {
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      zIndex: 9999,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      minWidth: 200,
      overflow: 'hidden',
    };
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 20,
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: current.bg, color: current.color,
          border: 'none', whiteSpace: 'nowrap',
          transition: 'opacity 0.15s',
        }}
      >
        {current.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div style={getDropdownStyle()}>
            {TASK_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => { onChange(s.value); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--text-primary)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: s.color, flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600, color: s.color }}>{s.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── PROGRESS BAR ─────────────────────────────────────────────────
function ProgressCell({ value = 0, onChange, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const pct = parseInt(value) || 0;

  const color = pct >= 100 ? '#22c55e' : pct >= 70 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';

  if (readOnly) return (
    <div style={{ minWidth: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
      </div>
    </div>
  );

  if (editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number" min={0} max={100}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onChange(parseInt(draft) || 0); }}
        onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(parseInt(draft) || 0); } if (e.key === 'Escape') setEditing(false); }}
        autoFocus
        style={{ width: 52, padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--accent)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
      />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
    </div>
  );

  return (
    <div style={{ minWidth: 80, cursor: 'pointer' }} onClick={() => { setDraft(pct); setEditing(true); }} title="Click to edit">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 11, color, minWidth: 28, textAlign: 'right', fontWeight: 700 }}>{pct}%</span>
      </div>
    </div>
  );
}

// ── WORKING TOGGLE ─────────────────────────────────────────
// Each assigned member sees their own toggle independently.
// All assignees can claim the task simultaneously.
function WorkingToggle({ task, userId, onToggle }) {
  const workerIds = task.active_worker_ids || [];
  const isMe = workerIds.includes(userId);

  return (
    <button
      onClick={() => onToggle(task.id)}
      title={isMe ? 'Click to stop teaching' : 'Click to mark as teaching'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
        background: isMe ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.15)',
        border: `1.5px solid ${isMe ? '#ef4444' : '#22c55e'}`,
        color: isMe ? '#ef4444' : '#22c55e',
        fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
        transition: 'all 0.18s ease',
      }}
    >
      {/* Toggle pill */}
      <span style={{
        display: 'inline-block',
        width: 28, height: 14, borderRadius: 10, position: 'relative',
        background: isMe ? '#ef4444' : '#22c55e',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute',
          top: 2, left: isMe ? 14 : 2,
          width: 10, height: 10, borderRadius: '50%',
          background: 'white',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </span>
      {isMe ? 'Working' : 'Available'}
    </button>
  );
}

// ── INLINE EDITABLE CELL ─────────────────────────────────────────
function EditableCell({ value, onSave, readOnly, placeholder = '—' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  if (readOnly || (!editing)) return (
    <span
      onClick={() => !readOnly && setEditing(true)}
      style={{ cursor: readOnly ? 'default' : 'pointer', color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12 }}
      title={readOnly ? undefined : 'Click to edit'}
    >
      {value || placeholder}
    </span>
  );

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
      onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); if (draft !== value) onSave(draft); } if (e.key === 'Escape') setEditing(false); }}
      autoFocus
      style={{ width: '100%', padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--accent)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
    />
  );
}

// ── TASK CREATE/EDIT MODAL ────────────────────────────────────────
const EMPTY_FORM = { title: '', description: '', client_id: '', service_type: '', assignee_ids: [], start_date: '', deadline: '', status: 'not_started', progress_pct: 0, notes: '', needs_after: '' };

function TaskModal({ task, users, clients, onSave, onClose }) {
  const [form, setForm] = useState(task ? {
    ...EMPTY_FORM, ...task,
    start_date: task.start_date ? task.start_date.split('T')[0] : '',
    deadline: task.deadline ? task.deadline.split('T')[0] : '',
    progress_pct: task.progress_pct || 0,
  } : EMPTY_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleAssignee = (uid) => {
    set('assignee_ids', form.assignee_ids.includes(uid)
      ? form.assignee_ids.filter(id => id !== uid)
      : [...form.assignee_ids, uid]
    );
  };
  const selectedAssignees = (users || []).filter(u => form.assignee_ids.includes(u.id));
  const availableAssignees = (users || []).filter(u => !form.assignee_ids.includes(u.id));

  return (
    <>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Class Title *</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Math - Algebra Chapter 3" autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Student *</label>
            <select className="form-select" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">— Select student —</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <select className="form-select" value={form.service_type} onChange={e => set('service_type', e.target.value)}>
              <option value="">— None —</option>
              {SERVICE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Assigned To</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: selectedAssignees.length ? 8 : 0 }}>
              {selectedAssignees.map(u => (
                <span key={u.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 12, background: 'rgba(99,102,241,0.1)',
                  color: 'var(--accent)', fontSize: 11, fontWeight: 600
                }}>
                  {u.name}
                  <button type="button" onClick={() => toggleAssignee(u.id)} style={{
                    background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                  }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            {availableAssignees.length > 0 && (
              <select className="form-select" value="" onChange={e => { if (e.target.value) toggleAssignee(e.target.value); }}>
                <option value="">+ Add an assignee…</option>
                {availableAssignees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Deadline</label>
            <input className="form-input" type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Progress % ({form.progress_pct}%)</label>
          <input type="range" min={0} max={100} step={5} value={form.progress_pct} onChange={e => set('progress_pct', e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Teacher notes..." />
          </div>
          <div className="form-group">
            <label className="form-label">Next Session Plan</label>
            <textarea className="form-textarea" rows={2} value={form.needs_after || ''} onChange={e => set('needs_after', e.target.value)} placeholder="Next session plan..." />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" rows={2} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Class description..." />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.title || !form.client_id}>
          {task ? 'Save Changes' : 'Create Class'}
        </button>
      </div>
    </>
  );
}

// ── MAIN TASKS PAGE ───────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterAssignee, setFilterAssignee] = useState(isAdmin ? '' : 'me');

  const [isMobile, setIsMobile] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedClients, setExpandedClients] = useState({});
  const toggleClientAccordion = (name) => setExpandedClients(prev => ({ ...prev, [name]: !prev[name] }));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['classes', { filterService, filterStatus, filterClient, filterAssignee }],
    queryFn: () =>
      api.get('/classes', {
        params: {
          service_type: filterService || undefined,
          status: filterStatus || undefined,
          client_id: filterClient || undefined,
          assignee_id: filterAssignee === 'me' ? user?.id : (filterAssignee || undefined),
        },
      }).then(r => r.data),
    staleTime: 30_000,        // treat data as fresh for 30s — no refetch on every visit
    placeholderData: (prev) => prev, // keep showing previous data while new data loads (no flash)
  });

  // Use distinct query keys so these don't conflict with Sidebar's /users poll
  const { data: clientsList } = useQuery({
    queryKey: ['students-list'],
    queryFn: () => api.get('/students', { params: { simple: 'true' } }).then(r => r.data.data),
    staleTime: 120_000,  // clients rarely change
  });
  const { data: usersList } = useQuery({
    queryKey: ['users-list-tasks'],  // isolated key — NOT 'users' (Sidebar polls that every 10s)
    queryFn: () => api.get('/users').then(r => r.data),
    staleTime: 120_000,  // team members rarely change
  });

  const createMutation = useMutation({
    mutationFn: body => api.post('/classes', body),
    onSuccess: () => { qc.invalidateQueries(['tasks']); setShowModal(false); toast.success('Class created'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to create class'),
  });

  // Full-edit mutation (modal save) — invalidates to get fresh server data
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/tasks/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['tasks']); setEditTask(null); setShowModal(false); toast.success('Class updated'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to update class'),
  });

  // Optimistic quick-update (inline status / progress / notes)
  // Updates the cache instantly — no visible reload spinner
  const quickUpdateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/tasks/${id}`, body),
    onMutate: async ({ id, ...body }) => {
      const queryKey = ['tasks', { filterService, filterStatus, filterClient, filterAssignee }];
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, old =>
        (old || []).map(t => t.id === id ? { ...t, ...body } : t)
      );
      return { previous, queryKey };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.queryKey, ctx.previous);
      toast.error(e.response?.data?.error || 'Failed to update class');
    },
    onSettled: (_data, _err, _vars, ctx) => {
      // Reconcile with server silently in background
      if (ctx?.queryKey) qc.invalidateQueries({ queryKey: ctx.queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/tasks/${id}`),
    onSuccess: () => { qc.invalidateQueries(['tasks']); toast.success('Class deleted'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to delete class'),
  });

  // Working toggle mutation — optimistically update active_worker_ids[]
  const workingMutation = useMutation({
    mutationFn: (taskId) => api.put(`/tasks/${taskId}/working`),
    onMutate: async (taskId) => {
      const queryKey = ['tasks', { filterService, filterStatus, filterClient, filterAssignee }];
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, old =>
        (old || []).map(t => {
          if (t.id !== taskId) return t;
          const workerIds = t.active_worker_ids || [];
          const isMe = workerIds.includes(user?.id);
          return {
            ...t,
            active_worker_ids: isMe
              ? workerIds.filter(id => id !== user?.id)  // release
              : [...workerIds, user?.id],                 // claim
          };
        })
      );
      return { previous, queryKey };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.queryKey, ctx.previous);
      toast.error(e.response?.data?.error || 'Failed to update working status');
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if (ctx?.queryKey) qc.invalidateQueries({ queryKey: ctx.queryKey });
    },
  });

  const handleSave = (form) => {
    if (editTask) updateMutation.mutate({ id: editTask.id, ...form });
    else createMutation.mutate(form);
  };

  // Quick-update a single field inline — uses optimistic mutation
  const quickUpdate = (id, field, value) => {
    quickUpdateMutation.mutate({ id, [field]: value });
  };

  const filtered = tasks.filter(t => {
    // Hide completed and blocked from default view
    if (!filterStatus && (t.status === 'completed' || t.status === 'blocked')) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    const assigneeMatch = t.assignees?.some(a => a.name.toLowerCase().includes(q));
    return t.title?.toLowerCase().includes(q) || t.client_name?.toLowerCase().includes(q) || assigneeMatch;
  });

  // Group by client for the spreadsheet look
  const grouped = filtered.reduce((acc, t) => {
    const key = t.client_name || 'No Student';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">All Classes</h1>
          <p className="page-subtitle">{filtered.length} classes{!isAdmin ? ' — — read only' : ''}</p>
        </div>
        {isAdmin && (
          <button id="create-class-btn" className="btn btn-primary" onClick={() => { setEditTask(null); setShowModal(true); }}>
            <Plus size={16} /> New Class
          </button>
        )}
      </div>

      {/* Filters */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {/* Top Search Row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                placeholder="Search classes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 32 }}
              />
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setShowMobileFilters(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px' }}
            >
              <Filter size={16} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {showMobileFilters ? 'Hide' : 'Filter'}
              </span>
              {(isAdmin ? (filterClient || filterService || filterStatus || filterAssignee !== 'me') : filterStatus) && (
                <span style={{
                  background: 'var(--accent)',
                  color: 'white',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 2
                }}>
                  {isAdmin
                    ? (Number(!!filterClient) + Number(!!filterService) + Number(!!filterStatus) + Number(filterAssignee !== 'me'))
                    : Number(!!filterStatus)
                  }
                </span>
              )}
            </button>
          </div>

          {/* Toggleable Filter Tray */}
          {showMobileFilters && (
            <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              {isAdmin && (
                <>
                  <div>
                    <label className="form-label" style={{ marginBottom: 4 }}>Responsible</label>
                    <select className="form-select" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                      <option value="">All Tasks</option>
                      <option value="me">My Tasks</option>
                      {usersList?.map(u => u.id !== user?.id && <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: 4 }}>Client</label>
                    <select className="form-select" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                      <option value="">All Students</option>
                      {clientsList?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: 4 }}>Subject</label>
                    <select className="form-select" value={filterService} onChange={e => setFilterService(e.target.value)}>
                      <option value="">All Subjects</option>
                      {SERVICE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Status</label>
                <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {(isAdmin ? (search || filterClient || filterService || filterStatus || filterAssignee !== 'me') : (search || filterStatus)) && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setSearch('');
                    setFilterStatus('');
                    if (isAdmin) {
                      setFilterClient('');
                      setFilterService('');
                      setFilterAssignee('');
                    }
                  }}
                  style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
                >
                  <X size={13} /> Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              placeholder={isAdmin ? "Search classes, students..." : "Search classes..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>
          {isAdmin && (
            <>
              <select className="form-select" style={{ width: 150 }} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                <option value="">All Tasks</option>
                <option value="me">My Tasks</option>
                {usersList?.map(u => u.id !== user?.id && <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select className="form-select" style={{ width: 170 }} value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                <option value="">All Students</option>
                {clientsList?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <select className="form-select" style={{ width: 160 }} value={filterService} onChange={e => setFilterService(e.target.value)}>
                <option value="">All Subjects</option>
                {SERVICE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </>
          )}
          <select className="form-select" style={{ width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(isAdmin ? (search || filterClient || filterService || filterStatus || filterAssignee !== 'me') : (search || filterStatus)) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('');
                setFilterStatus('');
                if (isAdmin) {
                  setFilterClient('');
                  setFilterService('');
                  setFilterAssignee('');
                }
              }}
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(grouped).map(([clientName, clientTasks]) => {
            const isExpanded = !!expandedClients[clientName];
            return (
              <div
                key={clientName}
                className="card card-sm sp-fadeup"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isExpanded ? 16 : 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderLeft: '4px solid var(--accent)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  boxShadow: 'var(--shadow-card)',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {/* Header: Clickable to toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleClientAccordion(clientName)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      🎓 {clientName}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                    <span style={{
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                      borderRadius: 12,
                      padding: '3px 10px',
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase'
                    }}>
                      {clientTasks.length} {clientTasks.length === 1 ? 'class' : 'classes'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleClientAccordion(clientName); }}
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

                {/* Expanded Drawer: List of tasks for this client inside the same container */}
                {isExpanded && (
                  <div className="sp-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                    {clientTasks.map((task, idx) => {
                      const isOverdue = task.deadline && task.status !== 'completed' && task.status !== 'done' && isPast(parseISO(task.deadline));
                      const svcLabel = SERVICE_MAP[task.service_type] || task.service_type || '';
                      const canEdit = isAdmin || (task.assignee_ids || []).includes(user?.id);

                      return (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            paddingTop: idx > 0 ? 16 : 0,
                            borderTop: idx > 0 ? '1px dashed var(--border)' : 'none',
                          }}
                        >
                          {/* Task Header: Service Pill, Locked Icon, Working Toggle & Status Dropdown */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {svcLabel ? (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  background: 'rgba(20,184,166,0.1)',
                                  color: '#14b8a6',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                }}>
                                  {svcLabel}
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>No Service</span>
                              )}
                              {task.is_locked && <Lock size={12} color="var(--text-muted)" />}
                              {/* Working toggle — mobile, only for this assignee */}
                              {(isAdmin || (task.assignee_ids || []).includes(user?.id) || task.assignees?.some(a => a.id === user?.id)) && (
                                <WorkingToggle
                                  task={task}
                                  userId={user?.id}
                                  onToggle={(id) => workingMutation.mutate(id)}
                                />
                              )}
                            </div>
                            <StatusDropdown
                              value={task.status}
                              readOnly={!canEdit}
                              onChange={v => quickUpdate(task.id, 'status', v)}
                            />
                          </div>

                          {/* Class Title */}
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                            {task.title}
                          </div>

                          {/* Description */}
                          {task.description && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                              {task.description}
                            </div>
                          )}

                          {/* Progress */}
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Progress</div>
                            <ProgressCell
                              value={task.progress_pct}
                              readOnly={!canEdit}
                              onChange={v => quickUpdate(task.id, 'progress_pct', v)}
                            />
                          </div>

                          {/* Responsible Team Members */}
                          {task.assignees && task.assignees.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Responsible</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {task.assignees.map((a, i) => (
                                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: 11 }} title={a.name}>
                                    {a.photo_url ? (
                                      <img
                                        src={a.photo_url}
                                        alt={a.name}
                                        style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                        onError={e => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div style={{
                                      width: 18, height: 18, borderRadius: '50%',
                                      background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                                      display: a.photo_url ? 'none' : 'flex',
                                      alignItems: 'center', justifyContent: 'center',
                                      fontSize: 8, fontWeight: 800, color: 'white', flexShrink: 0,
                                    }}>
                                      {a.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                    </div>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Start Date & Deadline */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-surface)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Start Date</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                                {task.start_date ? format(parseISO(task.start_date), 'dd MMM yyyy') : '—'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Deadline</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)', marginTop: 2 }}>
                                {task.deadline ? format(parseISO(task.deadline), 'dd MMM yyyy') : '—'}
                                {isOverdue && ' ⚠'}
                              </div>
                            </div>
                          </div>

                          {/* Notes & Needs After */}
                          {(task.notes || task.needs_after) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-surface)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
                              {task.notes && (
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  <strong style={{ color: 'var(--accent)' }}>📝 Note: </strong>
                                  <EditableCell
                                    value={task.notes}
                                    readOnly={!canEdit}
                                    placeholder="Add note…"
                                    onSave={v => quickUpdate(task.id, 'notes', v)}
                                  />
                                </div>
                              )}
                              {task.needs_after && (
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  <strong style={{ color: 'var(--info)' }}>⏭️ Next: </strong>
                                  <EditableCell
                                    value={task.needs_after}
                                    readOnly={!canEdit}
                                    placeholder="Next steps…"
                                    onSave={v => quickUpdate(task.id, 'needs_after', v)}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Footer Actions */}
                          {canEdit && (
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setEditTask(task); setShowModal(true); }}
                                style={{ padding: '6px 12px', fontSize: 12 }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                                onClick={() => { if (window.confirm(`Delete "${task.title}"?`)) deleteMutation.mutate(task.id); }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              {tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
            </div>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100, fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border)' }}>
                {/* Desktop table header */}
            {['Client / Business', 'Service', 'Task Description', 'Responsible', 'Working', 'Start Date', 'Deadline', 'Progress %', 'Status', 'Notes', 'Needs After'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left', fontSize: 11,
                    fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    borderRight: '1px solid var(--border)',
                  }}>
                    {h}
                  </th>
                ))}
                <th style={{ width: 60, padding: '10px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([clientName, clientTasks]) => (
                clientTasks.map((task, idx) => {
                  const isOverdue = task.deadline && task.status !== 'completed' && isPast(parseISO(task.deadline));
                  const svcLabel = SERVICE_MAP[task.service_type] || task.service_type || '—';
                  const statusCfg = STATUS_MAP[task.status];
                  const canEdit = isAdmin || (task.assignee_ids || []).includes(user?.id);

                  return (
                    <tr
                      key={task.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: idx % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)'}
                    >
                      {/* CLIENT */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-primary)', minWidth: 120 }}>
                        {idx === 0 ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                            background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
                            fontSize: 11, fontWeight: 700,
                          }}>
                            {clientName}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, paddingLeft: 8 }}>↳</span>
                        )}
                      </td>

                      {/* SERVICE */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', minWidth: 110 }}>
                        {task.service_type ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                            background: 'rgba(20,184,166,0.1)', color: '#14b8a6',
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {svcLabel}
                          </span>
                        ) : '—'}
                      </td>

                      {/* TASK TITLE */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {task.is_locked && <Lock size={11} color="var(--text-muted)" />}
                          <span
                            style={{ fontWeight: 600, color: 'var(--text-primary)', cursor: canEdit ? 'pointer' : 'default', lineHeight: 1.3 }}
                            onClick={() => canEdit && (setEditTask(task), setShowModal(true))}
                            title={canEdit ? 'Click to edit' : task.title}
                          >
                            {task.title}
                          </span>
                        </div>
                        {task.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
                            {task.description.length > 60 ? task.description.slice(0, 60) + '…' : task.description}
                          </div>
                        )}
                      </td>

                      {/* RESPONSIBLE */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', minWidth: 140 }}>
                        {task.assignees && task.assignees.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {task.assignees.map((a, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={a.name}>
                                {a.photo_url ? (
                                  <img
                                    src={a.photo_url}
                                    alt={a.name}
                                    style={{
                                      width: 24, height: 24, borderRadius: '50%',
                                      objectFit: 'cover', flexShrink: 0,
                                      border: '2px solid var(--border)',
                                    }}
                                    onError={e => {
                                      // fallback to initials on broken image
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                                  display: a.photo_url ? 'none' : 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontSize: 9, fontWeight: 800, color: 'white', flexShrink: 0,
                                }}>
                                  {a.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {a.name.split(' ')[0]}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* WORKING TOGGLE — visible to assignees only */}
                      <td style={{ padding: '8px 10px', borderRight: '1px solid var(--border)', minWidth: 120 }}>
                        {(isAdmin || (task.assignee_ids || []).includes(user?.id) || task.assignees?.some(a => a.id === user?.id)) && (
                          <WorkingToggle
                            task={task}
                            userId={user?.id}
                            onToggle={(id) => workingMutation.mutate(id)}
                          />
                        )}
                      </td>

                      {/* START DATE */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: 90 }}>
                        {task.start_date ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {format(parseISO(task.start_date), 'dd MMM yyyy')}
                          </span>
                        ) : '—'}
                      </td>

                      {/* DEADLINE */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: 90 }}>
                        {task.deadline ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {format(parseISO(task.deadline), 'dd MMM yyyy')}
                            {isOverdue && ' ⚠'}
                          </span>
                        ) : '—'}
                      </td>

                      {/* PROGRESS */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', minWidth: 100 }}>
                        <ProgressCell
                          value={task.progress_pct}
                          readOnly={!canEdit}
                          onChange={v => quickUpdate(task.id, 'progress_pct', v)}
                        />
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', minWidth: 160 }}>
                        <StatusDropdown
                          value={task.status}
                          readOnly={!canEdit}
                          onChange={v => quickUpdate(task.id, 'status', v)}
                        />
                      </td>

                      {/* NOTES */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', minWidth: 140 }}>
                        <EditableCell
                          value={task.notes}
                          readOnly={!canEdit}
                          placeholder="Add note…"
                          onSave={v => quickUpdate(task.id, 'notes', v)}
                        />
                      </td>

                      {/* NEEDS AFTER */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', minWidth: 140 }}>
                        <EditableCell
                          value={task.needs_after}
                          readOnly={!canEdit}
                          placeholder="Next steps…"
                          onSave={v => quickUpdate(task.id, 'needs_after', v)}
                        />
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 7px' }}
                              onClick={() => { setEditTask(task); setShowModal(true); }}
                              title="Edit task"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ padding: '4px 7px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                              onClick={() => { if (window.confirm(`Delete "${task.title}"?`)) deleteMutation.mutate(task.id); }}
                              title="Delete task"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal open={showModal} onClose={() => { setShowModal(false); setEditTask(null); }} title={editTask ? 'Edit Task' : 'New Task'} size="modal-lg">
          <TaskModal
            task={editTask}
            users={usersList}
            clients={clientsList}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditTask(null); }}
          />
        </Modal>
      )}
    </div>
  );
}
