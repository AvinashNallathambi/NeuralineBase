import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { RcmAutomationService } from './rcm-automation.service';
import { DenialPreventionService } from './denial-prevention.service';
import { RemittanceModule } from '../remittance/remittance.module';
import { DenialsModule } from '../denials/denials.module';
import { AppealsModule } from '../appeals/appeals.module';
import { UnderpaymentsModule } from '../underpayments/underpayments.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    RemittanceModule,
    DenialsModule,
    AppealsModule,
    UnderpaymentsModule,
    AiModule,
  ],
  controllers: [AutomationController],
  providers: [RcmAutomationService, DenialPreventionService],
  exports: [RcmAutomationService, DenialPreventionService],
})
export class AutomationModule {}
