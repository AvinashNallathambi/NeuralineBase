import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Health check module.
 *
 * Provides liveness and readiness probes for orchestration platforms.
 * The Redis health check depends on the global REDIS_CLIENT from RedisModule.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
