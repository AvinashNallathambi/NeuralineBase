import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { TokenBlacklistService } from './token-blacklist.service';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { HipaaAuditService } from '../../common/services/hipaa-audit.service';

/**
 * Shared in-memory fake Redis that simulates a single Redis instance
 * backing multiple backend replicas. Both TokenBlacklistService instances
 * inject the same fakeRedis object, so writes from instance A are visible
 * to instance B — exactly how a real shared Redis behaves.
 *
 * This tests the cross-instance revocation property: a token revoked on
 * one backend instance must be rejected by another.
 */
class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<string> {
    const expiresAt = mode === 'EX' && ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  /** Test helper: clear all keys between tests. */
  flushall(): void {
    this.store.clear();
  }
}

describe('TokenBlacklistService — cross-instance revocation', () => {
  let fakeRedis: FakeRedis;
  let instanceA: TokenBlacklistService;
  let instanceB: TokenBlacklistService;
  let moduleA: TestingModule;
  let moduleB: TestingModule;
  let auditLogCalls: Array<{ action: string; userId?: string }>;

  const JWT_SECRET = 'test-jwt-secret-for-cross-instance-test';
  const JWT_REFRESH_SECRET = 'test-refresh-secret-for-cross-instance-test';

  beforeEach(async () => {
    fakeRedis = new FakeRedis();
    auditLogCalls = [];

    const mockAuditService = {
      log: (entry: { action: string; userId?: string }) => {
        auditLogCalls.push(entry);
        return Promise.resolve();
      },
    };

    const mockConfigService = {
      get: (key: string, defaultVal?: unknown) => {
        if (key === 'NODE_ENV') return 'test';
        return defaultVal;
      },
    };

    // Two independent NestJS modules simulating two backend instances.
    // Both inject the SAME fakeRedis (shared Redis).
    moduleA = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        { provide: REDIS_CLIENT, useValue: fakeRedis },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HipaaAuditService, useValue: mockAuditService },
      ],
    }).compile();
    instanceA = moduleA.get(TokenBlacklistService);

    moduleB = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        { provide: REDIS_CLIENT, useValue: fakeRedis },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HipaaAuditService, useValue: mockAuditService },
      ],
    }).compile();
    instanceB = moduleB.get(TokenBlacklistService);
  });

  afterEach(async () => {
    fakeRedis.flushall();
    await moduleA.close();
    await moduleB.close();
  });

  /** Helper: mint a JWT with the given iat and exp claims. */
  function makeToken(opts: { sub: string; iat: number; exp: number; type?: string; role?: string }): string {
    return jwt.sign(
      { sub: opts.sub, type: opts.type ?? 'refresh', role: opts.role ?? 'staff' },
      JWT_REFRESH_SECRET,
      { expiresIn: 0, noTimestamp: false },
    );
  }

  /**
   * jwt.sign with expiresIn:0 sets exp = iat (already expired). We need
   * custom exp/iat control, so we bypass jwt.sign and build the token
   * manually.
   */
  function makeTokenManual(opts: { sub: string; iat: number; exp: number; type?: string; role?: string }): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: opts.sub,
        type: opts.type ?? 'refresh',
        role: opts.role ?? 'staff',
        iat: opts.iat,
        exp: opts.exp,
      }),
    ).toString('base64url');
    // Signature doesn't matter for these tests — isRevoked decodes without verifying.
    const sig = Buffer.from('fake-signature').toString('base64url');
    return `${header}.${payload}.${sig}`;
  }

  describe('single-token revocation (logout)', () => {
    it('instance A revokes a token → instance B rejects it', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = makeTokenManual({
        sub: 'user-123',
        iat: now,
        exp: now + 3600, // 1 hour
      });

      // Instance A (where user logged out) revokes the token
      await instanceA.revoke(token, now + 3600, {
        userId: 'user-123',
        reason: 'user_logout',
      });

      // Instance B (a different backend replica) must reject the same token
      const revokedOnB = await instanceB.isRevoked(token);
      expect(revokedOnB).toBe(true);
    });

    it('a different (non-revoked) token is NOT rejected', async () => {
      const now = Math.floor(Date.now() / 1000);
      // Two distinct tokens for the same user (different iat → different JWT string)
      const token1 = makeTokenManual({ sub: 'user-123', iat: now, exp: now + 3600 });
      const token2 = makeTokenManual({ sub: 'user-123', iat: now + 1, exp: now + 3600 });

      await instanceA.revoke(token1, now + 3600);

      expect(await instanceB.isRevoked(token1)).toBe(true);
      expect(await instanceB.isRevoked(token2)).toBe(false);
    });

    it('writes a TOKEN_REVOKED audit log entry', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = makeTokenManual({ sub: 'user-123', iat: now, exp: now + 3600 });

      await instanceA.revoke(token, now + 3600, {
        userId: 'user-123',
        reason: 'user_logout',
      });

      expect(auditLogCalls).toContainEqual(
        expect.objectContaining({
          action: 'TOKEN_REVOKED',
          userId: 'user-123',
        }),
      );
    });
  });

  describe('user-wide revocation (revokeAllForUser)', () => {
    it('instance A revokes all sessions → instance B rejects tokens issued before', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oldToken = makeTokenManual({
        sub: 'user-456',
        iat: now - 100, // issued 100s ago
        exp: now + 3600,
      });
      const newerToken = makeTokenManual({
        sub: 'user-456',
        iat: now + 10, // issued 10s in the future (after revocation)
        exp: now + 7200,
      });

      // Instance A triggers mass revocation (e.g. password reset)
      await instanceA.revokeAllForUser('user-456', {
        userId: 'user-456',
        reason: 'password_reset',
      });

      // Instance B must reject the old token
      expect(await instanceB.isRevoked(oldToken)).toBe(true);
      // Instance B must NOT reject a token issued after the revocation
      expect(await instanceB.isRevoked(newerToken)).toBe(false);
    });

    it('does NOT affect a different user\'s tokens', async () => {
      const now = Math.floor(Date.now() / 1000);
      const userAToken = makeTokenManual({ sub: 'user-A', iat: now - 50, exp: now + 3600 });
      const userBToken = makeTokenManual({ sub: 'user-B', iat: now - 50, exp: now + 3600 });

      await instanceA.revokeAllForUser('user-A', { reason: 'password_reset' });

      expect(await instanceB.isRevoked(userAToken)).toBe(true);
      expect(await instanceB.isRevoked(userBToken)).toBe(false);
    });

    it('writes an ALL_SESSIONS_REVOKED audit log entry', async () => {
      await instanceA.revokeAllForUser('user-789', {
        userId: 'user-789',
        reason: 'mfa_enabled',
      });

      expect(auditLogCalls).toContainEqual(
        expect.objectContaining({
          action: 'ALL_SESSIONS_REVOKED',
          userId: 'user-789',
        }),
      );
    });
  });

  describe('combined individual + user-wide revocation', () => {
    it('individual revocation still works alongside user-wide revocation', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = makeTokenManual({ sub: 'user-X', iat: now + 20, exp: now + 3600 });

      // User-wide revocation first (token issued after, so not affected)
      await instanceA.revokeAllForUser('user-X', { reason: 'password_reset' });
      expect(await instanceB.isRevoked(token)).toBe(false);

      // Now individually revoke the same token (e.g. explicit logout)
      await instanceA.revoke(token, now + 3600);
      expect(await instanceB.isRevoked(token)).toBe(true);
    });
  });

  describe('health check (ping)', () => {
    it('returns latency in ms when Redis is reachable', async () => {
      const latency = await instanceA.ping();
      expect(latency).not.toBeNull();
      expect(typeof latency).toBe('number');
      expect(latency).toBeGreaterThanOrEqual(0);
    });
  });
});
