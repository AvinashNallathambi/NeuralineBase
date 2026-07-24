import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncounterController } from './encounter.controller';
import { EncounterService } from './encounter.service';
import { DocumentationController } from './documentation.controller';
import { DocumentationIntelligenceController } from './documentation-intelligence.controller';
import { DocumentationActionsController } from './documentation-actions.controller';
import { DocumentationRevenueController } from './documentation-revenue.controller';
import { DocumentationService } from './documentation.service';
import { DocumentationIntelligenceService } from './documentation-intelligence.service';
import { DocumentationActionsService } from './documentation-actions.service';
import { DocumentationRevenueService } from './documentation-revenue.service';
import { Encounter } from './entities/encounter.entity';
import { ClinicalTemplate } from './entities/clinical-template.entity';
import { DocumentationSession } from './entities/documentation-session.entity';
import { DocumentationNoteVersion } from './entities/documentation-note-version.entity';
import { DocumentationPreference } from './entities/documentation-preference.entity';
import { DocumentationEvidence } from './entities/documentation-evidence.entity';
import { DocumentationSuggestion } from './entities/documentation-suggestion.entity';
import { DenialRecord } from '../denials/entities/denial-record.entity';
import { UnderpaymentRecord } from '../underpayments/entities/underpayment-record.entity';
import { PatientInsurance } from '../billing/entities/patient-insurance.entity';
import { InsurancePayer } from '../billing/entities/insurance-payer.entity';
import { ClinicalTemplateController } from './clinical-template.controller';
import { ClinicalTemplateService } from './clinical-template.service';
import { ClinicalTemplateSeedService } from './clinical-template-seed';
import { AiModule } from '../ai/ai.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter,
      ClinicalTemplate,
      DocumentationSession,
      DocumentationNoteVersion,
      DocumentationPreference,
      DocumentationEvidence,
      DocumentationSuggestion,
      DenialRecord,
      UnderpaymentRecord,
      PatientInsurance,
      InsurancePayer,
    ]),
    AiModule,
    MessagingModule,
  ],
  controllers: [
    EncounterController,
    ClinicalTemplateController,
    DocumentationController,
    DocumentationIntelligenceController,
    DocumentationActionsController,
    DocumentationRevenueController,
  ],
  providers: [
    EncounterService,
    ClinicalTemplateService,
    ClinicalTemplateSeedService,
    DocumentationService,
    DocumentationIntelligenceService,
    DocumentationActionsService,
    DocumentationRevenueService,
  ],
  exports: [
    EncounterService,
    ClinicalTemplateService,
    DocumentationService,
    DocumentationIntelligenceService,
    DocumentationActionsService,
  ],
})
export class ClinicalModule {}
