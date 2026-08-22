import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FhirController } from './fhir.controller';
import { FhirService } from './fhir.service';
import { PatientsModule } from '../patients/patients.module';
import { PatientImmunization } from '../immunizations/entities/patient-immunization.entity';
import { Encounter } from '../clinical/entities/encounter.entity';

@Module({
  imports: [PatientsModule, TypeOrmModule.forFeature([PatientImmunization, Encounter])],
  controllers: [FhirController],
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
