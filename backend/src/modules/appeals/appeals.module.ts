import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppealsController } from './appeals.controller';
import { AppealsService } from './appeals.service';
import { AppealAiService } from './appeal-ai.service';
import { Appeal } from './entities/appeal.entity';
import { AppealStatusHistory } from './entities/appeal-status-history.entity';
import { DenialRecord } from '../denials/entities/denial-record.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';
import { ClaimLineItem } from '../billing/entities/claim-line-item.entity';
import { UnderpaymentRecord } from '../underpayments/entities/underpayment-record.entity';
import { AiModule } from '../ai/ai.module';
import { DenialsModule } from '../denials/denials.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appeal,
      AppealStatusHistory,
      DenialRecord,
      EncounterClaim,
      ClaimLineItem,
      UnderpaymentRecord,
    ]),
    AiModule,
    DenialsModule,
  ],
  controllers: [AppealsController],
  providers: [AppealsService, AppealAiService],
  exports: [AppealsService],
})
export class AppealsModule {}
