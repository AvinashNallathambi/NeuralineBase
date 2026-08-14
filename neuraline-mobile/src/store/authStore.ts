/**
 * Auth Store — staff authentication state.
 *
 * HIPAA: In-memory only. No zustand/persist middleware. Tokens are
 * stored in the OS keychain (see services/secureTokenStorage) and
 * hydrated into this store on app open. When the app closes, all
 * in-memory state is cleared.
 */
import { create } from 'zustand';
import type { User, Tenant } from '@neuraline/shared';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean; // true while restoring session from keychain

  // Actions
  setAuth: (user: User, token: string, tenant: Tenant, refreshToken?: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, token, tenant, refreshToken) =>
    set({ user, token, tenant, refreshToken, isAuthenticated: true, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  logout: () =>
    set({
      user: null,
      tenant: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}));
