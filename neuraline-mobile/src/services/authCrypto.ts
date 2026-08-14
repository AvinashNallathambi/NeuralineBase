/**
 * Auth Crypto — RSA-OAEP password encryption for login.
 *
 * Replaces the web app's `window.crypto.subtle` usage with
 * `react-native-quick-crypto` (JSI-backed, native performance).
 *
 * The backend decrypts with its RSA private key (see backend AuthService).
 * This keeps the password encrypted in transit even if TLS terminates
 * at a load balancer.
 */

import QuickCrypto from 'react-native-quick-crypto';

/**
 * Convert a PEM public key string to a crypto KeyObject.
 */
function pemToPublicKey(pem: string) {
  // Strip PEM headers and decode base64
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
  const der = Buffer.from(b64, 'base64');
  return QuickCrypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/**
 * Encrypt a password with RSA-OAEP + SHA-256.
 * Returns base64-encoded ciphertext.
 */
export function encryptPassword(password: string, publicKeyPem: string): string {
  const publicKey = pemToPublicKey(publicKeyPem);
  const encrypted = QuickCrypto.publicEncrypt(
    {
      key: publicKey,
      padding: QuickCrypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(password, 'utf8'),
  );
  return encrypted.toString('base64');
}
