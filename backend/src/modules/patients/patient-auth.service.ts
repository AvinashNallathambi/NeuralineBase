import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Patient } from './entities/patient.entity';
import { TokenBlacklistService, RevocationContext } from '../auth/token-blacklist.service';

interface PatientTokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  type: string;
}

interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

@Injectable()
export class PatientAuthService {
  private readonly logger = new Logger(PatientAuthService.name);
  private readonly SALT_ROUNDS = 12;
  // HIPAA: Token blacklist — Redis-backed, shared across instances.
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000;
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  async login(
    email: string,
    password: string,
    tenantId: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    patient: Partial<Patient>;
    mfaRequired: boolean;
  }> {
    this.checkAccountLockout(email);

    const patient = await this.patientRepository.findOne({
      where: { email: email.toLowerCase(), tenantId },
    });

    if (!patient || !patient.passwordHash || !patient.portalActive) {
      await this.recordFailedLogin(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, patient.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedLogin(email, patient.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginAttempts.delete(email);

    await this.patientRepository.update(patient.id, { lastLoginAt: new Date() });

    const tokens = this.generateTokens(patient);
    this.logger.log(`Patient ${patient.id} logged in successfully`);

    return {
      ...tokens,
      patient: this.sanitizePatient(patient),
      mfaRequired: false,
    };
  }

  async setupAccount(
    patientId: string,
    password: string,
    tenantId: string,
  ): Promise<{ message: string }> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      throw new BadRequestException('Patient not found');
    }

    if (patient.passwordHash) {
      throw new BadRequestException('Account already set up');
    }

    if (!patient.email) {
      throw new BadRequestException('Patient must have an email on file');
    }

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    await this.patientRepository.update(patientId, {
      passwordHash: hashedPassword,
      portalActive: true,
    });

    this.logger.log(`Patient ${patientId} portal account set up`);
    return { message: 'Account set up successfully' };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<PatientTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh' || payload.role !== 'patient') {
        throw new UnauthorizedException('Invalid token type');
      }

      if (await this.tokenBlacklist.isRevoked(refreshToken)) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const patient = await this.patientRepository.findOne({
        where: { id: payload.sub },
      });

      if (!patient || !patient.portalActive) {
        throw new UnauthorizedException('Patient not found or inactive');
      }

      return this.generateTokens(patient);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(
    patientId: string,
    refreshToken?: string,
    context?: RevocationContext,
  ): Promise<{ message: string }> {
    if (refreshToken) {
      const expSeconds = this.decodeTokenExp(refreshToken);
      if (expSeconds !== null) {
        await this.tokenBlacklist.revoke(refreshToken, expSeconds, {
          ...context,
          userId: patientId,
        });
      }
    }
    this.logger.log(`Patient ${patientId} logged out`);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string, tenantId: string): Promise<{ message: string }> {
    const patient = await this.patientRepository.findOne({
      where: { email: email.toLowerCase(), tenantId },
    });

    if (patient && patient.portalActive) {
      const resetToken = uuidv4();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.patientRepository.update(patient.id, {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: expiresAt,
      });

      this.logger.log(`Password reset requested for patient ${patient.id}`);
    }

    return {
      message: 'If an account with that email exists, a password reset link has been sent',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    context?: RevocationContext,
  ): Promise<{ message: string }> {
    const patient = await this.patientRepository.findOne({
      where: { passwordResetToken: token },
    });

    if (!patient || !patient.passwordResetExpiresAt || patient.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.patientRepository.update(patient.id, {
      passwordHash: hashedPassword,
      passwordResetToken: null as any,
      passwordResetExpiresAt: null as any,
    });

    this.logger.log(`Password reset completed for patient ${patient.id}`);

    // HIPAA §164.312(a)(2)(iii) Automatic Logoff:
    // Revoke ALL existing patient portal sessions after password reset
    // so any compromised sessions are immediately cut off.
    await this.tokenBlacklist.revokeAllForUser(patient.id, {
      ...context,
      userId: patient.id,
      tenantId: patient.tenantId,
      reason: 'patient_password_reset',
    });

    return { message: 'Password has been reset successfully' };
  }

  async getMe(patientId: string): Promise<Partial<Patient>> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
      relations: ['insurances', 'problems'],
    });

    if (!patient) {
      throw new BadRequestException('Patient not found');
    }

    return this.sanitizePatient(patient);
  }

  // ─── Private helpers ───────────────────────────────────────────

  /**
   * Decode a JWT's `exp` claim (seconds since epoch) WITHOUT verifying the
   * signature. Used by `logout` to derive the Redis TTL for the blacklist
   * entry. Returns null if the token is malformed or has no `exp`.
   */
  private decodeTokenExp(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as { exp?: unknown };
      if (typeof payload.exp !== 'number') return null;
      return payload.exp;
    } catch {
      return null;
    }
  }

  private generateTokens(patient: Patient): { accessToken: string; refreshToken: string } {
    const payload = {
      sub: patient.id,
      email: patient.email,
      tenantId: patient.tenantId,
      role: 'patient',
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      },
    );

    return { accessToken, refreshToken };
  }

  private sanitizePatient(patient: Patient): Partial<Patient> {
    const { passwordHash, mfaSecret, passwordResetToken, passwordResetExpiresAt, ...sanitized } = patient;
    void passwordHash; void mfaSecret; void passwordResetToken; void passwordResetExpiresAt;
    return sanitized;
  }

  private checkAccountLockout(email: string): void {
    const attempt = this.loginAttempts.get(email);
    if (!attempt) return;

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      const remainingSec = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
      throw new UnauthorizedException(
        `Account locked due to too many failed attempts. Try again in ${remainingSec} seconds.`,
      );
    }

    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      this.loginAttempts.delete(email);
    }
  }

  private async recordFailedLogin(email: string, userId?: string): Promise<void> {
    const attempt = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0, lockedUntil: null };
    attempt.count += 1;
    attempt.lastAttempt = Date.now();

    if (attempt.count >= this.MAX_LOGIN_ATTEMPTS) {
      attempt.lockedUntil = Date.now() + this.LOCKOUT_DURATION_MS;
      this.logger.warn(`HIPAA: Patient account locked after ${attempt.count} failed attempts`);

      // HIPAA §164.312(a)(2)(iii): Revoke all sessions on account lockout
      if (userId) {
        await this.tokenBlacklist.revokeAllForUser(userId, {
          userId,
          reason: 'patient_account_lockout',
        });
      }
    }

    this.loginAttempts.set(email, attempt);
  }
}
