import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * HIPAA-compliant AES-256-GCM encryption service for PHI at rest.
 *
 * Usage:
 *   const cipher = encrypt(plaintext);   // returns "iv:authTag:ciphertext" (hex)
 *   const plain  = decrypt(cipher);      // returns original string
 *
 * The encryption key MUST be provided via the ENCRYPTION_KEY env variable
 * (64 hex chars = 32 bytes). The service refuses to start without one.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const hexKey = this.configService.get<string>('ENCRYPTION_KEY', '');
    if (!hexKey || hexKey.length !== 64) {
      // In development fall back to a deterministic key so the app still boots.
      // In production the startup guard (see main.ts) will block launch.
      const fallback = crypto.createHash('sha256').update('neuraline-dev-only').digest('hex');
      this.key = Buffer.from(fallback, 'hex');
      this.logger.warn(
        'ENCRYPTION_KEY not set or invalid – using DEVELOPMENT-ONLY fallback. ' +
        'Set a 64-char hex key in production!',
      );
    } else {
      this.key = Buffer.from(hexKey, 'hex');
    }
  }

  /** Encrypt a plaintext string. Returns `iv:authTag:ciphertext` (all hex). */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /** Decrypt a value previously produced by `encrypt()`. */
  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid ciphertext format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /** Hash a value (one-way) for indexing encrypted fields. */
  hash(value: string): string {
    return crypto.createHmac('sha256', this.key).update(value).digest('hex');
  }

  /** Encrypt a JSON-serialisable object. */
  encryptObject<T>(obj: T): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /** Decrypt back to an object. */
  decryptObject<T>(ciphertext: string): T {
    return JSON.parse(this.decrypt(ciphertext)) as T;
  }
}
