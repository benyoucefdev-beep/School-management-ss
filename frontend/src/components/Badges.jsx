// HealthBadge.jsx
export function HealthBadge({ score }) {
  const map = { green: 'badge-green', yellow: 'badge-yellow', red: 'badge-red' };
  return (
    <span className={`badge ${map[score] || 'badge-gray'}`}>
      <span className={`health-dot ${score}`} style={{ width: 7, height: 7, display: 'inline-block', borderRadius: '50%', background: score === 'green' ? 'var(--success)' : score === 'yellow' ? 'var(--warning)' : 'var(--danger)' }} />
      {score}
    </span>
  );
}

// StatusBadge.jsx
const statusConfig = {
  // Tasks
  todo:       { cls: 'badge-gray',   label: 'To Do' },
  in_progress:{ cls: 'badge-blue',   label: 'In Progress' },
  in_review:  { cls: 'badge-yellow', label: 'In Review' },
  done:       { cls: 'badge-green',  label: 'Done' },
  // Invoices
  draft:      { cls: 'badge-gray',   label: 'Draft' },
  sent:       { cls: 'badge-blue',   label: 'Sent' },
  paid:       { cls: 'badge-green',  label: 'Paid' },
  overdue:    { cls: 'badge-red',    label: 'Overdue' },
  // Quotes
  approved:   { cls: 'badge-green',  label: 'Approved' },
  rejected:   { cls: 'badge-red',    label: 'Rejected' },
  // Review
  submitted:          { cls: 'badge-blue',   label: 'Submitted' },
  revision_requested: { cls: 'badge-yellow', label: 'Revision Needed' },
  // Services
  on_track: { cls: 'badge-green',  label: 'On Track' },
  at_risk:  { cls: 'badge-yellow', label: 'At Risk' },
  delayed:  { cls: 'badge-red',    label: 'Delayed' },
};

export function StatusBadge({ status }) {
  const cfg = statusConfig[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

// AlertBadge
export function AlertBadge({ level }) {
  const map = { green: 'badge-green', yellow: 'badge-yellow', red: 'badge-red' };
  const labels = { green: 'OK', yellow: '⚠ Low Budget', red: '🔴 Critical' };
  return <span className={`badge ${map[level] || 'badge-gray'}`}>{labels[level] || level}</span>;
}
