/**
 * Biometric Service — Face ID / Touch ID / fingerprint.
 *
 * Uses react-native-biometrics for biometric key creation and verification.
 * The biometric key is used to gate access to the stored auth token —
 * the user must authenticate biometrically before the token is restored
 * from the keychain.
 */

import RNBiometrics from 'react-native-biometrics';

const biometrics = new RNBiometrics();

export interface BiometricAvailability {
  available: boolean;
  biometryType: 'FaceID' | 'TouchID' | 'Biometrics' | null;
}

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const { available } = await biometrics.isSensorAvailable();
    // react-native-biometrics doesn't expose the type directly in all versions;
    // we infer from platform in the caller if needed.
    return { available, biometryType: null };
  } catch {
    return { available: false, biometryType: null };
  }
}

export async function biometricPrompt(promptMessage: string): Promise<boolean> {
  try {
    const { success } = await biometrics.createSignature({
      promptMessage,
      payload: 'neuraline-auth-gate',
    });
    return success;
  } catch {
    return false;
  }
}
