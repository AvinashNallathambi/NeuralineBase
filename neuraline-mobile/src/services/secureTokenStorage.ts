/**
 * Secure Token Storage — replaces the web app's sessionStorage.
 *
 * Uses react-native-keychain (iOS Keychain / Android Keystore).
 * Tokens are NEVER stored in plaintext (never AsyncStorage).
 *
 * HIPAA: kSecAttrAccessibleWhenUnlockedThisDeviceOnly on iOS means
 * the token is not synced to iCloud and requires device unlock.
 */

import * as Keychain from 'react-native-keychain';

export type TokenScope = 'staff' | 'patient';

const KEY_MAP: Record<TokenScope, string> = {
  staff: 'neuraline_staff_token',
  patient: 'neuraline_patient_token',
};

const REFRESH_KEY_MAP: Record<TokenScope, string> = {
  staff: 'neuraline_staff_refresh',
  patient: 'neuraline_patient_refresh',
};

export interface StoredAuth {
  token: string;
  refreshToken?: string;
}

export async function saveSecureToken(
  scope: TokenScope,
  token: string,
  refreshToken?: string,
): Promise<void> {
  const key = KEY_MAP[scope];
  await Keychain.setGenericPassword('neuraline', token, {
    service: key,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  if (refreshToken) {
    const refreshKey = REFRESH_KEY_MAP[scope];
    await Keychain.setGenericPassword('neuraline', refreshToken, {
      service: refreshKey,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
}

export async function getSecureToken(scope: TokenScope): Promise<string | null> {
  const key = KEY_MAP[scope];
  const creds = await Keychain.getGenericPassword({ service: key });
  if (creds) {
    return creds.password;
  }
  return null;
}

export async function getSecureRefreshToken(scope: TokenScope): Promise<string | null> {
  const refreshKey = REFRESH_KEY_MAP[scope];
  const creds = await Keychain.getGenericPassword({ service: refreshKey });
  if (creds) {
    return creds.password;
  }
  return null;
}

export async function getStoredAuth(scope: TokenScope): Promise<StoredAuth | null> {
  const token = await getSecureToken(scope);
  if (!token) return null;
  const refreshToken = await getSecureRefreshToken(scope);
  return { token, refreshToken: refreshToken ?? undefined };
}

export async function clearSecureToken(scope: TokenScope): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEY_MAP[scope] });
  await Keychain.resetGenericPassword({ service: REFRESH_KEY_MAP[scope] });
}
