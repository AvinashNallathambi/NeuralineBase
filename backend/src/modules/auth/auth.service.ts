import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PasswordPolicyService } from '../../common/services/password-policy.service';

export interface UserRecord {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  isActive: boolean;
}

interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
}

interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  type: string;
}

// ── HIPAA: Account lockout tracking ─────────────────────────────
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  // HIPAA: Token blacklist (production should use Redis)
  private readonly tokenBlacklist = new Set<string>();

  // HIPAA: Account lockout – max attempts before lockout
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  /**
   * Authenticate user with email and password
   */
  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<UserRecord, 'password' | 'mfaSecret'>;
    mfaRequired: boolean;
  }> {
    // HIPAA: Check account lockout before processing
    this.checkAccountLockout(email);

    // TODO: Replace with actual database lookup via UsersService
    const user = await this.findUserByEmail(email);

    if (!user) {
      this.recordFailedLogin(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.recordFailedLogin(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // HIPAA: Clear failed attempts on successful login
    this.loginAttempts.delete(email);

    // Check if MFA is required
    if (user.mfaEnabled) {
      const partialToken = this.generatePartialToken(user);
      return {
        accessToken: partialToken,
        refreshToken: '',
        user: this.sanitizeUser(user),
        mfaRequired: true,
      };
    }

    const tokens = this.generateTokens(user);
    // HIPAA: Do not log email in plaintext
    this.logger.log(`User ${user.id} logged in successfully`);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      mfaRequired: false,
    };
  }

  /**
   * Register a new tenant with an admin user
   */
  async register(
    dto: RegisterDto,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<UserRecord, 'password' | 'mfaSecret'>;
    tenantId: string;
  }> {
    // Check if email already exists
    const existingUser = await this.findUserByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // HIPAA: Enforce password policy
    this.passwordPolicyService.validate(dto.password);

    // Create tenant
    const tenantId = uuidv4();

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    // Create admin user
    const user: UserRecord = {
      id: uuidv4(),
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'admin',
      tenantId,
      mfaEnabled: false,
      mfaSecret: null,
      isActive: true,
    };

    // TODO: Save tenant and user to database via UsersService
    // HIPAA: Do not log email in plaintext
    this.logger.log(
      `New tenant "${dto.tenantName}" registered with admin userId=${user.id}`,
    );

    const tokens = this.generateTokens(user);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      tenantId,
    };
  }

  /**
   * Refresh access token using a valid refresh token
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // HIPAA: Verify token is not blacklisted
      if (this.tokenBlacklist.has(refreshToken)) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // TODO: Verify refresh token is not revoked in database
      const user = await this.findUserById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Enable MFA for a user - generates secret and returns QR code data
   */
  async enableMfa(
    userId: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate MFA secret
    // TODO: Use otplib to generate proper TOTP secret
    const secret = uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
    const appName = this.configService.get<string>(
      'MFA_APP_NAME',
      'NeuralineEMR',
    );
    const qrCodeUrl = `otpauth://totp/${appName}:${user.email}?secret=${secret}&issuer=${appName}`;

    // TODO: Save secret to user record in database
    this.logger.log(`MFA enabled for user ${userId}`);

    return { secret, qrCodeUrl };
  }

  /**
   * Verify MFA TOTP code
   */
  async verifyMfa(
    userId: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; verified: boolean }> {
    const user = await this.findUserById(userId);
    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA not configured');
    }

    // TODO: Use otplib to verify TOTP code against stored secret
    // HIPAA: Validate code format strictly (6-digit numeric only)
    const isValid = /^\d{6}$/.test(code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code – must be 6 digits');
    }
    // NOTE: Once otplib is integrated, replace the regex check with:
    //   const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });

    const tokens = this.generateTokens(user);
    this.logger.log(`MFA verified for user ${userId}`);

    return { ...tokens, verified: true };
  }

  /**
   * Logout user - invalidate tokens
   */
  async logout(userId: string, refreshToken?: string): Promise<{ message: string }> {
    // HIPAA: Blacklist the refresh token so it cannot be reused
    if (refreshToken) {
      this.tokenBlacklist.add(refreshToken);
    }
    this.logger.log(`User ${userId} logged out`);
    return { message: 'Logged out successfully' };
  }

  /**
   * Send forgot password email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.findUserByEmail(email);

    // Always return success to prevent email enumeration
    if (user) {
      const resetToken = uuidv4();
      // TODO: Save reset token to database with expiry
      // TODO: Send email via notification service
      this.logger.log(`Password reset requested for ${email}`);
    }

    return {
      message:
        'If an account with that email exists, a password reset link has been sent',
    };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // TODO: Validate token from database and check expiry
    if (!token) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // HIPAA: Enforce password policy on reset
    this.passwordPolicyService.validate(newPassword);

    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    // TODO: Update user password in database
    this.logger.log(`Password reset completed for token ${token.substring(0, 8)}...`);

    void hashedPassword; // placeholder until DB integration

    return { message: 'Password has been reset successfully' };
  }

  // ─── Private helpers ─────────────────────────────────────────────

  private generateTokens(user: UserRecord): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
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
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRATION',
          '7d',
        ),
      },
    );

    return { accessToken, refreshToken };
  }

  private generatePartialToken(user: UserRecord): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        type: 'mfa_pending',
      },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '5m',
      },
    );
  }

  private sanitizeUser(
    user: UserRecord,
  ): Omit<UserRecord, 'password' | 'mfaSecret'> {
    const { password: _, mfaSecret: __, ...sanitized } = user;
    return sanitized;
  }

  // TODO: Replace these stubs with actual database queries via UsersService

  private async findUserByEmail(
    _email: string,
  ): Promise<UserRecord | null> {
    // Stub - will be replaced with TypeORM repository query
    return null;
  }

  private async findUserById(
    _id: string,
  ): Promise<UserRecord | null> {
    // Stub - will be replaced with TypeORM repository query
    return null;
  }

  // ── HIPAA: Account lockout helpers ──────────────────────────────

  /** Throw if the account is currently locked out. */
  private checkAccountLockout(email: string): void {
    const attempt = this.loginAttempts.get(email);
    if (!attempt) return;

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      const remainingSec = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
      throw new UnauthorizedException(
        `Account locked due to too many failed attempts. Try again in ${remainingSec} seconds.`,
      );
    }

    // Reset if lockout has expired
    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      this.loginAttempts.delete(email);
    }
  }

  /** Record a failed login and lock the account if threshold exceeded. */
  private recordFailedLogin(email: string): void {
    const attempt = this.loginAttempts.get(email) || {
      count: 0,
      lastAttempt: 0,
      lockedUntil: null,
    };

    attempt.count += 1;
    attempt.lastAttempt = Date.now();

    if (attempt.count >= this.MAX_LOGIN_ATTEMPTS) {
      attempt.lockedUntil = Date.now() + this.LOCKOUT_DURATION_MS;
      this.logger.warn(
        `HIPAA: Account locked for email hash ${this.hashEmail(email)} after ${attempt.count} failed attempts`,
      );
    }

    this.loginAttempts.set(email, attempt);
  }

  /** One-way hash to avoid logging raw emails. */
  private hashEmail(email: string): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(email).digest('hex').substring(0, 12);
  }
}
