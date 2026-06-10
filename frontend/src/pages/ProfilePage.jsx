import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Camera, Save, Lock, User, Mail, AtSign, Check, Bell } from 'lucide-react';
import { subscribePush, checkPushSubscription } from '../components/PushSubscriptionHandler';

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name:     user?.name     || '',
    username: user?.username || '',
    email:    user?.email    || '',
    photo_url: user?.photo_url || '',
  });

  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [previewUrl, setPreviewUrl] = useState(user?.photo_url || null);
  const fileInputRef = useRef(null);

  // Update profile (name, username, email, photo_url)
  const updateProfile = useMutation({
    mutationFn: body => api.put('/auth/me', body),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Profile updated successfully');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed to update profile'),
  });

  // Change password
  const changePassword = useMutation({
    mutationFn: body => api.put('/auth/me/password', body),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed to change password'),
  });

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPreviewUrl(dataUrl);
      setProfileForm(f => ({ ...f, photo_url: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = () => {
    if (!profileForm.name.trim()) { toast.error('Name is required'); return; }
    updateProfile.mutate(profileForm);
  };

  const handlePasswordSubmit = () => {
    if (!pwForm.current_password || !pwForm.new_password) {
      toast.error('Please fill all password fields');
      return;
    }
    if (pwForm.new_password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    changePassword.mutate({
      current_password: pwForm.current_password,
      new_password: pwForm.new_password,
    });
  };

  const ROLE_LABELS = {
    admin: 'Administrator',
    graphic_designer: 'Graphic Designer',
    software_developer: 'Software Developer',
    printer: 'Printer',
    ads_manager: 'Ads Manager',
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account details and security settings</p>
        </div>
      </div>

      {/* Avatar Section */}
      <Section title="Profile Picture">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 90, height: 90, borderRadius: '50%', position: 'relative',
              background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 800, color: 'white', flexShrink: 0,
              cursor: 'pointer', overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
            }}
            onClick={() => fileInputRef.current?.click()}
            title="Click to upload photo"
          >
            {previewUrl
              ? <img src={previewUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials(user?.name)}
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}
            >
              <Camera size={22} color="white" />
            </div>
          </div>
          <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              {ROLE_LABELS[user?.role] || user?.role}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={13} /> Change Photo
            </button>
          </div>
        </div>
      </Section>

      {/* Profile Info Section */}
      <Section title="Account Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">
              <User size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Display Name *
            </label>
            <input
              className="form-input"
              value={profileForm.name}
              onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your full name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <AtSign size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Username
            </label>
            <input
              className="form-input"
              value={profileForm.username}
              onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
              placeholder="your_username"
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">
              <Mail size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Email Address
            </label>
            <input
              className="form-input"
              type="email"
              value={profileForm.email}
              onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@axialogy.com"
            />
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleProfileSubmit}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending
              ? 'Saving...'
              : <><Save size={14} /> Save Changes</>}
          </button>
        </div>
      </Section>

      {/* Password Change Section — admin only */}
      {user?.role === 'admin' && (
        <Section title="Change Password">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">
                <Lock size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Current Password
              </label>
              <input
                className="form-input"
                type="password"
                value={pwForm.current_password}
                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                placeholder="Enter your current password"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                  placeholder="Min. 6 characters"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={pwForm.confirm_password}
                  onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                  placeholder="Repeat new password"
                  style={{
                    borderColor: pwForm.confirm_password && pwForm.new_password === pwForm.confirm_password
                      ? 'var(--success)' : undefined
                  }}
                />
                {pwForm.confirm_password && pwForm.new_password === pwForm.confirm_password && (
                  <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> Passwords match
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handlePasswordSubmit}
              disabled={changePassword.isPending}
            >
              {changePassword.isPending
                ? 'Updating...'
                : <><Lock size={14} /> Update Password</>}
            </button>
          </div>
        </Section>
      )}


      {/* Notification Status */}
      <NotificationStatus />

      {/* Role Info */}
      <div className="card" style={{ padding: '16px 20px', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your role on this platform:</div>
        <span className="badge badge-purple">{ROLE_LABELS[user?.role] || user?.role}</span>
      </div>
    </div>
  );
}

function NotificationStatus() {
  const [status, setStatus] = useState('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    checkPushSubscription().then(setStatus);
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    const ok = await subscribePush(false);
    if (ok) {
      setStatus('subscribed');
      toast.success('🔔 Notifications enabled on this device!');
    } else {
      const perm = 'Notification' in window ? Notification.permission : 'unsupported';
      setStatus(perm === 'denied' ? 'denied' : 'not_subscribed');
      if (perm === 'denied') {
        toast.error('Notifications are blocked. Allow them in your browser/app settings.');
      } else {
        toast.error('Could not enable notifications. Please try again.');
      }
    }
    setBusy(false);
  };

  const statusMap = {
    checking:       { bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', color: 'var(--text-muted)',  icon: '⏳', text: 'Checking notification status...' },
    unsupported:    { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', color: '#f59e0b',             icon: '⚠️', text: 'Push notifications are not supported in this browser. Use Chrome on Android or install the PWA on iOS.' },
    denied:         { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  color: 'var(--danger)',       icon: '🚫', text: 'Notifications blocked. Go to your browser settings → Site permissions and allow notifications for this site, then reload.' },
    default:        { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)',  color: 'var(--accent)',       icon: '🔔', text: 'Tap below to enable push notifications on this device.' },
    not_subscribed: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)',  color: 'var(--accent)',       icon: '🔔', text: 'This device is not subscribed. Tap below to enable push notifications.' },
    subscribed:     { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  color: '#22c55e',             icon: '✅', text: 'Push notifications are active on this device. You will receive alerts even when the app is closed.' },
  };

  const cfg = statusMap[status] || statusMap.checking;

  return (
    <div className="card" style={{ marginBottom: 24, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 }}>
          <Bell size={18} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: cfg.color, marginBottom: 4 }}>Push Notifications</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {cfg.icon} {cfg.text}
            </div>
          </div>
        </div>
        {(status === 'default' || status === 'not_subscribed') && (
          <button
            className="btn btn-primary"
            onClick={handleEnable}
            disabled={busy}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {busy ? 'Enabling...' : '🔔 Enable on This Device'}
          </button>
        )}
        {status === 'subscribed' && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleEnable}
            disabled={busy}
            title="Re-register this device's push subscription"
          >
            {busy ? '...' : '🔄 Refresh'}
          </button>
        )}
      </div>
    </div>
  );
}

