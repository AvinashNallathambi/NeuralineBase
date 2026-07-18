import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperbillsService } from './superbills.service';
import { SuperbillsController } from './superbills.controller';
import { SuperbillAiController } from './superbill-ai.controller';
import { ClaimFormService } from './claim-form.service';
import { Superbill } from './entities/superbill.entity';
import { SuperbillDiagnosis } from './entities/superbill-diagnosis.entity';
import { SuperbillProcedure } from './entities/superbill-procedure.entity';
import { SuperbillCharge } from './entities/superbill-charge.entity';
import { SuperbillPayment } from './entities/superbill-payment.entity';
import { AiModule } from '../ai/ai.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Superbill,
      SuperbillDiagnosis,
      SuperbillProcedure,
      SuperbillCharge,
      SuperbillPayment,
    ]),
    AiModule,
    AuditLogsModule,
  ],
  controllers: [SuperbillsController, SuperbillAiController],
  providers: [SuperbillsService, ClaimFormService],
  exports: [SuperbillsService],
})
export class SuperbillsModule {}
