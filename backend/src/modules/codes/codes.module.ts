import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IcdCode } from '../icd/entities/icd-code.entity';
import { CptCode } from '../cpt/entities/cpt-code.entity';
import { PatientProblem } from '../patients/entities/patient-problem.entity';
import { FavoriteDiagnosis } from '../icd/entities/favorite-diagnosis.entity';
import { Encounter } from '../clinical/entities/encounter.entity';
import { CodesController } from './codes.controller';
import { CodesService } from './codes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IcdCode, CptCode, PatientProblem, FavoriteDiagnosis, Encounter]),
  ],
  controllers: [CodesController],
  providers: [CodesService],
  exports: [CodesService],
})
export class CodesModule {}
