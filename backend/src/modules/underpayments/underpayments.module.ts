import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnderpaymentsController } from './underpayments.controller';
import { UnderpaymentsService } from './underpayments.service';
import { PayerContract } from './entities/payer-contract.entity';
import { UnderpaymentRecord } from './entities/underpayment-record.entity';
import { RemittanceClaim } from '../remittance/entities/remittance-claim.entity';
import { RemittanceServiceLine } from '../remittance/entities/remittance-service-line.entity';
import { Remittance } from '../remittance/entities/remittance.entity';
import { EncounterClaim } from '../billing/entities/encounter-claim.entity';
import { RemittanceModule } from '../remittance/remittance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayerContract,
      UnderpaymentRecord,
      RemittanceClaim,
      RemittanceServiceLine,
      Remittance,
      EncounterClaim,
    ]),
    RemittanceModule,
  ],
  controllers: [UnderpaymentsController],
  providers: [UnderpaymentsService],
  exports: [UnderpaymentsService],
})
export class UnderpaymentsModule {}
