import { Injectable, BadRequestException } from '@nestjs/common';

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

/**
 * HIPAA-compliant password policy enforcement.
 *
 * Requirements (NIST SP 800-63B + HIPAA Security Rule):
 *   - Minimum 12 characters
 *   - At least 1 uppercase letter
 *   - At least 1 lowercase letter
 *   - At least 1 digit
 *   - At least 1 special character
 *   - Not a commonly-used password
 */
@Injectable()
export class PasswordPolicyService {
  private readonly MIN_LENGTH = 12;

  private readonly COMMON_PASSWORDS = new Set([
    'password1234', 'admin1234567', 'qwerty123456',
    'letmein12345', 'welcome12345', 'changeme1234',
    'neuraline123', 'password!234', '123456789012',
  ]);

  /** Validate a password against the policy. Throws on failure. */
  validate(password: string): void {
    const result = this.check(password);
    if (!result.valid) {
      throw new BadRequestException(
        `Password does not meet security requirements: ${result.errors.join('; ')}`,
      );
    }
  }

  /** Check without throwing – useful for UI feedback. */
  check(password: string): PasswordPolicyResult {
    const errors: string[] = [];

    if (!password || password.length < this.MIN_LENGTH) {
      errors.push(`Must be at least ${this.MIN_LENGTH} characters`);
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Must contain at least one digit');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Must contain at least one special character');
    }
    if (this.COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return { valid: errors.length === 0, errors };
  }
}
