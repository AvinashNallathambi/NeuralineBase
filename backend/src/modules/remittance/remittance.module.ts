import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemittanceController } from './remittance.controller';
import { RemittanceService } from './remittance.service';
import { RemittanceSeedService } from './remittance-seed.service';
import { X12Parser835 } from './x12-parser-835.service';
import { Remittance } from './entities/remittance.entity';
import { RemittanceClaim } from './entities/remittance-claim.entity';
import { RemittanceServiceLine } from './entities/remittance-service-line.entity';
import { ClaimAdjustment } from './entities/claim-adjustment.entity';
import { EOB } from './entities/eob.entity';
import { CarcCode } from './entities/carc-code.entity';
import { RarcCode } from './entities/rarc-code.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';
import { ClaimLineItem } from '../billing/entities/claim-line-item.entity';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Remittance,
      RemittanceClaim,
      RemittanceServiceLine,
      ClaimAdjustment,
      EOB,
      CarcCode,
      RarcCode,
      EncounterClaim,
      ClaimLineItem,
    ]),
    BillingModule,
  ],
  controllers: [RemittanceController],
  providers: [RemittanceService, RemittanceSeedService, X12Parser835],
  exports: [RemittanceService],
})
export class RemittanceModule {}
