import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClinicalTemplate,
  ClinicalTemplateStatus,
} from './entities/clinical-template.entity';
import type { DeepPartial } from 'typeorm';

const SEED_TENANT_ID = '00000000-0000-0000-0000-000000000000';

function baseTemplate(partial: {
  name: string;
  specialty: string;
  visitType: string;
  description: string;
  icon?: string;
  department?: string;
  tags?: string[];
  encounterType?: string;
  visitReason?: string;
  chiefComplaint?: string;
  soapTemplate?: any;
  vitalsTemplate?: any;
  diagnosisTemplate?: any[];
  medicationTemplate?: any[];
  ordersTemplate?: any;
  treatmentPlanTemplate?: any;
  patientInstructions?: string;
  billingCodes?: any[];
  providerNotes?: string;
}): DeepPartial<ClinicalTemplate> {
  return {
    name: partial.name,
    specialty: partial.specialty,
    visitType: partial.visitType,
    description: partial.description,
    icon: partial.icon || 'FileTextOutlined',
    department: partial.department || null,
    tags: partial.tags || [],
    isDefault: false,
    isFavorite: false,
    usageCount: 0,
    status: ClinicalTemplateStatus.ACTIVE,
    encounterType: partial.encounterType || 'office_visit',
    visitReason: partial.visitReason || undefined,
    chiefComplaint: partial.chiefComplaint || undefined,
    soapTemplate: partial.soapTemplate || {},
    vitalsTemplate: partial.vitalsTemplate || {},
    diagnosisTemplate: partial.diagnosisTemplate || [],
    medicationTemplate: partial.medicationTemplate || [],
    ordersTemplate: partial.ordersTemplate || {},
    treatmentPlanTemplate: partial.treatmentPlanTemplate || {},
    patientInstructions: partial.patientInstructions || undefined,
    billingCodes: partial.billingCodes || [],
    providerNotes: partial.providerNotes || undefined,
    createdBy: null,
    createdByName: 'System',
  };
}

