import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncounterController } from './encounter.controller';
import { EncounterService } from './encounter.service';
import { EncounterOrderSyncService } from './encounter-order-sync.service';
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
import { LabOrder } from '../laboratory/entities/lab-order.entity';
import { LabTest } from '../laboratory/entities/lab-test.entity';
import { ImagingOrder } from '../laboratory/entities/imaging-order.entity';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { PatientMedication } from '../medications/entities/patient-medication.entity';
import { PatientAllergy } from '../patients/entities/patient-allergy.entity';
import { ClinicalTemplateController } from './clinical-template.controller';
import { ClinicalTemplateService } from './clinical-template.service';
import { ClinicalTemplateSeedService } from './clinical-template-seed';
import { AiModule } from '../ai/ai.module';
import { MessagingModule } from '../messaging/messaging.module';
import { LaboratoryModule } from '../laboratory/laboratory.module';
import { PrescriptionsModule } from '../prescriptions/prescriptions.module';
import { MedicationsModule } from '../medications/medications.module';
import { PatientsModule } from '../patients/patients.module';
import { ProvidersModule } from '../providers/providers.module';

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
      LabOrder,
      LabTest,
      ImagingOrder,
      Prescription,
      PatientMedication,
      PatientAllergy,
    ]),
    AiModule,
    MessagingModule,
    LaboratoryModule,
    PrescriptionsModule,
    MedicationsModule,
    PatientsModule,
    ProvidersModule,
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
    EncounterOrderSyncService,
    ClinicalTemplateService,
    ClinicalTemplateSeedService,
    DocumentationService,
    DocumentationIntelligenceService,
    DocumentationActionsService,
    DocumentationRevenueService,
  ],
  exports: [
    EncounterService,
    EncounterOrderSyncService,
    ClinicalTemplateService,
    DocumentationService,
    DocumentationIntelligenceService,
    DocumentationActionsService,
  ],
})
export class ClinicalModule {}
