// frontend/src/pages/GatewayPage.jsx
// Public gateway — shown at / when no team auth is present.
// Clients and suppliers who installed the PWA land here and are
// auto-redirected to their saved portal. New visitors pick their path.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .gw-root {
    min-height: 100vh;
    background: #0a0a10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 24px 16px;
    position: relative;
    overflow: hidden;
  }

  /* Ambient background orbs */
  .gw-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    opacity: 0.35;
  }
  .gw-orb-1 { width: 420px; height: 420px; background: #6366f1; top: -120px; left: -100px; }
  .gw-orb-2 { width: 320px; height: 320px; background: #10b981; bottom: -80px; right: -80px; }
  .gw-orb-3 { width: 200px; height: 200px; background: #f97316; top: 50%; left: 50%; transform: translate(-50%,-50%); }

  .gw-content { position: relative; z-index: 1; width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 32px; }

  /* Logo / Brand */
  .gw-brand { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .gw-logo {
    width: 72px; height: 72px; border-radius: 20px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px; font-weight: 900; color: white;
    box-shadow: 0 8px 32px rgba(99,102,241,0.4);
    letter-spacing: -2px;
  }
  .gw-name { font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.5px; }
  .gw-tagline { font-size: 14px; color: rgba(255,255,255,0.45); text-align: center; }

  /* Cards */
  .gw-cards { display: flex; flex-direction: column; gap: 12px; width: 100%; }

  .gw-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 16px;
    text-align: left;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    position: relative;
    overflow: hidden;
  }
  .gw-card:hover, .gw-card:active { transform: translateY(-2px); border-color: rgba(255,255,255,0.2); }
  .gw-card.client:hover  { background: rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.4); }
  .gw-card.supplier:hover { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.4); }
  .gw-card.team:hover    { background: rgba(249,115,22,0.12); border-color: rgba(249,115,22,0.4); }

  .gw-card-icon {
    width: 48px; height: 48px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; flex-shrink: 0;
  }
  .gw-card.client  .gw-card-icon { background: rgba(99,102,241,0.2); }
  .gw-card.supplier .gw-card-icon { background: rgba(16,185,129,0.2); }
  .gw-card.team    .gw-card-icon { background: rgba(249,115,22,0.2); }

  .gw-card-body { flex: 1; }
  .gw-card-title { font-size: 16px; font-weight: 700; color: white; margin-bottom: 3px; }
  .gw-card.client  .gw-card-title { color: #a5b4fc; }
  .gw-card.supplier .gw-card-title { color: #6ee7b7; }
  .gw-card.team    .gw-card-title { color: #fdba74; }
  .gw-card-sub { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.4; }

  .gw-card-arrow { color: rgba(255,255,255,0.25); font-size: 18px; flex-shrink: 0; }

  /* Saved portal badge */
  .gw-saved-badge {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5);
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 999px; padding: 3px 10px; margin-top: 5px;
  }
  .gw-saved-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  /* Link input section */
  .gw-link-input-wrap { width: 100%; }
  .gw-link-label { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
  .gw-link-row { display: flex; gap: 8px; }
  .gw-link-input {
    flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px; padding: 12px 16px; color: white; font-size: 14px;
    font-family: 'Inter', sans-serif; outline: none;
  }
  .gw-link-input::placeholder { color: rgba(255,255,255,0.3); }
  .gw-link-input:focus { border-color: rgba(99,102,241,0.6); background: rgba(99,102,241,0.08); }
  .gw-link-btn {
    padding: 12px 18px; border-radius: 12px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; transition: all 0.15s;
  }
  .gw-link-btn.client  { background: #6366f1; color: white; }
  .gw-link-btn.client:hover  { background: #4f46e5; }
  .gw-link-btn.supplier { background: #10b981; color: white; }
  .gw-link-btn.supplier:hover { background: #059669; }
  .gw-link-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .gw-link-err { font-size: 12px; color: #f87171; margin-top: 6px; }

  /* Footer */
  .gw-footer { font-size: 12px; color: rgba(255,255,255,0.2); text-align: center; }

  /* PWA install tip */
  .gw-install-tip {
    width: 100%; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
    border-radius: 12px; padding: 14px 16px;
    display: flex; align-items: flex-start; gap: 10px;
  }
  .gw-install-tip-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
  .gw-install-tip-text { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.5; }
  .gw-install-tip-text strong { color: rgba(255,255,255,0.75); }
`;

// Extract token from a full portal URL like https://management.edumanage.app/portal/TOKEN
function extractToken(input, type) {
  const trimmed = input.trim();
  // If it's already just a token (no slash)
  if (!trimmed.includes('/')) return trimmed;
  // Extract from URL path /portal/TOKEN or /supplier-portal/TOKEN
  const pattern = type === 'client'
    ? /\/portal\/([^/?#]+)/
    : /\/supplier-portal\/([^/?#]+)/;
  const match = trimmed.match(pattern);
  return match ? match[1] : trimmed;
}

export default function GatewayPage() {
  const navigate = useNavigate();

  // Saved portal tokens — read once from localStorage (set on portal login)
  const savedClient = useState(() => {
    try {
      const cp = localStorage.getItem('edumanage_default_portal');
      return cp ? JSON.parse(cp) : null;
    } catch { return null; }
  })[0];

  const savedSupplier = useState(() => {
    try {
      const sp = localStorage.getItem('edumanage_default_teacher_portal');
      return sp ? JSON.parse(sp) : null;
    } catch { return null; }
  })[0];

  // Which card is expanded with the link-paste input
  const [expanded, setExpanded] = useState(null); // 'client' | 'supplier' | null

  // Link inputs
  const [clientLink, setClientLink] = useState('');
  const [supplierLink, setSupplierLink] = useState('');
  const [clientErr, setClientErr] = useState('');
  const [supplierErr, setSupplierErr] = useState('');

  const goToClient = (token) => navigate(`/portal/${token}`);
  const goToSupplier = (token) => navigate(`/supplier-portal/${token}`);

  const handleClientGo = () => {
    const token = extractToken(clientLink, 'client');
    if (!token || token.length < 8) { setClientErr('Please paste your full portal link or token'); return; }
    setClientErr('');
    goToClient(token);
  };

  const handleSupplierGo = () => {
    const token = extractToken(supplierLink, 'supplier');
    if (!token || token.length < 8) { setSupplierErr('Please paste your full portal link or token'); return; }
    setSupplierErr('');
    goToSupplier(token);
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="gw-root">
        {/* Ambient orbs */}
        <div className="gw-orb gw-orb-1" />
        <div className="gw-orb gw-orb-2" />
        <div className="gw-orb gw-orb-3" />

        <div className="gw-content">
          {/* Brand */}
          <div className="gw-brand">
            <div className="gw-logo">A</div>
            <div className="gw-name">Axialogy</div>
            <div className="gw-tagline">Choose how you'd like to continue</div>
          </div>

          {/* Cards */}
          <div className="gw-cards">

            {/* ── Client Portal ─────────────────────────────── */}
            <div>
              <div
                className="gw-card client"
                onClick={() => {
                  if (savedClient) { goToClient(savedClient.token); return; }
                  setExpanded(expanded === 'client' ? null : 'client');
                  setSupplierErr('');
                }}
              >
                <div className="gw-card-icon">🧾</div>
                <div className="gw-card-body">
                  <div className="gw-card-title">Client Portal</div>
                  {savedClient ? (
                    <>
                      <div className="gw-card-sub">Welcome back!</div>
                      <div className="gw-saved-badge">
                        <span className="gw-saved-dot" style={{ color: '#a5b4fc' }} />
                        {savedClient.name || 'Your portal'}
                      </div>
                    </>
                  ) : (
                    <div className="gw-card-sub">View invoices, quotes &amp; tasks from your account manager</div>
                  )}
                </div>
                <div className="gw-card-arrow">{savedClient ? '›' : (expanded === 'client' ? '↑' : '›')}</div>
              </div>

              {/* Expand: paste link */}
              {!savedClient && expanded === 'client' && (
                <div className="gw-link-input-wrap" style={{ marginTop: 8, padding: '0 4px' }}>
                  <label className="gw-link-label">Paste your portal link from your account manager:</label>
                  <div className="gw-link-row">
                    <input
                      className="gw-link-input"
                      placeholder="management.edumanage.app/portal/…"
                      value={clientLink}
                      onChange={e => { setClientLink(e.target.value); setClientErr(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleClientGo()}
                      autoFocus
                    />
                    <button className="gw-link-btn client" onClick={handleClientGo} disabled={!clientLink.trim()}>Go</button>
                  </div>
                  {clientErr && <div className="gw-link-err">{clientErr}</div>}
                </div>
              )}
            </div>

            {/* ── Supplier Portal ────────────────────────────── */}
            <div>
              <div
                className="gw-card supplier"
                onClick={() => {
                  if (savedSupplier) { goToSupplier(savedSupplier.token); return; }
                  setExpanded(expanded === 'supplier' ? null : 'supplier');
                  setClientErr('');
                }}
              >
                <div className="gw-card-icon">🏭</div>
                <div className="gw-card-body">
                  <div className="gw-card-title">Supplier Portal</div>
                  {savedSupplier ? (
                    <>
                      <div className="gw-card-sub">Welcome back!</div>
                      <div className="gw-saved-badge">
                        <span className="gw-saved-dot" style={{ color: '#6ee7b7' }} />
                        {savedSupplier.name || 'Your supplier portal'}
                      </div>
                    </>
                  ) : (
                    <div className="gw-card-sub">View your transactions, payments and documents</div>
                  )}
                </div>
                <div className="gw-card-arrow">{savedSupplier ? '›' : (expanded === 'supplier' ? '↑' : '›')}</div>
              </div>

              {/* Expand: paste link */}
              {!savedSupplier && expanded === 'supplier' && (
                <div className="gw-link-input-wrap" style={{ marginTop: 8, padding: '0 4px' }}>
                  <label className="gw-link-label">Paste your supplier portal link:</label>
                  <div className="gw-link-row">
                    <input
                      className="gw-link-input"
                      placeholder="management.edumanage.app/supplier-portal/…"
                      value={supplierLink}
                      onChange={e => { setSupplierLink(e.target.value); setSupplierErr(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleSupplierGo()}
                      autoFocus
                    />
                    <button className="gw-link-btn supplier" onClick={handleSupplierGo} disabled={!supplierLink.trim()}>Go</button>
                  </div>
                  {supplierErr && <div className="gw-link-err">{supplierErr}</div>}
                </div>
              )}
            </div>

            {/* ── Team Login ─────────────────────────────────── */}
            <div
              className="gw-card team"
              onClick={() => navigate('/login')}
            >
              <div className="gw-card-icon">🔐</div>
              <div className="gw-card-body">
                <div className="gw-card-title">Team Member</div>
                <div className="gw-card-sub">Staff &amp; admin — log in to the management dashboard</div>
              </div>
              <div className="gw-card-arrow">›</div>
            </div>

          </div>

          {/* PWA install tip — shown to all, explains the home screen experience */}
          <div className="gw-install-tip">
            <div className="gw-install-tip-icon">📲</div>
            <div className="gw-install-tip-text">
              <strong>Add to Home Screen</strong> — install this page as an app.
              Your portal will be remembered so you go straight to it next time.
            </div>
          </div>

          <div className="gw-footer">© {new Date().getFullYear()} Axialogy</div>
        </div>
      </div>
    </>
  );
}

