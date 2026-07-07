import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IcdCode } from './entities/icd-code.entity';
import { FavoriteDiagnosis } from './entities/favorite-diagnosis.entity';
import { PatientProblem } from '../patients/entities/patient-problem.entity';
import { Encounter } from '../clinical/entities/encounter.entity';
import { IcdCodeController } from './icd-code.controller';
import { IcdCodeService } from './icd-code.service';
import { IcdSeedService } from './icd-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([IcdCode, FavoriteDiagnosis, PatientProblem, Encounter])],
  controllers: [IcdCodeController],
  providers: [IcdCodeService, IcdSeedService],
  exports: [IcdCodeService],
})
export class IcdModule {}
