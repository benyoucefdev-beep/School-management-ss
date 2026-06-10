import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, CheckCircle, Trash2, QrCode, Download, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

function StatusBadge({ status }) {
  const c = status === 'paid' ? 'var(--success)'
          : status === 'partial' ? 'var(--warning)'
          : status === 'overdue' ? 'var(--danger)'
          : '#64748b';
  return (
    <span style={{ background: `${c}22`, color: c, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

export default function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [tab, setTab] = useState(0);
  const [showQr, setShowQr] = useState(false);

  // Queries
  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => api.get(`/suppliers/${id}`).then(r => r.data),
  });
  const { data: txs, refetch: refetchTxs } = useQuery({
    queryKey: ['supplier-txs', id],
    queryFn: () => api.get(`/suppliers/${id}/transactions`).then(r => r.data),
    enabled: tab === 1,
  });
  const { data: orders } = useQuery({
    queryKey: ['supplier-orders', id],
    queryFn: () => api.get(`/suppliers/${id}/orders`).then(r => r.data),
    enabled: tab === 2 && supplier?.type_name === 'printing_house',
  });
  const { data: subs } = useQuery({
    queryKey: ['supplier-subs', id],
    queryFn: () => api.get(`/suppliers/${id}/subscriptions`).then(r => r.data),
    enabled: tab === 3 && supplier?.type_name === 'software_tool',
  });
  const { data: docs } = useQuery({
    queryKey: ['supplier-docs', id],
    queryFn: () => api.get(`/suppliers/${id}/documents`).then(r => r.data),
    enabled: tab === 4,
  });
  const { data: rate } = useQuery({
    queryKey: ['exchange-rate-latest'],
    queryFn: () => api.get('/exchange-rates/latest').then(r => r.data),
  });

  // ── Add Transaction ──────────────────────────────────────────
  const [txModal, setTxModal] = useState(false);
  const [txForm, setTxForm] = useState({
    payment_intent: 'paid',
    total_amount: '',
    quantity: '',
    payment_method: 'bank_transfer',
    due_date: '',
    notes: '',
  });

  const addTx = useMutation({
    mutationFn: (d) => api.post(`/suppliers/${id}/transactions`, d),
    onSuccess: () => {
      qc.invalidateQueries(['supplier-txs', id]);
      qc.invalidateQueries(['supplier', id]);
      setTxModal(false);
      setTxForm({ payment_intent: 'paid', total_amount: '', quantity: '', payment_method: 'bank_transfer', due_date: '', notes: '' });
      toast.success(txForm.payment_intent === 'paid' ? 'Paid — counted as expense' : 'Debt logged — reminder sent');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  // ── Pay Now (settle a pending transaction) ───────────────────
  const [payModal, setPayModal] = useState(null); // holds the tx object
  const [payForm, setPayForm] = useState({ payment_method: 'bank_transfer', payment_date: new Date().toISOString().split('T')[0], notes: '' });

  const payNow = useMutation({
    mutationFn: ({ txId, body }) => api.post(`/suppliers/${id}/transactions/${txId}/versements`, body),
    onSuccess: () => {
      qc.invalidateQueries(['supplier-txs', id]);
      qc.invalidateQueries(['supplier', id]);
      setPayModal(null);
      toast.success('✓ Payment recorded — expense counted!');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteTx = useMutation({
    mutationFn: (txId) => api.delete(`/suppliers/${id}/transactions/${txId}`),
    onSuccess: () => {
      qc.invalidateQueries(['supplier-txs', id]);
      qc.invalidateQueries(['supplier', id]);
      toast.success('Transaction cancelled and removed from active ledger');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  if (isLoading || !supplier) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

  const dzdRate = parseFloat(rate?.rate || 1);
  // Convert any amount to DZD for display
  const toDZD = (amount, currency) => {
    const n = parseFloat(amount || 0);
    if (currency === 'DZD') return n;
    return n * dzdRate; // EUR or USD → DZD via rate
  };
  const fmtDZD = (amount, currency) => `${toDZD(amount, currency).toLocaleString('en-US', { minimumFractionDigits: 2 })} DZD`;

  const TABS = ['Overview', 'Transactions',
    supplier.type_name === 'printing_house' ? 'Orders' : null,
    supplier.type_name === 'software_tool' ? 'Subscriptions' : null,
    'Documents',
  ].filter(Boolean);
  const activeTabName = TABS[tab];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/suppliers')} style={{ padding: 8 }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">{supplier.name}</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#334155', padding: '2px 8px', borderRadius: 6, fontSize: 11, color: '#f8fafc' }}>{supplier.type_name}</span>
            {supplier.country}
            {!supplier.is_active && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> (Inactive)</span>}
          </p>
        </div>
        {/* QR Portal Button */}
        {supplier.portal_token && (
          <button className="btn btn-secondary" onClick={() => setShowQr(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <QrCode size={15} /> Portal QR
          </button>
        )}
      </div>

      <div className="tabs">
        {TABS.map((t, i) => <button key={t} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────── */}
      {activeTabName === 'Overview' && (
        <div className="form-grid form-grid-2">
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Teacher Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              {[['Contact', supplier.contact_name], ['Email', supplier.contact_email], ['Phone', supplier.contact_phone], ['Tax ID', supplier.tax_number], ['Terms', supplier.payment_terms]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                  <span style={{ fontWeight: 500 }}>{v || '—'}</span>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 24, marginBottom: 16 }}>Financial Summary (DZD)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Salary Owed</span>
                <span style={{ fontWeight: 600 }}>{fmtDZD(supplier.summary?.total_owed, 'DZD')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Paid</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtDZD(supplier.summary?.total_paid, 'DZD')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Balance Pending</span>
                <span style={{ fontWeight: 700, color: supplier.summary?.balance > 0 ? 'var(--danger)' : 'inherit' }}>
                  {fmtDZD(supplier.summary?.balance, 'DZD')}
                </span>
              </div>
            </div>
          </div>
          <div className="card" />
        </div>
      )}

      {/* ── Transactions Tab ─────────────────────────────────────── */}
      {activeTabName === 'Transactions' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Transactions &amp; Versements</h3>
            <button className="btn btn-primary" onClick={() => setTxModal(true)}><Plus size={14} /> Add Transaction</button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {(txs || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No transactions yet</div>
            )}
            {(txs || []).map(tx => {
              const amtDZD = fmtDZD(tx.total_amount, 'DZD');
              const remDZD = fmtDZD(tx.balance_remaining, 'DZD');
              const isCancelled = tx.status === 'cancelled';
              const isPending = !isCancelled && tx.status !== 'paid';
              const accentColor = isCancelled ? 'var(--text-muted)' : tx.status === 'paid' ? 'var(--success)' : tx.status === 'overdue' ? 'var(--danger)' : 'hsl(38,95%,55%)';

              return (
                <div key={tx.id} style={{ border: `1px solid var(--border)`, borderLeft: `4px solid ${accentColor}`, borderRadius: 10, overflow: 'hidden', opacity: isCancelled ? 0.6 : 1 }}>
                  <div style={{ padding: '14px 16px', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, textDecoration: isCancelled ? 'line-through' : 'none' }}>
                        {amtDZD}
                        <StatusBadge status={tx.status} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                        <span>{tx.status === 'paid' ? '✓ Paid immediately' : '⏳ To pay later'}</span>
                        {tx.due_date && <span>· Due: {format(new Date(tx.due_date), 'MMM d, yyyy')}</span>}
                        {tx.notes && <span>· {tx.notes}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {isPending && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remaining</div>
                          <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>{remDZD}</div>
                        </div>
                      )}
                      
                      {!isCancelled && user?.role === 'admin' && (
                        <button
                          className="btn btn-icon"
                          style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.08)' }}
                          onClick={() => {
                            if (window.confirm('Cancel this transaction? It will be removed from your P&L but the log will remain.')) {
                              deleteTx.mutate(tx.id);
                            }
                          }}
                          title="Delete/Cancel Transaction"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      {isPending && user?.role === 'admin' && (
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700, whiteSpace: 'nowrap' }}
                          onClick={() => {
                            setPayModal(tx);
                            setPayForm({ amount: toDZD(tx.balance_remaining, 'DZD'), payment_method: 'bank_transfer', payment_date: new Date().toISOString().split('T')[0], notes: '' });
                          }}
                        >
                          <CheckCircle size={13} /> Pay Now
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Versements sub-table */}
                  {tx.versements?.length > 0 && (
                    <div style={{ padding: '10px 16px', background: 'rgba(15,23,42,0.25)', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Versements
                      </div>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <tbody>
                          {tx.versements.map((v, i) => (
                            <tr key={i} style={{ borderBottom: i === tx.versements.length - 1 ? 'none' : '1px solid var(--border)' }}>
                              <td style={{ padding: '6px 0', fontWeight: 600, color: 'var(--success)' }}>
                                {fmtDZD(v.amount, 'DZD')}
                              </td>
                              <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>{v.payment_method?.replace(/_/g, ' ')}</td>
                              <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>
                                {v.status === 'paid'
                                  ? (v.payment_date ? format(new Date(v.payment_date), 'MMM d, yyyy') : 'Paid')
                                  : v.scheduled_date ? `Scheduled: ${format(new Date(v.scheduled_date), 'MMM d, yyyy')}` : '—'}
                              </td>
                              <td style={{ padding: '6px 0', textAlign: 'right' }}>
                                <StatusBadge status={v.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal: Add Transaction ───────────────────────────────── */}
      <Modal open={txModal} onClose={() => setTxModal(false)} title="New Supplier Transaction">
        <div className="modal-body">
          <div style={{ display: 'grid', gap: 16 }}>

            {/* Toggle: Paid / To Pay Later */}
            <div className="form-grid form-grid-2" style={{ gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {[
                { value: 'paid',         label: '✓ Paid',         sub: 'Counts as expense now',    color: 'var(--success)' },
                { value: 'to_pay_later', label: '⏳ To Pay Later', sub: 'Reminder + debt logged',   color: 'hsl(38,95%,55%)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTxForm({ ...txForm, payment_intent: opt.value })}
                  style={{
                    padding: '14px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: txForm.payment_intent === opt.value ? `${opt.color}18` : 'var(--bg-card)',
                    borderRight: opt.value === 'paid' ? '1px solid var(--border)' : 'none',
                    borderBottom: txForm.payment_intent === opt.value ? `3px solid ${opt.color}` : '3px solid transparent',
                  }}
                >
                  <div style={{ fontWeight: 700, color: txForm.payment_intent === opt.value ? opt.color : 'var(--text-secondary)', fontSize: 14 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</div>
                </button>
              ))}
            </div>

            <div className="form-grid form-grid-2">
              <div>
                <label className="form-label">Amount (DZD) *</label>
                <input
                  type="number" step="0.01" className="form-input"
                  value={txForm.total_amount}
                  onChange={e => setTxForm({ ...txForm, total_amount: e.target.value })}
                  placeholder="e.g. 28500"
                />
              </div>
              <div>
                <label className="form-label">Quantity <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="number" step="1" min="1" className="form-input"
                  value={txForm.quantity}
                  onChange={e => setTxForm({ ...txForm, quantity: e.target.value })}
                  placeholder="e.g. 500 units"
                />
              </div>
              <div>
                <label className="form-label">Payment Method</label>
                <select className="form-input" value={txForm.payment_method} onChange={e => setTxForm({ ...txForm, payment_method: e.target.value })}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card / Online</option>
                </select>
              </div>
              {txForm.payment_intent === 'to_pay_later' && (
                <div>
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={txForm.due_date} onChange={e => setTxForm({ ...txForm, due_date: e.target.value })} />
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Notes</label>
              <input type="text" className="form-input" value={txForm.notes} onChange={e => setTxForm({ ...txForm, notes: e.target.value })} placeholder="Reference, description..." />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setTxModal(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ background: txForm.payment_intent === 'paid' ? 'var(--success)' : 'hsl(38,95%,45%)', color: '#fff' }}
            disabled={addTx.isPending || !txForm.total_amount}
            onClick={() => addTx.mutate({ ...txForm, currency: 'DZD', quantity: txForm.quantity ? parseInt(txForm.quantity) : null })}
          >
            {txForm.payment_intent === 'paid' ? '✓ Record as Paid' : '⏳ Log as Pending Debt'}
          </button>
        </div>
      </Modal>

      {/* ── Modal: Pay Now ───────────────────────────────────────── */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Pay Supplier — Settle Debt">
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {payModal && (
            <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>
                Total Remaining: {fmtDZD(payModal.balance_remaining, 'DZD')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                Supplier: {supplier.name} {payModal.due_date && `· Originally due ${format(new Date(payModal.due_date), 'MMM d, yyyy')}`}
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Payment Amount (DZD)</label>
            <input type="number" step="0.01" className="form-input" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} autoFocus />
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Method</label>
              <select className="form-select" value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card / Online</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Notes</label>
            <input type="text" className="form-input" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="CCP ref, transfer ID..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ background: 'var(--success)' }}
            disabled={payNow.isPending || !payModal || !payForm.amount}
            onClick={() => payNow.mutate({
              txId: payModal.id,
              body: {
                amount: payForm.amount,
                currency: 'DZD',
                payment_method: payForm.payment_method,
                payment_date: payForm.payment_date,
                status: 'paid',
                notes: payForm.notes,
              },
            })}
          >
            <CheckCircle size={14} /> Confirm Payment
          </button>
        </div>
      </Modal>

      {/* ── QR Portal Modal ── */}
      {showQr && supplier.portal_token && (() => {
        const portalUrl = `${window.location.origin}/supplier-portal/${supplier.portal_token}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(portalUrl)}`;
        return (
          <Modal open={showQr} onClose={() => setShowQr(false)} title="📱 Supplier Portal QR Code">
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Share this QR code with <strong>{supplier.name}</strong>. When scanned, they'll register or log in to see their transactions.
              </p>
              {/* QR Image */}
              <div style={{ padding: 16, background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'inline-block' }}>
                <img src={qrSrc} alt="Supplier Portal QR" style={{ width: 220, height: 220, display: 'block' }} />
              </div>
              {/* URL */}
              <div style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {portalUrl}
              </div>
              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Link copied!'); }}>
                  <ExternalLink size={14} /> Copy Link
                </button>
                <a href={qrSrc} download={`${supplier.name}-supplier-portal-qr.png`} target="_blank" rel="noreferrer" className="btn btn-primary">
                  <Download size={14} /> Download QR
                </a>
              </div>
              {/* Credentials */}
              <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 16, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  🔐 Supplier Portal Credentials
                </div>
                {supplier.portal_username ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 72, fontWeight: 600 }}>Username</span>
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 1, fontFamily: 'monospace' }}>{supplier.portal_username}</span>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => { navigator.clipboard.writeText(supplier.portal_username); toast.success('Copied!'); }}>Copy</button>
                    </div>
                    {supplier.portal_plain_password && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 72, fontWeight: 600 }}>Password</span>
                        <span style={{ fontSize: 13, fontWeight: 700, flex: 1, fontFamily: 'monospace' }}>{supplier.portal_plain_password}</span>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => { navigator.clipboard.writeText(supplier.portal_plain_password); toast.success('Copied!'); }}>Copy</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⏳</span>
                    <span>Supplier hasn't registered yet. Share the QR so they can create their account.</span>
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
