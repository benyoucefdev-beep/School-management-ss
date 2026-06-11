import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Search, GraduationCap, Mail, Phone, User, Edit3, Trash2 } from 'lucide-react';

function ClientForm({ initial, users, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    company_name: initial?.company_name || '',
    contact_name: initial?.contact_name || '',
    contact_email: initial?.contact_email || '',
    contact_phone: initial?.contact_phone || '',
    assigned_manager_ids: initial?.assigned_manager_ids || (initial?.assigned_manager_id ? [initial.assigned_manager_id] : []),
  }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleManager = (uid) => {
    set('assigned_manager_ids', form.assigned_manager_ids.includes(uid)
      ? form.assigned_manager_ids.filter(id => id !== uid)
      : [...form.assigned_manager_ids, uid]
    );
  };

  const handleSubmit = () => {
    onSubmit({
      ...form,
      assigned_manager_id: form.assigned_manager_ids[0] || null,
      assigned_manager_ids: form.assigned_manager_ids,
    });
  };

  const selectedManagers = (users || []).filter(u => form.assigned_manager_ids.includes(u.id));
  const availableManagers = (users || []).filter(u => !form.assigned_manager_ids.includes(u.id));

  return (
    <>
      <div className="modal-body">
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Student Full Name *</label>
            <input className="form-input" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Ahmed Benali" />
          </div>
          <div className="form-group">
            <label className="form-label">Parent Name</label>
            <input className="form-input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="John Smith" />
          </div>
          <div className="form-group">
            <label className="form-label">Parent Email</label>
            <input className="form-input" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="parent@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Parent Phone</label>
            <input className="form-input" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="0555 123 456" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Assigned Staff</label>
            {/* Selected tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: selectedManagers.length ? 8 : 0 }}>
              {selectedManagers.map(u => (
                <span key={u.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
                  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                }}>
                  {u.name}
                  <button
                    type="button"
                    onClick={() => toggleManager(u.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0 }}
                  >×</button>
                </span>
              ))}
            </div>
            {/* Dropdown to add more */}
            {availableManagers.length > 0 && (
              <select
                className="form-select"
                value=""
                onChange={e => { if (e.target.value) toggleManager(e.target.value); }}
              >
                <option value="">+ Add a staff member…</option>
                {availableManagers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          {initial ? 'Save Changes' : 'Create Student'}
        </button>
      </div>
    </>
  );
}

import { useAuth } from '../context/AuthContext';

export default function ClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState(null);

  const [isMobile, setIsMobile] = useState(false);
  const [expandedClients, setExpandedClients] = useState({});
  const toggleClient = (id) => setExpandedClients(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['students', search],
    queryFn: () => api.get('/students', { params: { search, limit: 50 } }).then(r => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/students', body),
    onSuccess: () => {
      qc.invalidateQueries(['clients']);
      setShowCreate(false);
      toast.success('Student added!');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/clients/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries(['clients']);
      setShowCreate(false);
      setEditClient(null);
      toast.success('Student updated!');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['clients']);
      toast.success('Student deleted!');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  const handleSave = (form) => {
    if (editClient) updateMutation.mutate({ id: editClient.id, ...form });
    else createMutation.mutate(form);
  };

  const clients = data?.data || [];

  const serviceLabel = {
    graphic_design: 'Design',
    digital_marketing: 'Marketing',
    dev_transformation: 'Dev',
    content_courses: 'Content',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{data?.total || 0} total students</p>
        </div>
        {user?.role === 'admin' && (
          <div className="page-actions">
            <button id="create-student-btn" className="btn btn-primary" onClick={() => { setEditClient(null); setShowCreate(true); }}>
              <Plus size={16} /> New Student
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-input-wrapper" style={{ maxWidth: 320 }}>
          <Search size={16} className="search-icon" />
          <input
            className="form-input search-input"
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : !clients.length ? (
        <div className="empty-state">
          <div className="empty-state-icon"><GraduationCap size={24} style={{ color: 'var(--text-muted)' }} /></div>
          <div className="empty-state-title">No students yet</div>
          <div className="empty-state-text">Add your first student to get started</div>
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {clients.map(client => {
            const isExpanded = !!expandedClients[client.id];
            return (
              <div
                key={client.id}
                className="card card-sm sp-fadeup"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isExpanded ? 12 : 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  boxShadow: 'var(--shadow-card)',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {/* Header: Parent Name, Company Subtitle & Status/Balance */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleClient(client.id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                      🎓 {client.company_name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                    <span style={{
                      background: client.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                      color: client.is_active ? 'var(--success)' : 'var(--text-muted)',
                      padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase'
                    }}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{ fontWeight: 700, color: parseFloat(client.wallet_balance || 0) < 0 ? 'var(--danger)' : 'var(--success)', fontSize: 13 }}>
                      {parseFloat(client.wallet_balance || 0).toFixed(0)} DZD
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleClient(client.id); }}
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

                {/* Expanded details */}
                {isExpanded && (
                  <div className="sp-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>


                    {/* Contact details */}
                    {(client.contact_name || client.contact_email || client.contact_phone) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-surface)', borderRadius: 10, padding: 10, border: '1px solid var(--border)', fontSize: 12 }}>
                        {client.contact_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: 'var(--text-secondary)' }}>
                            <User size={12} style={{ color: 'var(--text-muted)' }} />
                            {client.contact_name}
                          </div>
                        )}
                        {client.contact_email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                            <Mail size={12} />
                            {client.contact_email}
                          </div>
                        )}
                        {client.contact_phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                            <Phone size={12} />
                            {client.contact_phone}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manager & Joined Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Manager</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {client.manager_name || '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Joined</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                          {client.date_joined ? new Date(client.date_joined).toLocaleDateString() : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Wallet Balance & Active Services */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(client.active_services || []).filter(Boolean).map(s => (
                          <span key={s} className="badge badge-purple" style={{ fontSize: 10 }}>{serviceLabel[s] || s}</span>
                        ))}
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, color: parseFloat(client.wallet_balance || 0) < 0 ? 'var(--danger)' : 'var(--success)', fontSize: 14 }}>
                          {parseFloat(client.wallet_balance || 0).toFixed(2)} DZD
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '6px 12px', fontSize: 12, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        👁️ View Profile
                      </button>
                      {user?.role === 'admin' && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 12px', fontSize: 12, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => { setEditClient(client); setShowCreate(true); }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => { if (window.confirm(`Delete "${client.company_name}"?`)) deleteMutation.mutate(client.id); }}
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Contact</th>
                <th>Manager</th>
                <th>Services</th>
                <th>Wallet</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ fontWeight: 600 }}>{client.company_name}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>
                      {client.contact_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={12} style={{ color: 'var(--text-muted)' }} />
                          {client.contact_name}
                        </div>
                      )}
                      {client.contact_email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                          <Mail size={12} />
                          {client.contact_email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {client.manager_name || '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(client.active_services || []).filter(Boolean).map(s => (
                        <span key={s} className="badge badge-purple">{serviceLabel[s] || s}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: parseFloat(client.wallet_balance || 0) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {parseFloat(client.wallet_balance || 0).toFixed(2)} DZD
                    </span>
                  </td>
                  <td>
                    <span style={{
                      background: client.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                      color: client.is_active ? 'var(--success)' : 'var(--text-muted)',
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase'
                    }}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {client.date_joined ? new Date(client.date_joined).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                      {user?.role === 'admin' && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 7px' }}
                            onClick={() => { setEditClient(client); setShowCreate(true); }}
                            title="Edit student"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '4px 7px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                            onClick={() => { if (window.confirm(`Delete "${client.company_name}"?`)) deleteMutation.mutate(client.id); }}
                            title="Delete student"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditClient(null); }} title={editClient ? "Edit Student" : "New Student"}>
        <ClientForm key={editClient ? editClient.id : 'new'} initial={editClient} users={users} onSubmit={handleSave} onClose={() => { setShowCreate(false); setEditClient(null); }} />
      </Modal>
    </div>
  );
}
