import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PasswordPolicyService } from '../../common/services/password-policy.service';
import { UsersService } from '../users/users.service';
import { TokenBlacklistService } from './token-blacklist.service';

/**
 * Auth service tests — covers the critical login path:
 * - Successful login with correct credentials
 * - Failed login with wrong password
 * - Failed login with non-existent email
 * - Account lockout after 5 failed attempts
 * - MFA-required flow returns partial token
 * - Inactive account rejection
 */
describe('AuthService — login', () => {
  let service: AuthService;
  let usersService: Partial<Record<keyof UsersService, jest.Mock>>;
  let tokenBlacklist: Partial<TokenBlacklistService>;

  // Mock User entity (as returned by UsersService.findByEmailWithPassword)
  // toUserRecord() maps passwordHash -> password
  const mockUser: any = {
    id: 'test-user-1',
    email: 'test@neuraline.health',
    passwordHash: '',
    firstName: 'Test',
    lastName: 'User',
    role: 'doctor',
    tenantId: '00000000-0000-0000-0000-000000000000',
    mfaEnabled: false,
    mfaSecret: null,
    isActive: true,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('TestPass@2025', 12);
  });

  beforeEach(async () => {
    usersService = {
      findByEmailWithPassword: jest.fn(),
      findByIdWithPassword: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    tokenBlacklist = {
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
      isRevoked: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: any) => {
              if (key === 'JWT_SECRET') return 'test-jwt-secret-at-least-32-chars-long';
              if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret-at-least-32-chars';
              if (key === 'JWT_EXPIRATION') return '900';
              if (key === 'JWT_REFRESH_EXPIRATION') return '604800';
              if (key === 'MFA_APP_NAME') return 'NeuralineEMR';
              return fallback;
            }),
          },
        },
        {
          provide: PasswordPolicyService,
          useValue: { validate: jest.fn().mockReturnValue({ valid: true, errors: [] }) },
        },
        { provide: UsersService, useValue: usersService },
        { provide: TokenBlacklistService, useValue: tokenBlacklist },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    service.onModuleInit();
  });

  it('should return tokens on successful login', async () => {
    usersService.findByEmailWithPassword!.mockResolvedValue(mockUser);

    const result = await service.login('test@neuraline.health', 'TestPass@2025');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.mfaRequired).toBe(false);
    expect(result.user.email).toBe('test@neuraline.health');
  });

  it('should throw UnauthorizedException for wrong password', async () => {
    usersService.findByEmailWithPassword!.mockResolvedValue(mockUser);

    await expect(
      service.login('test@neuraline.health', 'WrongPassword@2025'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for non-existent email', async () => {
    usersService.findByEmailWithPassword!.mockResolvedValue(null);

    await expect(
      service.login('nobody@neuraline.health', 'TestPass@2025'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should lock account after 5 failed attempts', async () => {
    usersService.findByEmailWithPassword!.mockResolvedValue(mockUser);

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await expect(
        service.login('test@neuraline.health', 'WrongPassword@2025'),
      ).rejects.toThrow(UnauthorizedException);
    }

    // 6th attempt — even with correct password — should be locked
    await expect(
      service.login('test@neuraline.health', 'TestPass@2025'),
    ).rejects.toThrow(/Account locked/);
  });

  it('should return mfaRequired=true when MFA is enabled', async () => {
    const mfaUser = { ...mockUser, mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP' };
    usersService.findByEmailWithPassword!.mockResolvedValue(mfaUser);

    const result = await service.login('test@neuraline.health', 'TestPass@2025');

    expect(result.mfaRequired).toBe(true);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBe('');
  });

  it('should reject inactive accounts', async () => {
    const inactiveUser = { ...mockUser, isActive: false };
    usersService.findByEmailWithPassword!.mockResolvedValue(inactiveUser);

    await expect(
      service.login('test@neuraline.health', 'TestPass@2025'),
    ).rejects.toThrow(/Account is deactivated/);
  });

  it('should clear failed attempts after successful login', async () => {
    // This test does 9 bcrypt comparisons which can be slow on CI
    usersService.findByEmailWithPassword!.mockResolvedValue(mockUser);

    // 2 failed attempts
    for (let i = 0; i < 2; i++) {
      await expect(
        service.login('test@neuraline.health', 'WrongPassword@2025'),
      ).rejects.toThrow(UnauthorizedException);
    }

    // Successful login
    const result = await service.login('test@neuraline.health', 'TestPass@2025');
    expect(result.mfaRequired).toBe(false);

    // Should be able to fail 5 more times before lockout (counter was reset)
    for (let i = 0; i < 5; i++) {
      await expect(
        service.login('test@neuraline.health', 'WrongPassword@2025'),
      ).rejects.toThrow(UnauthorizedException);
    }
    // 6th attempt should be locked (5 failures since last success)
    await expect(
      service.login('test@neuraline.health', 'TestPass@2025'),
    ).rejects.toThrow(/Account locked/);
  }, 30000);
});

/**
 * MFA verification tests — covers the TOTP verification path.
 */
describe('AuthService — MFA', () => {
  let service: AuthService;
  let usersService: Partial<Record<keyof UsersService, jest.Mock>>;
  let tokenBlacklist: Partial<TokenBlacklistService>;

  beforeEach(async () => {
    usersService = {
      findByEmailWithPassword: jest.fn(),
      findByIdWithPassword: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    tokenBlacklist = {
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
      isRevoked: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: any) => {
              if (key === 'JWT_SECRET') return 'test-jwt-secret-at-least-32-chars-long';
              if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret-at-least-32-chars';
              if (key === 'JWT_EXPIRATION') return '900';
              if (key === 'JWT_REFRESH_EXPIRATION') return '604800';
              if (key === 'MFA_APP_NAME') return 'NeuralineEMR';
              return fallback;
            }),
          },
        },
        {
          provide: PasswordPolicyService,
          useValue: { validate: jest.fn().mockReturnValue({ valid: true, errors: [] }) },
        },
        { provide: UsersService, useValue: usersService },
        { provide: TokenBlacklistService, useValue: tokenBlacklist },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    service.onModuleInit();
  });

  it('should throw BadRequestException if MFA not configured', async () => {
    usersService.findByIdWithPassword!.mockResolvedValue({
      id: 'test-user-1',
      email: 'test@neuraline.health',
      mfaSecret: null,
      mfaEnabled: false,
      tenantId: '00000000-0000-0000-0000-000000000000',
    });

    await expect(service.verifyMfa('test-user-1', '123456')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw UnauthorizedException for invalid TOTP code', async () => {
    const { authenticator } = require('otplib');
    const secret = authenticator.generateSecret();

    usersService.findByIdWithPassword!.mockResolvedValue({
      id: 'test-user-1',
      email: 'test@neuraline.health',
      mfaSecret: secret,
      mfaEnabled: false,
      tenantId: '00000000-0000-0000-0000-000000000000',
    });

    // Use a clearly invalid code (all zeros is unlikely to match)
    await expect(service.verifyMfa('test-user-1', '000000')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should return tokens on valid TOTP code', async () => {
    const { authenticator } = require('otplib');
    const secret = authenticator.generateSecret();
    const validCode = authenticator.generate(secret);

    usersService.findByIdWithPassword!.mockResolvedValue({
      id: 'test-user-1',
      email: 'test@neuraline.health',
      mfaSecret: secret,
      mfaEnabled: false,
      tenantId: '00000000-0000-0000-0000-000000000000',
      passwordHash: await bcrypt.hash('TestPass@2025', 12),
      firstName: 'Test',
      lastName: 'User',
      role: 'doctor',
      isActive: true,
    });

    const result = await service.verifyMfa('test-user-1', validCode);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.verified).toBe(true);

    // Should have marked MFA as enabled
    expect(usersService.update).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000000',
      'test-user-1',
      { mfaEnabled: true },
    );
  });
});
