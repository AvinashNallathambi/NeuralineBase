import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationsController } from './medications.controller';
import { MedicationsService } from './medications.service';
import { OpenFDAService } from './openfda.service';
import { DailyMedService } from './dailymed.service';
import { PatientMedicationsController } from './patient-medications.controller';
import { PatientMedicationsService } from './patient-medications.service';
import { PatientMedication } from './entities/patient-medication.entity';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule, TypeOrmModule.forFeature([PatientMedication])],
  controllers: [MedicationsController, PatientMedicationsController],
  providers: [MedicationsService, OpenFDAService, DailyMedService, PatientMedicationsService],
  exports: [MedicationsService, OpenFDAService, DailyMedService, PatientMedicationsService],
})
export class MedicationsModule {}
