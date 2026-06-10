import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ExternalLink, Activity, Edit3, Trash2, Filter, X } from 'lucide-react';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';

const TYPES = [
  { id: 'all', label: 'All Teachers' },
  { id: 'software_tool', label: 'Full-Time' },
  { id: 'printing_house', label: 'Part-Time' },
  { id: 'euro_supplier', label: 'Contract' }
];

export default function SuppliersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  const [form, setForm] = useState({ 
    name: '', type_name: 'software_tool', contact_email: '', contact_phone: '', 
    specialization: '', currency: 'EUR', payment_terms: '', notes: '' 
  });
  
  const [isMobile, setIsMobile] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState({});
  const toggleSupplier = (id) => setExpandedSuppliers(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', filterType],
    queryFn: () => api.get('/suppliers', { params: filterType !== 'all' ? { type: filterType } : {} }).then(r => r.data)
  });

  const handleEdit = (supplier) => {
    setForm(supplier);
    setEditSupplier(supplier);
    setShowAdd(true);
  };

  const addSupplier = useMutation({
    mutationFn: (data) => api.post('/suppliers', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['suppliers']);
      setShowAdd(false);
      setForm({ name: '', type_name: 'software_tool', contact_email: '', contact_phone: '', specialization: '', currency: 'EUR', payment_terms: '', notes: '' });
      toast.success('Teacher added!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add teacher')
  });

  const updateSupplier = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/suppliers/${id}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['suppliers']);
      setShowAdd(false);
      setEditSupplier(null);
      setForm({ name: '', type_name: 'software_tool', contact_email: '', contact_phone: '', specialization: '', currency: 'EUR', payment_terms: '', notes: '' });
      toast.success('Teacher updated!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update teacher')
  });

  const deleteSupplier = useMutation({
    mutationFn: (id) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['suppliers']);
      toast.success('Teacher deleted!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete teacher')
  });

  const handleSave = () => {
    if (editSupplier) updateSupplier.mutate({ id: editSupplier.id, ...form });
    else addSupplier.mutate(form);
  };

  const filtered = (suppliers || []).filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.specialization && s.specialization.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">Manage your teaching staff</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditSupplier(null); setForm({ name: '', type_name: 'software_tool', contact_email: '', contact_phone: '', specialization: '', currency: 'EUR', payment_terms: '', notes: '' }); setShowAdd(true); }}>
          <Plus size={16} /> Add Teacher
        </button>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {/* Top Search Row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                placeholder="Search teachers..."
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
              {filterType !== 'all' && (
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
                  1
                </span>
              )}
            </button>
          </div>

          {/* Toggleable Filter Tray */}
          {showMobileFilters && (
            <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Teacher Type</label>
                <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  {TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              {(search || filterType !== 'all') && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => { setSearch(''); setFilterType('all'); }}
                  style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
                >
                  <X size={13} /> Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <div className="tabs" style={{ marginBottom: 0, flex: 1, overflowX: 'auto', display: 'flex', whiteSpace: 'nowrap' }}>
              {TYPES.map(t => (
                <button key={t.id} className={`tab ${filterType === t.id ? 'active' : ''}`} onClick={() => setFilterType(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative', width: 250 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Search by name or subject..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }} />
            </div>
          </div>
        </div>
      )}

      <div className="table-wrapper" style={isMobile ? { background: 'none', border: 'none', boxShadow: 'none', padding: 0 } : {}}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(s => {
              const isExpanded = !!expandedSuppliers[s.id];
              return (
                <div
                  key={s.id}
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
                  {/* Header: Name, Type and Status / Plus icon */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleSupplier(s.id)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        👨‍🏫 {s.name}
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {TYPES.find(t => t.id === s.type_name)?.label || s.type_name}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                      <span style={{
                        background: s.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: s.is_active ? 'var(--success)' : 'var(--danger)',
                        padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase'
                      }}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSupplier(s.id); }}
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
                      
                      {/* Info block */}
                      {(s.specialization || s.payment_terms || s.contact_email || s.contact_phone) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-surface)', borderRadius: 10, padding: 10, border: '1px solid var(--border)', fontSize: 12 }}>
                          {s.specialization && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                              <span style={{ width: 16, textAlign: 'center' }}>🌍</span>
                              <span>{s.specialization}</span>
                            </div>
                          )}
                          {s.payment_terms && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                              <span style={{ width: 16, textAlign: 'center' }}>💳</span>
                              <span>Terms: {s.payment_terms}</span>
                            </div>
                          )}
                          {s.contact_email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                              <span style={{ width: 16, textAlign: 'center' }}>✉️</span>
                              <span>{s.contact_email}</span>
                            </div>
                          )}
                          {s.contact_phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                              <span style={{ width: 16, textAlign: 'center' }}>📞</span>
                              <span>{s.contact_phone}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Financial Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                        textAlign: 'center',
                        background: 'var(--bg)',
                        padding: '8px 4px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        fontSize: 11
                      }}>
                        <div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Owed</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{parseFloat(s.total_owed).toFixed(2)} DZD</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Paid</div>
                          <div style={{ fontWeight: 700, color: 'var(--success)' }}>{parseFloat(s.total_paid).toFixed(2)} DZD</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Balance</div>
                          <div style={{
                            fontWeight: 700,
                            color: parseFloat(s.total_owed) - parseFloat(s.total_paid) > 0 ? 'var(--warning)' : 'var(--text-primary)'
                          }}>
                            {(parseFloat(s.total_owed) - parseFloat(s.total_paid)).toFixed(2)} DZD
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, padding: '6px 12px', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => navigate(`/suppliers/${s.id}`)}
                        >
                          👁️ View Profile
                        </button>
                        {user?.role === 'admin' && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ flex: 1, padding: '6px 12px', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              onClick={() => handleEdit(s)}
                            >
                              <Edit3 size={14} /> Edit
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ flex: 1, padding: '6px 12px', height: 32, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              onClick={() => { if (window.confirm(`Delete "${s.name}"?`)) deleteSupplier.mutate(s.id); }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!filtered.length && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No teachers found</div>}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name & Type</th>
                <th>Specialization</th>
                <th style={{ textAlign: 'right' }}>Total Owed</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => navigate(`/suppliers/${s.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    {s.is_active ? <span style={{ color: 'var(--success)' }}><Activity size={16} /></span> : <span style={{ color: 'var(--danger)' }}>Inactive</span>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{TYPES.find(t => t.id === s.type_name)?.label || s.type_name}</div>
                  </td>
                  <td>{s.specialization || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{parseFloat(s.total_owed).toFixed(2)} DZD</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>{parseFloat(s.total_paid).toFixed(2)} DZD</td>
                  <td style={{ textAlign: 'right', color: parseFloat(s.total_owed) - parseFloat(s.total_paid) > 0 ? 'var(--warning)' : 'inherit' }}>
                    {(parseFloat(s.total_owed) - parseFloat(s.total_paid)).toFixed(2)} DZD
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                      {user?.role === 'admin' && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 7px' }}
                            onClick={() => handleEdit(s)}
                            title="Edit teacher"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ padding: '4px 7px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                            onClick={() => { if (window.confirm(`Delete "${s.name}"?`)) deleteSupplier.mutate(s.id); }}
                            title="Delete teacher"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>No teachers found</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); setEditSupplier(null); setForm({ name: '', type_name: 'software_tool', contact_email: '', contact_phone: '', specialization: '', currency: 'EUR', payment_terms: '', notes: '' }); }} title={editSupplier ? "Edit Teacher" : "Add Teacher"}>
        <div className="modal-body">
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-input" value={form.type_name} onChange={e => setForm({...form, type_name: e.target.value})}>
                {TYPES.filter(t => t.id !== 'all').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input type="text" className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Teacher full name" />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-input" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Specialization</label>
              <input type="text" className="form-input" value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})} />
            </div>

          </div>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Contract Details</label>
            <input type="text" className="form-input" value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})} placeholder="e.g. Full-time, 3-month contract" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setEditSupplier(null); setForm({ name: '', type_name: 'software_tool', contact_email: '', contact_phone: '', specialization: '', currency: 'EUR', payment_terms: '', notes: '' }); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={addSupplier.isPending || updateSupplier.isPending || !form.name}>
            {editSupplier ? 'Save Changes' : 'Save Teacher'}
          </button>
        </div>
      </Modal>

      {/* Supplier Created Modal removed */}
    </div>
  );
}
