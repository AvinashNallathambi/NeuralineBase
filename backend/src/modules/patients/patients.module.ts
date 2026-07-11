import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { PatientProblem } from './entities/patient-problem.entity';
import { PatientInsurance } from '../billing/entities/patient-insurance.entity';
import { InsurancePayer } from '../billing/entities/insurance-payer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, PatientProblem, PatientInsurance, InsurancePayer])],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
