import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EligibilityController } from './eligibility.controller';
import { EligibilityAiController } from './eligibility-ai.controller';
import { EligibilityService } from './eligibility.service';
import { EligibilityAiService } from './eligibility-ai.service';
import { EligibilityProcessor } from './eligibility.processor';
import { EligibilitySchedulerService } from './eligibility-scheduler.service';
import { InsuranceVerification } from './entities/insurance-verification.entity';
import { PatientInsurance } from '../billing/entities/patient-insurance.entity';
import { MockEligibilityProvider } from './providers/mock-eligibility.provider';
import { StediEligibilityProvider } from './providers/stedi-eligibility.provider';
import { ELIGIBILITY_PROVIDER } from './providers/eligibility-provider.interface';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InsuranceVerification, PatientInsurance]),
    BullModule.registerQueue({ name: 'eligibility' }),
    ConfigModule,
    AiModule,
  ],
  controllers: [EligibilityController, EligibilityAiController],
  providers: [
    EligibilityService,
    EligibilityAiService,
    EligibilityProcessor,
    EligibilitySchedulerService,
    {
      provide: ELIGIBILITY_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const stediKey = configService.get<string>('STEDI_API_KEY');
        if (stediKey) {
          return new StediEligibilityProvider(configService);
        }
        return new MockEligibilityProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [EligibilityService],
})
export class EligibilityModule {}
