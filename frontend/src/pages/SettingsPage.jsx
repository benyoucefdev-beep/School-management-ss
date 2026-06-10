// frontend/src/pages/SettingsPage.jsx
// Exchange and Amounts — admin only
// Manages: DZD/USD exchange rate + service price list

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import {
  RefreshCw, CheckCircle, History, AlertTriangle,
  BadgeDollarSign, Plus, Trash2, Edit2, Save, X, Tag,
} from 'lucide-react';

const fmt = (n, d = 2) => Number(n || 0).toLocaleString('fr-DZ', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (d) => d ? format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'dd MMM yyyy') : '—';

// ── Default service list (admin can add/edit/remove) ─────────────
const DEFAULT_SERVICES = [
  { service_name: 'Graphic Design', service_key: 'graphic_design', price_dzd: 0, description: 'Logo, branding, visuals' },
  { service_name: 'Digital Marketing', service_key: 'digital_marketing', price_dzd: 0, description: 'Social media, campaigns' },
  { service_name: 'Dev Transformation', service_key: 'dev_transformation', price_dzd: 0, description: 'Website / app development' },
  { service_name: 'Content & Courses', service_key: 'content_courses', price_dzd: 0, description: 'Video production, e-learning' },
  { service_name: 'Ads Management', service_key: 'ads_management', price_dzd: 0, description: 'PPC, paid ads management' },
  { service_name: 'Printing', service_key: 'printing', price_dzd: 0, description: 'Flyers, banners, print materials' },
];

