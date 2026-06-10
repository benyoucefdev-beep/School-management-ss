import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';
const sApi = axios.create({ baseURL: BASE });

const NOTIF_ICON = { payment_received: '✅', debt_logged: '⏳', transaction_recorded: '📋' };
const _audio = typeof window !== 'undefined'
  ? new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') : null;
function playNotifSound() { if (_audio) _audio.play().catch(() => {}); }
function syncBadge(n) {
  try { if ('setAppBadge' in navigator) { n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } } catch (_) {}
}

const TX_STATUS_COLOR = {
  paid: '#10b981', pending: '#f59e0b', partial: '#f97316',
  overdue: '#ef4444', cancelled: '#94a3b8',
};
function StatusPill({ status }) {
  const color = TX_STATUS_COLOR[status] || '#94a3b8';
  return (
    <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:999, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', background:color+'22', color }}>
      {status?.replace(/_/g,' ') || '—'}
    </span>
  );
}
function Card({ children, style }) {
  return <div style={{ background:'white', borderRadius:16, padding:24, boxShadow:'0 1px 3px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.06)', ...style }}>{children}</div>;
}
const fmtDZD = (n) => parseFloat(n || 0).toLocaleString('fr-DZ', { minimumFractionDigits:2, maximumFractionDigits:2 });

