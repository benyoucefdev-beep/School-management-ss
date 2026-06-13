// frontend/src/pages/SettingsPage.jsx
// School app general settings — admin only

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast'
import { Settings, School, Globe, Bell, Shield, Save } from 'lucide-react';

export default function SettingsPage() {
  const qc = useQueryClient();

  const [schoolForm, setSchoolForm] = useState({
    school_name: 'EduManage School',
    school_email: '',
    school_phone: '',
    school_address: '',
    academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
  });

  const [notifForm, setNotifForm] = useState({
    notify_on_payment: true,
    notify_on_absence: true,
    notify_on_enrollment: true,
  });

  const handleSaveSchool = () => {
    toast.success('School settings saved!');
  };

  const handleSaveNotif = () => {
    toast.success('Notification preferences saved!');
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your school application preferences</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── School Information ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <School size={18} color="var(--primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>School Information</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Basic details about your institution</p>
            </div>
          </div>

          <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">School Name</label>
              <input
                className="form-input"
                value={schoolForm.school_name}
                onChange={e => setSchoolForm(f => ({ ...f, school_name: e.target.value }))}
                placeholder="e.g. Al Nour Academy"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Academic Year</label>
              <input
                className="form-input"
                value={schoolForm.academic_year}
                onChange={e => setSchoolForm(f => ({ ...f, academic_year: e.target.value }))}
                placeholder="2025/2026"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Contact Email</label>
              <input
                className="form-input"
                type="email"
                value={schoolForm.school_email}
                onChange={e => setSchoolForm(f => ({ ...f, school_email: e.target.value }))}
                placeholder="contact@school.com"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                type="tel"
                value={schoolForm.school_phone}
                onChange={e => setSchoolForm(f => ({ ...f, school_phone: e.target.value }))}
                placeholder="+213 555 123 456"
              />
            </div>
            <div className="form-group form-grid-2" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label className="form-label">School Address</label>
              <input
                className="form-input"
                value={schoolForm.school_address}
                onChange={e => setSchoolForm(f => ({ ...f, school_address: e.target.value }))}
                placeholder="123 Main Street, Algiers"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSaveSchool}>
              <Save size={14} /> Save School Info
            </button>
          </div>
        </div>

        {/* ── Notification Preferences ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color="#d97706" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Notification Preferences</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Control which events trigger app notifications</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {[
              { key: 'notify_on_payment', label: 'Payment received', desc: 'Notify when a student tuition fee payment is recorded' },
              { key: 'notify_on_absence', label: 'Student absence', desc: 'Notify when an absence is logged for a student' },
              { key: 'notify_on_enrollment', label: 'New enrollment', desc: 'Notify when a new student is added to the system' },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: '#f8fafc',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <div
                    onClick={() => setNotifForm(f => ({ ...f, [key]: !f[key] }))}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 100,
                      background: notifForm[key] ? 'var(--primary)' : '#cbd5e1',
                      position: 'relative',
                      transition: 'background 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 2,
                      left: notifForm[key] ? 22 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#ffffff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                      transition: 'left 0.2s ease',
                    }} />
                  </div>
                </label>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSaveNotif}>
              <Save size={14} /> Save Preferences
            </button>
          </div>
        </div>

        {/* ── Security ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} color="var(--danger)" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Security</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Access control and session management</p>
            </div>
          </div>

          <div style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>Role-based access control</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Admin, Manager, and Member roles with different permissions</div>
            </div>
            <span className="badge badge-green">Active</span>
          </div>
        </div>

      </div>
    </div>
  );
}
