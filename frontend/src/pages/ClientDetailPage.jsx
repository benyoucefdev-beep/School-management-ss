import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { HealthBadge, StatusBadge } from '../components/Badges';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Edit2, Plus, Trash2, FileText, Download, ExternalLink,
  DollarSign, TrendingDown, Wallet, Receipt, ChevronDown, X, QrCode,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const CLIENT_STATUSES = [
  { value: 'active',   label: 'Active',   color: 'rgba(16,185,129,0.15)', text: 'var(--success)' },
  { value: 'inactive', label: 'Inactive', color: 'rgba(100,116,139,0.15)', text: 'var(--text-muted)' },
  { value: 'prospect', label: 'Prospect', color: 'rgba(251,191,36,0.15)', text: '#f59e0b' },
  { value: 'churned',  label: 'Churned',  color: 'rgba(239,68,68,0.15)', text: 'var(--danger)' },
];

const TASK_STATUSES = [
  'not_started','in_progress','blocked','waiting_client',
  'ready_for_delivery','need_team_help','paused','need_more_info','to_be_followed','urgent','completed',
];
const SERVICE_TYPES = ['graphic_design','digital_marketing','dev_transformation','content_courses'];

const TABS = ['Overview', 'Tasks', 'Ads Spend', 'Files', 'Notes & Log'];
const FOLDERS = ['briefs', 'deliverables', 'brand_assets', 'contracts'];
const SERVICE_LABELS = {
  graphic_design: 'Graphic Design', digital_marketing: 'Digital Marketing',
  dev_transformation: 'Dev Transformation', content_courses: 'Content & Courses',
};
const PLATFORMS = ['facebook', 'tiktok', 'google', 'instagram', 'other'];

