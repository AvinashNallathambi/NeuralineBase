import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TelemedicineController, PatientPortalTelemedicineController } from './telemedicine.controller';
import { TelemedicineGateway } from './telemedicine.gateway';
import { TelemedicineService } from './telemedicine.service';
import { TelemedicineSession } from './entities/telemedicine-session.entity';
import { TELEMEDICINE_PROVIDER } from './providers/telemedicine-provider.interface';
import { MockTelemedicineProvider } from './providers/mock-telemedicine.provider';
import { DailyCoTelemedicineProvider } from './providers/daily-co-telemedicine.provider';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ClinicalModule } from '../clinical/clinical.module';
import { SuperbillsModule } from '../superbills/superbills.module';
import { PatientsModule } from '../patients/patients.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelemedicineSession]),
    ConfigModule,
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
    ClinicalModule,
    SuperbillsModule,
    PatientsModule,
    AiModule,
  ],
  controllers: [TelemedicineController, PatientPortalTelemedicineController],
  providers: [
    TelemedicineService,
    TelemedicineGateway,
    {
      provide: TELEMEDICINE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const dailyApiKey = configService.get<string>('DAILY_API_KEY');
        if (dailyApiKey) {
          return new DailyCoTelemedicineProvider(configService);
        }
        return new MockTelemedicineProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [TelemedicineService],
})
export class TelemedicineModule {}
