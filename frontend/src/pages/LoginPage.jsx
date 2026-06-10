import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFAULT_PATH } from '../config/roleNav';
import toast from 'react-hot-toast';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  @keyframes login-float-in {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1);    }
  }
  @keyframes login-orb-pulse {
    0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.6; }
    50%       { transform: scale(1.12) translate(-12px, -8px); opacity: 0.9; }
  }
  @keyframes login-orb-pulse2 {
    0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.5; }
    50%       { transform: scale(1.08) translate(8px, 12px); opacity: 0.8; }
  }
  @keyframes login-spin { to { transform: rotate(360deg); } }

  .login-page-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 16px;
    background: #0a0d14;
  }

  /* animated background orbs */
  .login-orb-1 {
    position: fixed; top: -15%; left: -10%;
    width: 55vmax; height: 55vmax; border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%);
    pointer-events: none;
    animation: login-orb-pulse 9s ease-in-out infinite;
  }
  .login-orb-2 {
    position: fixed; bottom: -20%; right: -10%;
    width: 50vmax; height: 50vmax; border-radius: 50%;
    background: radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 70%);
    pointer-events: none;
    animation: login-orb-pulse2 11s ease-in-out infinite;
  }
  .login-orb-3 {
    position: fixed; top: 40%; left: 40%;
    width: 30vmax; height: 30vmax; border-radius: 50%;
    background: radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%);
    pointer-events: none;
    animation: login-orb-pulse 14s ease-in-out infinite reverse;
  }

  /* card */
  .login-card {
    position: relative;
    width: 100%;
    max-width: 440px;
    animation: login-float-in 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
    background: rgba(17, 24, 39, 0.82);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 44px 40px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow:
      0 4px 40px rgba(0,0,0,0.5),
      0 0 0 1px rgba(255,255,255,0.05) inset,
      0 1px 0 rgba(255,255,255,0.1) inset;
  }

  /* logo badge */
  .login-logo-wrap {
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 32px;
    flex-direction: column;
    gap: 14px;
  }
  .login-logo-img {
    width: 64px; height: 64px;
    border-radius: 18px;
    box-shadow: 0 0 0 3px rgba(249,115,22,0.3), 0 8px 32px rgba(249,115,22,0.2);
    display: block;
  }
  .login-brand-text-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .login-brand-name {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.4px;
    color: #f1f5f9;
    text-align: center;
  }
  .login-brand-tagline {
    font-size: 13px;
    color: rgba(148,163,184,0.8);
    font-weight: 500;
    text-align: center;
    margin-top: -6px;
  }

  /* headings */
  .login-title {
    font-size: 26px;
    font-weight: 800;
    color: #f1f5f9;
    letter-spacing: -0.5px;
    margin-bottom: 6px;
    line-height: 1.2;
  }
  .login-subtitle {
    font-size: 14px;
    color: #64748b;
    margin-bottom: 32px;
    font-weight: 400;
  }

  /* divider */
  .login-divider {
    height: 1px;
    background: rgba(255,255,255,0.07);
    margin: 0 0 28px;
  }

  /* form */
  .login-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .login-input-wrap {
    position: relative;
    margin-bottom: 18px;
  }
  .login-input {
    width: 100%;
    padding: 14px 16px;
    font-size: 15px;
    font-family: inherit;
    font-weight: 500;
    color: #f1f5f9;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.09);
    border-radius: 12px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-sizing: border-box;
    -webkit-appearance: none;
  }
  .login-input::placeholder { color: #475569; }
  .login-input:focus {
    border-color: rgba(249,115,22,0.7);
    background: rgba(249,115,22,0.05);
    box-shadow: 0 0 0 3px rgba(249,115,22,0.15);
  }
  .login-input-pw { padding-right: 48px; }

  /* eye toggle */
  .login-eye-btn {
    position: absolute; right: 14px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: #475569; display: flex; align-items: center;
    padding: 2px; transition: color 0.15s;
  }
  .login-eye-btn:hover { color: #94a3b8; }

  /* forgot */
  .login-forgot-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
    margin-top: -8px;
  }
  .login-forgot-btn {
    background: none; border: none;
    color: #f97316; font-size: 12px;
    font-weight: 600; cursor: pointer;
    font-family: inherit; padding: 0;
    transition: opacity 0.15s;
  }
  .login-forgot-btn:hover { opacity: 0.75; }

  /* submit button */
  .login-submit-btn {
    width: 100%;
    padding: 15px;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
    box-shadow: 0 4px 20px rgba(249,115,22,0.35);
    letter-spacing: 0.02em;
  }
  .login-submit-btn:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(249,115,22,0.45);
  }
  .login-submit-btn:active:not(:disabled) { transform: translateY(0); }
  .login-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* spinner inside button */
  .login-btn-spinner {
    width: 17px; height: 17px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: white;
    border-radius: 50%;
    animation: login-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  /* footer note */
  .login-footer {
    text-align: center;
    margin-top: 28px;
    font-size: 12px;
    color: #334155;
    line-height: 1.6;
  }
  .login-footer strong { color: #475569; font-weight: 600; }

  /* all roles hint pills */
  .login-roles-row {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 20px;
    margin-bottom: 4px;
  }
  .login-role-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    border: 1px solid;
  }

  /* mobile tweaks */
  @media (max-width: 480px) {
    .login-card {
      padding: 32px 22px;
      border-radius: 20px;
      background: rgba(15, 20, 35, 0.92);
    }
    .login-title { font-size: 22px; }
    .login-logo-img { width: 56px; height: 56px; }
    .login-brand-name { font-size: 20px; }
    .login-input { padding: 13px 14px; font-size: 16px; }
    .login-input-pw { padding-right: 44px; }
    .login-submit-btn { padding: 14px; font-size: 15px; }
  }
`;

function EyeIcon({ open }) {
  return open
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(username, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}! 👋`);
      if (user.role === 'client')        navigate(`/portal/${user.portal_token}`);
      else if (user.role === 'supplier') navigate(`/supplier-portal/${user.portal_token}`);
      else                               navigate(ROLE_DEFAULT_PATH[user.role] || '/tasks');
    } catch (err) {
      const errMsg = err.response?.data?.error;
      toast.error(typeof errMsg === 'string' ? errMsg : 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-root">
      <style>{STYLES}</style>

      {/* Animated background orbs */}
      <div className="login-orb-1" />
      <div className="login-orb-2" />
      <div className="login-orb-3" />

      <div className="login-card">
        {/* Logo + brand */}
        <div className="login-logo-wrap">
          <img src="/icons/logo-192.png" alt="Axialogy" className="login-logo-img" />
          <div className="login-brand-text-wrap">
            <div className="login-brand-name">Axialogy</div>
            <div className="login-brand-tagline">Business Management Platform</div>
          </div>
        </div>

        <div className="login-divider" />

        {/* Headings */}
        <div className="login-title">Sign in</div>
        <div className="login-subtitle">Enter your username and password to continue</div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div>
            <label className="login-label" htmlFor="login-username">Username or Email</label>
            <div className="login-input-wrap">
              <input
                id="login-username"
                type="text"
                className="login-input"
                placeholder="e.g. youcef or your@email.com"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
              />
            </div>
          </div>

          <div>
            <label className="login-label" htmlFor="login-password">Password</label>
            <div className="login-forgot-row">
              <button
                type="button"
                className="login-forgot-btn"
                onClick={() => toast(
                  <span>
                    Please Contact Us on{' '}
                    <a
                      href="https://wa.me/213665566609"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#25D366', fontWeight: 'bold', textDecoration: 'underline' }}
                    >
                      WhatsApp
                    </a>{' '}
                    to reset your password.
                  </span>,
                  { icon: 'ℹ️', duration: 8000 }
                )}
              >
                Forgot password?
              </button>
            </div>
            <div className="login-input-wrap">
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className="login-input login-input-pw"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          <button id="login-btn" type="submit" className="login-submit-btn" disabled={loading}>
            {loading
              ? <><div className="login-btn-spinner" /> Signing in…</>
              : <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  Sign In
                </>}
          </button>
        </form>


      </div>
    </div>
  );
}
