import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { HipaaAuditService } from '../../common/services/hipaa-audit.service';

/**
 * Context passed from the HTTP request to enrich audit log entries.
 * Used when revoking tokens to record WHO revoked WHAT from WHERE.
 */
export interface RevocationContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  /** Human-readable reason for the revocation (e.g. "user_logout", "password_reset") */
  reason?: string;
}

/**
 * Redis-backed JWT revocation blacklist.
 *
 * Replaces the in-process `Set<string>` previously used by AuthService.
 * Storing revoked tokens in Redis means:
 *  - All backend instances share the same blacklist (works behind a load
 *    balancer with >1 NestJS replicas).
 *  - The blacklist survives backend restarts (Redis persistence).
 *  - Entries auto-expire via Redis TTL set to the JWT's own `exp`, so no
 *    manual cleanup is required.
 *
 * HIPAA hardening:
 *  - The raw JWT is never stored in Redis. We hash it with SHA-256 and use
 *    `revoked:token:<hash>` as the key. Redis memory dumps / backups / RDB
 *    files therefore never contain a usable refresh token.
 *  - In production, a Redis outage causes `isRevoked` to fail CLOSED
 *    (treat the token as revoked → reject the refresh). This prevents PHI
 *    access via a stale refresh token during a Redis incident.
 *  - In non-production, `isRevoked` fails OPEN so a missing local Redis
 *    container does not lock developers out.
 *
 * HIPAA §164.312(a)(2)(iii) Automatic Logoff:
 *  - `revokeAllForUser(userId)` sets a per-user "revoke-all-before" timestamp
 *    in Redis. Any token issued BEFORE that timestamp is treated as revoked,
 *    enabling mass session invalidation on password reset, MFA enable, or
 *    account lockout without tracking every individual token.
 *
 * HIPAA §164.312(b) Audit Controls:
 *  - Every revocation (single token or all-sessions) is written to the
 *    immutable HipaaAuditLog via HipaaAuditService, including the user,
 *    IP address, user-agent, and reason.
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly tokenPrefix = 'revoked:token:';
  private readonly userAllPrefix = 'revoked:all_before:';
  /** TTL for per-user revoke-all keys = max refresh token lifetime (7 days). */
  private readonly userAllTtlSeconds = 7 * 24 * 60 * 60;
  private readonly isProduction: boolean;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly auditService: HipaaAuditService,
  ) {
    this.isProduction =
      this.configService.get<string>('NODE_ENV', 'development') === 'production';
  }

  /**
   * Revoke a single refresh token until its natural expiry.
   *
   * @param token      Raw JWT string (will be hashed before storage).
   * @param expSeconds JWT `exp` claim in seconds since epoch. The Redis TTL
   *                   is derived from this so the entry is purged
   *                   automatically once the token would have expired anyway.
   * @param context    Optional request context for audit logging.
   */
  async revoke(
    token: string,
    expSeconds: number,
    context?: RevocationContext,
  ): Promise<void> {
    const ttl = expSeconds - Math.floor(Date.now() / 1000);
    if (ttl <= 0) {
      // Token already expired naturally — nothing to blacklist.
      return;
    }
    const key = this.tokenKeyFor(token);
    try {
      await this.redis.set(key, '1', 'EX', ttl);

      // HIPAA §164.312(b): Audit the revocation event
      await this.auditService.log({
        userId: context?.userId,
        userEmail: context?.userEmail,
        userRole: context?.userRole,
        tenantId: context?.tenantId,
        action: 'TOKEN_REVOKED',
        resourceType: 'AuthToken',
        description: context?.reason
          ? `Token revoked: ${context.reason}`
          : 'Token revoked (logout)',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { ttlSeconds: ttl, reason: context?.reason ?? 'user_logout' },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write token to Redis blacklist: ${(err as Error).message}`,
      );
      // Still attempt audit logging — the revocation failed but the attempt
      // itself is security-relevant.
      await this.auditService.log({
        userId: context?.userId,
        userEmail: context?.userEmail,
        userRole: context?.userRole,
        tenantId: context?.tenantId,
        action: 'TOKEN_REVOKE_FAILED',
        resourceType: 'AuthToken',
        description: `Token revocation failed: ${(err as Error).message}`,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { reason: context?.reason ?? 'user_logout' },
      });
    }
  }

  /**
   * Revoke ALL active sessions for a user (HIPAA §164.312(a)(2)(iii) Automatic Logoff).
   *
   * Sets a per-user timestamp in Redis. Any token whose `iat` (issued-at) is
   * older than this timestamp will be treated as revoked by `isRevoked`.
   * This avoids tracking every individual token — O(1) space per user.
   *
   * Use cases:
   *  - Password change/reset → invalidate all old sessions
   *  - MFA enable → force re-login with MFA
   *  - Account lockout → cut off attacker's existing sessions
   *  - Role change → force re-authentication with new permissions
   *
   * @param userId   The user whose sessions should be revoked.
   * @param context  Optional request context for audit logging.
   */
  async revokeAllForUser(userId: string, context?: RevocationContext): Promise<void> {
    const key = this.userAllKeyFor(userId);
    const nowSeconds = Math.floor(Date.now() / 1000);
    try {
      await this.redis.set(key, String(nowSeconds), 'EX', this.userAllTtlSeconds);

      // HIPAA §164.312(b): Audit the mass revocation event
      await this.auditService.log({
        userId,
        userEmail: context?.userEmail,
        userRole: context?.userRole,
        tenantId: context?.tenantId,
        action: 'ALL_SESSIONS_REVOKED',
        resourceType: 'UserSession',
        resourceId: userId,
        description: context?.reason
          ? `All sessions revoked: ${context.reason}`
          : 'All sessions revoked for user',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: {
          reason: context?.reason ?? 'unspecified',
          revokedAtEpoch: nowSeconds,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to revoke all sessions for user ${userId}: ${(err as Error).message}`,
      );
      await this.auditService.log({
        userId,
        userEmail: context?.userEmail,
        userRole: context?.userRole,
        tenantId: context?.tenantId,
        action: 'ALL_SESSIONS_REVOKE_FAILED',
        resourceType: 'UserSession',
        resourceId: userId,
        description: `Mass session revocation failed: ${(err as Error).message}`,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { reason: context?.reason ?? 'unspecified' },
      });
    }
  }

  /**
   * Check whether a refresh token has been revoked.
   *
   * Checks both:
   *  1. Individual token revocation (exact token in blacklist)
   *  2. User-wide revocation (token's `iat` is older than the user's
   *     "revoke-all-before" timestamp)
   *
   * Production policy: fail CLOSED (return true) on Redis errors so a Redis
   * outage cannot enable use of a revoked token.
   * Non-production policy: fail OPEN (return false) so dev environments
   * without a running Redis container are not locked out.
   */
  async isRevoked(token: string): Promise<boolean> {
    const tokenKey = this.tokenKeyFor(token);
    try {
      // 1. Check individual token blacklist
      const individualResult = await this.redis.get(tokenKey);
      if (individualResult === '1') {
        return true;
      }

      // 2. Check user-wide revocation (revoke-all-before)
      const decoded = this.decodeJwtPayload(token);
      if (decoded?.sub && decoded?.iat !== undefined) {
        const userAllKey = this.userAllKeyFor(decoded.sub);
        const revokeAllBeforeStr = await this.redis.get(userAllKey);
        if (revokeAllBeforeStr) {
          const revokeAllBefore = parseInt(revokeAllBeforeStr, 10);
          if (!isNaN(revokeAllBefore) && decoded.iat < revokeAllBefore) {
            return true;
          }
        }
      }

      return false;
    } catch (err) {
      this.logger.error(
        `Redis blacklist lookup failed: ${(err as Error).message}`,
      );
      if (this.isProduction) {
        // Fail closed: treat as revoked to protect PHI.
        return true;
      }
      // Dev/staging: fail open so the app remains usable without Redis.
      return false;
    }
  }

  /**
   * Ping the Redis server. Used by the health check endpoint.
   * Returns latency in milliseconds, or null if Redis is unreachable.
   */
  async ping(): Promise<number | null> {
    const start = Date.now();
    try {
      const result = await this.redis.ping();
      if (result === 'PONG') {
        return Date.now() - start;
      }
      return null;
    } catch {
      return null;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────

  private tokenKeyFor(token: string): string {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return this.tokenPrefix + hash;
  }

  private userAllKeyFor(userId: string): string {
    return this.userAllPrefix + userId;
  }

  /**
   * Decode JWT payload WITHOUT verifying signature. Used only to extract
   * `sub` (userId) and `iat` (issued-at) for the user-wide revocation check.
   *
   * Safety: `isRevoked` is always called AFTER JWT signature verification
   * in the refresh flow, so a tampered token would already be rejected.
   * A forged `sub`/`iat` here can only cause a false "not revoked" result
   * for a token that wouldn't pass signature verification anyway.
   */
  private decodeJwtPayload(token: string): { sub?: string; iat?: number } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as { sub?: unknown; iat?: unknown };
      const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
      const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
      return sub !== undefined || iat !== undefined ? { sub, iat } : null;
    } catch {
      return null;
    }
  }
}
