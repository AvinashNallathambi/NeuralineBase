import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientAuthController } from './patient-auth.controller';
import { PatientPortalController } from './patient-portal.controller';
import { PatientAiController } from './patient-ai.controller';
import { PatientAuthService } from './patient-auth.service';
import { PatientAiService } from './patient-ai.service';
import { PatientJwtStrategy } from './patient-jwt.strategy';
import { PatientJwtAuthGuard } from './patient-jwt-auth.guard';
import { Patient } from './entities/patient.entity';
import { PatientProblem } from './entities/patient-problem.entity';
import { PatientInsurance } from '../billing/entities/patient-insurance.entity';
import { InsurancePayer } from '../billing/entities/insurance-payer.entity';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PrescriptionsModule } from '../prescriptions/prescriptions.module';
import { LaboratoryModule } from '../laboratory/laboratory.module';
import { BillingModule } from '../billing/billing.module';
import { RemittanceModule } from '../remittance/remittance.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, PatientProblem, PatientInsurance, InsurancePayer]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '15m'),
        },
      }),
    }),
    AppointmentsModule,
    PrescriptionsModule,
    LaboratoryModule,
    BillingModule,
    RemittanceModule,
    AiModule,
  ],
  controllers: [PatientsController, PatientAuthController, PatientPortalController, PatientAiController],
  providers: [PatientsService, PatientAuthService, PatientAiService, PatientJwtStrategy, PatientJwtAuthGuard],
  exports: [PatientsService, PatientAuthService, PatientJwtAuthGuard],
})
export class PatientsModule {}
