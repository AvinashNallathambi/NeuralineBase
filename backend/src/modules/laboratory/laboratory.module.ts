import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaboratoryController } from './laboratory.controller';
import { LaboratoryService } from './laboratory.service';
import { LaboratoryAiService } from './laboratory-ai.service';
import { LabSeedService } from './lab-seed.service';
import { LabOrder } from './entities/lab-order.entity';
import { LabTest } from './entities/lab-test.entity';
import { LabResult } from './entities/lab-result.entity';
import { Specimen } from './entities/specimen.entity';
import { LabPanel } from './entities/lab-panel.entity';
import { ReferenceRange } from './entities/reference-range.entity';
import { ImagingOrder } from './entities/imaging-order.entity';
import { LabOrderStatusHistory } from './entities/lab-order-status-history.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabOrder,
      LabTest,
      LabResult,
      Specimen,
      LabPanel,
      ReferenceRange,
      ImagingOrder,
      LabOrderStatusHistory,
    ]),
    AiModule,
  ],
  controllers: [LaboratoryController],
  providers: [LaboratoryService, LaboratoryAiService, LabSeedService],
  exports: [LaboratoryService],
})
export class LaboratoryModule {}
