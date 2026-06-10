import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('edumanage_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If it's a 401 and NOT from the login route itself, redirect to login
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('edumanage_token');
      localStorage.removeItem('edumanage_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
