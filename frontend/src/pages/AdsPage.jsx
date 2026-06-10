// frontend/src/pages/AdsPage.jsx
// Ads & Wallet Dashboard — admin + ads_manager
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  Wallet, TrendingUp, DollarSign, CheckCircle, Eye, RefreshCw, Plus
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../context/AuthContext';

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n, dec = 2) => Number(n || 0).toLocaleString('fr-DZ', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const ALERT_CFG = {
  ok:       { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'OK'       },
  low:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Low'      },
  critical: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Critical' },
  empty:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Empty'    },
};

function Pill({ cfg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

// ── Rate Panel ────────────────────────────────────────────────
function RatePanel({ summary, isAdmin, onRateUpdate, isMobile }) {
  if (!summary) return null;
  const stale = summary.rate_stale;
  return (
    <div style={{
      display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 12, flexWrap: 'wrap',
      flexDirection: isMobile ? 'column' : 'row',
      padding: '10px 18px', borderRadius: 12,
      background: stale ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.08)',
      border: `1px solid ${stale ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.2)'}`,
      width: '100%'
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        💱 1 USD = <strong style={{ color: stale ? '#f59e0b' : 'var(--accent)' }}>
          {fmt(summary.current_rate)} DZD
        </strong>
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        set on {summary.rate_date ? format(parseISO(summary.rate_date), 'dd MMM yyyy') : '—'}
        {stale && <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠ {summary.rate_days_old}d old</span>}
      </span>
      {isAdmin && (
        <button className="btn btn-sm btn-secondary" onClick={onRateUpdate} style={{ marginLeft: isMobile ? '0' : 'auto', width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0 }}>
          <RefreshCw size={13} /> Update Rate
        </button>
      )}
    </div>
  );
}

// ── Rate Update Modal ─────────────────────────────────────────
function RateModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ rate: '', effective_date: new Date().toISOString().split('T')[0], notes: '' });
  const mut = useMutation({
    mutationFn: body => api.post('/ads/rate', body),
    onSuccess: () => { toast.success('Rate updated!'); onSuccess(); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  return (
    <>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">New Rate (DZD per 1 USD) *</label>
          <input className="form-input" type="number" step="0.01" min="1" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="e.g. 250.00" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Effective Date</label>
          <input className="form-input" type="date" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. BCR official rate" />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!form.rate || mut.isPending} onClick={() => mut.mutate(form)}>
          {mut.isPending ? <RefreshCw size={14} className="spin" /> : <CheckCircle size={14} />}
          Set Rate
        </button>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdminUser = user?.role === 'admin';

  const [showRateModal, setShowRateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ads'); // 'ads' or 'all'

  const [expandedWallets, setExpandedWallets] = useState({});
  const toggleWallet = (id) => setExpandedWallets(prev => ({ ...prev, [id]: !prev[id] }));

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: summary, isLoading: loadSum } = useQuery({
    queryKey: ['ads-summary'],
    queryFn: () => api.get('/ads/summary').then(r => r.data),
  });

  const { data: walletsData, isLoading: loadWallets } = useQuery({
    queryKey: ['ads-wallets'],
    queryFn: () => api.get('/ads/wallets').then(r => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries(['ads-summary']);
    qc.invalidateQueries(['ads-wallets']);
  };

  const allWallets = walletsData?.wallets || [];
  const wallets = activeTab === 'ads' ? allWallets.filter(w => w.has_ads) : allWallets;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ads Balance Summary</h1>
          <p className="page-subtitle">Client ad wallets and global DZD/USD rate</p>
        </div>
      </div>

      {/* Rate Banner */}
      <div style={{ marginBottom: 20 }}>
        <RatePanel summary={summary} isAdmin={isAdminUser} onRateUpdate={() => setShowRateModal(true)} isMobile={isMobile} />
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { icon: Wallet, label: 'Total Wallet Balance', value: `${fmt(summary?.total_balance_dzd)} DZD`, color: '#6366f1' },
          { icon: TrendingUp, label: 'Spent This Month', value: `${fmt(summary?.month_spent_dzd)} DZD`, color: '#f97316' },
          { icon: DollarSign, label: 'Spent This Month', value: `${fmt(summary?.month_spent_usd)} USD`, color: '#10b981' },
          { icon: RefreshCw, label: 'Current Rate', value: `${fmt(summary?.current_rate)} DZD/USD`, color: '#8b5cf6' },
        ].map(({ icon: Icon, label, value, color }) => ( // eslint-disable-line no-unused-vars
          <div key={label} className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
            <div className="stat-info">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color: color, fontSize: 20 }}>{loadSum ? '—' : value}</div>
            </div>
            <div className="stat-icon" style={{ background: color + '18' }}>
              <Icon size={20} color={color} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Section A: Client Wallets ── */}
      <div style={{ marginBottom: 32 }}>
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div className="tabs" style={{ marginBottom: 0, minWidth: isMobile ? '100%' : 300 }}>
              <button 
                className={`tab ${activeTab === 'ads' ? 'active' : ''}`}
                onClick={() => setActiveTab('ads')}
              >
                Ads Clients
              </button>
              <button 
                className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Wallets
              </button>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
              Showing {wallets.length} {activeTab === 'ads' ? 'ads clients' : 'total clients'}
            </span>
          </div>
        </div>

        {loadWallets ? <div className="loading-center"><div className="loading-spinner" /></div> : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {wallets.map(w => {
              const alertCfg = ALERT_CFG[w.alert_status] || ALERT_CFG.ok;
              const isExpanded = !!expandedWallets[w.client_id];
              return (
                <div
                  key={w.client_id}
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
                  {/* Header: Client Name, Alert Status, Balance, and Toggle */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleWallet(w.client_id)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        🏢 {w.client_name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <Pill cfg={alertCfg} />
                      <span style={{ fontWeight: 700, color: parseFloat(w.balance_dzd) <= 0 ? 'var(--danger)' : 'var(--success)', fontSize: 13 }}>
                        {parseFloat(w.balance_dzd).toFixed(0)} DZD
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWallet(w.client_id); }}
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

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="sp-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                      {/* Balance detail */}
                      <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Wallet Balance</div>
                          <div style={{ fontWeight: 800, fontSize: 18, color: parseFloat(w.balance_dzd) <= 0 ? 'var(--danger)' : 'var(--success)', marginTop: 2 }}>
                            {fmt(w.balance_dzd)} DZD
                          </div>
                        </div>
                      </div>

                      {/* Spent Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Spent (DZD)</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {fmt(w.total_spent_dzd)} DZD
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Spent (USD)</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                            ${fmt(w.total_spent_usd)}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        <Link to={`/clients/${w.client_id}`} className="btn btn-sm" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6 }}>
                          <Eye size={12} /> View Client
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {wallets.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                No wallets yet. Activate digital marketing for a client to create a wallet.
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800, fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border)' }}>
                  {['Client', 'Balance DZD', 'Total Spent DZD', 'Total Spent USD', 'Alert', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wallets.map((w, i) => {
                  const alertCfg = ALERT_CFG[w.alert_status] || ALERT_CFG.ok;
                  return (
                    <tr key={w.client_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)'}>
                      <td style={{ padding: '7px 14px', fontWeight: 700 }}>{w.client_name}</td>
                      <td style={{ padding: '7px 14px', fontWeight: 800, color: parseFloat(w.balance_dzd) <= 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {fmt(w.balance_dzd)} DZD
                      </td>
                      <td style={{ padding: '7px 14px', color: 'var(--text-muted)' }}>{fmt(w.total_spent_dzd)} DZD</td>
                      <td style={{ padding: '7px 14px', color: 'var(--text-muted)' }}>${fmt(w.total_spent_usd)}</td>
                      <td style={{ padding: '7px 14px' }}><Pill cfg={alertCfg} /></td>
                      <td style={{ padding: '7px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link to={`/clients/${w.client_id}`} className="btn btn-sm" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: 'none', padding: '4px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 6 }}>
                            <Eye size={12} /> View Client
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {wallets.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No wallets yet. Activate digital marketing for a client to create a wallet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showRateModal && (
        <Modal open title="Update DZD/USD Exchange Rate" onClose={() => setShowRateModal(false)} size="modal-sm">
          <RateModal onClose={() => setShowRateModal(false)} onSuccess={invalidate} />
        </Modal>
      )}
    </div>
  );
}
