import { create } from 'zustand';
import axios from 'axios';
import { getRedirectPath } from '../utils/getRedirectPath';

// Configure Axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'https://pos-2ufp.onrender.com';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  permissions: JSON.parse(localStorage.getItem('permissions') || '[]'),
  darkMode: localStorage.getItem('darkMode') === 'true',
  toasts: [],

  // Toast system helper
  addToast: (message, type = 'success') => {
    const id = Date.now();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 3500);
  },

  // Toggle Dark Mode
  toggleDarkMode: () => {
    const nextMode = !get().darkMode;
    localStorage.setItem('darkMode', nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ darkMode: nextMode });
  },

  // Initialize theme on app load
  initTheme: () => {
    const isDark = get().darkMode;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  // Log in — returns redirect path for the caller to navigate to
  login: async (username, password, role) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password, role });
      const { token, user, permissions } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('permissions', JSON.stringify(permissions || []));

      set({ token, user, permissions: permissions || [] });
      get().addToast(`Welcome back, ${user.name}!`, 'success');

      // Return where to redirect
      return { success: true, redirectPath: getRedirectPath(user.role, permissions || []) };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Login failed. Check your network or credentials.';
      get().addToast(errMsg, 'error');
      return { success: false, redirectPath: null };
    }
  },

  // Log out
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    set({ token: null, user: null, permissions: [] });
    get().addToast('Logged out successfully', 'info');
  },

  // Check auth status on refresh — rehydrates user from /api/auth/profile
  checkAuth: async () => {
    const currentToken = get().token;
    if (!currentToken) return false;

    axios.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;

    try {
      const res = await axios.get('/api/auth/profile');
      set({ user: res.data.user });
      return true;
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
      delete axios.defaults.headers.common['Authorization'];
      set({ token: null, user: null, permissions: [] });
      return false;
    }
  },

  // Silently refresh permissions from server (called on window focus)
  refreshPermissions: async () => {
    const currentToken = get().token;
    if (!currentToken) return;
    try {
      const res = await axios.get('/api/auth/me');
      const freshPerms = res.data.permissions || [];
      localStorage.setItem('permissions', JSON.stringify(freshPerms));
      set({ permissions: freshPerms });
    } catch {
      // Token expired → response interceptor handles logout
    }
  },

  // Permission check helper — supports both object map and flat array formats
  hasPermission: (module, action = 'view') => {
    const currentUser = get().user;
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;

    // Check flat array (new format from localStorage)
    const permsArray = get().permissions;
    if (Array.isArray(permsArray) && permsArray.length > 0) {
      const perm = permsArray.find(p => p.module === module);
      if (perm) {
        const key = `can_${action}`;
        return Boolean(perm[key]);
      }
    }

    // Fallback: check object map (legacy format from user.permissions)
    const permissions = currentUser.permissions || {};
    return !!permissions[module]?.[action];
  }
}));

// Configure request interceptor to dynamically inject token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Configure response interceptor to auto-logout on 401 only
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Auto logout if unauthenticated
      if (localStorage.getItem('token')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default useAuthStore;
export { axios };
