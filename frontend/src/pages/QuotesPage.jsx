import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { StatusBadge } from '../components/Badges';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Trash2, Download, FilePlus, Edit2, Send } from 'lucide-react';
import { format } from 'date-fns';

function LineItemsEditor({ items, onChange, disabled, services = [] }) {
  const addItem = () => onChange([...items, { description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: val };
    if (field === 'description') {
      const matchedService = services.find(s => s.service_name === val);
      if (matchedService) updated[i].unit_price = matchedService.price_dzd;
    }
    onChange(updated);
  };
  const total = items.reduce((s, item) => s + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)), 0);

  return (
    <div>
      {!disabled && services.length > 0 && (
        <datalist id="services-datalist">
          {services.map(s => <option key={s.id} value={s.service_name} />)}
        </datalist>
      )}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', marginBottom: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Description</th>
              <th style={{ padding: '10px 12px', width: 90, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Qty</th>
              <th style={{ padding: '10px 12px', width: 130, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Unit Price</th>
              <th style={{ padding: '10px 12px', width: 90, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Total</th>
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px' }}>
                  <input className="form-input" list="services-datalist" style={{ margin: 0 }} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Service description" disabled={disabled} />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <input className="form-input" type="number" style={{ margin: 0, textAlign: 'right', minWidth: 80 }} value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min="0" step="1" disabled={disabled} />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <input className="form-input" type="number" style={{ margin: 0, textAlign: 'right', minWidth: 100 }} value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} min="0" step="0.01" disabled={disabled} />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                  {(parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toFixed(2)} DZD
                </td>
                <td style={{ padding: '8px 6px' }}>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(i)} disabled={disabled}><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Line Item</button>
      )}
      <div style={{ textAlign: 'right', marginTop: 12, fontSize: 16, fontWeight: 700 }}>
        Total: <span style={{ color: 'var(--accent)' }}>{total.toFixed(2)} DZD</span>
      </div>
    </div>
  );
}

export default function QuotesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [viewQuote, setViewQuote] = useState(null);
  const [editQuote, setEditQuote] = useState(null);
  const [editForm, setEditForm] = useState({ notes: '', line_items: [] });
  const [form, setForm] = useState({ client_id: '', notes: '', line_items: [{ description: '', quantity: 1, unit_price: 0 }] });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [isMobile, setIsMobile] = useState(false);
  const [expandedQuotes, setExpandedQuotes] = useState({});
  const toggleQuote = (id) => setExpandedQuotes(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => api.get('/finance/quotes').then(r => r.data),
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then(r => r.data.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['quote-detail-view', viewQuote?.id],
    queryFn: () => api.get(`/finance/quotes/${viewQuote.id}`).then(r => r.data),
    enabled: !!viewQuote,
  });

  const { data: editDetail } = useQuery({
    queryKey: ['quote-detail-edit', editQuote?.id],
    queryFn: () => api.get(`/finance/quotes/${editQuote.id}`).then(r => r.data),
    enabled: !!editQuote,
    onSuccess: (data) => {
      setEditForm({
        notes: data.notes || '',
        line_items: data.line_items?.map(li => ({
          description: li.description,
          quantity: parseFloat(li.quantity),
          unit_price: parseFloat(li.unit_price),
        })) || [],
      });
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ['service-prices'],
    queryFn: () => api.get('/finance/service-prices').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/finance/quotes', body),
    onSuccess: () => {
      qc.invalidateQueries(['quotes']);
      setShowCreate(false);
      toast.success('Quotation created');
      setForm({ client_id: '', notes: '', line_items: [{ description: '', quantity: 1, unit_price: 0 }] });
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/finance/quotes/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries(['quotes']);
      qc.invalidateQueries(['quote-detail-edit', editQuote?.id]);
      setEditQuote(null);
      toast.success('Quotation updated!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, portal_visible }) => api.put(`/finance/quotes/${id}`, { status, ...(portal_visible !== undefined && { portal_visible }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries(['quotes']);
      if (vars.status === 'accepted') {
        qc.invalidateQueries(['invoices']);
        toast.success('Quote accepted! Invoice and Task auto-generated.');
      } else if (vars.status === 'sent') {
        toast.success('Quotation sent to client portal ✅');
      } else {
        toast.success('Status updated');
      }
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/finance/quotes/${id}`),
    onSuccess: () => { qc.invalidateQueries(['quotes']); toast.success('Deleted'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const convertToInvoice = async (quote) => {
    const due = prompt('Enter due date for the invoice (YYYY-MM-DD):');
    if (!due) return;
    try {
      await api.post(`/finance/invoices/from-quote/${quote.id}`, { due_date: due });
      qc.invalidateQueries(['quotes']);
      qc.invalidateQueries(['invoices']);
      toast.success('Invoice created from quotation!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to convert');
    }
  };

  const openEdit = (q) => {
    setEditQuote(q);
    setEditForm({ notes: q.notes || '', line_items: [] });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotations</h1>
          <p className="page-subtitle">{quotes.length} quotes</p>
        </div>
        <button id="create-quote-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Quote
        </button>
      </div>

      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : (
        <div className="table-wrapper" style={isMobile ? { background: 'none', border: 'none', boxShadow: 'none', padding: 0 } : {}}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {quotes.map(q => {
                const isExpanded = !!expandedQuotes[q.id];
                return (
                  <div
                    key={q.id}
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
                      position: 'relative',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {/* Collapsed Header: Number, Client, Amount, Status & Plus icon */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleQuote(q.id)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span 
                          className="font-mono" 
                          style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}
                        >
                          📄 {q.quote_number}
                        </span>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          🏢 {q.client_name}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <select
                          className="form-select"
                          style={{ padding: '2px 6px', width: 95, fontSize: 12, height: 28, margin: 0 }}
                          value={q.status}
                          onChange={e => updateStatus.mutate({ id: q.id, status: e.target.value })}
                        >
                          {['draft', 'sent', 'accepted', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>
                          {parseFloat(q.grand_total).toFixed(0)} DZD
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleQuote(q.id); }}
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
                      <div className="sp-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                        {/* Financial & date details box */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 10,
                          background: 'var(--bg-surface)',
                          borderRadius: 10,
                          padding: 12,
                          border: '1px solid var(--border)',
                          fontSize: 12
                        }}>
                          <div>
                            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Grand Total</div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{parseFloat(q.grand_total).toLocaleString()} DZD</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Created At</div>
                            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{format(new Date(q.created_at), 'MMM d, yyyy')}</div>
                          </div>
                          {q.notes && (
                            <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border)', paddingTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                              📝 Notes: {q.notes}
                            </div>
                          )}
                        </div>

                        {/* Actions wrapper */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setViewQuote(q)}
                          >
                            👁️ View Details
                          </button>
                          
                          <a 
                            href={`/api/finance/quotes/${q.id}/pdf`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn btn-secondary btn-sm" 
                            style={{ flex: 1, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 60 }}
                          >
                            <Download size={12} /> PDF
                          </a>

                          <button
                            className="btn btn-sm"
                            style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'none', height: 32, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 60 }}
                            onClick={() => openEdit(q)}
                          >
                            <Edit2 size={12} /> Edit
                          </button>

                          {q.status !== 'accepted' && (
                            <button 
                              className="btn btn-success btn-sm" 
                              style={{ flex: '1 0 100%', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              onClick={() => convertToInvoice(q)}
                            >
                              <FilePlus size={12} /> Convert to Invoice
                            </button>
                          )}

                          {q.status === 'draft' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ flex: '1 0 100%', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              onClick={() => updateStatus.mutate({ id: q.id, status: 'sent', portal_visible: true })}
                            >
                              <Send size={12} /> Send to Portal
                            </button>
                          )}

                          <button 
                            className="btn btn-danger btn-sm" 
                            style={{ height: 32, padding: '4px 10px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                            onClick={() => { if(window.confirm('Delete this quotation?')) deleteMutation.mutate(q.id); }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!quotes.length && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No quotations yet</div>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id}>
                    <td className="font-mono" style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setViewQuote(q)}>{q.quote_number}</td>
                    <td>{q.client_name}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding: '4px 8px', width: 120 }}
                        value={q.status}
                        onChange={e => updateStatus.mutate({ id: q.id, status: e.target.value })}
                      >
                        {['draft', 'sent', 'accepted', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ fontWeight: 600 }}>{parseFloat(q.grand_total).toLocaleString()} DZD</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{format(new Date(q.created_at), 'MMM d, yyyy')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'none', padding: '4px 8px' }}
                          onClick={() => openEdit(q)}
                          title="Edit quotation"
                        >
                          <Edit2 size={12} />
                        </button>
                        <a href={`/api/finance/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><Download size={12} /> PDF</a>
                        {q.status === 'draft' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => updateStatus.mutate({ id: q.id, status: 'sent', portal_visible: true })} title="Send to client portal">
                            <Send size={12} /> Send
                          </button>
                        )}
                        {q.status !== 'accepted' && (
                          <button className="btn btn-success btn-sm" onClick={() => convertToInvoice(q)} title="Convert to Invoice">
                            <FilePlus size={12} /> Invoice
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Delete this quotation?')) deleteMutation.mutate(q.id); }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!quotes.length && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No quotations yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Create Modal ── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Quotation" size="modal-xl">
        <div className="modal-body">
          <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Client *</label>
              <select className="form-select" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
                <option value="">— Select Client —</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes..." />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Line Items *</label>
            <LineItemsEditor items={form.line_items} services={services} onChange={items => set('line_items', items)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => createMutation.mutate(form)} disabled={!form.client_id || !form.line_items.length}>
            Create Quotation
          </button>
        </div>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal open={!!editQuote} onClose={() => setEditQuote(null)} title={`Edit ${editQuote?.quote_number || 'Quote'}`} size="modal-xl">
        <div className="modal-body">
          {editDetail ? (
            <>
              <div style={{ marginBottom: 16, padding: '8px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Client: <strong style={{ color: 'var(--text-primary)' }}>{editDetail.company_name}</strong>
                &nbsp;·&nbsp;Status: <strong style={{ color: 'var(--accent)' }}>{editDetail.status}</strong>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Notes</label>
                <input className="form-input" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." />
              </div>
              <div className="form-group">
                <label className="form-label">Line Items</label>
                <LineItemsEditor
                  items={editForm.line_items.length
                    ? editForm.line_items
                    : (editDetail.line_items?.map(li => ({ description: li.description, quantity: parseFloat(li.quantity), unit_price: parseFloat(li.unit_price) })) || [])}
                  services={services}
                  onChange={items => setEditForm(f => ({ ...f, line_items: items }))}
                />
              </div>
            </>
          ) : (
            <div className="loading-center"><div className="loading-spinner" /></div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setEditQuote(null)}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={updateMutation.isPending || !editDetail}
            onClick={() => updateMutation.mutate({
              id: editQuote.id,
              notes: editForm.notes,
              line_items: editForm.line_items.length
                ? editForm.line_items
                : editDetail?.line_items?.map(li => ({ description: li.description, quantity: parseFloat(li.quantity), unit_price: parseFloat(li.unit_price) })),
            })}
          >
            <Edit2 size={13} /> Save Changes
          </button>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      <Modal open={!!viewQuote} onClose={() => setViewQuote(null)} title={viewQuote?.quote_number} size="modal-xl">
        {detail && (
          <>
            <div className="modal-body">
              <div style={{ marginBottom: 16, display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                <span><strong>{detail.company_name}</strong></span>
                <StatusBadge status={detail.status} />
              </div>
              <LineItemsEditor items={detail.line_items} services={services} onChange={() => {}} disabled />
            </div>
            <div className="modal-footer">
              <a href={`/api/finance/quotes/${detail.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-secondary"><Download size={14} /> Download PDF</a>
              <button className="btn btn-secondary" onClick={() => setViewQuote(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
