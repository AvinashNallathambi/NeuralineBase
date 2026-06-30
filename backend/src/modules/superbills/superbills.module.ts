import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperbillsService } from './superbills.service';
import { SuperbillsController } from './superbills.controller';
import { SuperbillAiController } from './superbill-ai.controller';
import { Superbill } from './entities/superbill.entity';
import { SuperbillDiagnosis } from './entities/superbill-diagnosis.entity';
import { SuperbillProcedure } from './entities/superbill-procedure.entity';
import { SuperbillCharge } from './entities/superbill-charge.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Superbill,
      SuperbillDiagnosis,
      SuperbillProcedure,
      SuperbillCharge,
    ]),
    AiModule,
  ],
  controllers: [SuperbillsController, SuperbillAiController],
  providers: [SuperbillsService],
  exports: [SuperbillsService],
})
export class SuperbillsModule {}