const fmt = (n) => Number(n || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [noteContent, setNoteContent] = useState('');
  const [showAddFile, setShowAddFile] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [showLogPayment, setShowLogPayment] = useState(false);
  const [showLogVersement, setShowLogVersement] = useState(false);
  const [showEditVersement, setShowEditVersement] = useState(false);
  const [editingVersement, setEditingVersement] = useState(null);
  const [showAddSpend, setShowAddSpend] = useState(false);
  const [showEditSpend, setShowEditSpend] = useState(false);
  const [editingSpend, setEditingSpend] = useState(null);
  const [editSpendForm, setEditSpendForm] = useState({ platform: 'facebook', amount: '', spend_date: '', end_date: '', notes: '' });
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', service_type: '', assignee_ids: [], deadline: '', status: 'not_started' });
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [clientStatus, setClientStatus] = useState(null);
  const [fileForm, setFileForm] = useState({ folder: 'briefs', file_name: '', file_url: '' });
  const [editForm, setEditForm] = useState({});
  const [paymentForm, setPaymentForm] = useState({ invoice_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
  const [versementForm, setVersementForm] = useState({ amount_dzd: '', versement_date: new Date().toISOString().split('T')[0], notes: '' });
  const [editVersementForm, setEditVersementForm] = useState({ amount_dzd: '', versement_date: '', notes: '' });
  const [spendForm, setSpendForm] = useState({ platform: 'facebook', amount: '', spend_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' });
  const [showQr, setShowQr] = useState(false);
  const { user } = useAuth();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.get('/tasks', { params: { client_id: id } }).then(r => r.data),
    enabled: tab === 1,
  });

  const { data: invoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get('/finance/invoices', { params: { client_id: id } }).then(r => r.data),
    enabled: tab === 0,
  });

  const { data: versements, refetch: refetchVersements } = useQuery({
    queryKey: ['versements', id],
    queryFn: () => api.get('/finance/versements', { params: { client_id: id } }).then(r => r.data),
    enabled: tab === 0,
  });

  const { data: quotes } = useQuery({
    queryKey: ['quotes', id],
    queryFn: () => api.get('/finance/quotes', { params: { client_id: id } }).then(r => r.data),
    enabled: tab === 0,
  });

  const { data: adsData, refetch: refetchAds } = useQuery({
    queryKey: ['ads-client', id],
    queryFn: () => api.get(`/ads/client/${id}`).then(r => r.data),
    enabled: tab === 2,
  });

  const { data: files } = useQuery({
    queryKey: ['files', id],
    queryFn: () => api.get(`/clients/${id}/files`).then(r => r.data),
    enabled: tab === 3,
  });

  const { data: notes } = useQuery({
    queryKey: ['notes', id],
    queryFn: () => api.get(`/clients/${id}/notes`).then(r => r.data),
    enabled: tab === 4,
  });

  const { data: activity } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => api.get(`/clients/${id}/activity`).then(r => r.data),
    enabled: tab === 4,
  });

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) });



  // ── Mutations ──────────────────────────────────────────────────
  const addNote = useMutation({
    mutationFn: () => api.post(`/clients/${id}/notes`, { content: noteContent }),
    onSuccess: () => { qc.invalidateQueries(['notes', id]); setNoteContent(''); toast.success('Note added'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId) => api.delete(`/clients/${id}/notes/${noteId}`),
    onSuccess: () => { qc.invalidateQueries(['notes', id]); toast.success('Note deleted'); },
  });

  const addFile = useMutation({
    mutationFn: () => api.post(`/clients/${id}/files`, fileForm),
    onSuccess: () => { qc.invalidateQueries(['files', id]); setShowAddFile(false); toast.success('File added'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateClient = useMutation({
    mutationFn: (body) => api.put(`/clients/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['client', id]); setShowEditClient(false); toast.success('Client updated'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteFile = useMutation({
    mutationFn: (fileId) => api.delete(`/clients/${id}/files/${fileId}`),
    onSuccess: () => { qc.invalidateQueries(['files', id]); toast.success('File deleted'); },
  });

  const logPayment = useMutation({
    mutationFn: (body) => api.post('/finance/payments', body),
    onSuccess: () => {
      qc.invalidateQueries(['invoices', id]);
      qc.invalidateQueries(['client', id]);
      setShowLogPayment(false);
      setPaymentForm({ invoice_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
      toast.success('Invoice settled — wallet deducted!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const logVersement = useMutation({
    mutationFn: (body) => api.post('/finance/versements', body),
    onSuccess: () => {
      qc.invalidateQueries(['versements', id]);
      qc.invalidateQueries(['client', id]);
      setShowLogVersement(false);
      setVersementForm({ amount_dzd: '', versement_date: new Date().toISOString().split('T')[0], notes: '' });
      toast.success('Bon de Versement logged — wallet credited!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteVersement = useMutation({
    mutationFn: (vid) => api.delete(`/finance/versements/${vid}`),
    onSuccess: () => {
      qc.invalidateQueries(['versements', id]);
      qc.invalidateQueries(['client', id]);
      toast.success('Versement deleted, wallet reversed');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const editVersement = useMutation({
    mutationFn: ({ vid, ...body }) => api.put(`/finance/versements/${vid}`, body),
    onSuccess: () => {
      qc.invalidateQueries(['versements', id]);
      qc.invalidateQueries(['client', id]);
      setShowEditVersement(false);
      setEditingVersement(null);
      toast.success('Versement updated, wallet adjusted!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const addTask = useMutation({
    mutationFn: (body) => api.post('/tasks', body),
    onSuccess: () => {
      qc.invalidateQueries(['tasks', id]);
      setShowAddTask(false);
      setTaskForm({ title: '', description: '', service_type: '', assignee_ids: [], deadline: '', status: 'not_started' });
      toast.success('Task created!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateTaskStatus = useMutation({
    mutationFn: ({ taskId, status }) => api.put(`/tasks/${taskId}`, { status }),
    onSuccess: () => qc.invalidateQueries(['tasks', id]),
    onError: e => toast.error(e.response?.data?.error || 'Failed to move task'),
  });

  const draggedTaskId = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const updateClientStatus = useMutation({
    mutationFn: (status) => api.put(`/clients/${id}`, { client_status: status }),
    onSuccess: (_, status) => {
      qc.invalidateQueries(['client', id]);
      setClientStatus(status);
      setStatusDropdownOpen(false);
      toast.success('Client status updated!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const logAdSpend = useMutation({
    mutationFn: (body) => api.post('/ads/spend', body),
    onSuccess: () => {
      qc.invalidateQueries(['ads-client', id]);
      qc.invalidateQueries(['client', id]);
      setShowAddSpend(false);
      setSpendForm({ platform: 'facebook', amount: '', spend_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' });
      toast.success('Ad spend logged!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteSpend = useMutation({
    mutationFn: (spendId) => api.delete(`/ads/spend/${spendId}`),
    onSuccess: () => { qc.invalidateQueries(['ads-client', id]); qc.invalidateQueries(['client', id]); toast.success('Spend deleted, wallet refunded'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const editAdSpend = useMutation({
    mutationFn: ({ sid, ...body }) => api.put(`/ads/spend/${sid}`, body),
    onSuccess: () => {
      qc.invalidateQueries(['ads-client', id]);
      qc.invalidateQueries(['client', id]);
      setShowEditSpend(false);
      setEditingSpend(null);
      toast.success('Ad spend updated, wallet adjusted!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  if (isLoading) return <div className="loading-center"><div className="loading-spinner" />Loading client...</div>;
  if (!client) return <div className="loading-center">Client not found</div>;

  const walletBalance = parseFloat(client.wallet_balance || 0);
  const spendLogs = adsData?.spend_logs || [];
  const totalSpendUsd = parseFloat(adsData?.totals?.total_usd || 0);
  const totalSpendDzd = parseFloat(adsData?.totals?.total_dzd || 0);

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/clients')}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{client.student_name}</h1>
            {/* Status Dropdown */}
            {user?.role === 'admin' ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setStatusDropdownOpen(o => !o)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: (() => {
                      const s = clientStatus || client.client_status || (client.is_active ? 'active' : 'inactive');
                      return CLIENT_STATUSES.find(x => x.value === s)?.color || 'rgba(16,185,129,0.15)';
                    })(),
                    color: (() => {
                      const s = clientStatus || client.client_status || (client.is_active ? 'active' : 'inactive');
                      return CLIENT_STATUSES.find(x => x.value === s)?.text || 'var(--success)';
                    })(),
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                  }}
                >
                  {(() => {
                    const s = clientStatus || client.client_status || (client.is_active ? 'active' : 'inactive');
                    return CLIENT_STATUSES.find(x => x.value === s)?.label || s;
                  })()}
                  <ChevronDown size={10} />
                </button>
                {statusDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    zIndex: 100, minWidth: 130, overflow: 'hidden',
                  }}>
                    {CLIENT_STATUSES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => updateClientStatus.mutate(s.value)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '8px 14px', background: 'none', border: 'none',
                          cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          color: s.text, textTransform: 'uppercase',
                        }}
                      >{s.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span style={{
                background: client.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                color: client.is_active ? 'var(--success)' : 'var(--text-muted)',
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase'
              }}>
                {client.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
          <p className="page-subtitle">
            {client.contact_name} · {client.contact_email} · {client.contact_phone}
          </p>
        </div>
        {user?.role === 'admin' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowQr(true)} title="Client Portal QR Code">
              <QrCode size={14} /> QR Portal
            </button>
            <button className="btn btn-secondary" onClick={() => { setEditForm(client); setShowEditClient(true); }}>
              <Edit2 size={14} /> Edit
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm(`Delete "${client.student_name}"?`)) {
                  api.delete(`/clients/${client.id}`).then(() => {
                    toast.success('Client deleted');
                    navigate('/clients');
                  }).catch(() => toast.error('Failed to delete'));
                }
              }}
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ══ Tab 0: Overview ══ */}
      {tab === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Client Info */}
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Client Info</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                {[
                  ['Manager', client.manager_name || '—'],
                  ['Joined', client.date_joined ? format(new Date(client.date_joined), 'MMM d, yyyy') : '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet */}
            <div className="card" style={{ background: walletBalance >= 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${walletBalance >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Client Wallet</h3>
                  <div style={{ fontSize: 32, fontWeight: 800, color: walletBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {fmt(walletBalance)} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>DZD</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    {walletBalance >= 0 ? '✓ Balance available' : '⚠ Wallet overdrawn'}
                  </div>
                </div>
                <Wallet size={28} style={{ color: walletBalance >= 0 ? 'var(--success)' : 'var(--danger)', opacity: 0.5 }} />
              </div>
              {user?.role === 'admin' && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() => setShowLogVersement(true)}
                >
                  <DollarSign size={13} /> Log Bon de Versement
                </button>
              )}
            </div>
          </div>

          {/* Enrolled Subjects */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Enrolled Subjects</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {client.services?.filter(s => s.is_active).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{SERVICE_LABELS[s.service_type] || s.service_type}</span>
                  <StatusBadge status={s.delivery_status} />
                </div>
              ))}
              {!client.services?.filter(s => s.is_active).length && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No active services</div>
              )}
            </div>
          </div>



          {/* Quotations */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Quotations</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Number</th><th>Status</th><th>Total</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {(quotes || []).map(q => (
                    <tr key={q.id}>
                      <td className="font-mono">{q.quote_number}</td>
                      <td><StatusBadge status={q.status} /></td>
                      <td style={{ fontWeight: 600 }}>{fmt(q.grand_total)} DZD</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{format(new Date(q.created_at), 'MMM d, yyyy')}</td>
                      <td>
                        <a href={`/api/finance/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                          <Download size={12} /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                  {!quotes?.length && <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No quotations yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bon de Versements History */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Bons de Versement <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 600, marginLeft: 8 }}>↑ Credits wallet</span></h3>
              {user?.role === 'admin' && (
                <button className="btn btn-success btn-sm" onClick={() => setShowLogVersement(true)}>
                  <Plus size={13} /> New Versement
                </button>
              )}
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Number</th><th>Amount</th><th>Date</th><th>Notes</th>{user?.role === 'admin' && <th style={{ width: 80 }} />}</tr></thead>
                <tbody>
                  {(versements || []).map(v => (
                    <tr key={v.id}>
                      <td className="font-mono" style={{ fontWeight: 600, color: 'var(--success)' }}>{v.versement_number}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>+{fmt(v.amount_dzd)} DZD</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{format(new Date(v.versement_date), 'MMM d, yyyy')}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{v.notes || '—'}</td>
                      {user?.role === 'admin' && (
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-sm"
                              style={{ padding: '4px 7px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'none' }}
                              onClick={() => {
                                setEditingVersement(v);
                                setEditVersementForm({ amount_dzd: v.amount_dzd, versement_date: v.versement_date?.split('T')[0], notes: v.notes || '' });
                                setShowEditVersement(true);
                              }}
                              title="Edit versement"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ padding: '4px 7px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                              onClick={() => { if (window.confirm('Delete this versement? The wallet credit will be reversed.')) deleteVersement.mutate(v.id); }}
                              title="Delete versement"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!versements?.length && <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No versements yet — use the button above to log the first deposit</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoices */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Invoices <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, marginLeft: 8 }}>↓ Deducts wallet when settled</span></h3>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Number</th><th>Status</th><th>Total</th><th>Paid</th><th>Due</th><th /></tr></thead>
                <tbody>
                  {(invoices || []).map(inv => (
                    <tr key={inv.id}>
                      <td className="font-mono">{inv.invoice_number}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td style={{ fontWeight: 600 }}>{fmt(inv.grand_total)} DZD</td>
                      <td style={{ fontWeight: 600, color: 'var(--danger)' }}>-{fmt(inv.amount_paid)} DZD</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{format(new Date(inv.due_date), 'MMM d, yyyy')}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <a href={`/api/finance/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                          <Download size={12} /> PDF
                        </a>
                        {inv.status !== 'paid' && user?.role === 'admin' && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', fontSize: 11 }}
                            onClick={() => {
                              const remaining = Math.max(0, parseFloat(inv.grand_total) - parseFloat(inv.amount_paid));
                              setPaymentForm({ invoice_id: inv.id, amount: remaining.toFixed(2), payment_date: new Date().toISOString().split('T')[0], notes: '' });
                              setShowLogPayment(true);
                            }}
                          >
                            <Receipt size={11} /> Settle
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!invoices?.length && <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No invoices yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ Tab 1: Tasks ══ */}
      {tab === 1 && (
        <div>
          {user?.role === 'admin' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={() => setShowAddTask(true)}>
                <Plus size={14} /> Add Task
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {['todo', 'in_progress', 'in_review', 'done'].map(colKey => {
            // Map column key → actual DB status value
            const colStatus =
              colKey === 'todo' ? 'not_started' :
              colKey === 'in_review' ? 'ready_for_delivery' :
              colKey === 'done' ? 'completed' :
              colKey;

            const colTasks = (tasks || []).filter(t => {
              if (colKey === 'todo') {
                return t.status === 'not_started' || t.status === 'todo' || t.status === 'paused' || t.status === 'to_be_followed';
              }
              if (colKey === 'in_progress') {
                return t.status === 'in_progress' || t.status === 'blocked' || t.status === 'waiting_client' || t.status === 'need_team_help' || t.status === 'need_more_info' || t.status === 'urgent';
              }
              if (colKey === 'in_review') {
                return t.status === 'in_review' || t.status === 'ready_for_delivery';
              }
              if (colKey === 'done') {
                return t.status === 'done' || t.status === 'completed';
              }
              return t.status === colStatus;
            });

            const labels = { todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done' };
            const isDragOver = dragOverCol === colKey;
            return (
              <div
                key={colKey}
                className="kanban-column"
                style={isDragOver ? { outline: '2px dashed var(--accent)', outlineOffset: -2, background: 'rgba(99,102,241,0.05)' } : {}}
                onDragOver={e => { e.preventDefault(); setDragOverCol(colKey); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null); }}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const taskId = draggedTaskId.current;
                  if (!taskId) return;
                  // Find current status of dragged task
                  const allTasks = tasks || [];
                  const task = allTasks.find(t => t.id === taskId);
                  if (!task) return;
                  let currentColKey;
                  if (['not_started', 'todo', 'paused', 'to_be_followed'].includes(task.status)) {
                    currentColKey = 'todo';
                  } else if (['in_review', 'ready_for_delivery'].includes(task.status)) {
                    currentColKey = 'in_review';
                  } else if (['done', 'completed'].includes(task.status)) {
                    currentColKey = 'done';
                  } else {
                    currentColKey = 'in_progress';
                  }
                  if (currentColKey === colKey) return; // dropped in same column
                  updateTaskStatus.mutate({ taskId, status: colStatus });
                }}
              >
                <div className="kanban-column-header">
                  <span className="kanban-column-title">{labels[colKey]}</span>
                  <span className="kanban-column-count">{colTasks.length}</span>
                </div>
                <div className="kanban-cards">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      className={`task-card ${task.is_locked ? 'locked' : ''}`}
                      draggable={!task.is_locked}
                      onDragStart={e => {
                        draggedTaskId.current = task.id;
                        e.dataTransfer.effectAllowed = 'move';
                        // slight visual fade while dragging
                        setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
                      }}
                      onDragEnd={e => { e.target.style.opacity = '1'; draggedTaskId.current = null; }}
                      onClick={() => navigate(`/tasks?task=${task.id}`)}
                      style={{ cursor: task.is_locked ? 'not-allowed' : 'grab' }}
                    >
                      <div className="task-card-title">{task.title}</div>
                      {task.assignees && task.assignees.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {task.assignees.map(a => (
                            <span key={a.id} style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 10 }}>
                              {a.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Unassigned</div>
                      )}
                      {task.deadline && (
                        <div className={`task-deadline ${new Date(task.deadline) < new Date() ? 'overdue' : ''}`}>
                          Due {format(new Date(task.deadline), 'MMM d')}
                        </div>
                      )}
                    </div>
                  ))}
                  {!colTasks.length && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 8, minHeight: 48 }}>No tasks</div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* ══ Tab 2: Ads Spend ══ */}
      {tab === 2 && (
        <div>
          {/* Summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Payment Balance', value: `${fmt(walletBalance)} DZD`, icon: Wallet, color: walletBalance >= 0 ? '#10b981' : '#ef4444' },
              { label: 'Total Spent (USD)', value: `$${fmt(totalSpendUsd)}`, icon: TrendingDown, color: '#f97316' },
              { label: 'Total Spent (DZD)', value: `${fmt(totalSpendDzd)} DZD`, icon: Receipt, color: '#8b5cf6' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
                <div className="stat-info">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value" style={{ color, fontSize: 20 }}>{value}</div>
                </div>
                <div className="stat-icon" style={{ background: color + '18' }}>
                  <Icon size={20} color={color} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowAddSpend(true)}>
              <Plus size={14} /> Log Ad Spend
            </button>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Amount (USD)</th>
                  <th>Amount (DZD)</th>
                  <th>Spend Date</th>
                  <th>End Date</th>
                  <th>Notes</th>
                  <th>Logged By</th>
                  {user?.role === 'admin' && <th style={{ width: 80 }}></th>}
                </tr>
              </thead>
              <tbody>
                {spendLogs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{log.platform}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>${fmt(log.amount)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmt(log.amount_dzd || log.amount)} DZD</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {log.spend_date ? format(new Date(log.spend_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {log.end_date
                        ? <span style={{ color: new Date(log.end_date) <= new Date() ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                            {format(new Date(log.end_date), 'MMM d, yyyy')}
                          </span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 160 }}>{log.notes || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{log.logged_by_name}</td>
                    {user?.role === 'admin' && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '4px 7px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'none' }}
                            onClick={() => {
                              setEditingSpend(log);
                              setEditSpendForm({
                                platform: log.platform,
                                amount: log.amount,
                                spend_date: log.spend_date?.split('T')[0] || '',
                                end_date: log.end_date?.split('T')[0] || '',
                                notes: log.notes || '',
                              });
                              setShowEditSpend(true);
                            }}
                            title="Edit spend"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '4px 7px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                            onClick={() => { if (window.confirm('Delete this spend entry? Wallet will be refunded.')) deleteSpend.mutate(log.id); }}
                            title="Delete & refund"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!spendLogs.length && (
                  <tr><td colSpan={8} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No spend entries yet — click "Log Ad Spend" to add one</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Tab 3: Files ══ */}
      {tab === 3 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowAddFile(true)}>
              <Plus size={14} /> Add File
            </button>
          </div>
          {FOLDERS.map(folder => {
            const folderFiles = (files || []).filter(f => f.folder === folder);
            if (!folderFiles.length) return null;
            return (
              <div key={folder} style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', marginBottom: 10, color: 'var(--text-secondary)' }}>
                  {folder.replace('_', ' ')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {folderFiles.map(file => (
                    <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText size={16} style={{ color: 'var(--accent)' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{file.file_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>By {file.uploader_name} · {formatDistanceToNow(new Date(file.uploaded_at), { addSuffix: true })}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={file.file_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={12} /></a>
                        <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Are you sure you want to delete this file?')) deleteFile.mutate(file.id); }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!files?.length && <div className="empty-state"><div className="empty-state-title">No files yet</div><div className="empty-state-text">Add files to organize client assets</div></div>}
        </div>
      )}

      {/* ══ Tab 4: Notes & Log ══ */}
      {tab === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Internal Notes</h3>
            <div style={{ marginBottom: 16 }}>
              <textarea className="form-textarea" placeholder="Write an internal note..." value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={3} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => addNote.mutate()} disabled={!noteContent.trim()}>
                Add Note
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(notes || []).map(note => (
                <div key={note.id} style={{ padding: '14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>{note.content}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {note.author_name} · {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </span>
                    <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Are you sure you want to delete this note?')) deleteNote.mutate(note.id); }}><Trash2 size={10} /></button>
                  </div>
                </div>
              ))}
              {!notes?.length && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No notes yet</div>}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Activity Timeline</h3>
            <div className="timeline" style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
              {(activity || []).map(item => {
                const isDeleted = item.action_type === 'invoice_deleted' || item.action_type === 'quote_deleted';
                const exactTime = format(new Date(item.created_at), 'd MMM yyyy, HH:mm');
                return (
                  <div key={item.id} className="timeline-item">
                    <div className="timeline-dot" style={isDeleted ? { background: 'var(--danger)' } : undefined} />
                    <div className="timeline-content">
                      <div className="timeline-description" style={isDeleted ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                        {isDeleted ? '🗑 ' : ''}{item.description}
                      </div>
                      <div className="timeline-meta">
                        {item.user_name && <span>{item.user_name}</span>}
                        <span title={exactTime}>· {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>({exactTime})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!activity?.length && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No activity recorded yet</div>}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Edit Bon de Versement ══ */}
      <Modal open={showEditVersement} onClose={() => { setShowEditVersement(false); setEditingVersement(null); }} title={`Edit Versement ${editingVersement?.versement_number || ''}`}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--accent)' }}>
            ✎ Editing will adjust the client wallet by the difference in amount.
          </div>
          <div className="form-group">
            <label className="form-label">Amount (DZD) *</label>
            <input className="form-input" type="number" step="0.01" value={editVersementForm.amount_dzd} onChange={e => setEditVersementForm(f => ({ ...f, amount_dzd: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Versement Date</label>
            <input className="form-input" type="date" value={editVersementForm.versement_date} onChange={e => setEditVersementForm(f => ({ ...f, versement_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={editVersementForm.notes} onChange={e => setEditVersementForm(f => ({ ...f, notes: e.target.value }))} placeholder="Bank transfer ref, CCP, cash..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setShowEditVersement(false); setEditingVersement(null); }}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!editVersementForm.amount_dzd || editVersement.isPending}
            onClick={() => editVersement.mutate({ vid: editingVersement.id, ...editVersementForm })}
          >
            <Edit2 size={13} /> Save Changes
          </button>
        </div>
      </Modal>

      {/* ══ Modal: Add Task ══ */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="Add Task">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={2} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="What needs to be done?" />
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Service Type</label>
              <select className="form-select" value={taskForm.service_type} onChange={e => setTaskForm(f => ({ ...f, service_type: e.target.value }))}>
                <option value="">— Select —</option>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s] || s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Assignee</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: taskForm.assignee_ids.length ? 8 : 0 }}>
                {(users || []).filter(u => taskForm.assignee_ids.includes(u.id)).map(u => (
                  <span key={u.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 12, background: 'rgba(99,102,241,0.1)',
                    color: 'var(--accent)', fontSize: 11, fontWeight: 600
                  }}>
                    {u.name}
                    <button type="button" onClick={() => setTaskForm(f => ({ ...f, assignee_ids: f.assignee_ids.filter(id => id !== u.id) }))} style={{
                      background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                    }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              {(users || []).filter(u => !taskForm.assignee_ids.includes(u.id)).length > 0 && (
                <select className="form-select" value="" onChange={e => {
                  if (e.target.value) setTaskForm(f => ({ ...f, assignee_ids: [...f.assignee_ids, e.target.value] }));
                }}>
                  <option value="">+ Add an assignee…</option>
                  {(users || []).filter(u => !taskForm.assignee_ids.includes(u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input className="form-input" type="date" value={taskForm.deadline} onChange={e => setTaskForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowAddTask(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!taskForm.title || addTask.isPending}
            onClick={() => addTask.mutate({ ...taskForm, client_id: id, assignee_ids: taskForm.assignee_ids, service_type: taskForm.service_type || null, deadline: taskForm.deadline || null })}
          >
            <Plus size={13} /> Create Task
          </button>
        </div>
      </Modal>

      {/* ══ Modal: Log Bon de Versement ══ */}
      <Modal open={showLogVersement} onClose={() => setShowLogVersement(false)} title="Log Bon de Versement">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--success)' }}>
            ✓ This credits the client wallet. The client is depositing funds before work begins.
          </div>
          <div className="form-group">
            <label className="form-label">Amount (DZD) *</label>
            <input className="form-input" type="number" step="0.01" value={versementForm.amount_dzd} onChange={e => setVersementForm(f => ({ ...f, amount_dzd: e.target.value }))} placeholder="e.g. 50000" />
          </div>
          <div className="form-group">
            <label className="form-label">Versement Date</label>
            <input className="form-input" type="date" value={versementForm.versement_date} onChange={e => setVersementForm(f => ({ ...f, versement_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={versementForm.notes} onChange={e => setVersementForm(f => ({ ...f, notes: e.target.value }))} placeholder="Bank transfer ref, CCP, cash..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowLogVersement(false)}>Cancel</button>
          <button
            className="btn btn-success"
            disabled={!versementForm.amount_dzd || logVersement.isPending}
            onClick={() => logVersement.mutate({ ...versementForm, client_id: id })}
          >
            <DollarSign size={13} /> Log Versement
          </button>
        </div>
      </Modal>

      {/* ══ Modal: Settle Invoice (deducts wallet) ══ */}
      <Modal open={showLogPayment} onClose={() => setShowLogPayment(false)} title="Settle Invoice (Deduct from Wallet)">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>
            ⚠ This DEDUCTS the amount from the client wallet. Make sure the client has enough balance via a Bon de Versement.
          </div>
          <div className="form-group">
            <label className="form-label">Invoice *</label>
            <select className="form-select" value={paymentForm.invoice_id} onChange={e => {
              const inv = (invoices || []).find(i => i.id === e.target.value);
              const remaining = inv ? Math.max(0, parseFloat(inv.grand_total) - parseFloat(inv.amount_paid)).toFixed(2) : '';
              setPaymentForm(f => ({ ...f, invoice_id: e.target.value, amount: remaining }));
            }}>
              <option value="">— Select Invoice —</option>
              {(invoices || []).filter(i => i.status !== 'paid').map(i => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} — {fmt(parseFloat(i.grand_total) - parseFloat(i.amount_paid))} DZD remaining
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (DZD) *</label>
            <input className="form-input" type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount to deduct from wallet" />
          </div>
          <div className="form-group">
            <label className="form-label">Settlement Date</label>
            <input className="form-input" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} placeholder="service tag, reference..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowLogPayment(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ background: 'var(--danger)' }}
            disabled={!paymentForm.invoice_id || !paymentForm.amount || logPayment.isPending}
            onClick={() => logPayment.mutate({ ...paymentForm, client_id: id })}
          >
            <Receipt size={13} /> Settle Invoice
          </button>
        </div>
      </Modal>

      {/* ══ Modal: Edit Ad Spend ══ */}
      <Modal open={showEditSpend} onClose={() => { setShowEditSpend(false); setEditingSpend(null); }} title="Edit Ad Spend">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--accent)' }}>
            ✎ The DZD amount will be recalculated at the current exchange rate. The wallet will be adjusted by the difference.
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Platform *</label>
              <select className="form-select" value={editSpendForm.platform} onChange={e => setEditSpendForm(f => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount (USD) *</label>
              <input className="form-input" type="number" step="0.01" value={editSpendForm.amount} onChange={e => setEditSpendForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 150.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className="form-input" type="date" value={editSpendForm.spend_date} onChange={e => setEditSpendForm(f => ({ ...f, spend_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(auto-invoice on this day)</span></label>
              <input className="form-input" type="date" value={editSpendForm.end_date} onChange={e => setEditSpendForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={editSpendForm.notes} onChange={e => setEditSpendForm(f => ({ ...f, notes: e.target.value }))} placeholder="Campaign name, objective..." />
          </div>
          {editSpendForm.amount && (
            <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', fontSize: 13 }}>
              💱 $<strong>{parseFloat(editSpendForm.amount || 0).toFixed(2)}</strong> USD — wallet will be adjusted by the difference from the original amount
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setShowEditSpend(false); setEditingSpend(null); }}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!editSpendForm.amount || !editSpendForm.platform || !editSpendForm.spend_date || editAdSpend.isPending}
            onClick={() => editAdSpend.mutate({ sid: editingSpend.id, ...editSpendForm })}
          >
            <Edit2 size={13} /> Save Changes
          </button>
        </div>
      </Modal>

      {/* ══ Modal: Log Ad Spend ══ */}
      <Modal open={showAddSpend} onClose={() => setShowAddSpend(false)} title="Log Ad Spend">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Platform *</label>
              <select className="form-select" value={spendForm.platform} onChange={e => setSpendForm(f => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount (USD) *</label>
              <input className="form-input" type="number" step="0.01" value={spendForm.amount} onChange={e => setSpendForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 150.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className="form-input" type="date" value={spendForm.spend_date} onChange={e => setSpendForm(f => ({ ...f, spend_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(auto-invoice on this day)</span></label>
              <input className="form-input" type="date" value={spendForm.end_date} onChange={e => setSpendForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={spendForm.notes} onChange={e => setSpendForm(f => ({ ...f, notes: e.target.value }))} placeholder="Campaign name, objective..." />
          </div>
          {spendForm.amount && (
            <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', fontSize: 13 }}>
              💱 $<strong>{parseFloat(spendForm.amount || 0).toFixed(2)}</strong> USD will be converted at current rate and deducted from wallet in DZD
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowAddSpend(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!spendForm.amount || !spendForm.platform || !spendForm.spend_date || logAdSpend.isPending}
            onClick={() => logAdSpend.mutate({ ...spendForm, client_id: id })}
          >
            Log Spend
          </button>
        </div>
      </Modal>

      {/* ══ Modal: Add File ══ */}
      <Modal open={showAddFile} onClose={() => setShowAddFile(false)} title="Add File">
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Folder</label>
            <select className="form-select" value={fileForm.folder} onChange={e => setFileForm(f => ({ ...f, folder: e.target.value }))}>
              {FOLDERS.map(folder => <option key={folder} value={folder}>{folder.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">File Name</label>
            <input className="form-input" value={fileForm.file_name} onChange={e => setFileForm(f => ({ ...f, file_name: e.target.value }))} placeholder="Brand Guidelines v2.pdf" />
          </div>
          <div className="form-group">
            <label className="form-label">File URL</label>
            <input className="form-input" value={fileForm.file_url} onChange={e => setFileForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://drive.google.com/..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowAddFile(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => addFile.mutate()} disabled={!fileForm.file_name || !fileForm.file_url}>Add File</button>
        </div>
      </Modal>

      {/* ══ Modal: Edit Student ══ */}
      <Modal open={showEditClient} onClose={() => setShowEditClient(false)} title="Edit Student">
        <div className="modal-body">
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Client Name</label>
              <input className="form-input" value={editForm.student_name || ''} onChange={e => setEditForm(f => ({ ...f, student_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Parent Name</label>
              <input className="form-input" value={editForm.contact_name || ''} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Parent Email</label>
              <input className="form-input" type="email" value={editForm.contact_email || ''} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Parent Phone</label>
              <input className="form-input" value={editForm.contact_phone || ''} onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Manager</label>
              <select className="form-select" value={editForm.assigned_manager_id || ''} onChange={e => setEditForm(f => ({ ...f, assigned_manager_id: e.target.value }))}>
                <option value="">— Unassigned —</option>
                {users?.filter(u => u.role !== 'member').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowEditClient(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => updateClient.mutate(editForm)}>Save Changes</button>
        </div>
      </Modal>

      {/* ── QR Portal Modal ── */}
      {showQr && (() => {
        const portalUrl = `${window.location.origin}/portal/${client.portal_token}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(portalUrl)}`;
        return (
          <Modal open={showQr} onClose={() => setShowQr(false)} title="📱 Client Portal QR Code">
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Share this QR code with <strong>{client.student_name}</strong>. When scanned, they'll be asked to register or log in, then see their profile, tasks, wallet, and documents.
              </p>

              {/* QR Image */}
              {client.portal_token ? (
                <div style={{ padding: 16, background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'inline-block' }}>
                  <img src={qrSrc} alt="Portal QR Code" style={{ width: 220, height: 220, display: 'block' }} />
                </div>
              ) : (
                <div style={{ padding: 24, background: 'rgba(239,68,68,0.08)', borderRadius: 12, color: 'var(--danger)', fontSize: 13 }}>
                  ⚠️ Portal token not found. Please run migration 023 in Neon SQL Editor first.
                </div>
              )}

              {/* Portal URL */}
              <div style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {portalUrl}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Link copied!'); }}>
                  <ExternalLink size={14} /> Copy Link
                </button>
                {client.portal_token && (
                  <a href={qrSrc} download={`${client.student_name}-portal-qr.png`} target="_blank" rel="noreferrer" className="btn btn-primary">
                    <Download size={14} /> Download QR
                  </a>
                )}
              </div>

              {/* ── Portal Credentials (admin only) ── */}
              <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 16, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  🔐 Client Portal Credentials
                </div>
                {client.portal_username ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 72, fontWeight: 600 }}>Username</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, fontFamily: 'monospace' }}>{client.portal_username}</span>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => { navigator.clipboard.writeText(client.portal_username); toast.success('Username copied!'); }}
                      >Copy</button>
                    </div>
                    {client.portal_plain_password && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 72, fontWeight: 600 }}>Password</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{client.portal_plain_password}</span>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => { navigator.clipboard.writeText(client.portal_plain_password); toast.success('Password copied!'); }}
                        >Copy</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⏳</span>
                    <span>Client hasn't registered yet. Share the QR so they can create their account.</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowQr(false)}>Close</button>
            </div>
          </Modal>
        );
      })()}
    </div>

  );
}
