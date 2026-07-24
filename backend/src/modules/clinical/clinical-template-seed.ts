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
  // ---------------- Cardiology ----------------
  baseTemplate({
    name: 'Hypertension Follow-Up',
    specialty: 'Cardiology',
    visitType: 'Follow-Up',
    description: 'Routine hypertension management and titration visit',
    icon: 'HeartOutlined',
    department: 'Cardiology',
    tags: ['cardiology', 'hypertension', 'chronic'],
    chiefComplaint: 'High blood pressure follow-up',
    soapTemplate: {
      subjective: 'Patient with known hypertension returns for follow-up. Reports home BP logs, adherence, and any side effects.',
      objective: 'BP elevated on today\'s reading. Cardiac exam regular rate and rhythm, no murmurs. No edema. No signs of end-organ damage.',
      assessment: 'Essential hypertension. Assess control and adjust regimen as needed.',
      plan: 'Review home BP log. Titrate antihypertensive. Reinforce sodium restriction and weight management. Recheck labs.',
    },
    vitalsTemplate: { bloodPressure: '150/92', heartRate: '78', respiratoryRate: '16', oxygenSaturation: '98%' },
    diagnosisTemplate: [{ code: 'I10', description: 'Essential (primary) hypertension', isPrimary: true, type: 'chronic', status: 'active' }],
    medicationTemplate: [
      { name: 'Lisinopril', dosage: '20 mg', frequency: 'Daily', route: 'oral', instructions: 'Take in the morning' },
      { name: 'Amlodipine', dosage: '5 mg', frequency: 'Daily', route: 'oral', instructions: 'Take in the evening' },
    ],
    ordersTemplate: {
      labs: [
        { name: 'Basic Metabolic Panel', priority: 'routine' },
        { name: 'Urinalysis', priority: 'routine' },
      ],
      imaging: [{ name: 'Echocardiogram', modality: 'TTE', bodyPart: 'heart', priority: 'routine' }],
    },
    treatmentPlanTemplate: {
      goals: ['BP < 130/80 mmHg', 'Sodium < 1500 mg/day'],
      interventions: ['DASH diet', '150 min/week aerobic exercise', 'Home BP monitoring twice daily'],
      patientEducation: ['Take medications consistently', 'Avoid NSAIDs which can raise BP'],
      followUp: 'Follow up in 4 weeks with home BP log.',
    },
    billingCodes: [
      { codeType: 'CPT', code: '99213', description: 'Established patient office visit, low complexity', isPrimary: true },
      { codeType: 'ICD10', code: 'I10', description: 'Essential (primary) hypertension' },
    ],
  }),
  baseTemplate({
    name: 'Atrial Fibrillation Follow-Up',
    specialty: 'Cardiology',
    visitType: 'Follow-Up',
    description: 'Atrial fibrillation management, rate/rhythm control and anticoagulation review',
    icon: 'HeartOutlined',
    department: 'Cardiology',
    tags: ['cardiology', 'arrhythmia', 'afib', 'chronic', 'anticoagulation'],
    chiefComplaint: 'Atrial fibrillation follow-up',
    soapTemplate: {
      subjective: 'Patient with atrial fibrillation returns for follow-up. Reports palpitations, exercise tolerance, bleeding symptoms, and medication adherence.',
      objective: 'Irregularly irregular pulse. Cardiac exam no murmurs. No signs of heart failure. INR/anticoagulation review.',
      assessment: 'Persistent atrial fibrillation. Assess rate control, rhythm strategy, and stroke prevention.',
      plan: 'Review rate vs. rhythm control strategy. Assess CHA2DS2-VASc and HAS-BLED. Adjust anticoagulation. Consider cardiology EP referral if symptomatic.',
    },
    vitalsTemplate: { bloodPressure: '128/78', heartRate: '88', respiratoryRate: '16', oxygenSaturation: '98%' },
    diagnosisTemplate: [
      { code: 'I48.91', description: 'Unspecified atrial fibrillation', isPrimary: true, type: 'chronic', status: 'active' },
    ],
    medicationTemplate: [
      { name: 'Metoprolol Succinate', dosage: '50 mg', frequency: 'Daily', route: 'oral', instructions: 'Take with food' },
      { name: 'Apixaban', dosage: '5 mg', frequency: 'Twice daily', route: 'oral', instructions: 'Take with or without food' },
    ],
    ordersTemplate: {
      labs: [
        { name: 'Basic Metabolic Panel', priority: 'routine' },
        { name: 'PT/INR', priority: 'routine', notes: 'If on warfarin' },
        { name: 'Thyroid Stimulating Hormone', priority: 'routine' },
      ],
      imaging: [{ name: 'Echocardiogram', modality: 'TTE', bodyPart: 'heart', priority: 'routine' }],
      procedures: [{ name: 'Electrocardiogram (ECG)', cptCode: '93000', description: '12-lead ECG' }],
    },
    treatmentPlanTemplate: {
      goals: ['Resting HR 60-80 bpm', 'Stroke prevention per CHA2DS2-VASc'],
      interventions: ['Stroke risk stratification', 'Rate control with beta-blocker', 'Anticoagulation adherence'],
      patientEducation: ['Report signs of stroke (FAST)', 'Monitor for bleeding', 'Avoid excessive alcohol'],
      followUp: 'Follow up in 3 months or sooner if symptomatic.',
    },
    billingCodes: [
      { codeType: 'CPT', code: '99214', description: 'Established patient office visit, moderate complexity', isPrimary: true },
      { codeType: 'CPT', code: '93000', description: 'Electrocardiogram, routine ECG with at least 12 leads' },
      { codeType: 'ICD10', code: 'I48.91', description: 'Unspecified atrial fibrillation' },
    ],
  }),
  baseTemplate({
    name: 'CHF Management',
    specialty: 'Cardiology',
    visitType: 'Follow-Up',
    description: 'Chronic heart failure management, volume status and GDMT optimization',
    icon: 'HeartOutlined',
    department: 'Cardiology',
    tags: ['cardiology', 'heart failure', 'chronic', 'GDMT'],
    chiefComplaint: 'Heart failure follow-up',
    soapTemplate: {
      subjective: 'Patient with heart failure returns for follow-up. Reports dyspnea, orthopnea, edema, weight, and exercise tolerance.',
      objective: 'Assess volume status, JVP, lung sounds, lower extremity edema. Weight trend reviewed.',
      assessment: 'Chronic heart failure. Assess NYHA class, volume status, and GDMT optimization.',
      plan: 'Adjust diuretics based on volume status. Optimize GDMT (beta-blocker, ACEi/ARB/ARNI, MRA, SGLT2i). Reinforce daily weights and sodium restriction.',
    },
    vitalsTemplate: { bloodPressure: '118/72', heartRate: '72', respiratoryRate: '18', oxygenSaturation: '96%', weight: '180 lb' },
    diagnosisTemplate: [
      { code: 'I50.9', description: 'Heart failure, unspecified', isPrimary: true, type: 'chronic', status: 'active' },
    ],
    medicationTemplate: [
      { name: 'Carvedilol', dosage: '12.5 mg', frequency: 'Twice daily', route: 'oral', instructions: 'Take with food' },
      { name: 'Lisinopril', dosage: '20 mg', frequency: 'Daily', route: 'oral', instructions: 'Take in the morning' },
      { name: 'Furosemide', dosage: '40 mg', frequency: 'Daily', route: 'oral', instructions: 'Take in the morning' },
      { name: 'Spironolactone', dosage: '25 mg', frequency: 'Daily', route: 'oral', instructions: 'Take with food' },
    ],
    ordersTemplate: {
      labs: [
        { name: 'Basic Metabolic Panel', priority: 'routine' },
        { name: 'BNP or NT-proBNP', priority: 'routine' },
        { name: 'Complete Blood Count', priority: 'routine' },
      ],
      imaging: [{ name: 'Echocardiogram', modality: 'TTE', bodyPart: 'heart', priority: 'routine' }],
    },
    treatmentPlanTemplate: {
      goals: ['Euvolemia', 'NYHA class I-II', 'GDMT at target doses'],
      interventions: ['Daily weights — call if >2 lb/day or >5 lb/week', 'Sodium < 2000 mg/day', 'Fluid restriction if indicated'],
      patientEducation: ['Recognize worsening HF signs', 'Adhere to GDMT', 'Avoid NSAIDs'],
      followUp: 'Follow up in 2 weeks; sooner if weight gain or symptoms worsen.',
    },
    billingCodes: [
      { codeType: 'CPT', code: '99214', description: 'Established patient office visit, moderate complexity', isPrimary: true },
      { codeType: 'ICD10', code: 'I50.9', description: 'Heart failure, unspecified' },
    ],
  }),
  baseTemplate({
    name: 'Chest Pain Evaluation',
    specialty: 'Cardiology',
    visitType: 'Urgent',
    description: 'Acute chest pain risk stratification and workup',
    icon: 'HeartOutlined',
    department: 'Cardiology',
    tags: ['cardiology', 'chest pain', 'acute', 'urgent'],
    chiefComplaint: 'Chest pain',
    soapTemplate: {
      subjective: 'Patient presents with chest pain. Characterize onset, duration, quality, radiation, aggravators/relievers, associated symptoms, and cardiac risk factors.',
      objective: 'Vital signs, cardiac and pulmonary exam. Assess for signs of instability.',
      assessment: 'Chest pain — risk stratify using HEART score. Rule out ACS, PE, aortic dissection.',
      plan: 'ECG, cardiac biomarkers, consider chest X-ray and CT angiography. Admit if high-risk.',
    },
    vitalsTemplate: { bloodPressure: '140/88', heartRate: '96', respiratoryRate: '20', oxygenSaturation: '97%', painScore: 6, painLocation: 'substernal' },
    diagnosisTemplate: [
      { code: 'R07.9', description: 'Chest pain, unspecified', isPrimary: true, type: 'acute', status: 'active' },
    ],
    ordersTemplate: {
      labs: [
        { name: 'Troponin I', priority: 'stat', notes: 'Serial at 0 and 3 hours' },
        { name: 'Complete Blood Count', priority: 'stat' },
        { name: 'Basic Metabolic Panel', priority: 'stat' },
        { name: 'D-dimer', priority: 'stat', notes: 'If PE suspected and low risk' },
      ],
      imaging: [
        { name: 'Chest X-Ray', modality: 'XR', bodyPart: 'chest', priority: 'stat' },
        { name: 'CT Angiography Chest', modality: 'CTA', bodyPart: 'chest', priority: 'stat', notes: 'If PE or dissection suspected' },
      ],
      procedures: [{ name: 'Electrocardiogram (ECG)', cptCode: '93000', description: '12-lead ECG within 10 minutes of arrival' }],
    },
    treatmentPlanTemplate: {
      interventions: ['Aspirin 325 mg chewed if ACS suspected and no contraindication', 'Continuous cardiac monitoring', 'IV access'],
      patientEducation: ['Return immediately if pain worsens, syncope, or shortness of breath'],
      followUp: 'If discharged: follow up in 48-72 hours. If high HEART score: admit for observation.',
    },
    billingCodes: [
      { codeType: 'CPT', code: '99284', description: 'Emergency department visit, moderate complexity', isPrimary: true },
      { codeType: 'CPT', code: '93000', description: 'Electrocardiogram, routine ECG with at least 12 leads' },
      { codeType: 'ICD10', code: 'R07.9', description: 'Chest pain, unspecified' },
    ],
  }),
  baseTemplate({
    name: 'Post-MI Follow-Up',
    specialty: 'Cardiology',
    visitType: 'Follow-Up',
    description: 'Post-myocardial infarction recovery and secondary prevention visit',
    icon: 'HeartOutlined',
    department: 'Cardiology',
    tags: ['cardiology', 'MI', 'post-MI', 'secondary prevention', 'chronic'],
    chiefComplaint: 'Follow-up after heart attack',
    soapTemplate: {
      subjective: 'Patient status post myocardial infarction returns for follow-up. Reports chest pain, dyspnea, exercise tolerance, medication adherence, and cardiac rehab participation.',
      objective: 'Vital signs stable. Cardiac exam unremarkable. Post-MI wound/vascular access site assessment if recent PCI.',
      assessment: 'Status post MI. Assess recovery, secondary prevention therapy, and cardiac rehabilitation.',
      plan: 'Optimize dual antiplatelet therapy, statin, beta-blocker, ACEi. Refer to cardiac rehab. Reinforce lifestyle modification.',
    },
    vitalsTemplate: { bloodPressure: '124/76', heartRate: '68', respiratoryRate: '16', oxygenSaturation: '98%' },
    diagnosisTemplate: [
      { code: 'I25.2', description: 'Old myocardial infarction', isPrimary: true, type: 'chronic', status: 'active' },
    ],
    medicationTemplate: [
      { name: 'Aspirin', dosage: '81 mg', frequency: 'Daily', route: 'oral', instructions: 'Take with food' },
      { name: 'Clopidogrel', dosage: '75 mg', frequency: 'Daily', route: 'oral', instructions: 'Take at same time daily' },
      { name: 'Atorvastatin', dosage: '80 mg', frequency: 'Daily', route: 'oral', instructions: 'Take in the evening' },
      { name: 'Metoprolol Succinate', dosage: '50 mg', frequency: 'Daily', route: 'oral', instructions: 'Take with food' },
    ],
    ordersTemplate: {
      labs: [
        { name: 'Lipid Panel', priority: 'routine' },
        { name: 'Basic Metabolic Panel', priority: 'routine' },
        { name: 'Hemoglobin A1c', priority: 'routine' },
      ],
      imaging: [{ name: 'Echocardiogram', modality: 'TTE', bodyPart: 'heart', priority: 'routine' }],
      referrals: [{ specialty: 'Cardiac Rehabilitation', reason: 'Structured exercise and secondary prevention program', urgency: 'routine' }],
    },
    treatmentPlanTemplate: {
      goals: ['LDL < 70 mg/dL', 'BP < 130/80', 'Complete cardiac rehab program'],
      interventions: ['Mediterranean diet', 'Cardiac rehab 36 sessions', 'Smoking cessation if applicable', 'Stress management'],
      patientEducation: ['Recognize recurrent ischemia symptoms', 'Adhere to DAPT duration', 'Statins reduce recurrent events'],
      followUp: 'Follow up in 4 weeks; repeat lipid panel in 6-12 weeks.',
    },
    billingCodes: [
      { codeType: 'CPT', code: '99214', description: 'Established patient office visit, moderate complexity', isPrimary: true },
      { codeType: 'ICD10', code: 'I25.2', description: 'Old myocardial infarction' },
    ],
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
