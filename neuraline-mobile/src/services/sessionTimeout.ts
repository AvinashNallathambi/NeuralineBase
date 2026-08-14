/**
 * Session Timeout — native app-state-aware session management.
 *
 * Replaces the web app's SessionTimeoutProvider (which uses DOM events).
 * On native, we listen to AppState transitions:
 * - 'active' → user returned; check if timeout has elapsed
 * - 'background' → user left; start the timeout clock
 * - 'inactive' → (iOS) transient state, ignore
 *
 * HIPAA: On timeout, clear in-memory auth state. The keychain token
 * remains, but the user must re-authenticate (or use biometric unlock)
 * to re-hydrate it.
 */

import { AppState, type AppStateStatus } from 'react-native';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store';

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useSessionTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const logout = useAuthStore((s) => s.logout);
  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // User left the app — record when
        backgroundTimeRef.current = Date.now();
      } else if (nextState === 'active' && backgroundTimeRef.current !== null) {
        // User returned — check if timeout has elapsed
        const elapsed = Date.now() - backgroundTimeRef.current;
        backgroundTimeRef.current = null;

        if (elapsed >= timeoutMs) {
          // Session expired — clear in-memory state, force re-auth
          logout();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [logout, timeoutMs]);
}
