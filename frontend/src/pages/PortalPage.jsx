import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';
const portalApi = axios.create({ baseURL: BASE });

// —— Notification helpers ————————————————————————————
const NOTIF_ICON = { invoice_received: '🧾', quote_received: '📋', task_updated: '✅' };
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const _audio = typeof window !== 'undefined' ? new Audio(NOTIFICATION_SOUND_URL) : null;
function playNotificationSound() { if (_audio) _audio.play().catch(() => {}); }
function syncBadge(count) {
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }
  } catch (_) {}
}
function showOsNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', vibrate: [200, 100, 200] }); } catch (_) {}
  }
}
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

const STATUS_COLORS = {
  not_started: '#94a3b8', in_progress: '#6366f1', in_review: '#f59e0b',
  done: '#10b981', completed: '#10b981', blocked: '#ef4444',
  waiting_client: '#f97316', urgent: '#ef4444', paused: '#94a3b8',
};
function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: color + '22', color }}>
      {status?.replace(/_/g, ' ') || '—'}
    </span>
  );
}
function Card({ children, style }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{children}</h2>;
}
function NotesThread({ notes = [], uploadId, token, onRefresh }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await portalApi.post(`/portal/${token}/documents/${uploadId}/notes`, { content: text.trim() });
      setText(''); onRefresh();
    } catch { } finally { setSaving(false); }
  };
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
      {notes.map(n => (
        <div key={n.id} style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: n.author_type === 'admin' ? '#6366f1' : '#0ea5e9', minWidth: 80 }}>
            {n.author_type === 'admin' ? '🏢 Team' : '👤 You'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#334155' }}>{n.content}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{new Date(n.created_at).toLocaleString()}</div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Write a note..."
          style={{ flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
        <button onClick={send} disabled={saving || !text.trim()}
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ── Shared eye-toggle icon ──────────────────────────────────────
function EyeIcon({ open }) {
  return open
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}
function PasswordField({ label, placeholder, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="auth-input" type={show ? 'text' : 'password'} placeholder={placeholder}
          value={value} onChange={onChange} required autoComplete={autoComplete}
          style={{ paddingRight: 44 }} />
        <button type="button" onClick={() => setShow(v => !v)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 2 }}>
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

// ── Auth screen shared styles ─────────────────────────────────
const AUTH_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  .auth-card { animation: fadeUp 0.4s ease; }
  .auth-input { width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-size: 15px; font-family: inherit; outline: none; transition: border 0.2s, box-shadow 0.2s; box-sizing: border-box; }
  .auth-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
  .auth-btn { width: 100%; padding: 14px; border-radius: 12px; border: none; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity 0.2s, transform 0.1s; font-family: inherit; }
  .auth-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
  .auth-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .auth-link { background: none; border: none; color: #6366f1; font-weight: 600; cursor: pointer; font-size: 14px; text-decoration: underline; }

  /* ── Tabs ─────────────────────────────────────────────── */
  .portal-tabs { display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .portal-tabs::-webkit-scrollbar { display: none; }
  .portal-tab { flex: 1; min-width: 80px; padding: 13px 8px; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 500; white-space: nowrap; transition: all 0.15s; border-bottom: 2px solid transparent; font-family: inherit; }

  /* ── Bell animation ───────────────────────────────────── */
  @keyframes bell-shake { 0%{transform:rotate(0)} 15%{transform:rotate(18deg)} 30%{transform:rotate(-16deg)} 45%{transform:rotate(12deg)} 60%{transform:rotate(-8deg)} 75%{transform:rotate(4deg)} 100%{transform:rotate(0)} }
  .bell-shake { animation: bell-shake 0.6s ease-in-out; }

  /* ── Portal header mobile fixes ───────────────────────── */
  .portal-header-inner { max-width: 800px; margin: 0 auto; }
  .portal-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .portal-header-info { flex: 1; min-width: 0; }
  .portal-header-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }

  /* ── Content area ─────────────────────────────────────── */
  .portal-content { max-width: 800px; margin: 0 auto; padding: 24px 16px; }

  /* ── Card grid for overview stats ────────────────────── */
  .portal-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

  /* ── Mobile ───────────────────────────────────────────── */
  @media (max-width: 640px) {
    .portal-header-inner { padding: 0; }
    .portal-tab { font-size: 12px; padding: 11px 6px; min-width: 70px; }
    .portal-content { padding: 16px 12px; }
    .portal-stats-grid { grid-template-columns: 1fr; }
    .auth-input { font-size: 16px; }
    .auth-btn { font-size: 15px; }
  }
  @media (max-width: 380px) {
    .portal-tab { font-size: 11px; padding: 10px 4px; min-width: 60px; }
  }
`;


const WHATSAPP_LINK = 'https://wa.me/213665566609';

// ── Registration Screen ────────────────────────────────────────
function RegisterScreen({ companyName, token, onSuccess, onSwitchToLogin }) {
  const [form, setForm] = useState({ username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await portalApi.post(`/portal/${token}/register`, { username: form.username.trim(), password: form.password });
      onSuccess(form.username.trim());
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #fdf4ff 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{AUTH_STYLES}</style>
      <div className="auth-card" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14, boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>◆</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Axialogy Client Portal</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>Create your account</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>Welcome, <strong>{companyName}</strong>!</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Username</label>
              <input className="auth-input" type="text" placeholder="Choose a username" value={form.username} onChange={e => set('username', e.target.value)} required autoFocus autoComplete="username" />
            </div>
            <PasswordField label="Password" placeholder="At least 6 characters" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password" />
            <PasswordField label="Confirm Password" placeholder="Repeat your password" value={form.confirm} onChange={e => set('confirm', e.target.value)} autoComplete="new-password" />
            {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>⚠️ {error}</div>}
            <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Create Account →'}</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#64748b' }}>
            Already have an account?{' '}
            <button className="auth-link" type="button" onClick={onSwitchToLogin}>Log in</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#94a3b8' }}>
            Forgot your password?{' '}
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>Contact us on WhatsApp 💬</a>
          </div>
        </Card>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#94a3b8' }}>Powered by <strong style={{ color: '#6366f1' }}>Axialogy</strong></p>
      </div>
    </div>
  );
}

// ── Login Screen ───────────────────────────────────────────────
function LoginScreen({ companyName, token, onSuccess, onSwitchToRegister }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await portalApi.post(`/portal/${token}/login`, { username: form.username.trim(), password: form.password });
      onSuccess(form.username.trim());
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #fdf4ff 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{AUTH_STYLES}</style>
      <div className="auth-card" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14, boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>◆</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Axialogy Client Portal</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>Welcome back</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>Sign in to <strong>{companyName}</strong>'s portal</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Username</label>
              <input className="auth-input" type="text" placeholder="Your username" value={form.username} onChange={e => set('username', e.target.value)} required autoFocus autoComplete="username" />
            </div>
            <PasswordField label="Password" placeholder="Your password" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="current-password" />
            {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>⚠️ {error}</div>}
            <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In →'}</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#64748b' }}>
            Don't have an account?{' '}
            <button className="auth-link" type="button" onClick={onSwitchToRegister}>Register</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#94a3b8' }}>
            Forgot your password?{' '}
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>Contact us on WhatsApp 💬</a>
          </div>
        </Card>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#94a3b8' }}>Powered by <strong style={{ color: '#6366f1' }}>Axialogy</strong></p>
      </div>
    </div>
  );
}


// ── Loading spinner ────────────────────────────────────────────
function FullScreenSpinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4ff 0%, #fdf4ff 100%)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 14, color: '#94a3b8', fontFamily: 'inherit' }}>Loading portal…</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Portal Page
// ══════════════════════════════════════════════════════════════
export default function PortalPage() {
  const { token } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user: authUser, logout: authLogout } = useAuth();

  // Unified-login check: client logged in via the main login page
  // → skip the portal's own auth screens entirely
  const isUnifiedAuth = authUser?.role === 'client' && authUser?.portal_token === token;

  // ── Lock navigation to this portal URL ───────────────────────
  // Prevents the back button from escaping the portal scope.
  useEffect(() => {
    const portalUrl = window.location.href;
    localStorage.setItem('edumanage_portal_url', portalUrl);
    // Replace history entry so "back" doesn't go to an outside page
    window.history.replaceState(null, '', portalUrl);

    const handlePopState = () => {
      const saved = localStorage.getItem('edumanage_portal_url');
      if (saved && !window.location.href.startsWith(saved)) {
        window.history.pushState(null, '', saved);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [token]);

  // ── Auth gate state ────────────────────────────────────────
  // 'loading' → check localStorage → 'register' | 'login' | 'authed'
  const [authState, setAuthState] = useState(() => {
    try {
      const saved = localStorage.getItem(`portalAuth_${token}`);
      return saved ? 'authed' : 'loading';
    } catch { return 'loading'; }
  });
  const [authInfo, setAuthInfo] = useState(null); // { has_credentials, company_name }

  useEffect(() => {
    if (authState !== 'loading') return;
    portalApi.get(`/portal/${token}/auth-check`)
      .then(r => {
        setAuthInfo(r.data);
        setAuthState(r.data.has_credentials ? 'login' : 'register');
      })
      .catch(() => setAuthState('error'));
  }, [token, authState]);

  const handleAuthSuccess = (username) => {
    try {
      localStorage.setItem(`portalAuth_${token}`, JSON.stringify({ username, at: Date.now() }));
      // Save this portal as the default so the installed PWA auto-redirects here
      const companyName = authInfo?.company_name || '';
      localStorage.setItem('edumanage_default_portal', JSON.stringify({ token, name: companyName }));
    } catch {}
    setAuthState('authed');
  };

  // ── Auth screens ───────────────────────────────────────────
  // If authenticated via unified login, go straight to portal content
  if (isUnifiedAuth) {
    const handleUnifiedLogout = () => {
      try { localStorage.removeItem(`portalAuth_${token}`); } catch {}
      authLogout();
      navigate('/login', { replace: true });
    };
    return <PortalContent token={token} qc={qc} onLogout={handleUnifiedLogout} />;
  }

  if (authState === 'loading') return <FullScreenSpinner />;

  if (authState === 'error') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: 12, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Portal not found</h1>
      <p style={{ color: '#64748b' }}>This link may be invalid or expired. Please contact your account manager.</p>
    </div>
  );

  if (authState === 'register') return (
    <RegisterScreen
      companyName={authInfo?.company_name || ''}
      token={token}
      onSuccess={handleAuthSuccess}
      onSwitchToLogin={() => setAuthState('login')}
    />
  );

  if (authState === 'login') return (
    <LoginScreen
      companyName={authInfo?.company_name || ''}
      token={token}
      onSuccess={handleAuthSuccess}
      onSwitchToRegister={() => setAuthState('register')}
    />
  );

  // ── authState === 'authed' → render full portal ────────────
  const handleLogout = () => {
    try { localStorage.removeItem(`portalAuth_${token}`); } catch {}
    authLogout();
    navigate('/login', { replace: true });
  };

  return <PortalContent token={token} qc={qc} onLogout={handleLogout} />;
}

// ── Full portal content (only rendered when authenticated) ─────
function PortalContent({ token, qc, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNote, setUploadNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [credForm, setCredForm] = useState({ current: '', newUser: '', newPass: '', confirm: '' });
  const [credErr, setCredErr] = useState('');
  const [credOk, setCredOk] = useState('');
  const [credLoading, setCredLoading] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [showMenu]);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['portal', token],
    queryFn: () => portalApi.get(`/portal/${token}`).then(r => r.data),
    retry: false,
  });

  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['portal-notifs', token],
    queryFn: () => portalApi.get(`/portal/${token}/notifications`).then(r => r.data),
    staleTime: 60_000,                  // cache notifications for 1 min
    refetchInterval: 90_000,            // slow down polling to 1.5 mins
    refetchIntervalInBackground: false, // do NOT poll when PWA/app is closed or in background
  });
  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unread || 0;

  useEffect(() => {
    const onFirstInteraction = () => {
      requestNotificationPermission();
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('touchend', onFirstInteraction);
    };
    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('touchend', onFirstInteraction);
    return () => {
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('touchend', onFirstInteraction);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'visible') refetchNotifs(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refetchNotifs]);

  const prevUnreadRef = useRef(0);
  const bellRef = useRef(null);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && unreadCount > 0) {
      playNotificationSound();
      syncBadge(unreadCount);
      const newest = notifications.find(n => !n.is_read);
      if (newest) showOsNotification(newest.title, newest.message);
      if (bellRef.current) {
        bellRef.current.classList.add('bell-shake');
        setTimeout(() => bellRef.current?.classList.remove('bell-shake'), 600);
      }
    }
    syncBadge(unreadCount);
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, notifications]);

  const markRead = useMutation({
    mutationFn: (id) => portalApi.patch(`/portal/${token}/notifications/${id}/read`),
    onSuccess: () => { refetchNotifs(); syncBadge(Math.max(0, unreadCount - 1)); },
  });
  const markAllRead = useMutation({
    mutationFn: () => portalApi.patch(`/portal/${token}/notifications/read-all`),
    onSuccess: () => { refetchNotifs(); syncBadge(0); },
  });

  const { data: quotes = [], refetch: refetchQuotes } = useQuery({
    queryKey: ['portal-quotes', token],
    queryFn: () => portalApi.get(`/portal/${token}/quotes`).then(r => r.data),
    enabled: !!profile,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: invoices = [], refetch: refetchInvoices } = useQuery({
    queryKey: ['portal-invoices', token],
    queryFn: () => portalApi.get(`/portal/${token}/invoices`).then(r => r.data),
    enabled: !!profile,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: documents = [] } = useQuery({
    queryKey: ['portal-docs', token],
    queryFn: () => portalApi.get(`/portal/${token}/documents`).then(r => r.data),
    enabled: !!profile,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Refetch docs data when switching to documents tab
  useEffect(() => {
    if (activeTab === 'documents') {
      refetchQuotes();
      refetchInvoices();
    }
  }, [activeTab]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', uploadFile);
    if (uploadNote.trim()) fd.append('note', uploadNote.trim());
    try {
      await portalApi.post(`/portal/${token}/upload`, fd);
      setUploadFile(null); setUploadNote(''); setUploadSuccess(true);
      qc.invalidateQueries(['portal-docs', token]);
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch { } finally { setUploading(false); }
  };

  if (isLoading) return <FullScreenSpinner />;

  if (isError) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Portal not found</h1>
      <p style={{ color: '#64748b' }}>This link may be invalid or expired. Please contact your account manager.</p>
    </div>
  );

  const tabs = [
    { id: 'overview',  label: '📊 Overview', short: '📊' },
    { id: 'tasks',     label: '✅ Tasks',     short: '✅' },
    { id: 'documents', label: `📄 Docs${quotes.length + invoices.length > 0 ? ` (${quotes.length + invoices.length})` : ''}`, short: '📄' },
  ];

  // Credential update
  const updateCreds = async (e) => {
    e.preventDefault(); setCredErr(''); setCredOk('');
    if (credForm.newPass && credForm.newPass !== credForm.confirm) { setCredErr('Passwords do not match'); return; }
    if (!credForm.newUser && !credForm.newPass) { setCredErr('Enter a new username or password'); return; }
    setCredLoading(true);
    try {
      await portalApi.put(`/portal/${token}/credentials`, {
        current_password: credForm.current,
        new_username: credForm.newUser || undefined,
        new_password: credForm.newPass || undefined,
      });
      setCredOk('Account updated successfully!');
      setCredForm({ current: '', newUser: '', newPass: '', confirm: '' });
    } catch (err) { setCredErr(err.response?.data?.error || 'Update failed'); }
    finally { setCredLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{AUTH_STYLES}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '20px 16px 0' }}>
        <div className="portal-header-inner">
          {/* Top row — info left, buttons right */}
          <div className="portal-header-top">
            <div className="portal-header-info">
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>◆ Axialogy Client Portal</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', wordBreak: 'break-word' }}>{profile.company_name}</h1>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#94a3b8' }}>
                {profile.contact_name  && <span>👤 {profile.contact_name}</span>}
                {profile.contact_email && <span>✉️ {profile.contact_email}</span>}
                {profile.contact_phone && <span>📞 {profile.contact_phone}</span>}
              </div>
            </div>
            {/* Action buttons */}
            <div className="portal-header-actions">
              {/* Bell — always visible */}
              <button ref={bellRef} title="Notifications"
                onClick={() => { setShowNotifs(v => !v); setShowMenu(false); if (!showNotifs && unreadCount > 0) markAllRead.mutate(); }}
                style={{ position: 'relative', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', color: 'white', fontSize: 18, lineHeight: 1, transformOrigin: 'top center' }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 3, right: 3, background: '#ef4444', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {/* Hamburger menu */}
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button onClick={() => { setShowMenu(v => !v); setShowNotifs(false); }} title="Menu"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '9px 11px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                {showMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'white', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflow: 'hidden', minWidth: 190, zIndex: 200 }}>
                    <button onClick={() => { setShowSettings(true); setShowMenu(false); }}
                      style={{ width: '100%', padding: '14px 18px', border: 'none', background: 'none', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'inherit' }}>
                      <span>⚙️</span> Account Settings
                    </button>
                    <button onClick={() => { onLogout(); setShowMenu(false); }}
                      style={{ width: '100%', padding: '14px 18px', border: 'none', background: 'none', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notification Panel */}
          {showNotifs && (
            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>🔔 Notifications</span>
                {notifications.some(n => !n.is_read) && (
                  <button onClick={() => markAllRead.mutate()} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Mark all read</button>
                )}
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {notifications.length === 0 && <div style={{ padding: '20px 16px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No notifications</div>}
                {notifications.map(n => (
                  <div key={n.id} onClick={() => !n.is_read && markRead.mutate(n.id)}
                    style={{ padding: '12px 16px', background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.12)', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: n.is_read ? 'default' : 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{NOTIF_ICON[n.type] || '🔔'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: n.is_read ? '#94a3b8' : 'white' }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('fr-DZ')}</div>
                    </div>
                    {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: 4 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ marginTop: 16 }}>
            <div className="portal-tabs">
              {tabs.map(t => (
                <button key={t.id} className="portal-tab" onClick={() => setActiveTab(t.id)}
                  style={{ fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? '#6366f1' : '#94a3b8', borderBottom: activeTab === t.id ? '2px solid #6366f1' : '2px solid transparent' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="portal-content">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Wallet Balance</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>
                {parseFloat(profile.wallet_balance || 0).toLocaleString('en-DZ')} <span style={{ fontSize: 18, opacity: 0.7 }}>DZD</span>
              </div>
            </Card>
            {/* Contact us button */}
            <a
              href="https://wa.me/213665566609"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px 20px', background: '#25D366', color: 'white', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 2px 10px rgba(37,211,102,0.3)' }}
            >
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.672 4.797 1.842 6.788L2 30l7.394-1.818A13.942 13.942 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2z" fill="white"/><path d="M23.5 19.875c-.375-.188-2.219-1.094-2.563-1.219-.343-.125-.593-.188-.843.188-.25.375-.969 1.219-1.188 1.469-.218.25-.437.281-.812.094-.375-.188-1.582-.584-3.015-1.86-1.113-.993-1.864-2.22-2.083-2.594-.218-.375-.023-.578.164-.765.169-.168.375-.437.563-.656.188-.219.25-.375.375-.625.125-.25.063-.469-.031-.656-.094-.188-.844-2.032-1.156-2.782-.305-.729-.614-.63-.844-.641l-.719-.012c-.25 0-.656.094-.999.469-.343.375-1.312 1.281-1.312 3.125 0 1.844 1.343 3.625 1.531 3.875.188.25 2.644 4.04 6.406 5.663 3.762 1.624 3.762 1.082 4.443 1.013.681-.069 2.219-.906 2.532-1.781.312-.875.312-1.625.218-1.781-.093-.156-.343-.25-.718-.438z" fill="#25D366"/></svg>
              Contact us on WhatsApp
            </a>
            <Card>
              <SectionTitle>🕐 Recent Activity</SectionTitle>
              {profile.activity?.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No activity yet.</p>}
              {profile.activity?.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < profile.activity.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#334155' }}>{a.description}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── TASKS ── */}
        {activeTab === 'tasks' && (
          <Card>
            <SectionTitle>✅ My Tasks</SectionTitle>
            {profile.tasks?.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No tasks yet.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {profile.tasks?.map(t => (
                <div key={t.id} style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{t.title}</div>
                    <StatusPill status={t.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                    {t.service_type && <span>🏷️ {t.service_type.replace(/_/g, ' ')}</span>}
                    {t.deadline && <span>📅 Due {new Date(t.deadline).toLocaleDateString()}</span>}
                    {t.progress_pct > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        📈 {t.progress_pct}%
                        <div style={{ width: 60, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${t.progress_pct}%`, height: '100%', background: '#6366f1', borderRadius: 2 }} />
                        </div>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === 'documents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card>
              <SectionTitle>📋 Quotations</SectionTitle>
              {quotes.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No quotations sent yet.</p>}
              {quotes.map(q => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{q.quote_number}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{new Date(q.created_at).toLocaleDateString()} · {parseFloat(q.grand_total).toLocaleString()} DZD</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <StatusPill status={q.status} />
                    <a href={`${BASE}/portal/${token}/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer"
                      style={{ padding: '6px 12px', borderRadius: 8, background: '#f1f5f9', color: '#1e293b', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>⬇ PDF</a>
                  </div>
                </div>
              ))}
            </Card>
            <Card>
              <SectionTitle>🧾 Invoices</SectionTitle>
              {invoices.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No invoices sent yet.</p>}
              {invoices.map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Due {new Date(inv.due_date).toLocaleDateString()} · Total {parseFloat(inv.grand_total).toLocaleString()} DZD
                      {parseFloat(inv.amount_paid) > 0 && <span style={{ color: '#10b981' }}> · Paid {parseFloat(inv.amount_paid).toLocaleString()} DZD</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <StatusPill status={inv.status} />
                    <a href={`${BASE}/portal/${token}/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer"
                      style={{ padding: '6px 12px', borderRadius: 8, background: '#f1f5f9', color: '#1e293b', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>⬇ PDF</a>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}


      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 16px', color: '#94a3b8', fontSize: 12 }}>
        Powered by <strong style={{ color: '#6366f1' }}>Axialogy</strong>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter',sans-serif" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowSettings(false); setCredErr(''); setCredOk(''); } }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>⚙️ Account Settings</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Change your username or password</div>
              </div>
              <button onClick={() => { setShowSettings(false); setCredErr(''); setCredOk(''); }}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            <form onSubmit={updateCreds} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Current Password *</label>
                <div style={{ position: 'relative' }}>
                  <input className="auth-input" type="password" value={credForm.current}
                    onChange={e => setCredForm(f => ({ ...f, current: e.target.value }))} required placeholder="Your current password" />
                </div>
              </div>
              <div style={{ height: 1, background: '#f1f5f9' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Optional — leave blank to keep current</div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>New Username</label>
                <input className="auth-input" type="text" placeholder="Leave blank to keep current"
                  value={credForm.newUser} onChange={e => setCredForm(f => ({ ...f, newUser: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>New Password</label>
                <input className="auth-input" type="password" placeholder="Leave blank to keep current"
                  value={credForm.newPass} onChange={e => setCredForm(f => ({ ...f, newPass: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Confirm New Password</label>
                <input className="auth-input" type="password"
                  value={credForm.confirm} onChange={e => setCredForm(f => ({ ...f, confirm: e.target.value }))} />
              </div>
              {credErr && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>⚠️ {credErr}</div>}
              {credOk  && <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#16a34a', fontSize: 13 }}>✅ {credOk}</div>}
              <button className="auth-btn" type="submit" disabled={credLoading || !credForm.current}>
                {credLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

