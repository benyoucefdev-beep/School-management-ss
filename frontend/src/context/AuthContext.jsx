import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('edumanage_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('edumanage_token');
    const stored = localStorage.getItem('edumanage_user');
    if (token && stored) {
      try {
        const parsed = JSON.parse(stored);
        // Eagerly set user and set loading to false so the UI renders instantly.
        // Fresh user/status details are fetched silently in the background.
        setUser(parsed);
        setLoading(false);

        api.get('/auth/me')
          .then(res => {
            setUser(res.data);
            localStorage.setItem('edumanage_user', JSON.stringify(res.data));
          })
          .catch((err) => {
            // Only log out if the token is explicitly rejected (401/403).
            // Do NOT log out if there is a network error or a temporary server error.
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
              localStorage.removeItem('edumanage_token');
              localStorage.removeItem('edumanage_user');
              setUser(null);
            }
          });
        return;
      } catch {
        // Fall back to login if JSON parsing fails
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem('edumanage_token', token);
    localStorage.setItem('edumanage_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('edumanage_token');
    localStorage.removeItem('edumanage_user');
    setUser(null);
  };

  // Call this after profile updates to sync local state
  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      localStorage.setItem('edumanage_user', JSON.stringify(res.data));
      return res.data;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
