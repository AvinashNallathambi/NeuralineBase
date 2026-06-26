import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { LaboratoryModule } from './modules/laboratory/laboratory.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TelemedicineModule } from './modules/telemedicine/telemedicine.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FhirModule } from './modules/fhir/fhir.module';
import { AiModule } from './modules/ai/ai.module';
import { EncryptionService } from './common/services/encryption.service';
import { HipaaAuditService } from './common/services/hipaa-audit.service';
import { PasswordPolicyService } from './common/services/password-policy.service';
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

    // Feature modules
    AuthModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    ClinicalModule,
    PrescriptionsModule,
    LaboratoryModule,
    BillingModule,
    NotificationsModule,
    TelemedicineModule,
    ReportsModule,
    FhirModule,
    AiModule,
  ],
  providers: [
    // HIPAA: Global services available to all modules
    EncryptionService,
    HipaaAuditService,
    PasswordPolicyService,
  ],
  exports: [EncryptionService, HipaaAuditService, PasswordPolicyService],
})
export class AppModule {}
