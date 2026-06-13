import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { StatusBadge } from '../components/Badges';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Trash2, Printer, DollarSign, Send, Edit2, Tag, Save, X, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

function printInvoice(detail) {
  const items = detail.line_items || [];
  const subtotal = items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0), 0);
  const discountPct = parseFloat(detail.discount_pct || 0);
  const discountAmount = subtotal * (discountPct / 100);
  const grandTotal = subtotal - discountAmount;
  const paid = parseFloat(detail.amount_paid || 0);
  const balance = grandTotal - paid;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${detail.invoice_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; color: #0f172a; background: #fff; padding: 0; }
    .page { max-width: 800px; margin: 0 auto; padding: 56px 48px; }
    
    /* Header */
    .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
    .brand-name { font-size: 28px; font-weight: 800; color: #f97316; }
    .brand-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
    .inv-title-block { text-align: right; }
    .inv-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
    .inv-number { font-size: 22px; font-weight: 800; color: #0f172a; }
    .inv-status { display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: ${detail.status === 'paid' ? '#ecfdf5' : '#fff7ed'}; color: ${detail.status === 'paid' ? '#059669' : '#ea580c'}; }
    
    /* Meta */
    .inv-meta { display: flex; justify-content: space-between; margin-bottom: 40px; gap: 32px; }
    .meta-block { flex: 1; }
    .meta-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    .meta-value { font-size: 14px; color: #0f172a; font-weight: 500; }
    .meta-value strong { display: block; font-size: 16px; font-weight: 700; }
    
    /* Divider */
    .divider { height: 1px; background: #e2e8f0; margin: 32px 0; }
    
    /* Items Table */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    .items-table thead tr { background: #f8fafc; }
    .items-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 2px solid #e2e8f0; }
    .items-table th:not(:first-child) { text-align: right; }
    .items-table td { padding: 14px 16px; font-size: 14px; color: #0f172a; border-bottom: 1px solid #f1f5f9; }
    .items-table td:not(:first-child) { text-align: right; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .items-table .desc { font-weight: 500; }
    .items-table .amount { font-weight: 600; }
    
    /* Totals */
    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #475569; }
    .total-row.paid-row { color: #059669; font-weight: 600; }
    .total-row.balance-row { font-size: 18px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 16px; }
    .total-row span:first-child { color: #64748b; font-weight: 400; }
    .total-row.balance-row span { color: #0f172a; }
    .total-row.paid-row span:first-child { color: #059669; }
    
    .accent-bar { height: 4px; background: linear-gradient(90deg, #f97316, #fb923c); border-radius: 2px; margin-bottom: 48px; }
    
    /* Notes and Footer */
    .notes { margin-top: 48px; padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #f97316; }
    .notes-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    .notes-text { font-size: 13px; color: #475569; }
    .inv-footer { margin-top: 64px; text-align: center; font-size: 12px; color: #94a3b8; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { padding: 24px; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="accent-bar"></div>

  <div class="inv-header">
    <div>
      <div class="brand-name">Axialogy</div>
      <div class="brand-sub">Internal Business Platform</div>
    </div>
    <div class="inv-title-block">
      <div class="inv-label">Invoice</div>
      <div class="inv-number">${detail.invoice_number}</div>
      <span class="inv-status">${detail.status.toUpperCase()}</span>
    </div>
  </div>

  <div class="inv-meta">
    <div class="meta-block">
      <div class="meta-label">Billed To</div>
      <div class="meta-value"><strong>${detail.company_name || 'N/A'}</strong></div>
    </div>
    <div class="meta-block" style="text-align: right;">
      <div class="meta-label">Issue Date</div>
      <div class="meta-value">${format(new Date(), 'MMMM d, yyyy')}</div>
      <div class="meta-label" style="margin-top: 12px;">Due Date</div>
      <div class="meta-value" style="color: ${detail.status === 'overdue' ? '#ef4444' : '#0f172a'}; font-weight: 600;">${format(new Date(detail.due_date), 'MMMM d, yyyy')}</div>
    </div>
  </div>

  <div class="divider"></div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
        <tr>
          <td class="desc">${item.description || '—'}</td>
          <td>${parseFloat(item.quantity || 0)}</td>
          <td>${parseFloat(item.unit_price || 0).toLocaleString('en-US', {minimumFractionDigits: 2})} DZD</td>
          <td class="amount">${(parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toLocaleString('en-US', {minimumFractionDigits: 2})} DZD</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${subtotal.toLocaleString('en-US', {minimumFractionDigits: 2})} DZD</span></div>
    ${discountPct > 0 ? `<div class="total-row" style="color: #ef4444;"><span>Remise (${discountPct}%)</span><span>-${discountAmount.toLocaleString('en-US', {minimumFractionDigits: 2})} DZD</span></div>` : ''}
    ${paid > 0 ? `<div class="total-row paid-row"><span>Amount Paid</span><span>-${paid.toLocaleString('en-US', {minimumFractionDigits: 2})} DZD</span></div>` : ''}
    <div class="total-row balance-row"><span>Balance Due</span><span>${balance.toLocaleString('en-US', {minimumFractionDigits: 2})} DZD</span></div>
  </div>

  ${detail.notes ? `<div class="notes"><div class="notes-label">Notes</div><div class="notes-text">${detail.notes}</div></div>` : ''}
  
  <div class="inv-footer">
    Thank you for your business · Generated by Axialogy Platform
  </div>
</div>
<script>
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html);
  w.document.close();
}

function LineItemsEditor({ items, onChange, disabled, services = [] }) {
  const addItem = () => onChange([...items, { description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => { 
    const u = [...items]; 
    u[i] = { ...u[i], [field]: val }; 
    
    // Auto-fill price if a service is selected from the dropdown
    if (field === 'description') {
      const matchedService = services.find(s => s.service_name === val);
      if (matchedService) {
        u[i].unit_price = matchedService.price_dzd;
      }
    }
    
    onChange(u); 
  };
  const total = items.reduce((s, item) => s + parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0), 0);

  return (
    <div>
      {!disabled && services.length > 0 && (
        <datalist id="services-datalist">
          {services.map(s => (
            <option key={s.id} value={s.service_name} />
          ))}
        </datalist>
      )}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', marginBottom: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Description</th>
              <th style={{ padding: '10px 12px', width: 90, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Qty</th>
              <th style={{ padding: '10px 12px', width: 130, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Unit Price (DZD)</th>
              <th style={{ padding: '10px 12px', width: 110, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Total (DZD)</th>
              {!disabled && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px' }}>
                  <input className="form-input" list="services-datalist" style={{ margin: 0 }} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description" disabled={disabled} />
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
                {!disabled && (
                  <td style={{ padding: '8px 6px' }}>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(i)}><Trash2 size={12} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Line Item</button>}
      <div style={{ textAlign: 'right', marginTop: 12, fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>
        Subtotal: <span>{total.toFixed(2)} DZD</span>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('fees');
  const [showCreate, setShowCreate] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);
  const [editInvForm, setEditInvForm] = useState({ due_date: '', notes: '', line_items: [], discount_pct: 0 });
  const [showLogPayment, setShowLogPayment] = useState(null);
  const [form, setForm] = useState({ client_id: '', due_date: '', notes: '', line_items: [{ description: '', quantity: 1, unit_price: 0 }], discount_pct: 0 });
  const [payForm, setPayForm] = useState({ amount: '', notes: '', payment_date: new Date().toISOString().split('T')[0] });

  // Course price management state
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ service_name: '', price_dzd: '', description: '' });

  const [isMobile, setIsMobile] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const toggleInvoice = (id) => setExpandedInvoices(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/finance/invoices').then(r => r.data),
  });

  const { data: clients } = useQuery({
    queryKey: ['students-list'],
    queryFn: () => api.get('/students', { params: { limit: 100 } }).then(r => r.data.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['invoice-detail-view', viewInvoice?.id],
    queryFn: () => api.get(`/finance/invoices/${viewInvoice.id}`).then(r => r.data),
    enabled: !!viewInvoice,
  });

  const { data: editDetail } = useQuery({
    queryKey: ['invoice-detail-edit', editInvoice?.id],
    queryFn: () => api.get(`/finance/invoices/${editInvoice.id}`).then(r => r.data),
    enabled: !!editInvoice,
    onSuccess: (data) => {
      setEditInvForm({
        due_date: data.due_date?.split('T')[0] || '',
        notes: data.notes || '',
        discount_pct: parseFloat(data.discount_pct || 0),
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
    mutationFn: (body) => api.post('/finance/invoices', body),
    onSuccess: () => { qc.invalidateQueries(['invoices']); setShowCreate(false); toast.success('Invoice created'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, portal_visible }) =>
      api.put(`/finance/invoices/${id}`, { status, ...(portal_visible !== undefined && { portal_visible }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries(['invoices']);
      if (vars.status === 'sent') {
        toast.success('Invoice sent to client portal ✅');
      } else {
        toast.success('Status updated');
      }
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateInvoice = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/finance/invoices/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries(['invoices']);
      qc.invalidateQueries(['invoice-detail-edit', editInvoice?.id]);
      setEditInvoice(null);
      toast.success('Invoice updated!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/finance/invoices/${id}`),
    onSuccess: () => { qc.invalidateQueries(['invoices']); toast.success('Deleted'); },
  });

  const logPayment = useMutation({
    mutationFn: (body) => api.post('/finance/payments', body),
    onSuccess: () => { qc.invalidateQueries(['invoices']); qc.invalidateQueries(['invoice-detail', showLogPayment?.id]); setShowLogPayment(null); toast.success('Payment logged!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  // ── Course Price Mutations ───────────────────────────────────────────
  const createCourseMutation = useMutation({
    mutationFn: (body) => api.post('/finance/service-prices', body),
    onSuccess: () => { qc.invalidateQueries(['service-prices']); setShowAddCourse(false); setCourseForm({ service_name: '', price_dzd: '', description: '' }); toast.success('Course price added!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const updateCourseMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/finance/service-prices/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['service-prices']); setEditCourse(null); toast.success('Course price updated!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (id) => api.delete(`/finance/service-prices/${id}`),
    onSuccess: () => { qc.invalidateQueries(['service-prices']); toast.success('Course price deleted'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const totalRevenue = invoices.reduce((s, i) => s + parseFloat(i.amount_paid || 0), 0);
  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + parseFloat(i.grand_total || 0) - parseFloat(i.amount_paid || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tuition Fees</h1>
          <p className="page-subtitle">
            {totalRevenue.toLocaleString()} DZD received · {totalOutstanding.toLocaleString()} DZD outstanding
          </p>
        </div>
        {activeTab === 'fees' && (
          <button id="create-invoice-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Fee
          </button>
        )}
        {activeTab === 'courses' && (
          <button className="btn btn-primary" onClick={() => { setCourseForm({ service_name: '', price_dzd: '', description: '' }); setShowAddCourse(true); }}>
            <Plus size={16} /> Add Course Price
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${activeTab === 'fees' ? 'tab-active' : ''}`} onClick={() => setActiveTab('fees')}>
          <DollarSign size={14} style={{ display: 'inline', marginRight: 6 }} />Fee Records
        </button>
        <button className={`tab ${activeTab === 'courses' ? 'tab-active' : ''}`} onClick={() => setActiveTab('courses')}>
          <BookOpen size={14} style={{ display: 'inline', marginRight: 6 }} />Course Prices
        </button>
      </div>

      {/* ── Fee Records Tab ── */}
      {activeTab === 'fees' && (
      <>
        {isLoading ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : (
          <div className="table-wrapper" style={isMobile ? { background: 'none', border: 'none', boxShadow: 'none', padding: 0 } : {}}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {invoices.map(inv => {
                const isOverdue = inv.status === 'overdue';
                const remaining = parseFloat(inv.grand_total) - parseFloat(inv.amount_paid);
                const isExpanded = !!expandedInvoices[inv.id];
                return (
                  <div
                    key={inv.id}
                    className="card card-sm sp-fadeup"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: isExpanded ? 12 : 0,
                      background: 'var(--bg-card)',
                      border: isOverdue ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 16,
                      boxShadow: 'var(--shadow-card)',
                      position: 'relative',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {/* Collapsed Header: Number, Client, Status & Plus icon */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleInvoice(inv.id)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span 
                          className="font-mono" 
                          style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}
                        >
                          📄 {inv.invoice_number}
                        </span>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          🏢 {inv.client_name}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <StatusBadge status={inv.status} />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                          {parseFloat(inv.grand_total).toFixed(0)} DZD
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleInvoice(inv.id); }}
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
                        {/* Details box */}
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
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{parseFloat(inv.grand_total).toLocaleString()} DZD</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Amount Paid</div>
                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>{parseFloat(inv.amount_paid).toLocaleString()} DZD</div>
                          </div>
                          {remaining > 0 && (
                            <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Outstanding Balance</span>
                              <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{remaining.toLocaleString()} DZD</span>
                            </div>
                          )}
                        </div>

                        {/* Due Date Indicator */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 6, 
                          fontSize: 12, 
                          color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)',
                          fontWeight: isOverdue ? 600 : 400
                        }}>
                          <span>📅 Due Date:</span>
                          <span>{format(new Date(inv.due_date), 'MMM d, yyyy')}</span>
                          {isOverdue && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '1px 6px', borderRadius: 4, marginLeft: 'auto' }}>OVERDUE</span>}
                        </div>

                        {/* Actions wrapper */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                          {/* View / Print */}
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ flex: 1, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 60 }} 
                            onClick={() => setViewInvoice(inv)}
                          >
                            <Printer size={12} /> Print
                          </button>

                          {/* Edit */}
                          <button
                            className="btn btn-sm"
                            style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'none', height: 32, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 60 }}
                            onClick={() => { 
                              setEditInvoice(inv); 
                              setEditInvForm({ 
                                due_date: inv.due_date?.split('T')[0] || '', 
                                notes: inv.notes || '', 
                                discount_pct: parseFloat(inv.discount_pct || 0),
                                line_items: [] 
                              }); 
                            }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>

                          {/* Settle (Deduct) */}
                          {inv.status !== 'paid' && (
                            <button 
                              className="btn btn-success btn-sm" 
                              style={{ flex: '1 0 100%', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              onClick={() => { 
                                setShowLogPayment(inv); 
                                setPayForm({ 
                                  amount: parseFloat(inv.grand_total) - parseFloat(inv.amount_paid), 
                                  notes: '', 
                                  payment_date: new Date().toISOString().split('T')[0] 
                                }); 
                              }}
                            >
                              <DollarSign size={12} /> Settle Invoice
                            </button>
                          )}

                          {/* Send Draft */}
                          {inv.status === 'draft' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ flex: '1 0 100%', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              onClick={() => updateStatus.mutate({ id: inv.id, status: 'sent', portal_visible: true })}
                            >
                              <Send size={12} /> Send to Portal
                            </button>
                          )}

                          {/* Mark Overdue */}
                          {inv.status === 'sent' && (
                            <button
                              className="btn btn-sm"
                              style={{ flex: '1 0 100%', height: 32, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => updateStatus.mutate({ id: inv.id, status: 'overdue' })}
                            >
                              Mark Overdue
                            </button>
                          )}

                          {/* Delete */}
                          <button 
                            className="btn btn-danger btn-sm" 
                            style={{ height: 32, padding: '4px 10px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                            onClick={() => { if(window.confirm('Delete this invoice?')) deleteMutation.mutate(inv.id); }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!invoices.length && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No invoices yet</div>
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
                  <th>Paid</th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const isOverdue = inv.status === 'overdue';
                  return (
                    <tr key={inv.id} style={{ background: isOverdue ? 'rgba(239,68,68,0.025)' : undefined }}>
                      <td className="font-mono" style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setViewInvoice(inv)}>{inv.invoice_number}</td>
                      <td>{inv.client_name}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td style={{ fontWeight: 600 }}>{parseFloat(inv.grand_total).toLocaleString()} DZD</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{parseFloat(inv.amount_paid).toLocaleString()} DZD</td>
                      <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', fontSize: 13 }}>
                        {format(new Date(inv.due_date), 'MMM d, yyyy')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Edit */}
                          <button
                            className="btn btn-sm"
                            style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'none', padding: '4px 8px' }}
                            onClick={() => { 
                              setEditInvoice(inv); 
                              setEditInvForm({ 
                                due_date: inv.due_date?.split('T')[0] || '', 
                                notes: inv.notes || '', 
                                discount_pct: parseFloat(inv.discount_pct || 0),
                                line_items: [] 
                              }); 
                            }}
                            title="Edit invoice"
                          >
                            <Edit2 size={12} />
                          </button>
                          {/* Print */}
                          <button className="btn btn-secondary btn-sm" title="View Invoice" onClick={() => setViewInvoice(inv)}>
                            <Printer size={12} />
                          </button>
                          {/* Pay — only when not yet paid */}
                          {inv.status !== 'paid' && (
                            <button className="btn btn-success btn-sm" onClick={() => { setShowLogPayment(inv); setPayForm({ amount: parseFloat(inv.grand_total) - parseFloat(inv.amount_paid), notes: '', payment_date: new Date().toISOString().split('T')[0] }); }}>
                              <DollarSign size={12} /> Pay
                            </button>
                          )}
                          {/* Send — only when draft */}
                          {inv.status === 'draft' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => updateStatus.mutate({ id: inv.id, status: 'sent', portal_visible: true })}>
                              <Send size={12} /> Send
                            </button>
                          )}
                          {/* Mark Overdue — only when sent (not yet overdue or paid) */}
                          {inv.status === 'sent' && (
                            <button
                              className="btn btn-sm"
                              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none' }}
                              onClick={() => updateStatus.mutate({ id: inv.id, status: 'overdue' })}
                              title="Mark as overdue"
                            >
                              Overdue
                            </button>
                          )}
                          {/* Delete */}
                          <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Delete this invoice?')) deleteMutation.mutate(inv.id); }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!invoices.length && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No invoices yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        )}
      </>
      )}

      {/* ── Course Prices Tab ── */}
      {activeTab === 'courses' && (
        <div>
          {/* Info banner */}
          <div style={{ marginBottom: 20, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={16} />
            <span>These prices are the <strong>reference rates</strong> for each course. They auto-suggest when creating a new fee invoice and will be used to calculate teacher salary payments.</span>
          </div>

          {/* Course prices table */}
          {services.length === 0 ? (
            <div className="empty-state">
              <Tag size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <h3>No course prices yet</h3>
              <p>Add your first course to start building the price reference list</p>
              <button className="btn btn-primary" onClick={() => setShowAddCourse(true)}>
                <Plus size={16} /> Add Course Price
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course Name</th>
                    <th>Description</th>
                    <th>Price (DZD)</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(course => (
                    editCourse?.id === course.id ? (
                      // Inline edit row
                      <tr key={course.id} style={{ background: 'rgba(37,99,235,0.04)' }}>
                        <td style={{ padding: '8px 14px' }}>
                          <input className="form-input" style={{ margin: 0 }} value={courseForm.service_name} onChange={e => setCourseForm(f => ({ ...f, service_name: e.target.value }))} placeholder="Course name" autoFocus />
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <input className="form-input" style={{ margin: 0 }} value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. 3 sessions/week" />
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input className="form-input" type="number" style={{ margin: 0, maxWidth: 120, textAlign: 'right' }} value={courseForm.price_dzd} onChange={e => setCourseForm(f => ({ ...f, price_dzd: e.target.value }))} min="0" step="100" />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>DZD</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" disabled={!courseForm.service_name || updateCourseMutation.isPending} onClick={() => updateCourseMutation.mutate({ id: editCourse.id, ...courseForm })}>
                              <Save size={12} /> Save
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditCourse(null)}><X size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // Display row
                      <tr key={course.id}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BookOpen size={13} color="var(--primary)" />
                            </div>
                            {course.service_name}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{course.description || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>
                          {parseFloat(course.price_dzd || 0) > 0
                            ? `${parseFloat(course.price_dzd).toLocaleString()} DZD`
                            : <span style={{ fontStyle: 'italic', fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>Not set</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditCourse(course); setCourseForm({ service_name: course.service_name, price_dzd: course.price_dzd, description: course.description || '' }); }}>
                              <Edit2 size={12} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Delete ' + course.service_name + '?')) deleteCourseMutation.mutate(course.id); }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Course Modal */}
          <Modal open={showAddCourse} onClose={() => setShowAddCourse(false)} title="Add Course Price">
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Course Name *</label>
                <input className="form-input" value={courseForm.service_name} onChange={e => setCourseForm(f => ({ ...f, service_name: e.target.value }))} placeholder="e.g. Mathematics — Level 3" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. 3 sessions per week, 90 min each" />
              </div>
              <div className="form-group">
                <label className="form-label">Price (DZD / month)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="form-input" type="number" value={courseForm.price_dzd} onChange={e => setCourseForm(f => ({ ...f, price_dzd: e.target.value }))} placeholder="e.g. 5000" min="0" step="100" style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>DZD</span>
                </div>
                {parseFloat(courseForm.price_dzd) > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--primary)' }}>
                    Preview: {parseFloat(courseForm.price_dzd).toLocaleString()} DZD/month
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddCourse(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!courseForm.service_name || createCourseMutation.isPending} onClick={() => createCourseMutation.mutate(courseForm)}>
                {createCourseMutation.isPending ? 'Adding…' : 'Add Course Price'}
              </button>
            </div>
          </Modal>
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Fee" size="modal-xl">
        <div className="modal-body">
          <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Client *</label>
              <select className="form-select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">— Select Client —</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Date *</label>
              <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment terms, notes..." />
            </div>
            <div className="form-group">
              <label className="form-label">Remise (%)</label>
              <input className="form-input" type="number" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} placeholder="0" min="0" max="100" />
            </div>
          </div>
          <LineItemsEditor items={form.line_items} services={services} onChange={items => setForm(f => ({ ...f, line_items: items }))} />
          <div style={{ textAlign: 'right', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Subtotal: {form.line_items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0), 0).toFixed(2)} DZD
            </div>
            {parseFloat(form.discount_pct || 0) > 0 && (
              <div style={{ fontSize: 14, color: 'var(--danger)', marginTop: 4 }}>
                Remise (-{form.discount_pct}%): -{(form.line_items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0), 0) * (form.discount_pct / 100)).toFixed(2)} DZD
              </div>
            )}
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>
              Grand Total: <span style={{ color: 'var(--accent)' }}>
                {(form.line_items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0), 0) * (1 - (parseFloat(form.discount_pct) || 0) / 100)).toFixed(2)} DZD
              </span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => createMutation.mutate(form)} disabled={!form.client_id || !form.due_date}>
            Create Fee Record
          </button>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title={viewInvoice?.invoice_number} size="modal-xl">
        {detail && (
          <>
            <div className="modal-body">
              <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <strong>{detail.company_name}</strong>
                <StatusBadge status={detail.status} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Due: {format(new Date(detail.due_date), 'MMM d, yyyy')}</span>
              </div>
              <LineItemsEditor items={detail.line_items} services={services} onChange={() => {}} disabled />
              <div style={{ textAlign: 'right', marginTop: 12, paddingRight: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Subtotal: {parseFloat(detail.subtotal || 0).toLocaleString()} DZD</div>
                {parseFloat(detail.discount_pct || 0) > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 2 }}>
                    Remise (-{detail.discount_pct}%): -{(parseFloat(detail.subtotal || 0) * (detail.discount_pct / 100)).toLocaleString()} DZD
                  </div>
                )}
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6, color: 'var(--accent)' }}>Grand Total: {parseFloat(detail.grand_total || 0).toLocaleString()} DZD</div>
              </div>
              {detail.payments?.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Payment History</h4>
                  {detail.payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{parseFloat(p.amount).toLocaleString()} DZD</span>
                      <span style={{ color: 'var(--text-muted)' }}>{format(new Date(p.payment_date), 'MMM d, yyyy')} {p.notes && `· ${p.notes}`}</span>
                    </div>
                  ))}
                </div>
              )}
              {detail.status === 'paid' && (() => {
                const clientWallet = parseFloat(detail.wallet_balance || 0);
                const adsSpent = parseFloat(detail.total_ads_spent || 0);
                const available = clientWallet - adsSpent;
                return (
                  <div style={{ marginTop: 20, padding: 24, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--accent)' }}>💰 Wallet vs Ads Budget Summary</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Client Wallet Balance</span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>{clientWallet.toLocaleString()} DZD</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total Ads Spent (DZD equivalent)</span>
                        <span style={{ fontWeight: 700, color: 'var(--warning)' }}>-{adsSpent.toLocaleString()} DZD</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                        <span style={{ fontWeight: 700 }}>Remaining Balance</span>
                        <span style={{ fontWeight: 800, fontSize: 15, color: available >= 0 ? 'var(--success)' : 'var(--danger)' }}>{available.toLocaleString()} DZD</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => detail && printInvoice(detail)}>
                <Printer size={14} /> Print Invoice
              </button>
              <button className="btn btn-secondary" onClick={() => setViewInvoice(null)}>Close</button>
            </div>
          </>
        )}
      </Modal>

      {/* Edit Fee Modal */}
      <Modal open={!!editInvoice} onClose={() => setEditInvoice(null)} title={`Edit ${editInvoice?.invoice_number || 'Invoice'}`} size="modal-xl">
        <div className="modal-body">
          {editDetail ? (
            <>
              <div style={{ marginBottom: 16, padding: '8px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Client: <strong style={{ color: 'var(--text-primary)' }}>{editDetail.company_name}</strong>
                &nbsp;·&nbsp;Status: <strong style={{ color: 'var(--accent)' }}>{editDetail.status}</strong>
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="form-input" type="date" value={editInvForm.due_date} onChange={e => setEditInvForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={editInvForm.notes} onChange={e => setEditInvForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment terms, notes..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Remise (%)</label>
                  <input className="form-input" type="number" value={editInvForm.discount_pct} onChange={e => setEditInvForm(f => ({ ...f, discount_pct: e.target.value }))} placeholder="0" min="0" max="100" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Line Items</label>
                <LineItemsEditor
                  items={editInvForm.line_items.length
                    ? editInvForm.line_items
                    : (editDetail.line_items?.map(li => ({ description: li.description, quantity: parseFloat(li.quantity), unit_price: parseFloat(li.unit_price) })) || [])}
                  services={services}
                  onChange={items => setEditInvForm(f => ({ ...f, line_items: items }))}
                />
              </div>
              <div style={{ textAlign: 'right', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Subtotal: {(editInvForm.line_items.length ? editInvForm.line_items : (editDetail.line_items || [])).reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0), 0).toFixed(2)} DZD
                </div>
                {parseFloat(editInvForm.discount_pct || 0) > 0 && (
                  <div style={{ fontSize: 14, color: 'var(--danger)', marginTop: 4 }}>
                    Remise (-{editInvForm.discount_pct}%): -{((editInvForm.line_items.length ? editInvForm.line_items : (editDetail.line_items || [])).reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0), 0) * (editInvForm.discount_pct / 100)).toFixed(2)} DZD
                  </div>
                )}
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>
                  Grand Total: <span style={{ color: 'var(--accent)' }}>
                    {((editInvForm.line_items.length ? editInvForm.line_items : (editDetail.line_items || [])).reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0), 0) * (1 - (parseFloat(editInvForm.discount_pct) || 0) / 100)).toFixed(2)} DZD
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="loading-center"><div className="loading-spinner" /></div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setEditInvoice(null)}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={updateInvoice.isPending || !editDetail}
            onClick={() => updateInvoice.mutate({
              id: editInvoice.id,
              due_date: editInvForm.due_date || undefined,
              notes: editInvForm.notes || undefined,
              discount_pct: editInvForm.discount_pct,
              line_items: editInvForm.line_items.length
                ? editInvForm.line_items
                : editDetail?.line_items?.map(li => ({ description: li.description, quantity: parseFloat(li.quantity), unit_price: parseFloat(li.unit_price) })),
            })}
          >
            <Edit2 size={13} /> Save Changes
          </button>
        </div>
      </Modal>

      {/* Settle Invoice Modal — deducts from client wallet */}
      <Modal open={!!showLogPayment} onClose={() => setShowLogPayment(null)} title="Settle Invoice (Deduct from Wallet)">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>
            ⚠ This DEDUCTS from the client wallet. The wallet must have been funded first via a Bon de Versement.
          </div>
          <div className="form-group">
            <label className="form-label">Amount (DZD)</label>
            <input className="form-input" type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} min="0" step="0.01" />
          </div>
          <div className="form-group">
            <label className="form-label">Settlement Date</label>
            <input className="form-input" type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Service reference, notes..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowLogPayment(null)}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ background: 'var(--danger)' }}
            onClick={() => logPayment.mutate({ invoice_id: showLogPayment.id, client_id: showLogPayment.client_id, ...payForm })}
            disabled={!payForm.amount}
          >
            <DollarSign size={14} /> Settle Invoice
          </button>
        </div>
      </Modal>
    </div>
  );
}
