import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncounterController } from './encounter.controller';
import { EncounterService } from './encounter.service';
import { Encounter } from './entities/encounter.entity';
import { ClinicalTemplate } from './entities/clinical-template.entity';
import { ClinicalTemplateController } from './clinical-template.controller';
import { ClinicalTemplateService } from './clinical-template.service';
import { ClinicalTemplateSeedService } from './clinical-template-seed';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter, ClinicalTemplate])],
  controllers: [EncounterController, ClinicalTemplateController],
  providers: [EncounterService, ClinicalTemplateService, ClinicalTemplateSeedService],
  exports: [EncounterService, ClinicalTemplateService],
})
export class ClinicalModule {}
