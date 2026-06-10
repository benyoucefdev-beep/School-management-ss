import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, AlertTriangle, Clock, Plus, Filter } from 'lucide-react';
import { format } from 'date-fns';

function MetricCard({ label, value, icon: Icon, color, note }) { // eslint-disable-line no-unused-vars
  const isNeg = value < 0;
  const display = `${isNeg ? '-' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })} DZD`;
  return (
    <div className="stat-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || (isNeg ? 'var(--danger)' : 'var(--text-primary)') }}>{display}</div>
      {note && <div className="stat-sub">{note}</div>}
      <div className="stat-icon" style={{ background: `${color}20` }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
  );
}

export default function PLPage() {
  const [period, setPeriod] = useState('month');
  const [dateInput, setDateInput] = useState(format(new Date(), 'yyyy-MM'));
  const date = period === 'month' ? dateInput : dateInput.slice(0, 7);

  const [isMobile, setIsMobile] = useState(false);
  const [expandedDebts, setExpandedDebts] = useState({});
  const toggleDebt = (id) => setExpandedDebts(prev => ({ ...prev, [id]: !prev[id] }));
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['pl', period, date],
    queryFn: () => api.get('/finance/pl', { params: { period, date } }).then(r => r.data),
  });

  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">P&amp;L Report</h1>
          <p className="page-subtitle">Profit &amp; Loss Analysis</p>
        </div>
        {!isMobile && (
          <div className="page-actions" style={{ gap: 12, alignItems: 'center' }}>
            <select className="form-select" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 130 }}>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Annual</option>
            </select>
            <input
              className="form-input"
              type="month"
              value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
              📅 {period === 'month' ? 'Monthly' : period === 'quarter' ? 'Quarterly' : 'Annual'}: {date}
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
            </button>
          </div>

          {showMobileFilters && (
            <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Period Type</label>
                <select className="form-select" value={period} onChange={e => setPeriod(e.target.value)}>
                  <option value="month">Monthly</option>
                  <option value="quarter">Quarterly</option>
                  <option value="year">Annual</option>
                </select>
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Select Date</label>
                <input
                  className="form-input"
                  type="month"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : data ? (
        <>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Period: {data.from} → {data.to}
          </div>

          {/* ── Metric Cards ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 28 }}>
            <MetricCard label="Total Revenue"      value={data.revenue}                   icon={DollarSign}    color="var(--success)"   note="Versements received" />
            <MetricCard label="Fixed Expenses"     value={-data.fixed_expenses}           icon={TrendingDown}  color="var(--warning)"   note="Annualized per month" />
            <MetricCard label="Variable Expenses"  value={-data.variable_expenses}        icon={TrendingDown}  color="var(--warning)"   note="This period" />
            <MetricCard label="Supplier Payments"  value={-(data.supplier_payments ?? 0)} icon={TrendingDown}  color="hsl(280,70%,55%)" note="Paid to suppliers" />
            <MetricCard label="Ads Spend"          value={-(data.ads_spend ?? 0)}         icon={BarChart2}     color="var(--accent)"    note="Campaigns (DZD)" />
            <MetricCard label="Total Expenses"     value={-data.total_expenses}           icon={TrendingDown}  color="var(--danger)"    note="Supplier + Fixed/Var" />
            <MetricCard
              label="Net Profit"
              value={data.net_profit}
              icon={data.net_profit >= 0 ? TrendingUp : TrendingDown}
              color={data.net_profit >= 0 ? 'var(--success)' : 'var(--danger)'}
              note={`${data.margin_pct}% margin`}
            />
            {(data.pending_debts_dzd > 0) && (
              <MetricCard
                label="Pending Debts"
                value={-data.pending_debts_dzd}
                icon={Clock}
                color="hsl(38,95%,55%)"
                note="Not yet paid to suppliers"
              />
            )}
          </div>

          {/* ── Breakdown Card ───────────────────────────────────────── */}
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Revenue',           value: data.revenue,                 color: 'var(--success)',   pct: 100 },
                { label: 'Fixed Expenses',    value: data.fixed_expenses,          color: 'var(--warning)',   pct: data.revenue > 0 ? (data.fixed_expenses    / data.revenue) * 100 : 0 },
                { label: 'Variable Expenses', value: data.variable_expenses,       color: 'hsl(25,90%,55%)', pct: data.revenue > 0 ? (data.variable_expenses / data.revenue) * 100 : 0 },
                { label: 'Supplier Payments', value: data.supplier_payments ?? 0, color: 'hsl(280,70%,55%)', pct: data.revenue > 0 ? ((data.supplier_payments ?? 0) / data.revenue) * 100 : 0 },
                { label: 'Ads Spend (DZD)',   value: data.ads_spend ?? 0,         color: 'var(--accent)',   pct: data.revenue > 0 ? ((data.ads_spend ?? 0)  / data.revenue) * 100 : 0 },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontWeight: 700, color: item.color }}>
                      {item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} DZD
                      {item.pct !== 100 && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>({Math.round(item.pct)}%)</span>}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, item.pct)}%`, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, padding: '20px', background: data.net_profit >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 'var(--radius-md)', border: `1px solid ${data.net_profit >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: data.net_profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  Net {data.net_profit >= 0 ? 'Profit' : 'Loss'}
                </span>
                <span style={{ fontSize: 24, fontWeight: 800, color: data.net_profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {data.net_profit < 0 ? '-' : ''}{Math.abs(data.net_profit).toLocaleString('en-US', { minimumFractionDigits: 2 })} DZD
                </span>
              </div>
              <div style={{ fontSize: 13, color: data.net_profit >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 4, opacity: 0.8 }}>
                {data.margin_pct}% profit margin · Revenue − Operating expenses (Fixed, Variable, Suppliers)
              </div>
            </div>
          </div>

          {/* ── Dettes (Pending Supplier Debts) ────────────────────── */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={18} style={{ color: 'hsl(38,95%,55%)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Dettes Fournisseurs</h3>
              {(data.pending_debts?.length > 0) && (
                <span style={{ marginLeft: 'auto', background: 'rgba(245,158,11,0.15)', color: 'hsl(38,95%,45%)', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  {data.pending_debts.length} pending · {fmt(data.pending_debts_dzd)} DZD
                </span>
              )}
            </div>

            {data.pending_debts?.length > 0 ? (
              isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.pending_debts.map(d => {
                    const isOverdue = d.due_date && new Date(d.due_date) < new Date();
                    const isExpanded = !!expandedDebts[d.id];
                    return (
                      <div
                        key={d.id}
                        className="card card-sm sp-fadeup"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: isExpanded ? 12 : 0,
                          background: isOverdue ? 'rgba(239,68,68,0.02)' : 'var(--bg-card)',
                          border: isOverdue ? '1px solid var(--danger)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: 16,
                          boxShadow: 'var(--shadow-card)',
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        {/* Header: Supplier name, Status, Amount & Toggle */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            cursor: 'pointer'
                          }}
                          onClick={() => toggleDebt(d.id)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                              🤝 {d.supplier_name}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                            <span style={{
                              padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                              background: d.status === 'overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                              color: d.status === 'overdue' ? 'var(--danger)' : 'hsl(38,95%,45%)',
                            }}>
                              {d.status}
                            </span>
                            <span style={{ fontWeight: 800, color: 'hsl(38,95%,45%)', fontSize: 13 }}>
                              {Number(d.amount_remaining || 0).toFixed(0)} DZD
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleDebt(d.id); }}
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
                            {/* Amount Detailed / Original Currency */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
                              <div>
                                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Remaining</div>
                                <div style={{ fontWeight: 800, fontSize: 15, color: 'hsl(38,95%,45%)', marginTop: 2 }}>
                                  {Number(d.amount_remaining || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} DZD
                                </div>
                              </div>
                              {d.currency !== 'DZD' && (
                                <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.15)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)', fontWeight: 600 }}>
                                  orig. in {d.currency}
                                </span>
                              )}
                            </div>

                            {/* Due Date & Notes */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Due Date:</span>
                                <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: isOverdue ? 700 : 500 }}>
                                  {d.due_date ? format(new Date(d.due_date), 'MMM d, yyyy') : '—'}
                                  {isOverdue && ' ⚠'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Notes</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.4 }}>{d.notes || '—'}</span>
                              </div>
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
                        <th>Supplier</th>
                        <th>Amount Remaining</th>
                        <th>Currency</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pending_debts.map(d => {
                        const isOverdue = d.due_date && new Date(d.due_date) < new Date();
                        return (
                          <tr key={d.id} style={{ background: isOverdue ? 'rgba(239,68,68,0.04)' : undefined }}>
                            <td style={{ fontWeight: 600 }}>{d.supplier_name}</td>
                            <td style={{ fontWeight: 700, color: 'hsl(38,95%,45%)' }}>
                              {Number(d.amount_remaining || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} DZD
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                              {d.currency !== 'DZD' ? (
                                <span style={{ fontSize: 11, background: 'rgba(100,116,139,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                                  orig. in {d.currency}
                                </span>
                              ) : 'DZD'}
                            </td>
                            <td>
                              <span style={{
                                padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                background: d.status === 'overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                color: d.status === 'overdue' ? 'var(--danger)' : 'hsl(38,95%,45%)',
                              }}>
                                {d.status}
                              </span>
                            </td>
                            <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', fontSize: 13, fontWeight: isOverdue ? 700 : 400 }}>
                              {d.due_date ? format(new Date(d.due_date), 'MMM d, yyyy') : '—'}
                              {isOverdue && ' ⚠'}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{d.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                ✓ No pending supplier debts
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
