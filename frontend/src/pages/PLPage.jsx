import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { TrendingUp, TrendingDown, DollarSign, Users, Wallet } from 'lucide-react';
import { format } from 'date-fns';

const DZD = (n) =>
  `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD`;

function MetricCard({ label, value, icon: Icon, color, note, negative = false }) { // eslint-disable-line no-unused-vars
  const shown = negative ? -Math.abs(Number(value) || 0) : Number(value) || 0;
  return (
    <div className="stat-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || (shown < 0 ? 'var(--danger)' : 'var(--text-primary)') }}>
        {DZD(shown)}
      </div>
      {note && <div className="stat-sub">{note}</div>}
      <div className="stat-icon" style={{ background: `${color}20` }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
  );
}

function Bar({ label, value, revenue, color }) {
  const pct = revenue > 0 ? Math.min((Math.abs(value) / revenue) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{DZD(value)}</span>
      </div>
      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

export default function PLPage() {
  const now = new Date();
  const [scope, setScope] = useState('month');            // 'month' | 'year'
  const [monthInput, setMonthInput] = useState(format(now, 'yyyy-MM'));

  const [year, month] = monthInput.split('-');
  // The API takes year + optional month; omitting month gives the whole year.
  const params = scope === 'month' ? { year, month: Number(month) } : { year };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pl', scope, monthInput],
    queryFn: () => api.get('/finance/pl', { params }).then(r => r.data),
  });

  const revenue    = Number(data?.revenue ?? 0);
  const expenses   = Number(data?.expenses ?? 0);
  const teacherPay = Number(data?.teacher_payments ?? 0);
  const totalCosts = Number(data?.total_costs ?? 0);
  const netProfit  = Number(data?.net_profit ?? 0);
  const marginPct  = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Report</h1>
          <p className="page-subtitle">Tuition income against running costs</p>
        </div>
        <div className="page-actions" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-select" value={scope} onChange={e => setScope(e.target.value)} style={{ width: 130 }}>
            <option value="month">Monthly</option>
            <option value="year">Annual</option>
          </select>
          <input
            className="input"
            type={scope === 'month' ? 'month' : 'number'}
            value={scope === 'month' ? monthInput : year}
            min={scope === 'year' ? 2000 : undefined}
            max={scope === 'year' ? 2100 : undefined}
            onChange={e =>
              setMonthInput(scope === 'month' ? e.target.value : `${e.target.value}-01`)
            }
            style={{ width: 170 }}
          />
        </div>
      </div>

      {isLoading && <div className="card" style={{ padding: 40, textAlign: 'center' }}>Loading…</div>}

      {isError && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--danger)' }}>
          Could not load the report{error?.response?.status ? ` (HTTP ${error.response.status})` : ''}.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Period: {scope === 'month' ? monthInput : year}
          </div>

          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <MetricCard label="Tuition Revenue"  value={revenue}    icon={DollarSign} color="var(--success)" note="Payments + subject fees received" />
            <MetricCard label="School Expenses"  value={expenses}   icon={Wallet}     color="var(--warning)" note="Recorded expenses" negative />
            <MetricCard label="Teacher Payments" value={teacherPay} icon={Users}      color="hsl(280,70%,55%)" note="Paid to teaching staff" negative />
            <MetricCard label="Total Costs"      value={totalCosts} icon={TrendingDown} color="var(--danger)" note="Expenses + teacher pay" negative />
            <MetricCard
              label="Net Profit"
              value={netProfit}
              icon={netProfit >= 0 ? TrendingUp : TrendingDown}
              color={netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}
              note={`${marginPct.toFixed(1)}% margin`}
            />
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: 15 }}>Where the money goes</h3>
            {revenue === 0 && totalCosts === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                No financial activity recorded for this period.
              </div>
            ) : (
              <>
                <Bar label="Tuition Revenue"  value={revenue}    revenue={revenue} color="var(--success)" />
                <Bar label="School Expenses"  value={expenses}   revenue={revenue} color="var(--warning)" />
                <Bar label="Teacher Payments" value={teacherPay} revenue={revenue} color="hsl(280,70%,55%)" />

                <div
                  style={{
                    marginTop: 24,
                    padding: 20,
                    background: netProfit >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${netProfit >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {DZD(netProfit)}
                  </span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
