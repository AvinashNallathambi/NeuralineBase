import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImmunizationsController } from './immunizations.controller';
import { ImmunizationsService } from './immunizations.service';
import { VaccineInventoryService } from './vaccine-inventory.service';
import { PatientImmunization } from './entities/patient-immunization.entity';
import { VaccineInventory } from './entities/vaccine-inventory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PatientImmunization, VaccineInventory])],
  controllers: [ImmunizationsController],
  providers: [ImmunizationsService, VaccineInventoryService],
  exports: [ImmunizationsService, VaccineInventoryService],
})
export class ImmunizationsModule {}
