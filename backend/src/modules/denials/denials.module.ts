import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DenialsController } from './denials.controller';
import { DenialsService } from './denials.service';
import { DenialCategoryEngine } from './denial-category-engine';
import { DenialAiService } from './denial-ai.service';
import { DenialRecord } from './entities/denial-record.entity';
import { ClaimAdjustment } from '../remittance/entities/claim-adjustment.entity';
import { RemittanceClaim } from '../remittance/entities/remittance-claim.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';
import { CarcCode } from '../remittance/entities/carc-code.entity';
import { RarcCode } from '../remittance/entities/rarc-code.entity';
import { RemittanceModule } from '../remittance/remittance.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DenialRecord,
      ClaimAdjustment,
      RemittanceClaim,
      EncounterClaim,
      CarcCode,
      RarcCode,
    ]),
    RemittanceModule,
    AiModule,
  ],
  controllers: [DenialsController],
  providers: [DenialsService, DenialCategoryEngine, DenialAiService],
  exports: [DenialsService, DenialCategoryEngine, DenialAiService],
})
export class DenialsModule {}
