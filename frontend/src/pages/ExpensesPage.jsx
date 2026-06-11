import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

function ExpenseModal({ type, initial, clients, onSave, onClose }) {
  const [form, setForm] = useState(initial || (type === 'fixed'
    ? { name: '', amount: '', frequency: 'monthly', category: '' }
    : { name: '', amount: '', category: 'other', linked_to_client: false, client_id: '', expense_date: new Date().toISOString().split('T')[0] }
  ));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Expense name" />
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Amount (DZD) *</label>
            <input className="form-input" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} min="0" step="0.01" />
          </div>
          {type === 'fixed' ? (
            <>
              <div className="form-group">
                <label className="form-label">Frequency *</label>
                <select className="form-select" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Category</label>
                <input className="form-input" value={form.category || ''} onChange={e => set('category', e.target.value)} placeholder="Software, Facilities, etc." />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="freelancer">Freelancer</option>
                  <option value="tool">Tool</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Linked to Client?</label>
                <select className="form-select" value={form.linked_to_client ? 'yes' : 'no'} onChange={e => set('linked_to_client', e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {form.linked_to_client && (
                <div className="form-group">
                  <label className="form-label">Client</label>
                  <select className="form-select" value={form.client_id || ''} onChange={e => set('client_id', e.target.value)}>
                    <option value="">— Select —</option>
                    {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name || !form.amount}>Save</button>
      </div>
    </>
  );
}

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [showFixed, setShowFixed] = useState(false);
  const [showVariable, setShowVariable] = useState(false);
  const [editFixed, setEditFixed] = useState(null);
  const [editVariable, setEditVariable] = useState(null);

  const [isMobile, setIsMobile] = useState(false);
  const [expandedFixed, setExpandedFixed] = useState({});
  const toggleFixed = (id) => setExpandedFixed(prev => ({ ...prev, [id]: !prev[id] }));
  const [expandedVar, setExpandedVar] = useState({});
  const toggleVar = (id) => setExpandedVar(prev => ({ ...prev, [id]: !prev[id] }));
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: fixed = [] } = useQuery({ queryKey: ['fixed-expenses'], queryFn: () => api.get('/finance/expenses/fixed').then(r => r.data) });
  const { data: variable = [] } = useQuery({ queryKey: ['variable-expenses'], queryFn: () => api.get('/finance/expenses/variable').then(r => r.data) });
  const { data: clients } = useQuery({ queryKey: ['students-list'], queryFn: () => api.get('/students', { params: { limit: 100 } }).then(r => r.data.data) });

  const createFixed = useMutation({ mutationFn: b => api.post('/finance/expenses/fixed', b), onSuccess: () => { qc.invalidateQueries(['fixed-expenses']); setShowFixed(false); toast.success('Fixed expense added'); }, onError: e => toast.error(e.response?.data?.error || 'Failed to create expense') });
  const updateFixed = useMutation({ mutationFn: ({ id, ...b }) => api.put(`/finance/expenses/fixed/${id}`, b), onSuccess: () => { qc.invalidateQueries(['fixed-expenses']); setEditFixed(null); toast.success('Updated'); }, onError: e => toast.error(e.response?.data?.error || 'Failed to update expense') });
  const deleteFixed = useMutation({ mutationFn: id => api.delete(`/finance/expenses/fixed/${id}`), onSuccess: () => { qc.invalidateQueries(['fixed-expenses']); toast.success('Deleted'); } });

  const createVariable = useMutation({ mutationFn: b => api.post('/finance/expenses/variable', b), onSuccess: () => { qc.invalidateQueries(['variable-expenses']); setShowVariable(false); toast.success('Variable expense added'); }, onError: e => toast.error(e.response?.data?.error || 'Failed to create expense') });
  const updateVariable = useMutation({ mutationFn: ({ id, ...b }) => api.put(`/finance/expenses/variable/${id}`, b), onSuccess: () => { qc.invalidateQueries(['variable-expenses']); setEditVariable(null); toast.success('Updated'); }, onError: e => toast.error(e.response?.data?.error || 'Failed to update expense') });
  const deleteVariable = useMutation({ mutationFn: id => api.delete(`/finance/expenses/variable/${id}`), onSuccess: () => { qc.invalidateQueries(['variable-expenses']); toast.success('Deleted'); } });

  const totalFixed = fixed.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalVariable = variable.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Fixed: ${totalFixed.toLocaleString()} · Variable: ${totalVariable.toLocaleString()}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 32 : 24 }}>
        {/* Fixed Expenses */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Fixed Expenses</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowFixed(true)}><Plus size={14} /> Add</button>
          </div>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {fixed.map(e => {
                const isExpanded = !!expandedFixed[e.id];
                return (
                  <div
                    key={e.id}
                    className="card card-sm sp-fadeup"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: isExpanded ? 10 : 0,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 16,
                      boxShadow: 'var(--shadow-card)',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {/* Collapsed Header: Name, Amount & Plus Icon */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleFixed(e.id)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          {e.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            Category: {e.category || '—'}
                          </span>
                          <span className="badge badge-purple" style={{ textTransform: 'capitalize', fontSize: 9, padding: '1px 5px' }}>{e.frequency}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 13 }}>
                          {parseFloat(e.amount).toLocaleString()} DZD
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFixed(e.id); }}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '50%',
                            width: 26, height: 26,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--text-primary)',
                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)'
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="sp-fadein" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: 8, marginTop: 4 }}>
                        <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>
                          {parseFloat(e.amount).toLocaleString()} DZD
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }} onClick={() => setEditFixed(e)}><Edit2 size={12} /> Edit</button>
                          <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }} onClick={() => { if (window.confirm('Delete this fixed expense?')) deleteFixed.mutate(e.id); }}><Trash2 size={12} /> Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!fixed.length && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>No fixed expenses</div>}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Amount</th><th>Frequency</th><th>Category</th><th></th></tr></thead>
                <tbody>
                  {fixed.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{e.name}</td>
                      <td>{parseFloat(e.amount).toLocaleString()} DZD</td>
                      <td style={{ textTransform: 'capitalize' }}>{e.frequency}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{e.category || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditFixed(e)}><Edit2 size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Delete this fixed expense?')) deleteFixed.mutate(e.id); }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!fixed.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No fixed expenses</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Variable Expenses */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Variable Expenses</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowVariable(true)}><Plus size={14} /> Add</button>
          </div>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {variable.map(e => {
                const isExpanded = !!expandedVar[e.id];
                return (
                  <div
                    key={e.id}
                    className="card card-sm sp-fadeup"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: isExpanded ? 10 : 0,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 16,
                      boxShadow: 'var(--shadow-card)',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {/* Collapsed Header: Name, Category, Amount & Plus Icon */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleVar(e.id)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          {e.name}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          Category: {e.category}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 13 }}>
                          {parseFloat(e.amount).toLocaleString()} DZD
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleVar(e.id); }}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '50%',
                            width: 26, height: 26,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--text-primary)',
                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)'
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="sp-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{format(new Date(e.expense_date), 'MMM d, yyyy')}</span>
                        </div>
                        {e.client_name && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Client:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 10, color: 'var(--text-secondary)' }}>
                              🏢 {e.client_name}
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
                          <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>
                            {parseFloat(e.amount).toLocaleString()} DZD
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }} onClick={() => setEditVariable(e)}><Edit2 size={12} /> Edit</button>
                            <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }} onClick={() => { if (window.confirm('Delete this variable expense?')) deleteVariable.mutate(e.id); }}><Trash2 size={12} /> Delete</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!variable.length && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>No variable expenses</div>}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Amount</th><th>Category</th><th>Client</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {variable.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{e.name}</td>
                      <td>{parseFloat(e.amount).toLocaleString()} DZD</td>
                      <td style={{ textTransform: 'capitalize' }}>{e.category}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{e.client_name || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{format(new Date(e.expense_date), 'MMM d')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditVariable(e)}><Edit2 size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Delete this variable expense?')) deleteVariable.mutate(e.id); }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!variable.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No variable expenses</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={showFixed} onClose={() => setShowFixed(false)} title="Add Fixed Expense">
        <ExpenseModal type="fixed" clients={clients} onSave={createFixed.mutate} onClose={() => setShowFixed(false)} />
      </Modal>
      <Modal open={!!editFixed} onClose={() => setEditFixed(null)} title="Edit Fixed Expense">
        {editFixed && <ExpenseModal type="fixed" initial={editFixed} clients={clients} onSave={b => updateFixed.mutate({ id: editFixed.id, ...b })} onClose={() => setEditFixed(null)} />}
      </Modal>
      <Modal open={showVariable} onClose={() => setShowVariable(false)} title="Add Variable Expense">
        <ExpenseModal type="variable" clients={clients} onSave={createVariable.mutate} onClose={() => setShowVariable(false)} />
      </Modal>
      <Modal open={!!editVariable} onClose={() => setEditVariable(null)} title="Edit Variable Expense">
        {editVariable && <ExpenseModal type="variable" initial={editVariable} clients={clients} onSave={b => updateVariable.mutate({ id: editVariable.id, ...b })} onClose={() => setEditVariable(null)} />}
      </Modal>
    </div>
  );
}
