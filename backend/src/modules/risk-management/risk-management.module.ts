import { Module } from '@nestjs/common';
import { RiskManagementController } from './risk-management.controller';
import { RiskManagementService } from './risk-management.service';
import { PatientsModule } from '../patients/patients.module';
import { MedicationsModule } from '../medications/medications.module';
import { LaboratoryModule } from '../laboratory/laboratory.module';
import { ClinicalModule } from '../clinical/clinical.module';
import { AiModule } from '../ai/ai.module';
import { EpcsModule } from '../epcs/epcs.module';
import { ImmunizationsModule } from '../immunizations/immunizations.module';

@Module({
  imports: [
    PatientsModule,
    MedicationsModule,
    LaboratoryModule,
    ClinicalModule,
    AiModule,
    EpcsModule,
    ImmunizationsModule,
  ],
  controllers: [RiskManagementController],
  providers: [RiskManagementService],
  exports: [RiskManagementService],
})
export class RiskManagementModule {}
