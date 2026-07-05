import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncounterController } from './encounter.controller';
import { EncounterService } from './encounter.service';
import { Encounter } from './entities/encounter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter])],
  controllers: [EncounterController],
  providers: [EncounterService],
  exports: [EncounterService],
})
export class ClinicalModule {}
