/**
 * Patient Auth Store — patient portal authentication state.
 *
 * Separate from staff auth — patients use a different JWT strategy
 * (patient-jwt) and a different keychain key.
 */
import { create } from 'zustand';
import type { Patient } from '@neuraline/shared';

interface PatientAuthState {
  patient: Partial<Patient> | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (patient: Partial<Patient>, token: string, refreshToken?: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const usePatientAuthStore = create<PatientAuthState>((set) => ({
  patient: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (patient, token, refreshToken) =>
    set({ patient, token, refreshToken, isAuthenticated: true, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  logout: () =>
    set({
      patient: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}));
