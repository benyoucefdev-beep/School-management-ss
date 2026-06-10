// frontend/src/pages/UnauthorizedPage.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFAULT_PATH } from '../config/roleNav';
import { ShieldX } from 'lucide-react';

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const defaultPath = ROLE_DEFAULT_PATH[user?.role] || '/my-tasks';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: 24,
      padding: '0 24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(239,68,68,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShieldX size={40} color="var(--danger)" />
      </div>

      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          Access Denied
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 4 }}>
          You don't have access to this page.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Contact your admin if you think this is a mistake.
        </p>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => navigate(defaultPath, { replace: true })}
      >
        Go back to my workspace
      </button>
    </div>
  );
}
