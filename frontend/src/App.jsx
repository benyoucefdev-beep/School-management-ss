import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Menu, X, User, LogOut, ChevronDown, Settings } from 'lucide-react';
import Sidebar from './components/Sidebar';
import RoleGuard from './components/RoleGuard';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationBell from './components/NotificationBell';
import { ROLE_DEFAULT_PATH } from './config/roleNav';
import { useAutoSubscribe } from './components/PushSubscriptionHandler';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));

// School core
const StudentsPage       = lazy(() => import('./pages/StudentsPage'));
const StudentDetailPage  = lazy(() => import('./pages/StudentDetailPage'));
const TeachersPage       = lazy(() => import('./pages/TeachersPage'));
const TeacherDetailPage  = lazy(() => import('./pages/TeacherDetailPage'));
const ClassesPage        = lazy(() => import('./pages/ClassesPage'));
const GroupsPage         = lazy(() => import('./pages/GroupsPage'));
const SubjectsPage       = lazy(() => import('./pages/SubjectsPage'));
const ParentsPage        = lazy(() => import('./pages/ParentsPage'));

// Finance
const ExpensesPage       = lazy(() => import('./pages/ExpensesPage'));
const PLPage             = lazy(() => import('./pages/PLPage'));

// Admin
const TeamPage           = lazy(() => import('./pages/TeamPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));
const UnauthorizedPage   = lazy(() => import('./pages/UnauthorizedPage'));

// Staff roles. 'owner'/'staff' are legacy aliases kept so existing accounts work.
const MANAGER_UP = ['admin', 'owner', 'manager'];   // run the school
const ALL_STAFF  = ['admin', 'owner', 'manager', 'member', 'staff'];
const ADMIN_ONLY = ['admin', 'owner'];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const CACHE_VERSION = 'edumanage-v3'; // bump to discard caches saved by older builds
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: CACHE_VERSION,
  throttleTime: 1000,
});

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function ProfileDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white', overflow: 'hidden' }}>
          {user?.photo_url ? <img src={user.photo_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(user?.name)}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</span>
        <ChevronDown size={14} style={{ opacity: 0.6, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', minWidth: 200, zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</div>
          </div>
          <button onClick={() => { navigate('/profile'); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14, transition: 'background 0.15s', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <User size={15} /> My Profile
          </button>
          <button onClick={() => { navigate('/settings'); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14, transition: 'background 0.15s', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <Settings size={15} /> Settings
          </button>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <button onClick={() => { logout(); navigate('/login'); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, transition: 'background 0.15s', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function AppLayout({ children }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => { const m = window.innerWidth < 1024; setIsMobile(m); if (!m) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="app-shell">
      {isMobile && (
        <>
          {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
          <div className={`mobile-nav ${sidebarOpen ? 'mobile-nav--open' : ''}`}>
            <div className="mobile-nav-header">
              <div className="sidebar-logo-icon">E</div>
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>EduManage</span>
              <button className="mobile-nav-close" onClick={() => setSidebarOpen(false)}><X size={22} /></button>
            </div>
            <Sidebar onNav={() => setSidebarOpen(false)} hideLogo />
          </div>
        </>
      )}
      {!isMobile && <aside className="sidebar"><Sidebar /></aside>}

      <div className={`app-main${!isMobile ? ' app-main--with-sidebar' : ''}`}>
        <header className="app-header">
          {isMobile && <button className="menu-toggle-btn" onClick={() => setSidebarOpen(o => !o)}><Menu size={20} /></button>}
          <div className="header-right">
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  useAutoSubscribe();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="loading-spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="loading-spinner" /></div>;
  if (user) return <Navigate to={ROLE_DEFAULT_PATH[user.role] || '/dashboard'} replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_DEFAULT_PATH[user.role] || '/dashboard'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"        element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/profile"   element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      {/* School — admin/manager */}
      <Route path="/students"    element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><StudentsPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/students/:id" element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><StudentDetailPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/teachers"    element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><TeachersPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/teachers/:id" element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><TeacherDetailPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/classes"     element={<ProtectedRoute><RoleGuard allowedRoles={ALL_STAFF}><ClassesPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/groups"      element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><GroupsPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/subjects"    element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><SubjectsPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/parents"     element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><ParentsPage /></RoleGuard></ProtectedRoute>} />

      {/* Finance */}
      <Route path="/finance/expenses" element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><ExpensesPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/finance/pl"       element={<ProtectedRoute><RoleGuard allowedRoles={MANAGER_UP}><PLPage /></RoleGuard></ProtectedRoute>} />

      {/* Management — admin only */}
      <Route path="/team"     element={<ProtectedRoute><RoleGuard allowedRoles={ADMIN_ONLY}><TeamPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><RoleGuard allowedRoles={ADMIN_ONLY}><SettingsPage /></RoleGuard></ProtectedRoute>} />

      {/* Root & catch-all */}
      <Route path="/"  element={<RootRedirect />} />
      <Route path="*"  element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000, buster: CACHE_VERSION }}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="loading-spinner" /></div>}>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </Suspense>
          <Toaster
            position="bottom-right"
            toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px' }, success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-card)' } }, error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--bg-card)' } } }}
          />
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}
