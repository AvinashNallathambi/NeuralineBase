import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionRefill } from './entities/prescription-refill.entity';
import { PrescriptionStatusHistory } from './entities/prescription-status-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      PrescriptionRefill,
      PrescriptionStatusHistory,
    ]),
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
