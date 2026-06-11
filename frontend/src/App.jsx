import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Menu, X, User, LogOut, ChevronDown } from 'lucide-react';
import Sidebar from './components/Sidebar';
import RoleGuard from './components/RoleGuard';
import NotificationBell from './components/NotificationBell';
import ThemeToggle from './components/ThemeToggle';
import { ROLE_DEFAULT_PATH } from './config/roleNav';
import { useAutoSubscribe } from './components/PushSubscriptionHandler';

// Lazy-load all pages so each route is a separate JS chunk.
// iOS Safari (JavaScriptCore) is much slower than Chrome V8 at parsing large bundles.
// Splitting into small chunks means iOS only parses what it needs right now.
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const ClientsPage        = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage   = lazy(() => import('./pages/ClientDetailPage'));
const SuppliersPage      = lazy(() => import('./pages/SuppliersPage'));
const SupplierDetailPage = lazy(() => import('./pages/SupplierDetailPage'));
const TasksPage          = lazy(() => import('./pages/TasksPage'));
const QuotesPage         = lazy(() => import('./pages/QuotesPage'));
const InvoicesPage       = lazy(() => import('./pages/InvoicesPage'));
const ExpensesPage       = lazy(() => import('./pages/ExpensesPage'));
const PLPage             = lazy(() => import('./pages/PLPage'));
const AdsPage            = lazy(() => import('./pages/AdsPage'));
const TeamPage           = lazy(() => import('./pages/TeamPage'));
const UnauthorizedPage   = lazy(() => import('./pages/UnauthorizedPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));
const PortalPage         = lazy(() => import('./pages/PortalPage'));
const SupplierPortalPage = lazy(() => import('./pages/SupplierPortalPage'));
const GroupsPage         = lazy(() => import('./pages/GroupsPage'));
const SubjectsPage       = lazy(() => import('./pages/SubjectsPage'));
const ParentsPage        = lazy(() => import('./pages/ParentsPage'));

const ALL_SPECIALIST_ROLES = ['graphic_designer', 'software_developer', 'printer', 'ads_manager'];
const ALL_ROLES = ['admin', ...ALL_SPECIALIST_ROLES];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60_000,        // 2 minutes — data stays fresh longer
      gcTime: 24 * 60 * 60_000,     // 24 hours — keep in localStorage longer
      refetchOnWindowFocus: false,  // don't refetch just because user switched tabs
    },
  },
});

// Persist the query cache to localStorage so the PWA shows data instantly on reopen.
// Data appears in milliseconds from cache, fresh fetch happens in background.
// Cache is versioned — changing CACHE_VERSION invalidates stale persisted data on deploy.
const CACHE_VERSION = 'edumanage-v1';
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: CACHE_VERSION,
  throttleTime: 1000, // write to localStorage at most once per second
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
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 10px', borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: 'white', overflow: 'hidden',
        }}>
          {user?.photo_url
            ? <img src={user.photo_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(user?.name)}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.name}
        </span>
        <ChevronDown size={14} style={{ opacity: 0.6, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          minWidth: 200, zIndex: 1000, overflow: 'hidden',
        }}>
          {/* User info header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</div>
          </div>

          {/* My Profile */}
          <button
            onClick={() => { navigate('/profile'); setOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '12px 16px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-primary)', fontSize: 14,
              transition: 'background 0.15s', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <User size={15} /> My Profile
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Sign Out */}
          <button
            onClick={() => { logout(); navigate('/login'); setOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '12px 16px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--danger)', fontSize: 14,
              transition: 'background 0.15s', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function ClearBadgeOnOpen() {
  useEffect(() => {
    // Clear badge number when user opens the app
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }, []);
  return null;
}

function AppLayout({ children }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen(o => !o);

  return (
    <div className="app-shell">
      <ClearBadgeOnOpen />
      {isMobile && (
        <>
          {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}
          <div className={`mobile-nav ${sidebarOpen ? 'mobile-nav--open' : ''}`}>
            <div className="mobile-nav-header">
              <div className="sidebar-logo-icon">E</div>
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>EduManage</span>
              <button className="mobile-nav-close" onClick={closeSidebar} aria-label="Close menu">
                <X size={22} />
              </button>
            </div>
            <Sidebar onNav={closeSidebar} hideLogo />
          </div>
        </>
      )}

      {!isMobile && (
        <aside className="sidebar">
          <Sidebar />
        </aside>
      )}

      <div className={`app-main${!isMobile ? ' app-main--with-sidebar' : ''}`}>
        <header className="app-header">
          {isMobile && (
            <button className="menu-toggle-btn" onClick={toggleSidebar} aria-label="Open menu">
              <Menu size={20} />
            </button>
          )}
          <div className="header-right">
            <ThemeToggle />
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </header>
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  useAutoSubscribe(); // silently subscribe to push on every app load
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="loading-spinner" /></div>;
  if (user) {
    // Portal users go to their portal, not the team dashboard
    if (user.role === 'client')   return <Navigate to={`/portal/${user.portal_token}`} replace />;
    if (user.role === 'supplier') return <Navigate to={`/supplier-portal/${user.portal_token}`} replace />;
    return <Navigate to={ROLE_DEFAULT_PATH[user.role] || '/tasks'} replace />;
  }
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // Portal users go to their specific portal URL
  if (user.role === 'client')   return <Navigate to={`/portal/${user.portal_token}`} replace />;
  if (user.role === 'supplier') return <Navigate to={`/supplier-portal/${user.portal_token}`} replace />;
  // Team members go to their default page
  return <Navigate to={ROLE_DEFAULT_PATH[user.role] || '/tasks'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────── */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      {/* Client portal — fully public, no auth needed */}
      <Route path="/portal/:token" element={<PortalPage />} />
      {/* Supplier portal — fully public, no auth needed */}
      <Route path="/supplier-portal/:token" element={<SupplierPortalPage />} />

      {/* ── All authenticated roles ────────────────────────── */}
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><ClientsPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><ClientDetailPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/classes" element={<ProtectedRoute><RoleGuard allowedRoles={ALL_ROLES}><TasksPage /></RoleGuard></ProtectedRoute>} />

      {/* ── Admin-only ─────────────────────────────────────── */}
      <Route path="/finance/quotes" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><QuotesPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/finance/invoices" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><InvoicesPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/finance/expenses" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><ExpensesPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/finance/pl" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><PLPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><SuppliersPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/suppliers/:id" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><SupplierDetailPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><TeamPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><SettingsPage /></RoleGuard></ProtectedRoute>} />

      {/* ── School Management ──────────────────────────────── */}
      <Route path="/groups"   element={<ProtectedRoute><RoleGuard allowedRoles={ALL_ROLES}><GroupsPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><RoleGuard allowedRoles={ALL_ROLES}><SubjectsPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/parents"  element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><ParentsPage /></RoleGuard></ProtectedRoute>} />

      {/* ── Admin + ads_manager ────────────────────────────── */}
      <Route path="/ads" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'ads_manager']}><AdsPage /></RoleGuard></ProtectedRoute>} />

      {/* ── Admin + printer ────────────────────────────────── */}
      <Route path="/orders" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'printer']}><TasksPage /></RoleGuard></ProtectedRoute>} />

      {/* ── Root & catch-all ───────────────────────────────── */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // persist up to 24 hours
        buster: CACHE_VERSION,        // cache-bust on version change
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
              <div className="loading-spinner" />
            </div>
          }>
            <AppRoutes />
          </Suspense>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-card)' } },
              error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--bg-card)' } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}

export default App;
