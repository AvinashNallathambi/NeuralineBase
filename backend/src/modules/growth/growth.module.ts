import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrowthController } from './growth.controller';
import { GrowthChartService } from './growth-chart.service';
import { GrowthPercentileService } from './growth-percentile.service';
import { Encounter } from '../clinical/entities/encounter.entity';
import { Patient } from '../patients/entities/patient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter, Patient])],
  controllers: [GrowthController],
  providers: [GrowthChartService, GrowthPercentileService],
  exports: [GrowthChartService, GrowthPercentileService],
})
export class GrowthModule {}
