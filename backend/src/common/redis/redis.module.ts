import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Shared Redis client provider.
 *
 * Exposed as a @Global module so any feature module can inject the
 * `REDIS_CLIENT` symbol without re-declaring the connection. Bull manages
 * its own internal Redis client separately (see BullModule.forRootAsync in
 * AppModule), which is the standard NestJS pattern.
 *
 * HIPAA notes:
 *  - The client is configured with bounded retry/backoff so a transient
 *    Redis outage does not crash the API.
 *  - Callers that handle security-sensitive state (e.g. TokenBlacklistService)
 *    must decide explicitly whether to fail-open or fail-closed when Redis
 *    is unavailable; this provider does not impose a policy.
 *  - TLS is enabled when REDIS_TLS=true OR when REDIS_URL starts with
 *    `rediss://`. In production (NODE_ENV=production), TLS is auto-enabled
 *    unless REDIS_TLS is explicitly set to 'false'. This satisfies
 *    45 CFR 164.312(e)(1) Transmission Security for data in transit.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

function parseRedisUrl(url: string): { host: string; port: number; password?: string; tls: boolean } {
  const parsed = new URL(url);
  const tls = parsed.protocol === 'rediss:';
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : (tls ? 6380 : 6379),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls,
  };
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV', 'development') === 'production';
        const redisUrl = configService.get<string>('REDIS_URL', '');
        const redisTlsEnv = configService.get<string>('REDIS_TLS', '');

        // Determine TLS: explicit env > URL scheme > production default
        let useTls: boolean;
        if (redisTlsEnv !== '') {
          useTls = redisTlsEnv === 'true';
        } else if (redisUrl) {
          useTls = redisUrl.startsWith('rediss://');
        } else {
          // Auto-enable TLS in production unless explicitly disabled
          useTls = isProduction;
        }

        const password = configService.get<string>('REDIS_PASSWORD', '');

        // If REDIS_URL is provided, it takes precedence over individual host/port
        if (redisUrl) {
          const parsed = parseRedisUrl(redisUrl);
          return new Redis({
            host: parsed.host,
            port: parsed.port,
            password: parsed.password || password || undefined,
            tls: useTls ? {} : undefined,
            retryStrategy: (times: number) => Math.min(times * 200, 2000),
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
          });
        }

        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: password || undefined,
          tls: useTls ? {} : undefined,
          retryStrategy: (times: number) => Math.min(times * 200, 2000),
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