function ServicePriceRow({ item, onSave, onDelete, isMobile, isExpanded, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ service_name: item.service_name, price_dzd: item.price_dzd, description: item.description || '' });

  if (isMobile) {
    if (editing) {
      return (
        <div className="card card-sm sp-fadeup" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, background: 'rgba(99,102,241,0.06)' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: 11, fontWeight: 700 }}>Service Name</label>
            <input className="form-input" style={{ margin: 0 }} value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: 11, fontWeight: 700 }}>Description</label>
            <input className="form-input" style={{ margin: 0 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description..." />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: 11, fontWeight: 700 }}>Standard Price (DZD)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input className="form-input" type="number" style={{ margin: 0, textAlign: 'right' }} value={form.price_dzd} onChange={e => setForm(f => ({ ...f, price_dzd: e.target.value }))} min="0" step="100" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>DZD</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { onSave({ ...item, ...form }); setEditing(false); }}>
              <Save size={12} /> Save
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
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
        {/* Header: Service Name, Price, and Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            cursor: 'pointer'
          }}
          onClick={onToggle}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              🏷️ {item.service_name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
            <span style={{ fontWeight: 700, color: parseFloat(item.price_dzd) > 0 ? 'var(--accent)' : 'var(--text-muted)', fontSize: 13 }}>
              {parseFloat(item.price_dzd) > 0 ? `${fmt(item.price_dzd)} DZD` : 'Not set'}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
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

        {/* Expanded drawer */}
        {isExpanded && (
          <div className="sp-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            {/* Description */}
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {item.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No description provided.</span>}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: 10 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setEditing(true)}>
                <Edit2 size={12} /> Edit Price
              </button>
              <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => onDelete(item.id)}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
        <td style={{ padding: '8px 14px' }}>
          <input className="form-input" style={{ margin: 0 }} value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} />
        </td>
        <td style={{ padding: '8px 14px' }}>
          <input className="form-input" style={{ margin: 0 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description..." />
        </td>
        <td style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              className="form-input"
              type="number"
              style={{ margin: 0, textAlign: 'right' }}
              value={form.price_dzd}
              onChange={e => setForm(f => ({ ...f, price_dzd: e.target.value }))}
              min="0"
              step="100"
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>DZD</span>
          </div>
        </td>
        <td style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { onSave({ ...item, ...form }); setEditing(false); }}>
              <Save size={12} /> Save
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              <X size={12} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{item.service_name}</td>
      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 13 }}>{item.description || '—'}</td>
      <td style={{ padding: '10px 14px', fontWeight: 700, color: parseFloat(item.price_dzd) > 0 ? 'var(--accent)' : 'var(--text-muted)', fontSize: 15 }}>
        {parseFloat(item.price_dzd) > 0 ? `${fmt(item.price_dzd)} DZD` : <span style={{ fontStyle: 'italic', fontWeight: 400, fontSize: 12 }}>Not set</span>}
      </td>
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Edit2 size={12} /></button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(item.id)}><Trash2 size={12} /></button>
        </div>
      </td>
    </tr>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();

  const [isMobile, setIsMobile] = useState(false);
  const [expandedServices, setExpandedServices] = useState({});
  const toggleService = (id) => setExpandedServices(prev => ({ ...prev, [id]: !prev[id] }));

  const [expandedRates, setExpandedRates] = useState({});
  const toggleRate = (id) => setExpandedRates(prev => ({ ...prev, [id]: !prev[id] }));

  useState(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  // ── Exchange Rate State ──────────────────────────────────────
  const [rateForm, setRateForm] = useState({
    rate: '',
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [rateSubmitted, setRateSubmitted] = useState(false);

  // ── New Service Form ─────────────────────────────────────────
  const [showAddService, setShowAddService] = useState(false);
  const [newService, setNewService] = useState({ service_name: '', price_dzd: '', description: '' });

  // ── Queries ──────────────────────────────────────────────────
  const { data: currentRate, isLoading: loadingRate } = useQuery({
    queryKey: ['dzd-rate-current'],
    queryFn: () => api.get('/ads/rate/current').then(r => r.data),
    onSuccess: (data) => {
      if (data && !rateSubmitted) setRateForm(f => ({ ...f, rate: data.rate }));
    },
  });

  const { data: rateHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['dzd-rate-history'],
    queryFn: () => api.get('/ads/rate/history').then(r => r.data),
  });

  const { data: servicePrices = [], isLoading: loadingServices } = useQuery({
    queryKey: ['service-prices'],
    queryFn: () => api.get('/finance/service-prices').then(r => r.data),
  });

  // ── Mutations ────────────────────────────────────────────────
  const updateRate = useMutation({
    mutationFn: body => api.post('/ads/rate', body),
    onSuccess: () => {
      qc.invalidateQueries(['dzd-rate-current']);
      qc.invalidateQueries(['dzd-rate-history']);
      qc.invalidateQueries(['ads-summary']);
      toast.success('Exchange rate updated!');
      setRateSubmitted(true);
      setRateForm(f => ({ ...f, notes: '' }));
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed to update rate'),
  });

  const saveServicePrice = useMutation({
    mutationFn: (item) => item.id
      ? api.put(`/finance/service-prices/${item.id}`, item)
      : api.post('/finance/service-prices', item),
    onSuccess: () => { qc.invalidateQueries(['service-prices']); toast.success('Service price saved!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteServicePrice = useMutation({
    mutationFn: (id) => api.delete(`/finance/service-prices/${id}`),
    onSuccess: () => { qc.invalidateQueries(['service-prices']); toast.success('Deleted'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const initDefaults = useMutation({
    mutationFn: () => Promise.all(DEFAULT_SERVICES.map(s => api.post('/finance/service-prices', s))),
    onSuccess: () => { qc.invalidateQueries(['service-prices']); toast.success('Default services initialized!'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const days = currentRate?.days_since_update ?? null;
  const isStale = days !== null && days >= 7;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Exchange & Amounts</h1>
          <p className="page-subtitle">Currency conversion rate and service pricing — admin only</p>
        </div>
      </div>

      {/* ── DZD/USD Exchange Rate ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: `2px solid ${isStale ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.3)'}`,
        borderRadius: 'var(--radius-xl)',
        padding: 28,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: isStale ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <BadgeDollarSign size={20} color={isStale ? '#f59e0b' : 'var(--accent)'} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>DZD / USD Exchange Rate</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Used to convert all ad spend (USD) to DZD for client wallet billing.
            </p>
          </div>
        </div>

        {/* Current Rate Display */}
        {loadingRate ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : currentRate ? (
          <div style={{
            display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 22,
            padding: '16px 20px', background: 'var(--bg)', borderRadius: 12,
            border: isStale ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Current Rate</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: isStale ? '#f59e0b' : 'var(--accent)' }}>
                {fmt(currentRate.rate)} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>DZD / USD</span>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Set on</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtDate(currentRate.effective_date)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>by {currentRate.set_by_name || 'admin'}</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Age</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: isStale ? '#f59e0b' : 'var(--success)' }}>
                {days === 0 ? 'Today' : `${days} day${days !== 1 ? 's' : ''} ago`}
              </div>
              {isStale && (
                <div style={{ fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <AlertTriangle size={11} /> Recommend updating
                </div>
              )}
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Example</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>$100 = <span style={{ color: 'var(--accent)' }}>{fmt(100 * parseFloat(currentRate.rate))} DZD</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$1,000 = {fmt(1000 * parseFloat(currentRate.rate))} DZD</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 16, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 22, color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
            ⚠️ No rate set yet. Enter the current DZD/USD rate below.
          </div>
        )}

        {/* Update Rate Form */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--text-secondary)' }}>
            {currentRate ? 'Update Rate' : 'Set Initial Rate'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">New Rate (DZD per $1 USD) *</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>$1 =</span>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="1"
                  value={rateForm.rate}
                  onChange={e => setRateForm(f => ({ ...f, rate: e.target.value }))}
                  placeholder="250.00"
                  style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0', borderLeft: 'none', minWidth: 110 }}
                />
                <span style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 var(--radius-md) var(--radius-md) 0', fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>DZD</span>
              </div>
              {rateForm.rate && parseFloat(rateForm.rate) > 0 && (
                <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>
                  Preview: $100 = {fmt(100 * parseFloat(rateForm.rate))} DZD
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Effective Date</label>
              <input className="form-input" type="date" value={rateForm.effective_date} onChange={e => setRateForm(f => ({ ...f, effective_date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" value={rateForm.notes} onChange={e => setRateForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. BCR official rate" />
            </div>
            <button
              className="btn btn-primary"
              disabled={!rateForm.rate || parseFloat(rateForm.rate) <= 0 || updateRate.isPending}
              onClick={() => updateRate.mutate({ rate: parseFloat(rateForm.rate), effective_date: rateForm.effective_date, notes: rateForm.notes || null })}
              style={{ marginBottom: 0 }}
            >
              {updateRate.isPending ? <><RefreshCw size={14} className="spin" /> Saving...</> : <><CheckCircle size={14} /> Save Rate</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Service Prices ── */}
      <div style={{ background: 'var(--bg-card)', border: '2px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-xl)', padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={20} color="var(--success)" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>Service Prices</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Standard prices per service type — used to calculate task costs and client wallet deductions
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {servicePrices.length === 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => initDefaults.mutate()} disabled={initDefaults.isPending}>
                {initDefaults.isPending ? 'Initializing...' : 'Initialize Defaults'}
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddService(true)}>
              <Plus size={14} /> Add Service
            </button>
          </div>
        </div>

        {loadingServices ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {showAddService && (
                <div className="card card-sm sp-fadeup" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, background: 'rgba(16,185,129,0.06)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700 }}>Service Name</label>
                    <input className="form-input" style={{ margin: 0 }} value={newService.service_name} onChange={e => setNewService(f => ({ ...f, service_name: e.target.value }))} placeholder="Service name" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700 }}>Description</label>
                    <input className="form-input" style={{ margin: 0 }} value={newService.description} onChange={e => setNewService(f => ({ ...f, description: e.target.value }))} placeholder="Description..." />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700 }}>Price (DZD)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input className="form-input" type="number" style={{ margin: 0, textAlign: 'right' }} value={newService.price_dzd} onChange={e => setNewService(f => ({ ...f, price_dzd: e.target.value }))} placeholder="0" min="0" step="100" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>DZD</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <button className="btn btn-primary btn-sm" disabled={!newService.service_name} onClick={() => { saveServicePrice.mutate(newService); setNewService({ service_name: '', price_dzd: '', description: '' }); setShowAddService(false); }}>
                      <Save size={12} /> Save
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAddService(false)}><X size={12} /> Cancel</button>
                  </div>
                </div>
              )}
              {servicePrices.map(item => (
                <ServicePriceRow
                  key={item.id}
                  item={item}
                  onSave={updated => saveServicePrice.mutate(updated)}
                  onDelete={id => {
                    if (window.confirm('Are you sure you want to delete this service price?')) {
                      deleteServicePrice.mutate(id);
                    }
                  }}
                  isMobile={true}
                  isExpanded={!!expandedServices[item.id]}
                  onToggle={() => toggleService(item.id)}
                />
              ))}
              {!servicePrices.length && !showAddService && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                  No service prices set yet.
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Service Name', 'Description', 'Standard Price', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {showAddService && (
                    <tr style={{ background: 'rgba(16,185,129,0.06)' }}>
                      <td style={{ padding: '8px 14px' }}>
                        <input className="form-input" style={{ margin: 0 }} value={newService.service_name} onChange={e => setNewService(f => ({ ...f, service_name: e.target.value }))} placeholder="Service name" />
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <input className="form-input" style={{ margin: 0 }} value={newService.description} onChange={e => setNewService(f => ({ ...f, description: e.target.value }))} placeholder="Description..." />
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input className="form-input" type="number" style={{ margin: 0, textAlign: 'right' }} value={newService.price_dzd} onChange={e => setNewService(f => ({ ...f, price_dzd: e.target.value }))} placeholder="0" min="0" step="100" />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>DZD</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-sm" disabled={!newService.service_name} onClick={() => { saveServicePrice.mutate(newService); setNewService({ service_name: '', price_dzd: '', description: '' }); setShowAddService(false); }}>
                            <Save size={12} /> Save
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddService(false)}><X size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {servicePrices.map(item => (
                    <ServicePriceRow
                      key={item.id}
                      item={item}
                      onSave={updated => saveServicePrice.mutate(updated)}
                      onDelete={id => {
                        if (window.confirm('Are you sure you want to delete this service price?')) {
                          deleteServicePrice.mutate(id);
                        }
                      }}
                      isMobile={false}
                    />
                  ))}
                  {!servicePrices.length && !showAddService && (
                    <tr>
                      <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        No service prices set yet — click "Initialize Defaults" to add standard services or "Add Service" to create custom ones.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ── Rate History ── */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <History size={18} color="var(--text-muted)" />
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Exchange Rate History</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>Last 30 entries</span>
        </div>
        {loadingHistory ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : rateHistory.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No rate history yet. Set your first rate above.
          </div>
        ) : (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rateHistory.map(r => {
                const isExpanded = !!expandedRates[r.id];
                return (
                  <div
                    key={r.id}
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
                    {/* Header: Clickable to Toggle */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleRate(r.id)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          📅 {fmtDate(r.effective_date)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontWeight: 850, color: 'var(--accent)', fontSize: 14 }}>
                          {fmt(r.rate)} DZD
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRate(r.id); }}
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

                    {/* Expanded Drawer */}
                    {isExpanded && (
                      <div className="sp-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-surface)', padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>$100 Equivalent</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginTop: 2 }}>{fmt(100 * parseFloat(r.rate))} DZD</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>$1,000 Equivalent</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginTop: 2 }}>{fmt(1000 * parseFloat(r.rate))} DZD</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Set By:</span>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{r.set_by_name || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Notes</span>
                            <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r.notes || '—'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Effective Date', 'Rate (DZD/$)', '$100 = DZD', '$1,000 = DZD', 'Set By', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rateHistory.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600 }}>{fmtDate(r.effective_date)}</td>
                      <td style={{ padding: '9px 14px', fontWeight: 800, color: 'var(--accent)', fontSize: 15 }}>{fmt(r.rate)}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>{fmt(100 * parseFloat(r.rate))} DZD</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>{fmt(1000 * parseFloat(r.rate))} DZD</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{r.set_by_name || '—'}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
