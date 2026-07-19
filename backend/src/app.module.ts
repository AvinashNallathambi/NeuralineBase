import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { LaboratoryModule } from './modules/laboratory/laboratory.module';
import { BillingModule } from './modules/billing/billing.module';
import { RemittanceModule } from './modules/remittance/remittance.module';
import { DenialsModule } from './modules/denials/denials.module';
import { AppealsModule } from './modules/appeals/appeals.module';
import { UnderpaymentsModule } from './modules/underpayments/underpayments.module';
import { AutomationModule } from './modules/automation/automation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TelemedicineModule } from './modules/telemedicine/telemedicine.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FhirModule } from './modules/fhir/fhir.module';
import { AiModule } from './modules/ai/ai.module';
import { SuperbillsModule } from './modules/superbills/superbills.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { IcdModule } from './modules/icd/icd.module';
import { CptModule } from './modules/cpt/cpt.module';
import { EligibilityModule } from './modules/eligibility/eligibility.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { MedicationsModule } from './modules/medications/medications.module';
import { PharmaciesModule } from './modules/pharmacies/pharmacies.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TrialsModule } from './modules/trials/trials.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';
import { RedisModule, REDIS_CLIENT } from './common/redis/redis.module';
import { EncryptionService } from './common/services/encryption.service';
import { HipaaAuditService } from './common/services/hipaa-audit.service';
import { PasswordPolicyService } from './common/services/password-policy.service';
import { TenantWipeService } from './common/services/tenant-wipe.service';
import { HipaaAuditLog } from './common/entities/hipaa-audit-log.entity';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbSsl = configService.get<string>('DB_SSL', 'false') === 'true';
        const dbLogging = configService.get<string>('DB_LOGGING', 'false') === 'true';
        const dbSync = configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true';
        return {
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'neuraline'),
        password: configService.get<string>('DB_PASSWORD', 'neuraline_dev'),
        database: configService.get<string>('DB_DATABASE', 'neuraline'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: dbSync,
        // HIPAA: Disable query logging to prevent PHI leakage in logs
        logging: configService.get<string>('NODE_ENV') === 'production'
          ? false
          : dbLogging,
        ssl: dbSsl
          ? { rejectUnauthorized: configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED', 'true') === 'true' }
          : false,
        autoLoadEntities: true,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: false,
      };
      },
    }),

    // HIPAA: Audit log entity registration
    TypeOrmModule.forFeature([HipaaAuditLog]),

    // Global common services (TenantWipeService, EncryptionService, etc.)
    CommonModule,

    // Shared Redis client (global) — used by TokenBlacklistService and
    // future Redis-backed features. Bull still manages its own internal
    // client via BullModule below.
    RedisModule,

    // Redis / Bull queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', ''),
        },
      }),
    }),

    // HIPAA: Distributed rate limiting via @nestjs/throttler backed by Redis.
    // All backend instances share the same counters, so rate limits are
    // enforced globally (not per-instance). This prevents brute-force attacks
    // from bypassing limits by hitting different replicas behind a load balancer.
    // The shared REDIS_CLIENT is injected so we don't open a second connection.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT, ConfigService],
      useFactory: (redis: Redis, configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    ClinicalModule,
    PrescriptionsModule,
    LaboratoryModule,
    BillingModule,
    RemittanceModule,
    DenialsModule,
    AppealsModule,
    UnderpaymentsModule,
    AutomationModule,
    NotificationsModule,
    TelemedicineModule,
    ReportsModule,
    FhirModule,
    AiModule,
    SuperbillsModule,
    WorkflowModule,
    IcdModule,
    CptModule,
    EligibilityModule,
    IntegrationsModule,
    MedicationsModule,
    PharmaciesModule,
    ProvidersModule,
    MessagingModule,
    SubscriptionsModule,
    TrialsModule,
    HealthModule,
  ],
  providers: [
    // HIPAA: Global services available to all modules
    EncryptionService,
    HipaaAuditService,
    PasswordPolicyService,
    TenantWipeService,
    // HIPAA: Global rate-limit guard — enforces @nestjs/throttler limits on
    // every endpoint by default. Use @SkipThrottle() to opt out of specific
    // routes, or @Throttle() to apply stricter limits to sensitive endpoints.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [EncryptionService, HipaaAuditService, PasswordPolicyService, TenantWipeService],
})
export class AppModule {}