const SEED_TEMPLATES: DeepPartial<ClinicalTemplate>[] = [
  baseTemplate({
    name: 'Annual Physical',
    specialty: 'General Medicine',
    visitType: 'Annual Physical',
    description: 'Comprehensive annual wellness examination template',
    icon: 'FileTextOutlined',
    department: 'Primary Care',
    tags: ['preventive', 'annual', 'wellness'],
    visitReason: 'Annual preventive physical examination',
    chiefComplaint: 'Routine annual physical',
    soapTemplate: {
      subjective: 'Patient presents for routine annual physical. No acute complaints. Reports general well-being.',
      objective: 'Vital signs within normal limits. General physical exam unremarkable.',
      assessment: 'Healthy adult. Due for age-appropriate preventive screening.',
      plan: 'Continue current lifestyle. Order routine preventive labs. Update immunizations as needed.',
    },
    vitalsTemplate: { bloodPressure: '120/80', heartRate: '72', temperature: '98.6', respiratoryRate: '16', oxygenSaturation: '98%' },
    ordersTemplate: {
      labs: [
        { name: 'Comprehensive Metabolic Panel', priority: 'routine' },
        { name: 'Complete Blood Count', priority: 'routine' },
        { name: 'Lipid Panel', priority: 'routine' },
        { name: 'Hemoglobin A1c', priority: 'routine' },
      ],
    },
    treatmentPlanTemplate: {
      followUp: 'Follow up in 12 months for next annual physical.',
      patientEducation: ['Maintain balanced diet', '150 minutes of moderate exercise weekly'],
    },
    billingCodes: [
      { codeType: 'CPT', code: '99396', description: 'Periodic preventive medicine, established patient', isPrimary: true },
      { codeType: 'ICD10', code: 'Z00.00', description: 'General adult medical exam w/o abnormal findings' },
    ],
  }),
  baseTemplate({
    name: 'Follow-Up Visit',
    specialty: 'General Medicine',
    visitType: 'Follow-Up',
    description: 'Standard follow-up encounter for existing conditions',
    icon: 'FileTextOutlined',
    department: 'Primary Care',
    tags: ['follow-up', 'chronic'],
    visitReason: 'Follow-up for ongoing care',
    chiefComplaint: 'Follow-up visit',
    soapTemplate: {
      subjective: 'Patient returns for follow-up. Reports symptom progression since last visit.',
      objective: 'Vital signs stable. Focused exam of affected system.',
      assessment: 'Stable condition. Continue current management plan.',
      plan: 'Continue current medications. Reassess at next interval.',
    },
    treatmentPlanTemplate: { followUp: 'Follow up in 4 weeks.' },
    billingCodes: [{ codeType: 'CPT', code: '99213', description: 'Established patient office visit, low complexity', isPrimary: true }],
  }),
  baseTemplate({
    name: 'Urgent Care',
    specialty: 'Urgent Care',
    visitType: 'Urgent',
    description: 'Acute care visit for urgent symptoms',
    icon: 'FileTextOutlined',
    department: 'Urgent Care',
    tags: ['urgent', 'acute'],
    visitReason: 'Urgent care evaluation',
    chiefComplaint: 'Acute symptoms',
    soapTemplate: {
      subjective: 'Patient presents with acute symptoms requiring urgent evaluation.',
      objective: 'Vital signs evaluated. Focused exam of presenting complaint.',
      assessment: 'Acute condition requiring urgent care management.',
      plan: 'Provide symptomatic treatment and urgent workup as indicated.',
    },
    diagnosisTemplate: [{ code: 'R50.9', description: 'Fever, unspecified', isPrimary: true, type: 'acute', status: 'active' }],
    ordersTemplate: {
      labs: [{ name: 'Complete Blood Count', priority: 'stat' }, { name: 'Comprehensive Metabolic Panel', priority: 'stat' }],
    },
    treatmentPlanTemplate: { followUp: 'Return if symptoms worsen or do not improve within 48 hours.' },
    billingCodes: [{ codeType: 'CPT', code: '99213', description: 'Established patient office visit', isPrimary: true }],
  }),
  baseTemplate({
    name: 'Telehealth Visit',
    specialty: 'Telehealth',
    visitType: 'Video Visit',
    description: 'Virtual consultation template',
    icon: 'FileTextOutlined',
    department: 'Telehealth',
    tags: ['telehealth', 'virtual'],
    encounterType: 'telehealth',
    visitReason: 'Telehealth video visit',
    chiefComplaint: 'Telehealth visit',
    soapTemplate: {
      subjective: 'Patient connects via secure video. History obtained remotely.',
      objective: 'Limited remote exam based on patient self-assessment.',
      assessment: 'Telehealth visit. Assessment based on history and limited exam.',
      plan: 'Plan discussed with patient. In-person follow-up if needed.',
    },
    treatmentPlanTemplate: { followUp: 'Follow up as clinically indicated.' },
    billingCodes: [{ codeType: 'CPT', code: '99213', description: 'Established patient office visit', isPrimary: true }],
  }),
  baseTemplate({
    name: 'Mental Health Assessment',
    specialty: 'Behavioral Health',
    visitType: 'Initial Assessment',
    description: 'Behavioral health initial assessment',
    icon: 'FileTextOutlined',
    department: 'Behavioral Health',
    tags: ['behavioral health', 'mental health'],
    chiefComplaint: 'Mental health evaluation',
    soapTemplate: {
      subjective: 'Patient presents for mental health assessment. Mood, sleep, and functional status reviewed.',
      objective: 'Mental status exam: cooperative, no acute distress.',
      assessment: 'Behavioral health initial assessment.',
      plan: 'Initiate appropriate therapy and/or medication. Safety plan.',
    },
    diagnosisTemplate: [{ code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', isPrimary: true, type: 'acute', status: 'active' }],
    medicationTemplate: [{ name: 'Sertraline', dosage: '50 mg', frequency: 'Daily', route: 'oral', instructions: 'Take in the morning' }],
    treatmentPlanTemplate: {
      followUp: 'Follow up in 2 weeks to assess response.',
      interventions: ['Cognitive behavioral therapy', 'Sleep hygiene', 'Exercise program'],
    },
    billingCodes: [{ codeType: 'CPT', code: '90791', description: 'Psychiatric diagnostic evaluation', isPrimary: true }],
  }),
  baseTemplate({
    name: 'Diabetic Management',
    specialty: 'Primary Care',
    visitType: 'Follow-Up',
    description: 'Diabetes monitoring and management visit',
    icon: 'FileTextOutlined',
    department: 'Primary Care',
    tags: ['diabetes', 'chronic'],
    chiefComplaint: 'Diabetes follow-up',
    soapTemplate: {
      subjective: 'Patient with diabetes presents for routine management. Reports glucose logs and adherence.',
      objective: 'General exam unremarkable. No signs of complications.',
      assessment: 'Type 2 diabetes mellitus, assess glycemic control.',
      plan: 'Review A1c. Adjust medications as needed. Reinforce lifestyle.',
    },
    diagnosisTemplate: [{ code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', isPrimary: true, type: 'chronic', status: 'active' }],
    medicationTemplate: [{ name: 'Metformin', dosage: '1000 mg', frequency: 'Twice daily', route: 'oral', instructions: 'Take with meals' }],
    ordersTemplate: {
      labs: [{ name: 'Hemoglobin A1c', priority: 'routine' }, { name: 'Lipid Panel', priority: 'routine' }],
    },
    treatmentPlanTemplate: {
      goals: ['A1c < 7.0%', 'BP < 130/80'],
      interventions: ['Carbohydrate counting', '150 min/week exercise', 'Daily foot inspection'],
      followUp: 'Follow up in 3 months with repeat A1c.',
    },
    billingCodes: [{ codeType: 'CPT', code: '99213', description: 'Established patient office visit', isPrimary: true }],
  }),
];

@Injectable()
export class ClinicalTemplateSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClinicalTemplateSeedService.name);

  constructor(
    @InjectRepository(ClinicalTemplate)
    private readonly repository: Repository<ClinicalTemplate>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existingCount = await this.repository.count({
      where: { tenantId: SEED_TENANT_ID },
    });

    if (existingCount > 0) {
      this.logger.log(`Clinical templates already seeded (${existingCount}), skipping`);
      return;
    }

    const entities = SEED_TEMPLATES.map((seed) =>
      this.repository.create({ ...seed, tenantId: SEED_TENANT_ID }),
    );

    await this.repository.save(entities);
    this.logger.log(`Seeded ${entities.length} default clinical templates`);
  }
}
