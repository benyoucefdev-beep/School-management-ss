import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2, Clock, CalendarDays } from 'lucide-react';
import api from '../lib/api';
import asArray from '../lib/asArray';
import toast from 'react-hot-toast';

const DZD = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} DZD`;

/**
 * Course enrolment for one student.
 *
 * A student may be enrolled in any number of courses — the backing table
 * student_subjects is a many-to-many join keyed on (student_id, subject_id).
 * Enrolment is what makes attendance possible at all: the absence sweep only
 * knows a student was expected at a session because they are enrolled in that
 * subject.
 */
export default function StudentCourses({ studentId }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState('');

  const { data: enrolled = [], isLoading } = useQuery({
    queryKey: ['student-subjects', studentId],
    queryFn: () => api.get(`/students/${studentId}/subjects`).then(r => asArray(r.data)),
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: () => api.get('/subjects').then(r => asArray(r.data)),
  });

  const enrolledIds = new Set(enrolled.map(c => c.id));
  const available = allSubjects.filter(s => !enrolledIds.has(s.id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['student-subjects', studentId] });
  };

  const add = useMutation({
    mutationFn: (subject_id) => api.post(`/students/${studentId}/subjects`, { subject_id }),
    onSuccess: () => { invalidate(); setPicked(''); toast.success('Enrolled in course'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Could not enrol'),
  });

  const remove = useMutation({
    mutationFn: (subjectId) => api.delete(`/students/${studentId}/subjects/${subjectId}`),
    onSuccess: () => { invalidate(); toast.success('Removed from course'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Could not remove'),
  });

  const monthlyTotal = enrolled.reduce((sum, c) => sum + Number(c.monthly_fee || 0), 0);
  const weeklySessions = enrolled.reduce((sum, c) => sum + Number(c.sessions_per_week || 0), 0);

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={17} /> Courses
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
            {enrolled.length} enrolled
          </span>
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={picked}
            onChange={e => setPicked(e.target.value)}
            style={{ minWidth: 210 }}
            disabled={available.length === 0}
          >
            <option value="">
              {available.length ? '— choose a course —' : 'All courses already assigned'}
            </option>
            {available.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.monthly_fee > 0 ? ` — ${DZD(s.monthly_fee)}/mo` : ''}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={!picked || add.isPending}
            onClick={() => add.mutate(picked)}
          >
            <Plus size={15} /> Enrol
          </button>
        </div>
      </div>

      {isLoading && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>}

      {!isLoading && enrolled.length === 0 && (
        <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <BookOpen size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 8, fontWeight: 600 }}>Not enrolled in any course yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Attendance only tracks students who are enrolled — a course must be assigned
            before absences can be recorded.
          </div>
        </div>
      )}

      {enrolled.length > 0 && (
        <>
          <div style={{ display: 'grid', gap: 10 }}>
            {enrolled.map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  borderLeft: `4px solid ${c.color_code || 'var(--accent)'}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  {c.name_ar && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.name_ar}</div>}
                </div>

                <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CalendarDays size={12} /> {c.sessions_per_week ?? 1}× / week
                </span>
                <span className="badge badge-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> {c.session_minutes ?? 60} min
                </span>
                <span style={{ fontWeight: 700, minWidth: 96, textAlign: 'right' }}>
                  {DZD(c.monthly_fee)}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/mo</span>
                </span>

                <button
                  className="btn btn-ghost btn-icon"
                  title={`Remove ${c.name}`}
                  onClick={() => { if (confirm(`Remove this student from ${c.name}?`)) remove.mutate(c.id); }}
                >
                  <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {weeklySessions} session{weeklySessions === 1 ? '' : 's'} per week across {enrolled.length} course{enrolled.length === 1 ? '' : 's'}
            </span>
            <span style={{ fontWeight: 800, fontSize: 16 }}>
              Parent pays {DZD(monthlyTotal)}<span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}> / month</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
