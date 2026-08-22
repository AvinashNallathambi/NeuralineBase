import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityMeasuresController } from './quality-measures.controller';
import { QualityMeasuresService } from './quality-measures.service';
import { QualityMeasureResult } from './entities/quality-measure-result.entity';
import { PatientsModule } from '../patients/patients.module';
import { MedicationsModule } from '../medications/medications.module';
import { LaboratoryModule } from '../laboratory/laboratory.module';
import { ClinicalModule } from '../clinical/clinical.module';
import { AiModule } from '../ai/ai.module';
import { ImmunizationsModule } from '../immunizations/immunizations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QualityMeasureResult]),
    PatientsModule,
    MedicationsModule,
    LaboratoryModule,
    ClinicalModule,
    AiModule,
    ImmunizationsModule,
  ],
  controllers: [QualityMeasuresController],
  providers: [QualityMeasuresService],
  exports: [QualityMeasuresService],
})
export class QualityMeasuresModule {}
