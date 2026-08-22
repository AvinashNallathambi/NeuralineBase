import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NsaController } from './nsa.controller';
import { NsaService } from './nsa.service';
import { NsaAiService } from './nsa-ai.service';
import { BusinessDayCalculator } from './business-day-calculator.service';
import { GoodFaithEstimate } from './entities/good-faith-estimate.entity';
import { NsaVarianceRecord } from './entities/nsa-variance-record.entity';
import { NsaIdrCase } from './entities/nsa-idr-case.entity';
import { NsaIdrDeadline } from './entities/nsa-idr-deadline.entity';
import { AiModule } from '../ai/ai.module';
import { SuperbillsModule } from '../superbills/superbills.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoodFaithEstimate,
      NsaVarianceRecord,
      NsaIdrCase,
      NsaIdrDeadline,
    ]),
    AiModule,
    SuperbillsModule,
  ],
  controllers: [NsaController],
  providers: [NsaService, NsaAiService, BusinessDayCalculator],
  exports: [NsaService, NsaAiService, BusinessDayCalculator],
})
export class NsaModule {}
