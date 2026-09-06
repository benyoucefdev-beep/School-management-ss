import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { Printer, RefreshCw, Upload, Trash2, CheckCircle2, Clock, XCircle, User } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

/**
 * Student identity card, laid out as a passport data page.
 *
 * Size is ID-3 (125 x 88 mm) — the same as the first page of a passport — with
 * a 35 x 45 mm photo well, the standard passport photo size. Printing emits
 * exactly one page at those dimensions with nothing else on it.
 */

const CARD_W = '125mm';
const CARD_H = '88mm';

/** Resize in the browser so what we upload is passport-shaped and small. */
function resizeToPassport(file, maxW = 360) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => { img.src = reader.result; };
    img.onerror = () => reject(new Error('That file is not a readable image'));
    img.onload = () => {
      // Crop to the 35:45 passport ratio, centred, then scale down.
      const targetRatio = 35 / 45;
      let { width: sw, height: sh } = img;
      let sx = 0, sy = 0;
      if (sw / sh > targetRatio) { const w = sh * targetRatio; sx = (sw - w) / 2; sw = w; }
      else { const h = sw / targetRatio; sy = (sh - h) / 2; sh = h; }

      const w = Math.min(maxW, Math.round(sw));
      const h = Math.round(w / targetRatio);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    reader.readAsDataURL(file);
  });
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: '1.6mm' }}>
      <div style={{ fontSize: '5.4pt', letterSpacing: '0.4pt', textTransform: 'uppercase', color: '#6b7280', lineHeight: 1.2 }}>
        {label}
      </div>
      <div style={{ fontSize: '8pt', fontWeight: 700, color: '#111827', lineHeight: 1.25, wordBreak: 'break-word' }}>
        {value || '—'}
      </div>
    </div>
  );
}

export default function StudentCard({ student, onReissue }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url = null;
    api.get(`/students/${student.id}/qr`, { responseType: 'blob' })
      .then(r => { url = URL.createObjectURL(r.data); setQrUrl(url); })
      .catch(() => setQrUrl(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [student.id, student.scan_code]);

  const loadPhoto = () => {
    api.get(`/students/${student.id}/photo`, { responseType: 'blob' })
      .then(r => setPhotoUrl(URL.createObjectURL(r.data)))
      .catch(() => setPhotoUrl(null));
  };
  useEffect(loadPhoto, [student.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: summary } = useQuery({
    queryKey: ['attendance-summary', student.id],
    queryFn: () => api.get(`/attendance/summary/${student.id}`).then(r => r.data),
    retry: false,
  });

  const removePhoto = useMutation({
    mutationFn: () => api.delete(`/students/${student.id}/photo`),
    onSuccess: () => { setPhotoUrl(null); toast.success('Photo removed'); qc.invalidateQueries({ queryKey: ['student', student.id] }); },
    onError: () => toast.error('Could not remove the photo'),
  });

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error('Choose a JPEG, PNG or WebP image');
    setBusy(true);
    try {
      const data = await resizeToPassport(file);
      await api.post(`/students/${student.id}/photo`, { data });
      toast.success('Photo saved');
      loadPhoto();
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  const Stat = ({ icon: Icon, label, value, color }) => ( // eslint-disable-line no-unused-vars
    <div style={{ textAlign: 'center' }}>
      <Icon size={13} style={{ color }} />
      <div style={{ fontSize: '8pt', fontWeight: 800, color, lineHeight: 1.2 }}>{value ?? 0}</div>
      <div style={{ fontSize: '5pt', color: '#6b7280', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );

  return (
    <>
      {/* Print exactly one ID-3 page containing only the card. */}
      <style>{`
        @media print {
          @page { size: ${CARD_W} ${CARD_H}; margin: 0; }
          body * { visibility: hidden !important; }
          #student-passport, #student-passport * { visibility: visible !important; }
          #student-passport {
            position: fixed !important; left: 0; top: 0;
            margin: 0 !important; border-radius: 0 !important; box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <div
          id="student-passport"
          style={{
            width: CARD_W, height: CARD_H,
            background: 'linear-gradient(135deg,#ffffff 0%,#f8fafc 55%,#eef2ff 100%)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '5mm', boxSizing: 'border-box',
            display: 'grid', gridTemplateColumns: '35mm 1fr', gap: '5mm',
            fontFamily: 'system-ui, sans-serif', color: '#111827',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          }}
        >
          {/* Left column: photo well + QR, passport style */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2mm' }}>
            <div
              style={{
                width: '35mm', height: '45mm', border: '0.4mm solid #cbd5e1', borderRadius: 3,
                background: '#fff', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {photoUrl
                ? <img src={photoUrl} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                    <User size={26} />
                    <div style={{ fontSize: '5.5pt', marginTop: 2 }}>NO PHOTO</div>
                    <div style={{ fontSize: '5pt' }}>35 × 45 mm</div>
                  </div>}
            </div>
            {qrUrl && (
              <img src={qrUrl} alt="Attendance QR"
                   style={{ width: '24mm', height: '24mm', alignSelf: 'center' }} />
            )}
          </div>

          {/* Right column: identity */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ borderBottom: '0.3mm solid #cbd5e1', paddingBottom: '1.5mm', marginBottom: '2mm' }}>
              <div style={{ fontSize: '7pt', fontWeight: 800, letterSpacing: '0.6pt', color: '#4f46e5' }}>
                EDUMANAGE — STUDENT CARD
              </div>
              <div style={{ fontSize: '5.2pt', color: '#6b7280' }}>
                Scan the code on arrival to record attendance
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '3mm' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Full name" value={student.full_name} />
              </div>
              <Field label="Level" value={student.level} />
              <Field label="Group" value={student.group_name} />
              <Field label="Date of birth" value={student.date_of_birth ? String(student.date_of_birth).slice(0, 10) : null} />
              <Field label="Enrolled" value={student.enrollment_date ? String(student.enrollment_date).slice(0, 10) : null} />
              <Field label="Phone" value={student.student_phone || student.phone} />
              <Field label="Guardian" value={student.father_phone} />
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2mm' }}>
              {summary && (
                <div style={{ display: 'flex', gap: '3mm' }}>
                  <Stat icon={CheckCircle2} label="Present" value={summary.present} color="#059669" />
                  <Stat icon={Clock}        label="Late"    value={summary.late}    color="#d97706" />
                  <Stat icon={XCircle}      label="Absent"  value={summary.absent}  color="#dc2626" />
                </div>
              )}
              <div style={{ fontSize: '4.8pt', fontFamily: 'monospace', color: '#9ca3af', textAlign: 'right', wordBreak: 'break-all', maxWidth: '38mm' }}>
                {student.scan_code || ''}
              </div>
            </div>
          </div>
        </div>

        {/* Controls — never printed */}
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} style={{ display: 'none' }} />
          <button className="btn btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> {busy ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Upload photo'}
          </button>
          {photoUrl && (
            <button className="btn btn-ghost" onClick={() => removePhoto.mutate()}>
              <Trash2 size={15} /> Remove photo
            </button>
          )}
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={15} /> Print card
          </button>
          {onReissue && (
            <button className="btn btn-ghost" title="Issue a new code — the printed card stops working"
                    onClick={() => { if (confirm('Reissue this card? The current QR stops working immediately.')) onReissue(); }}>
              <RefreshCw size={15} /> Reissue code
            </button>
          )}
        </div>
        <div className="no-print" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Card prints at 125 × 88 mm (passport data-page size). Photo well is 35 × 45 mm —
          images are cropped to that ratio automatically.
        </div>
      </div>
    </>
  );
}
