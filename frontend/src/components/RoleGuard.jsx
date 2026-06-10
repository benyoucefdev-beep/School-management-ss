// frontend/src/components/RoleGuard.jsx
// Protects routes based on allowed roles
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFAULT_PATH } from '../config/roleNav';

/**
 * Wraps a route and redirects unqualified users to /unauthorized
 * @param {string[]} allowedRoles - roles that can access this route
 * @param {React.ReactNode} children
 */
export default function RoleGuard({ allowedRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
