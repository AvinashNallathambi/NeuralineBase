/**
 * Navigation Ref — imperative navigation for use outside React components.
 *
 * Replaces the web app's `window.location.href = '/login'` pattern.
 * The axios 401 interceptor and session timeout use this to reset
 * the navigation stack without touching the DOM.
 */

import { createNavigationContainerRef } from '@react-navigation/native';

export type RootStackParamList = {
  // Loading
  Loading: undefined;

  // Auth
  Login: undefined;
  BiometricUnlock: undefined;
  ForgotPassword: undefined;

  // Staff app
  StaffApp: undefined;

  // Patient portal
  PatientLogin: undefined;
  PatientApp: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToLogin(): void {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }
}

export function navigateToPatientLogin(): void {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'PatientLogin' }],
    });
  }
}
