import { create } from 'zustand';
import type { User, Notification, Tenant } from '../types';

// HIPAA: Use sessionStorage instead of localStorage for auth tokens.
// sessionStorage is cleared when the browser tab closes, preventing
// token persistence on shared workstations.
const SESSION_TOKEN_KEY = 'neuraline_token';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string, tenant: Tenant) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  token: sessionStorage.getItem(SESSION_TOKEN_KEY),
  isAuthenticated: !!sessionStorage.getItem(SESSION_TOKEN_KEY),
  login: (user, token, tenant) => {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    set({ user, token, tenant, isAuthenticated: true });
  },
  logout: () => {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    // HIPAA: Clear all session data on logout
    sessionStorage.clear();
    set({ user: null, token: null, tenant: null, isAuthenticated: false });
  },
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}));

interface AppState {
  sidebarCollapsed: boolean;
  currentModule: string;
  notifications: Notification[];
  unreadCount: number;
  toggleSidebar: () => void;
  setCurrentModule: (module: string) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  currentModule: 'dashboard',
  notifications: [],
  unreadCount: 0,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCurrentModule: (module) => set({ currentModule: module }),
  addNotification: (notification) =>
    set((s) => ({
      notifications: [notification, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    })),
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
}));
