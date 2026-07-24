import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ClinicalModule } from '../clinical/clinical.module';
import { SuperbillsModule } from '../superbills/superbills.module';
import { PatientsModule } from '../patients/patients.module';
import { AiModule } from '../ai/ai.module';
import { CommonModule } from '../../common/common.module';
import { TelemedicineSession } from './entities/telemedicine-session.entity';
import { TelemedicineService } from './telemedicine.service';
import { TelemedicineGateway } from './telemedicine.gateway';
import {
  TelemedicineController,
  PatientPortalTelemedicineController,
} from './telemedicine.controller';
import {
  TELEMEDICINE_PROVIDER,
  TelemedicineProvider,
} from './providers/telemedicine-provider.interface';
import { DailyCoTelemedicineProvider } from './providers/daily-co-telemedicine.provider';
import { MockTelemedicineProvider } from './providers/mock-telemedicine.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelemedicineSession]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default-secret'),
      }),
    }),
    IntegrationsModule,
    AppointmentsModule,
    ClinicalModule,
    SuperbillsModule,
    PatientsModule,
    AiModule,
    CommonModule,
  ],
  controllers: [TelemedicineController, PatientPortalTelemedicineController],
  providers: [
    TelemedicineService,
    TelemedicineGateway,
    {
      // Use Daily.co when DAILY_API_KEY is set; otherwise fall back to the mock
      // provider so the portal video-visit flow works in local development.
      provide: TELEMEDICINE_PROVIDER,
      inject: [ConfigService, DailyCoTelemedicineProvider, MockTelemedicineProvider],
      useFactory: (
        configService: ConfigService,
        daily: DailyCoTelemedicineProvider,
        mock: MockTelemedicineProvider,
      ): TelemedicineProvider => {
        const apiKey = configService.get<string>('DAILY_API_KEY');
        return apiKey ? daily : mock;
      },
    },
    DailyCoTelemedicineProvider,
    MockTelemedicineProvider,
  ],
  exports: [TelemedicineService],
})
export class TelemedicineModule {}
