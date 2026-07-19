import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

/**
 * Health check endpoints for infrastructure dependencies.
 *
 * HIPAA §164.308(a)(7) Contingency Plan — operational monitoring:
 * These endpoints allow orchestration platforms (Kubernetes, Docker Swarm,
 * load balancers) to detect infrastructure degradation and route traffic
 * away from unhealthy instances. This prevents PHI access failures during
 * Redis outages.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('redis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check Redis connectivity and latency' })
  @ApiResponse({ status: 200, description: 'Redis is reachable' })
  @ApiResponse({ status: 503, description: 'Redis is unreachable' })
  async checkRedis(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    latencyMs: number | null;
    timestamp: string;
  }> {
    const start = Date.now();
    try {
      const result = await this.redis.ping();
      const latencyMs = Date.now() - start;
      if (result === 'PONG') {
        return {
          status: latencyMs < 100 ? 'ok' : 'degraded',
          latencyMs,
          timestamp: new Date().toISOString(),
        };
      }
      return {
        status: 'down',
        latencyMs: null,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'down',
        latencyMs: null,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Overall health check (liveness probe)' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async checkLiveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }
}
