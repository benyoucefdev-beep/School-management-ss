import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { GraduationCap, Printer, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import api from '../lib/api';

/**
 * The student's identity card: their details plus the QR code they scan on
 * arrival. The QR encodes scan_code (not portal_token), so reissuing a lost
 * card never invalidates the student's portal login.
 */
export default function StudentCard({ student, onReissue }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [qrError, setQrError] = useState(false);

  // The QR endpoint needs the auth header, so fetch it as a blob rather than
  // pointing <img src> straight at the API.
  useEffect(() => {
    let revoked = null;
    setQrError(false);
    api.get(`/students/${student.id}/qr`, { responseType: 'blob' })
      .then(r => { revoked = URL.createObjectURL(r.data); setQrUrl(revoked); })
      .catch(() => setQrError(true));
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [student.id, student.scan_code]);

  const { data: summary } = useQuery({
    queryKey: ['attendance-summary', student.id],
    queryFn: () => api.get(`/attendance/summary/${student.id}`).then(r => r.data),
  });

  const Stat = ({ icon: Icon, label, value, color }) => ( // eslint-disable-line no-unused-vars
    <div style={{ textAlign: 'center', flex: 1, minWidth: 70 }}>
      <Icon size={16} style={{ color }} />
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.3 }}>{value ?? 0}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
          color: '#fff', padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GraduationCap size={20} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Student Card</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Scan on arrival to record attendance</div>
          </div>
        </div>
        {student.is_adult && (
          <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.22)', padding: '4px 10px', borderRadius: 999 }}>
            ADULT — own portal
          </span>
        )}
      </div>

      <div style={{ padding: 20, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Identity */}
        <div style={{ flex: '1 1 240px', minWidth: 220 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{student.full_name}</div>
          {[
            ['Level',       student.level],
            ['Group',       student.group_name],
            ['Student no.', student.student_phone],
            ['Guardian',    student.father_phone],
            ['Email',       student.email],
            ['Enrolled',    student.enrollment_date ? String(student.enrollment_date).slice(0, 10) : null],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 84 }}>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}

          {summary && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <Stat icon={CheckCircle2} label="Present" value={summary.present} color="var(--success)" />
              <Stat icon={Clock}        label="Late"    value={summary.late}    color="var(--warning)" />
              <Stat icon={XCircle}      label="Absent"  value={summary.absent}  color="var(--danger)" />
              {summary.total_minutes_late > 0 && (
                <Stat icon={Clock} label="Min late" value={summary.total_minutes_late} color="var(--text-muted)" />
              )}
            </div>
          )}
        </div>

        {/* QR */}
        <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
          <div
            style={{
              width: 180, height: 180, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 8,
            }}
          >
            {qrError
              ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>QR unavailable</span>
              : qrUrl
                ? <img src={qrUrl} alt={`Attendance QR for ${student.full_name}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: 180 }}>
            {student.scan_code || '—'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
            {onReissue && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
                title="Issue a new code — the old card stops working"
                onClick={() => { if (confirm('Reissue this card? The current QR will stop working immediately.')) onReissue(); }}
              >
                <RefreshCw size={14} /> Reissue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
