import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DenialsController } from './denials.controller';
import { DenialsService } from './denials.service';
import { DenialCategoryEngine } from './denial-category-engine';
import { DenialAiService } from './denial-ai.service';
import { DenialSchedulerService } from './denial-scheduler.service';
import { DenialDeadlineProcessor } from './denial-deadline.processor';
import { DenialRecord } from './entities/denial-record.entity';
import { ClaimAdjustment } from '../remittance/entities/claim-adjustment.entity';
import { RemittanceClaim } from '../remittance/entities/remittance-claim.entity';
import { Remittance } from '../remittance/entities/remittance.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';
import { CarcCode } from '../remittance/entities/carc-code.entity';
import { RarcCode } from '../remittance/entities/rarc-code.entity';
import { RemittanceModule } from '../remittance/remittance.module';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DenialRecord,
      ClaimAdjustment,
      RemittanceClaim,
      Remittance,
      EncounterClaim,
      CarcCode,
      RarcCode,
    ]),
    forwardRef(() => RemittanceModule),
    AiModule,
    NotificationsModule,
    BullModule.registerQueue({ name: 'denials' }),
  ],
  controllers: [DenialsController],
  providers: [DenialsService, DenialCategoryEngine, DenialAiService, DenialSchedulerService, DenialDeadlineProcessor],
  exports: [DenialsService, DenialCategoryEngine, DenialAiService],
})
export class DenialsModule {}