// Eye toggle
function EyeIcon({ open }) {
  return open
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}
function PasswordField({ label, placeholder, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>{label}</label>
      <div style={{ position:'relative' }}>
        <input className="sp-input" type={show ? 'text' : 'password'} placeholder={placeholder}
          value={value} onChange={onChange} required autoComplete={autoComplete}
          style={{ paddingRight:44 }} />
        <button type="button" onClick={() => setShow(v => !v)}
          style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', display:'flex', alignItems:'center', padding:2 }}>
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

const WHATSAPP_LINK = 'https://wa.me/213665566609';

const AUTH_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes bellShake {
    0%,100%{ transform:rotate(0); } 15%{ transform:rotate(18deg); }
    30%{ transform:rotate(-16deg); } 45%{ transform:rotate(12deg); }
    60%{ transform:rotate(-8deg); } 75%{ transform:rotate(4deg); }
  }
  .sp-fadeup { animation: fadeUp 0.4s ease; }
  .sp-bell-shake { animation: bellShake 0.6s ease-in-out; }
  .sp-input { width:100%; padding:12px 16px; border-radius:12px; border:1.5px solid #e2e8f0; font-size:15px; font-family:inherit; outline:none; transition:border .2s,box-shadow .2s; box-sizing:border-box; }
  .sp-input:focus { border-color:#ea580c; box-shadow:0 0 0 3px rgba(234,88,12,.12); }
  .sp-btn { width:100%; padding:14px; border-radius:12px; border:none; background:linear-gradient(135deg,#f97316,#ea580c); color:white; font-size:16px; font-weight:700; cursor:pointer; transition:opacity .2s,transform .1s; font-family:inherit; }
  .sp-btn:hover:not(:disabled){ opacity:.92; transform:translateY(-1px); }
  .sp-btn:disabled{ opacity:.55; cursor:not-allowed; transform:none; }
  .sp-link { background:none; border:none; color:#ea580c; font-weight:600; cursor:pointer; font-size:14px; text-decoration:underline; }

  /* ── Tabs ─────────────────────────────────────────────── */
  .portal-tabs { display:flex; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
  .portal-tabs::-webkit-scrollbar { display:none; }
  .portal-tab { flex:1; min-width:80px; padding:13px 8px; border:none; background:none; cursor:pointer; font-size:13px; font-weight:500; white-space:nowrap; transition:all .15s; border-bottom:2px solid transparent; font-family:inherit; }

  /* ── Header helper classes ────────────────────────────── */
  .sp-header-inner { max-width:800px; margin:0 auto; }
  .sp-header-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .sp-header-info { flex:1; min-width:0; }
  .sp-header-actions { display:flex; gap:6px; flex-shrink:0; align-items:center; }
  .sp-content { max-width:800px; margin:0 auto; padding:24px 16px; }

  /* ── Mobile ───────────────────────────────────────────── */
  @media (max-width: 640px) {
    .portal-tab { font-size:12px; padding:11px 6px; min-width:70px; }
    .sp-content { padding:16px 12px; }
    .sp-input { font-size:16px; }
    .sp-btn  { font-size:15px; }
  }
  @media (max-width: 380px) {
    .portal-tab { font-size:11px; padding:10px 4px; min-width:60px; }
  }
`;


function FullScreenSpinner() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#fff7ed,#fef3c7)', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{AUTH_STYLES}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, border:'4px solid #fed7aa', borderTopColor:'#f97316', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
        <div style={{ fontSize:14, color:'#9a3412' }}>Loading portal…</div>
      </div>
    </div>
  );
}

function RegisterScreen({ supplierName, token, onSuccess, onSwitchToLogin }) {
  const [form, setForm] = useState({ username:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await sApi.post(`/supplier-portal/${token}/register`, { username: form.username.trim(), password: form.password });
      onSuccess(form.username.trim());
    } catch (err) { setError(err.response?.data?.error || 'Registration failed.'); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#fff7ed,#fef3c7)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{AUTH_STYLES}</style>
      <div className="sp-fadeup" style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,#f97316,#ea580c)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:14, boxShadow:'0 8px 24px rgba(249,115,22,.35)' }}>🏭</div>
          <div style={{ fontSize:13, fontWeight:700, color:'#f97316', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Axialogy · Teacher Portal</div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#1e293b', margin:0 }}>Create your account</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:6 }}>Welcome, <strong>{supplierName}</strong>!</p>
        </div>
        <Card>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>Username</label>
              <input className="sp-input" type="text" placeholder="Choose a username" value={form.username} onChange={e => set('username', e.target.value)} required autoComplete="username" />
            </div>
            <PasswordField label="Password" placeholder="At least 6 characters" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password" />
            <PasswordField label="Confirm Password" placeholder="Repeat your password" value={form.confirm} onChange={e => set('confirm', e.target.value)} autoComplete="new-password" />
            {error && <div style={{ padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, color:'#dc2626', fontSize:13 }}>⚠️ {error}</div>}
            <button className="sp-btn" type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Account →'}</button>
          </form>
          <div style={{ textAlign:'center', marginTop:16, fontSize:14, color:'#64748b' }}>
            Already have an account? <button className="sp-link" onClick={onSwitchToLogin}>Log in</button>
          </div>
          <div style={{ textAlign:'center', marginTop:12, fontSize:13, color:'#94a3b8' }}>
            Forgot your password?{' '}
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" style={{ color:'#25D366', fontWeight:600, textDecoration:'none' }}>Contact us on WhatsApp 💬</a>
          </div>
        </Card>
        <p style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#9a3412' }}>Powered by <strong style={{ color:'#f97316' }}>Axialogy</strong></p>
      </div>
    </div>
  );
}

function LoginScreen({ supplierName, token, onSuccess, onSwitchToRegister }) {
  const [form, setForm] = useState({ username:'', password:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await sApi.post(`/supplier-portal/${token}/login`, { username: form.username.trim(), password: form.password });
      onSuccess(form.username.trim());
    } catch (err) { setError(err.response?.data?.error || 'Login failed.'); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#fff7ed,#fef3c7)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{AUTH_STYLES}</style>
      <div className="sp-fadeup" style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,#f97316,#ea580c)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:14, boxShadow:'0 8px 24px rgba(249,115,22,.35)' }}>🏭</div>
          <div style={{ fontSize:13, fontWeight:700, color:'#f97316', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Axialogy · Teacher Portal</div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#1e293b', margin:0 }}>Welcome back</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:6 }}>Sign in to <strong>{supplierName}</strong>'s portal</p>
        </div>
        <Card>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>Username</label>
              <input className="sp-input" type="text" placeholder="Your username" value={form.username} onChange={e => set('username', e.target.value)} required autoComplete="username" />
            </div>
            <PasswordField label="Password" placeholder="Your password" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="current-password" />
            {error && <div style={{ padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, color:'#dc2626', fontSize:13 }}>⚠️ {error}</div>}
            <button className="sp-btn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In →'}</button>
          </form>
          <div style={{ textAlign:'center', marginTop:16, fontSize:14, color:'#64748b' }}>
            Don't have an account? <button className="sp-link" onClick={onSwitchToRegister}>Register</button>
          </div>
          <div style={{ textAlign:'center', marginTop:12, fontSize:13, color:'#94a3b8' }}>
            Forgot your password?{' '}
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" style={{ color:'#25D366', fontWeight:600, textDecoration:'none' }}>Contact us on WhatsApp 💬</a>
          </div>
        </Card>
        <p style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#9a3412' }}>Powered by <strong style={{ color:'#f97316' }}>Axialogy</strong></p>
      </div>
    </div>
  );
}

export default function SupplierPortalPage() {
  const { token } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user: authUser, logout: authLogout } = useAuth();

  // Unified-login check: supplier logged in via the main login page
  const isUnifiedAuth = authUser?.role === 'supplier' && authUser?.portal_token === token;

  // ── Lock navigation to this teacher portal URL ────────────────
  // Prevents the back button from escaping the portal scope.
  useEffect(() => {
    const portalUrl = window.location.href;
    localStorage.setItem('edumanage_teacher_portal_url', portalUrl);
    window.history.replaceState(null, '', portalUrl);

    const handlePopState = () => {
      const saved = localStorage.getItem('edumanage_teacher_portal_url');
      if (saved && !window.location.href.startsWith(saved)) {
        window.history.pushState(null, '', saved);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [token]);

  const [authState, setAuthState] = useState(() => {
    try { return localStorage.getItem(`spAuth_${token}`) ? 'authed' : 'loading'; } catch { return 'loading'; }
  });
  const [authInfo, setAuthInfo] = useState(null);

  useEffect(() => {
    if (authState !== 'loading') return;
    sApi.get(`/supplier-portal/${token}/auth-check`)
      .then(r => { setAuthInfo(r.data); setAuthState(r.data.has_credentials ? 'login' : 'register'); })
      .catch(() => setAuthState('error'));
  }, [token, authState]);

  const handleAuthSuccess = (username) => {
    try {
      localStorage.setItem(`spAuth_${token}`, JSON.stringify({ username, at: Date.now() }));
      const supplierName = authInfo?.supplier_name || '';
      localStorage.setItem('edumanage_default_teacher_portal', JSON.stringify({ token, name: supplierName }));
    } catch {}
    setAuthState('authed');
  };

  const handleLogout = () => {
    try { localStorage.removeItem(`spAuth_${token}`); } catch {}
    authLogout();
    navigate('/login', { replace: true });
  };

  // If authenticated via unified login, go straight to dashboard
  if (isUnifiedAuth) {
    return <SupplierPortalDashboard token={token} qc={qc} onLogout={handleLogout} />;
  }

  if (authState === 'loading') return <FullScreenSpinner />;
  if (authState === 'error') return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#fff7ed', gap:12, fontFamily:"'Inter',sans-serif" }}>
      <div style={{ fontSize:48 }}>🔒</div>
      <h1 style={{ fontSize:22, fontWeight:700, color:'#1e293b', margin:0 }}>Portal not found</h1>
      <p style={{ color:'#64748b', margin:0 }}>This link may be invalid or expired.</p>
    </div>
  );
  if (authState === 'register') return <RegisterScreen supplierName={authInfo?.supplier_name||''} token={token} onSuccess={handleAuthSuccess} onSwitchToLogin={() => setAuthState('login')} />;
  if (authState === 'login')    return <LoginScreen    supplierName={authInfo?.supplier_name||''} token={token} onSuccess={handleAuthSuccess} onSwitchToRegister={() => setAuthState('register')} />;
  return <SupplierPortalDashboard token={token} qc={qc} onLogout={handleLogout} />;
}

function SupplierPortalDashboard({ token, qc, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const bellRef = useRef(null);
  const menuRef = useRef(null);
  const prevUnreadRef = useRef(0);
  const [credForm, setCredForm] = useState({ current:'', newUser:'', newPass:'', confirm:'' });
  const [credErr, setCredErr]   = useState('');
  const [credOk, setCredOk]     = useState('');
  const [credLoading, setCredLoading] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [showMenu]);

  const { data: portal, isLoading, isError, error: portalError } = useQuery({
    queryKey: ['sp-portal', token],
    queryFn: () => sApi.get(`/supplier-portal/${token}`).then(r => r.data),
    retry: 1,
    staleTime: 60_000,
    refetchInterval: 120_000,           // check details every 2 mins
    refetchIntervalInBackground: false, // do NOT poll in background
  });

  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['sp-notifs', token],
    queryFn: () => sApi.get(`/supplier-portal/${token}/notifications`).then(r => r.data),
    staleTime: 60_000,
    refetchInterval: 90_000,            // check notifications every 1.5 mins
    refetchIntervalInBackground: false, // do NOT poll in background
  });



  const notifications = notifData?.notifications || [];
  const unreadCount   = notifData?.unread || 0;

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && unreadCount > 0) {
      playNotifSound(); syncBadge(unreadCount);
      if (bellRef.current) {
        bellRef.current.classList.add('sp-bell-shake');
        setTimeout(() => bellRef.current?.classList.remove('sp-bell-shake'), 700);
      }
    }
    syncBadge(unreadCount);
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    const fn = () => { if (document.visibilityState === 'visible') refetchNotifs(); };
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  }, [refetchNotifs]);

  const markRead = useMutation({
    mutationFn: (id) => sApi.patch(`/supplier-portal/${token}/notifications/${id}/read`),
    onSuccess: () => refetchNotifs(),
  });
  const markAllRead = useMutation({
    mutationFn: () => sApi.patch(`/supplier-portal/${token}/notifications/read-all`),
    onSuccess: () => { refetchNotifs(); syncBadge(0); },
  });

  const updateCreds = async (e) => {
    e.preventDefault(); setCredErr(''); setCredOk('');
    if (credForm.newPass && credForm.newPass !== credForm.confirm) { setCredErr('Passwords do not match'); return; }
    if (!credForm.newUser && !credForm.newPass) { setCredErr('Enter a new username or password'); return; }
    setCredLoading(true);
    try {
      const r = await sApi.put(`/supplier-portal/${token}/credentials`, {
        current_password: credForm.current,
        new_username: credForm.newUser || undefined,
        new_password: credForm.newPass || undefined,
      });
      if (credForm.newUser) try { localStorage.setItem(`spAuth_${token}`, JSON.stringify({ username: r.data.username, at: Date.now() })); } catch {}
      setCredOk('Account updated!');
      setCredForm({ current:'', newUser:'', newPass:'', confirm:'' });
    } catch (err) { setCredErr(err.response?.data?.error || 'Update failed'); }
    finally { setCredLoading(false); }
  };

  if (isLoading) return <FullScreenSpinner />;
  if (isError) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#fff7ed', gap:12, fontFamily:"'Inter',sans-serif", padding:24 }}>
      <style>{AUTH_STYLES}</style>
      <div style={{ fontSize:48 }}>⚠️</div>
      <h1 style={{ fontSize:20, fontWeight:700, color:'#1e293b', margin:0 }}>Could not load portal</h1>
      <p style={{ color:'#64748b', margin:0, fontSize:13, textAlign:'center', maxWidth:320 }}>{portalError?.response?.data?.error || portalError?.message}</p>
      <button onClick={() => qc.invalidateQueries(['sp-portal', token])} className="sp-btn" style={{ maxWidth:200, marginTop:8 }}>Retry</button>
    </div>
  );

  const { summary = {}, transactions = [] } = portal;
  const paid   = transactions.filter(t => t.status === 'paid');
  const unpaid = transactions.filter(t => t.status !== 'paid' && t.status !== 'cancelled');

  const tabs = [
    { id:'overview',  label:'📊 Overview' },
    { id:'payments',  label:`✅ Paid${paid.length > 0 ? ` (${paid.length})` : ''}` },
    { id:'pending',   label:`⏳ Pending${unpaid.length > 0 ? ` (${unpaid.length})` : ''}` },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{AUTH_STYLES}</style>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#431407 0%,#7c2d12 100%)', color:'white' }}>
        <div style={{ maxWidth:860, margin:'0 auto', padding:'20px 16px 0' }}>
          {/* Top row */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fb923c', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:4 }}>🏭 Axialogy · Teacher Portal</div>
              <h1 style={{ fontSize:20, fontWeight:800, margin:'0 0 4px', wordBreak:'break-word' }}>{portal.name}</h1>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:12, color:'#fed7aa' }}>
                {portal.contact_name  && <span>👤 {portal.contact_name}</span>}
                {portal.contact_email && <span>✉️ {portal.contact_email}</span>}
              </div>
            </div>
            {/* Action buttons — bell + hamburger */}
            <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
              {/* Bell — always visible */}
              <button ref={bellRef} title="Notifications"
                onClick={() => { setShowNotifs(v => !v); setShowMenu(false); if (!showNotifs && unreadCount > 0) markAllRead.mutate(); }}
                style={{ position:'relative', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', borderRadius:10, padding:'9px 12px', cursor:'pointer', color:'white', fontSize:18, lineHeight:1, transformOrigin:'top center' }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{ position:'absolute', top:3, right:3, background:'#ef4444', color:'white', borderRadius:'50%', width:16, height:16, fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {/* Hamburger menu */}
              <div ref={menuRef} style={{ position:'relative' }}>
                <button onClick={() => { setShowMenu(v => !v); setShowNotifs(false); }} title="Menu"
                  style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', borderRadius:10, padding:'9px 11px', cursor:'pointer', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                {showMenu && (
                  <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'white', borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,0.2)', overflow:'hidden', minWidth:190, zIndex:200 }}>
                    <button onClick={() => { setShowSettings(true); setShowMenu(false); }}
                      style={{ width:'100%', padding:'14px 18px', border:'none', background:'none', textAlign:'left', fontSize:14, fontWeight:600, color:'#1e293b', cursor:'pointer', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #f1f5f9', fontFamily:'inherit' }}>
                      <span>⚙️</span> Account Settings
                    </button>
                    <button onClick={() => { onLogout(); setShowMenu(false); }}
                      style={{ width:'100%', padding:'14px 18px', border:'none', background:'none', textAlign:'left', fontSize:14, fontWeight:600, color:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontFamily:'inherit' }}>
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
            <div style={{ marginTop:14, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
                <span style={{ fontWeight:700, fontSize:13 }}>🔔 Notifications</span>
                {notifications.some(n => !n.is_read) && (
                  <button onClick={() => markAllRead.mutate()} style={{ background:'none', border:'none', color:'#fb923c', fontSize:12, cursor:'pointer', fontWeight:600 }}>Mark all read</button>
                )}
              </div>
              <div style={{ maxHeight:300, overflowY:'auto' }}>
                {notifications.length === 0 && <div style={{ padding:'18px 14px', color:'#94a3b8', fontSize:13, textAlign:'center' }}>No notifications yet</div>}
                {notifications.map(n => (
                  <div key={n.id} onClick={() => !n.is_read && markRead.mutate(n.id)}
                    style={{ padding:'10px 14px', background: n.is_read ? 'transparent' : 'rgba(249,115,22,.12)', borderBottom:'1px solid rgba(255,255,255,.06)', cursor: n.is_read ? 'default' : 'pointer', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{NOTIF_ICON[n.type] || '🔔'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:12, color: n.is_read ? '#94a3b8' : 'white' }}>{n.title}</div>
                      <div style={{ fontSize:12, color:'#fed7aa', marginTop:1 }}>{n.message}</div>
                      <div style={{ fontSize:10, color:'#92400e', marginTop:3 }}>{new Date(n.created_at).toLocaleString('fr-DZ')}</div>
                    </div>
                    {!n.is_read && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fb923c', flexShrink:0, marginTop:3 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ marginTop:16 }}>
            <div className="portal-tabs">
              {tabs.map(t => (
                <button key={t.id} className="portal-tab" onClick={() => setTab(t.id)}
                  style={{ fontWeight: tab===t.id ? 700 : 500, color: tab===t.id ? '#fb923c' : '#fed7aa', borderBottom: tab===t.id ? '2px solid #fb923c' : '2px solid transparent' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:20 }}>

        {tab === 'overview' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                { label:'Total Invoiced', value:`${fmtDZD(summary.total_owed)} DZD`, color:'#f97316', icon:'📋' },
                { label:'Total Paid',     value:`${fmtDZD(summary.total_paid)} DZD`, color:'#10b981', icon:'✅' },
                { label:'Balance Due',    value:`${fmtDZD(summary.balance_pending)} DZD`,
                  color: parseFloat(summary.balance_pending||0) > 0 ? '#ef4444' : '#10b981', icon:'⚖️' },
              ].map(c => (
                <Card key={c.label} style={{ textAlign:'center', padding:'14px 10px' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{c.label}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:c.color, wordBreak:'break-word' }}>{c.value}</div>
                </Card>
              ))}
            </div>
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'13px 20px', background:'#25D366', color:'white', borderRadius:12, fontWeight:700, fontSize:14, textDecoration:'none', boxShadow:'0 2px 10px rgba(37,211,102,.3)' }}>
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.672 4.797 1.842 6.788L2 30l7.394-1.818A13.942 13.942 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2z" fill="white"/><path d="M23.5 19.875c-.375-.188-2.219-1.094-2.563-1.219-.343-.125-.593-.188-.843.188-.25.375-.969 1.219-1.188 1.469-.218.25-.437.281-.812.094-.375-.188-1.582-.584-3.015-1.86-1.113-.993-1.864-2.22-2.083-2.594-.218-.375-.023-.578.164-.765.169-.168.375-.437.563-.656.188-.219.25-.375.375-.625.125-.25.063-.469-.031-.656-.094-.188-.844-2.032-1.156-2.782-.305-.729-.614-.63-.844-.641l-.719-.012c-.25 0-.656.094-.999.469-.343.375-1.312 1.281-1.312 3.125 0 1.844 1.343 3.625 1.531 3.875.188.25 2.644 4.04 6.406 5.663 3.762 1.624 3.762 1.082 4.443 1.013.681-.069 2.219-.906 2.532-1.781.312-.875.312-1.625.218-1.781-.093-.156-.343-.25-.718-.438z" fill="#25D366"/></svg>
              Contact us on WhatsApp
            </a>
            <Card>
              <h2 style={{ fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:14 }}>🕐 Recent Transactions</h2>
              {transactions.length === 0
                ? <p style={{ color:'#94a3b8', textAlign:'center', padding:20, fontSize:13 }}>No transactions yet.</p>
                : <TxList txs={transactions.slice(0,5)} />}
            </Card>
          </>
        )}

        {tab === 'payments' && (
          <Card>
            <h2 style={{ fontSize:15, fontWeight:700, color:'#10b981', marginBottom:14 }}>✅ Paid Transactions ({paid.length})</h2>
            {paid.length === 0
              ? <p style={{ color:'#94a3b8', textAlign:'center', padding:20, fontSize:13 }}>No paid transactions yet.</p>
              : <TxList txs={paid} />}
          </Card>
        )}

        {tab === 'pending' && (
          <Card>
            <h2 style={{ fontSize:15, fontWeight:700, color:'#f97316', marginBottom:14 }}>⏳ Pending / Unpaid ({unpaid.length})</h2>
            {unpaid.length === 0
              ? <p style={{ color:'#94a3b8', textAlign:'center', padding:20, fontSize:13 }}>No pending transactions 🎉</p>
              : <TxList txs={unpaid} showBalance />}
          </Card>
        )}


      </div>

      <div style={{ textAlign:'center', padding:'16px', color:'#94a3b8', fontSize:12 }}>
        Powered by <strong style={{ color:'#f97316' }}>Axialogy</strong>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Inter',sans-serif" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowSettings(false); setCredErr(''); setCredOk(''); } }}>
          <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:420, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:15, color:'#1e293b' }}>⚙️ Account Settings</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Update your username or password</div>
              </div>
              <button onClick={() => { setShowSettings(false); setCredErr(''); setCredOk(''); }}
                style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#94a3b8' }}>✕</button>
            </div>
            <form onSubmit={updateCreds} style={{ padding:22, display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Current Password *</label>
                <input className="sp-input" type="password" value={credForm.current} onChange={e => setCredForm(f => ({...f, current:e.target.value}))} required />
              </div>
              <div style={{ height:1, background:'#f1f5f9' }} />
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Optional changes</div>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>New Username</label>
                <input className="sp-input" type="text" placeholder="Leave blank to keep current" value={credForm.newUser} onChange={e => setCredForm(f => ({...f, newUser:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>New Password</label>
                <input className="sp-input" type="password" placeholder="Leave blank to keep current" value={credForm.newPass} onChange={e => setCredForm(f => ({...f, newPass:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Confirm New Password</label>
                <input className="sp-input" type="password" value={credForm.confirm} onChange={e => setCredForm(f => ({...f, confirm:e.target.value}))} />
              </div>
              {credErr && <div style={{ padding:'8px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', fontSize:13 }}>⚠️ {credErr}</div>}
              {credOk  && <div style={{ padding:'8px 12px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, color:'#16a34a', fontSize:13 }}>✅ {credOk}</div>}
              <button className="sp-btn" type="submit" disabled={credLoading || !credForm.current}>{credLoading ? 'Saving…' : 'Save Changes'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TxList({ txs, showBalance }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {txs.map(tx => (
        <div key={tx.id} style={{ padding:'12px 14px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0', borderLeft:`4px solid ${TX_STATUS_COLOR[tx.status]||'#94a3b8'}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:15, color:'#1e293b' }}>{fmtDZD(tx.total_amount)} DZD</div>
              <div style={{ display:'flex', gap:10, marginTop:4, fontSize:12, color:'#64748b', flexWrap:'wrap' }}>
                {tx.quantity       && <span>📦 Qty: {tx.quantity}</span>}
                {tx.payment_method && <span>💳 {tx.payment_method.replace(/_/g,' ')}</span>}
                {tx.due_date       && <span>📅 {new Date(tx.due_date).toLocaleDateString('fr-DZ')}</span>}
                {tx.notes          && <span>📝 {tx.notes}</span>}
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{new Date(tx.created_at).toLocaleDateString('fr-DZ')}</div>
            </div>
            <StatusPill status={tx.status} />
          </div>
          {showBalance && tx.balance_remaining > 0 && (
            <div style={{ marginTop:8, padding:'5px 10px', background:'rgba(239,68,68,.08)', borderRadius:8, fontSize:12, color:'#b91c1c', fontWeight:600 }}>
              ⚖️ Remaining: {fmtDZD(tx.balance_remaining)} DZD
            </div>
          )}
          {tx.paid_amount > 0 && tx.status !== 'paid' && (
            <div style={{ marginTop:5, padding:'5px 10px', background:'rgba(16,185,129,.08)', borderRadius:8, fontSize:12, color:'#065f46', fontWeight:600 }}>
              ✅ Paid: {fmtDZD(tx.paid_amount)} DZD
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

