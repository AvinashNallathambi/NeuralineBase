import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientsService } from '../patients/patients.service';
import { PatientMedicationsService } from '../medications/patient-medications.service';
import { LaboratoryService } from '../laboratory/laboratory.service';
import { EncounterService } from '../clinical/encounter.service';
import { ImmunizationsService } from '../immunizations/immunizations.service';
import { AiService } from '../ai/ai.service';
import { QualityMeasureResult } from './entities/quality-measure-result.entity';
import { MeasureDefinition, getApplicableMeasures, MEASURE_REGISTRY } from './measure-registry';

export interface MeasureResult {
  measureId: string;
  measureTitle: string;
  program: string;
  category: string;
  status: 'met' | 'not_met' | 'overdue' | 'not_applicable';
  lastValue: string | null;
  targetValue: string | null;
  lastEventDate: string | null;
  explanation: string;
  recommendation: string | null;
  closeableInVisit: boolean;
  suggestedAction: string | null;
  priority: number;
  crossProgramMappings: Array<{ program: string; measureId: string; measureTitle: string }>;
  dataElements: Array<{ source: string; field: string; value: string; date?: string }>;
}

export interface PatientQualityProfile {
  patientId: string;
  patientName: string;
  patientAge: number | null;
  patientSex: string | null;
  generatedAt: string;
  reportingPeriod: { start: string; end: string };
  measures: MeasureResult[];
  summary: {
    total: number;
    met: number;
    notMet: number;
    overdue: number;
    notApplicable: number;
    complianceRate: number;
    openGaps: number;
    closeableGaps: number;
    estimatedQualityScore: number;
  };
  aiRecommendations: {
    topPriorities: Array<{ measureId: string; title: string; action: string; impact: string }>;
    visitReadiness: Array<{ measureId: string; title: string; action: string }>;
    summary: string;
  } | null;
}

export interface PracticeQualityDashboard {
  tenantId: string;
  generatedAt: string;
  reportingPeriod: { start: string; end: string };
  totalPatients: number;
  measures: Array<{
    measureId: string;
    measureTitle: string;
    program: string;
    category: string;
    eligible: number;
    met: number;
    notMet: number;
    overdue: number;
    complianceRate: number;
  }>;
  overallCompliance: number;
  estimatedQualityScore: number;
  topGaps: Array<{ measureId: string; measureTitle: string; gapCount: number; complianceRate: number }>;
  aiInsights: string | null;
}

@Injectable()
export class QualityMeasuresService {
  private readonly logger = new Logger(QualityMeasuresService.name);

  constructor(
    private readonly patientsService: PatientsService,
    private readonly patientMedicationsService: PatientMedicationsService,
    private readonly laboratoryService: LaboratoryService,
    private readonly encounterService: EncounterService,
    private readonly immunizationsService: ImmunizationsService,
    private readonly aiService: AiService,
    @InjectRepository(QualityMeasureResult)
    private readonly measureResultRepository: Repository<QualityMeasureResult>,
  ) {}

  // ── Patient-Level Quality Profile ──────────────────────────────────────────

  async getPatientQualityProfile(
    tenantId: string,
    patientId: string,
  ): Promise<PatientQualityProfile> {
    const patient = await this.patientsService.findOne(tenantId, patientId);
    if (!patient) throw new NotFoundException('Patient not found');

    const patientName = `${patient.firstName} ${patient.lastName}`;
    const patientAge = this.calculateAge(patient.dateOfBirth);
    const patientSex = patient.gender || null;

    // Fetch all data in parallel
    const [problems, medications, encounters, labOrders, immunizations, socialHistory] = await Promise.all([
      this.patientsService.findProblems(tenantId, patientId, {}).catch(() => []),
      this.patientMedicationsService.findByPatient(tenantId, patientId).catch(() => []),
      this.encounterService.findByPatient(patientId, tenantId).catch(() => []),
      this.laboratoryService.findAllOrders(tenantId, { patientId, page: 1, limit: 50 }).catch(() => ({ data: [], total: 0 })),
      this.immunizationsService.getForAiCareGap(tenantId, patientId).catch(() => []),
      this.patientsService.findSocialHistory(tenantId, patientId).catch(() => []),
    ]);

    // Extract diagnosis codes from problem list
    const diagnosisCodes = (problems as any[])
      .filter((p) => p.clinicalStatus === 'active' || !p.clinicalStatus)
      .map((p) => p.code || '')
      .filter(Boolean);

    // Get applicable measures
    const applicableMeasures = getApplicableMeasures(patientAge, patientSex, diagnosisCodes);

    // Extract data for measure calculation
    const recentVitals = this.extractRecentVitals(encounters as any[]);
    const recentLabs = this.extractRecentLabs((labOrders as any).data || []);
    const activeMeds = (medications as any[])
      .filter((m) => m.status === 'active' || !m.status)
      .map((m) => ({ name: m.medicationName || '', dosage: m.dosage || '', frequency: m.frequency || '' }));
    const immunizationList = immunizations as any[];
    const socialHistList = socialHistory as any[];

    // Calculate each measure
    const measureResults = applicableMeasures.map((measure) =>
      this.calculateMeasure(
        measure,
        patientAge,
        patientSex,
        diagnosisCodes,
        recentVitals,
        recentLabs,
        activeMeds,
        immunizationList,
        socialHistList,
        encounters as any[],
      ),
    );

    // Build summary
    const summary = this.buildSummary(measureResults);

    // AI recommendations
    const aiRecommendations = await this.generateAiRecommendations(
      patientName,
      patientAge,
      patientSex,
      measureResults,
    ).catch((err) => {
      this.logger.warn(`AI recommendations failed: ${err.message}`);
      return null;
    });

    // Persist results
    await this.persistResults(tenantId, patientId, measureResults);

    return {
      patientId,
      patientName,
      patientAge,
      patientSex,
      generatedAt: new Date().toISOString(),
      reportingPeriod: this.getReportingPeriod(),
      measures: measureResults,
      summary,
      aiRecommendations,
    };
  }

  // ── Practice-Level Dashboard ───────────────────────────────────────────────

  async getPracticeDashboard(tenantId: string): Promise<PracticeQualityDashboard> {
    // Get all persisted measure results for this tenant in the current period
    const period = this.getReportingPeriod();
    const results = await this.measureResultRepository.find({
      where: { tenantId },
      order: { measureId: 'ASC' },
    });

    // Get total patient count
    const patients = await this.patientsService.findAll(tenantId, { page: 1, limit: 1 });
    const totalPatients = (patients as any).total || 0;

    // Aggregate by measure
    const measureMap = new Map<string, { measure: MeasureDefinition; met: number; notMet: number; overdue: number; eligible: number }>();

    for (const result of results) {
      const def = MEASURE_REGISTRY.find((m) => m.id === result.measureId);
      if (!def) continue;

      const key = result.measureId;
      if (!measureMap.has(key)) {
        measureMap.set(key, { measure: def, met: 0, notMet: 0, overdue: 0, eligible: 0 });
      }
      const entry = measureMap.get(key)!;
      entry.eligible++;
      if (result.status === 'met') entry.met++;
      else if (result.status === 'not_met') entry.notMet++;
      else if (result.status === 'overdue') entry.overdue++;
    }

    const measures = Array.from(measureMap.entries()).map(([id, entry]) => ({
      measureId: id,
      measureTitle: entry.measure.title,
      program: entry.measure.program,
      category: entry.measure.category,
      eligible: entry.eligible,
      met: entry.met,
      notMet: entry.notMet,
      overdue: entry.overdue,
      complianceRate: entry.eligible > 0 ? Math.round((entry.met / entry.eligible) * 100) : 0,
    }));

    const totalEligible = measures.reduce((s, m) => s + m.eligible, 0);
    const totalMet = measures.reduce((s, m) => s + m.met, 0);
    const overallCompliance = totalEligible > 0 ? Math.round((totalMet / totalEligible) * 100) : 0;

    const topGaps = measures
      .filter((m) => m.notMet + m.overdue > 0)
      .sort((a, b) => (b.notMet + b.overdue) - (a.notMet + a.overdue))
      .slice(0, 10)
      .map((m) => ({
        measureId: m.measureId,
        measureTitle: m.measureTitle,
        gapCount: m.notMet + m.overdue,
        complianceRate: m.complianceRate,
      }));

    // AI insights
    const aiInsights = await this.generateAiInsights(measures, overallCompliance, totalPatients).catch((err) => {
      this.logger.warn(`AI insights failed: ${err.message}`);
      return null;
    });

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      reportingPeriod: period,
      totalPatients,
      measures,
      overallCompliance,
      estimatedQualityScore: this.estimateQualityScore(measures),
      topGaps,
      aiInsights,
    };
  }

  // ── Measure Calculation Engine ─────────────────────────────────────────────

  private calculateMeasure(
    measure: MeasureDefinition,
    patientAge: number | null,
    patientSex: string | null,
    diagnosisCodes: string[],
    vitals: Array<{ metric: string; value: string }>,
    labs: Array<{ test: string; value: string; unit?: string; date?: string }>,
    medications: Array<{ name: string; dosage: string; frequency: string }>,
    immunizations: Array<{ name: string; date?: string }>,
    socialHistory: any[],
    encounters: any[],
  ): MeasureResult {
    const dataElements: Array<{ source: string; field: string; value: string; date?: string }> = [];
    let status: 'met' | 'not_met' | 'overdue' | 'not_applicable' = 'not_met';
    let lastValue: string | null = null;
    let lastEventDate: string | null = null;
    let explanation = '';
    const period = this.getReportingPeriod();
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    switch (measure.id) {
      // ─── Diabetes: HbA1c Testing ───
      case 'CMS122v13': {
        const hba1c = labs.find((l) =>
          /hba1c|hemoglobin.*a1c|glycated/i.test(l.test) || l.test === 'HbA1c',
        );
        if (hba1c) {
          lastValue = hba1c.value + (hba1c.unit ? ` ${hba1c.unit}` : '');
          lastEventDate = hba1c.date || null;
          dataElements.push({ source: 'lab', field: 'HbA1c', value: hba1c.value, date: hba1c.date });
          const labDate = hba1c.date ? new Date(hba1c.date) : null;
          if (labDate && labDate >= periodStart && labDate <= periodEnd) {
            status = 'met';
            explanation = `HbA1c was tested on ${hba1c.date} with result ${lastValue}. This satisfies the annual HbA1c testing requirement for the ${period.start}–${period.end} reporting period.`;
          } else {
            status = 'overdue';
            explanation = `Last HbA1c was ${lastValue} on ${hba1c.date || 'unknown date'}, which is outside the current reporting period (${period.start}–${period.end}). A new HbA1c test is required.`;
          }
        } else {
          status = 'not_met';
          explanation = `Patient has diabetes (ICD-10 codes: ${diagnosisCodes.filter(c => c.startsWith('E1')).join(', ')}) but no HbA1c lab result found in the record. HbA1c testing is required at least once per year.`;
        }
        break;
      }

      // ─── Diabetes: Eye Exam ───
      case 'CMS124v13': {
        const eyeExam = encounters.find((e) => {
          const soap = e.soapNote || {};
          const text = `${soap.subjective || ''} ${soap.objective || ''} ${soap.assessment || ''} ${soap.plan || ''}`.toLowerCase();
          return /retinal|fundus|ophthalmos|eye exam|diabetic retinopathy|optomap/i.test(text);
        });
        if (eyeExam) {
          lastEventDate = eyeExam.startTime ? new Date(eyeExam.startTime).toISOString().split('T')[0] : null;
          dataElements.push({ source: 'encounter', field: 'SOAP note', value: 'Retinal/eye exam documented', date: lastEventDate || undefined });
          const encDate = lastEventDate ? new Date(lastEventDate) : null;
          if (encDate && encDate >= periodStart) {
            status = 'met';
            explanation = `Diabetic retinal eye exam was documented on ${lastEventDate}. This satisfies the annual eye exam requirement.`;
            lastValue = 'Retinal exam completed';
          } else {
            status = 'overdue';
            explanation = `Last diabetic eye exam was on ${lastEventDate}, which is outside the current reporting period. A new retinal exam is needed.`;
            lastValue = 'Last exam outside reporting period';
          }
        } else {
          status = 'not_met';
          explanation = `Patient has diabetes but no retinal eye exam found in encounter documentation. Annual diabetic eye exam is required.`;
        }
        break;
      }

      // ─── Diabetes: Nephropathy Screening ───
      case 'CMS125v13': {
        const nephroLab = labs.find((l) =>
          /microalbumin|urine.*albumin|uacr|creatinine.*ratio|urine.*protein/i.test(l.test),
        );
        const nephroDx = diagnosisCodes.some(c => /^N18|^E1[0-9].2[0-9]/i.test(c));
        if (nephroLab) {
          lastValue = nephroLab.value + (nephroLab.unit ? ` ${nephroLab.unit}` : '');
          lastEventDate = nephroLab.date || null;
          dataElements.push({ source: 'lab', field: 'Urinalysis', value: nephroLab.value, date: nephroLab.date });
          const labDate = nephroLab.date ? new Date(nephroLab.date) : null;
          if (labDate && labDate >= periodStart) {
            status = 'met';
            explanation = `Urine microalbumin/creatinine ratio was tested on ${nephroLab.date} with result ${lastValue}. This satisfies the annual nephropathy screening requirement.`;
          } else {
            status = 'overdue';
            explanation = `Last nephropathy screening was ${lastValue} on ${nephroLab.date || 'unknown date'}, outside the current reporting period.`;
          }
        } else if (nephroDx) {
          status = 'met';
          explanation = `Patient has a diagnosis of nephropathy (ICD-10 N18.x), which satisfies the nephropathy attention requirement.`;
          lastValue = 'Nephropathy diagnosis on file';
        } else {
          status = 'not_met';
          explanation = `Patient has diabetes but no evidence of nephropathy screening (urine microalbumin test) or nephropathy diagnosis. Annual screening is required.`;
        }
        break;
      }

      // ─── Controlling High Blood Pressure ───
      case 'CMS22v13': {
        const bp = vitals.find((v) => v.metric === 'Blood Pressure');
        if (bp) {
          lastValue = bp.value;
          dataElements.push({ source: 'vitals', field: 'Blood Pressure', value: bp.value });
          const bpMatch = bp.value.match(/(\d+)\/(\d+)/);
          if (bpMatch) {
            const systolic = parseInt(bpMatch[1], 10);
            const diastolic = parseInt(bpMatch[2], 10);
            if (systolic < 140 && diastolic < 90) {
              status = 'met';
              explanation = `Most recent blood pressure reading is ${bp.value} mmHg, which is below the target of <140/90 mmHg. This measure is satisfied.`;
            } else {
              status = 'not_met';
              explanation = `Most recent blood pressure reading is ${bp.value} mmHg, which is above the target of <140/90 mmHg. Consider medication adjustment or adherence assessment.`;
            }
          } else {
            status = 'not_met';
            explanation = `Blood pressure recorded as "${bp.value}" but could not be parsed. Manual review needed.`;
          }
        } else {
          status = 'not_met';
          explanation = `Patient has hypertension (ICD-10 I10-I16) but no blood pressure reading found in recent encounters. BP must be recorded to evaluate this measure.`;
        }
        break;
      }

      // ─── Statin Therapy for CVD Prevention ───
      case 'CMS68v13': {
        const statinMeds = medications.filter((m) =>
          /atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin|fluvastatin|pitavastatin/i.test(m.name),
        );
        if (statinMeds.length > 0) {
          status = 'met';
          lastValue = statinMeds.map((m) => `${m.name} ${m.dosage}`.trim()).join(', ');
          dataElements.push({ source: 'medication', field: 'Statin', value: lastValue });
          explanation = `Patient is prescribed statin therapy: ${lastValue}. This satisfies the measure requirement.`;
        } else {
          status = 'not_met';
          explanation = `Patient has qualifying diagnosis (CVD or diabetes) but is not prescribed a statin. Statin therapy is recommended for patients 40-75 with CVD or diabetes.`;
        }
        break;
      }

      // ─── Colorectal Cancer Screening ───
      case 'CMS130v13': {
        const colonoscopy = encounters.find((e) => {
          const text = `${e.soapNote?.subjective || ''} ${e.soapNote?.objective || ''} ${e.soapNote?.assessment || ''} ${e.soapNote?.plan || ''} ${e.type || ''} ${e.visitReason || ''}`.toLowerCase();
          return /colonoscopy|colorectal|fit test|fecal.*immuno|cologuard|stool.*dna|flexible sigmoid/i.test(text);
        });
        const fitLab = labs.find((l) => /fit|fecal.*immuno|occult.*blood|guaiac/i.test(l.test));
        if (colonoscopy || fitLab) {
          const source = colonoscopy ? 'encounter' : 'lab';
          lastEventDate = colonoscopy?.startTime
            ? new Date(colonoscopy.startTime).toISOString().split('T')[0]
            : fitLab?.date || null;
          lastValue = colonoscopy ? 'Colonoscopy documented' : `FIT test: ${fitLab!.value}`;
          dataElements.push({ source, field: 'CRC Screening', value: lastValue, date: lastEventDate || undefined });
          status = 'met';
          explanation = `Colorectal cancer screening documented (${lastValue}) on ${lastEventDate || 'unknown date'}. This satisfies the screening requirement.`;
        } else {
          status = 'not_met';
          explanation = `Patient is in the eligible age range (${patientAge} years) but no colorectal cancer screening (colonoscopy, FIT, or FIT-DNA) found in the record.`;
        }
        break;
      }

      // ─── Breast Cancer Screening ───
      case 'CMS124v14': {
        const mammo = encounters.find((e) => {
          const text = `${e.soapNote?.subjective || ''} ${e.soapNote?.objective || ''} ${e.soapNote?.assessment || ''} ${e.soapNote?.plan || ''} ${e.type || ''} ${e.visitReason || ''} ${e.orders?.imaging?.map((i: any) => i.name || '').join(' ') || ''}`.toLowerCase();
          return /mammogram|mammography|breast.*screening|bilateral.*mammo/i.test(text);
        });
        if (mammo) {
          lastEventDate = mammo.startTime ? new Date(mammo.startTime).toISOString().split('T')[0] : null;
          lastValue = 'Mammography documented';
          dataElements.push({ source: 'encounter', field: 'Mammography', value: lastValue, date: lastEventDate || undefined });
          const encDate = lastEventDate ? new Date(lastEventDate) : null;
          const twentySevenMonthsAgo = new Date();
          twentySevenMonthsAgo.setMonth(twentySevenMonthsAgo.getMonth() - 27);
          if (encDate && encDate >= twentySevenMonthsAgo) {
            status = 'met';
            explanation = `Mammography screening documented on ${lastEventDate}, within the 27-month requirement window.`;
          } else {
            status = 'overdue';
            explanation = `Last mammography was on ${lastEventDate}, more than 27 months ago. A new screening mammogram is needed.`;
          }
        } else {
          status = 'not_met';
          explanation = `Patient is a ${patientAge}-year-old female in the eligible age range (50-74) but no mammography screening found in the record.`;
        }
        break;
      }

      // ─── Cervical Cancer Screening ───
      case 'CMS125v14': {
        const pap = encounters.find((e) => {
          const text = `${e.soapNote?.subjective || ''} ${e.soapNote?.objective || ''} ${e.soapNote?.assessment || ''} ${e.soapNote?.plan || ''} ${e.type || ''} ${e.visitReason || ''}`.toLowerCase();
          return /pap smear|pap test|cervical.*cytology|hpv test|hpv screening|cervical.*screening/i.test(text);
        });
        if (pap) {
          lastEventDate = pap.startTime ? new Date(pap.startTime).toISOString().split('T')[0] : null;
          lastValue = 'Pap/HPV screening documented';
          dataElements.push({ source: 'encounter', field: 'Cervical Screening', value: lastValue, date: lastEventDate || undefined });
          const encDate = lastEventDate ? new Date(lastEventDate) : null;
          const threeYearsAgo = new Date();
          threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
          const fiveYearsAgo = new Date();
          fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
          if (encDate && encDate >= threeYearsAgo) {
            status = 'met';
            explanation = `Cervical cancer screening (Pap/HPV) documented on ${lastEventDate}, within the required screening interval.`;
          } else if (encDate && encDate >= fiveYearsAgo) {
            status = 'met';
            explanation = `Cervical cancer screening documented on ${lastEventDate}, within the 5-year HPV screening window.`;
          } else {
            status = 'overdue';
            explanation = `Last cervical cancer screening was on ${lastEventDate}, outside the required screening interval (3 years for Pap, 5 years for HPV).`;
          }
        } else {
          status = 'not_met';
          explanation = `Patient is a ${patientAge}-year-old female in the eligible age range (23-64) but no cervical cancer screening (Pap or HPV) found in the record.`;
        }
        break;
      }

      // ─── Influenza Immunization ───
      case 'CMS127v13': {
        const fluVax = immunizations.find((i) =>
          /influenza|flu.*vaccine|flu.*shot|fluzone|flumist|afluria|fluarix|fluad/i.test(i.name),
        );
        if (fluVax) {
          lastEventDate = fluVax.date || null;
          lastValue = fluVax.name;
          dataElements.push({ source: 'immunization', field: 'Influenza vaccine', value: fluVax.name, date: fluVax.date });
          const vaxDate = fluVax.date ? new Date(fluVax.date) : null;
          const fluSeasonStart = new Date(new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0), 7, 1); // Aug 1 of current flu season
          if (vaxDate && vaxDate >= fluSeasonStart) {
            status = 'met';
            explanation = `Influenza vaccine (${fluVax.name}) administered on ${fluVax.date}. This satisfies the current flu season requirement.`;
          } else {
            status = 'overdue';
            explanation = `Last influenza vaccine was on ${fluVax.date}, before the current flu season. A new flu vaccine is needed.`;
          }
        } else {
          status = 'not_met';
          explanation = `No influenza immunization found in the patient's record. Annual flu vaccine is recommended for all patients ≥6 months.`;
        }
        break;
      }

      // ─── Pneumococcal Vaccination ───
      case 'CMS128v13': {
        const pneumoVax = immunizations.find((i) =>
          /pneumococcal|pneumonia.*vaccine|pcv13|pcv15|pcv20|ppsv23|pneumovax|prevnar/i.test(i.name),
        );
        if (pneumoVax) {
          lastEventDate = pneumoVax.date || null;
          lastValue = pneumoVax.name;
          dataElements.push({ source: 'immunization', field: 'Pneumococcal vaccine', value: pneumoVax.name, date: pneumoVax.date });
          status = 'met';
          explanation = `Pneumococcal vaccine (${pneumoVax.name}) administered on ${pneumoVax.date}. This satisfies the measure requirement for patients ≥65.`;
        } else {
          status = 'not_met';
          explanation = `Patient is ≥65 years old but no pneumococcal vaccination found in the record. PCV15 or PCV20 is recommended.`;
        }
        break;
      }

      // ─── Depression Screening ───
      case 'CMS134v13': {
        const depressionScreen = encounters.find((e) => {
          const text = `${e.soapNote?.subjective || ''} ${e.soapNote?.objective || ''} ${e.soapNote?.assessment || ''} ${e.soapNote?.plan || ''}`.toLowerCase();
          return /phq-?9|phq9|depression.*screen|depression.*questionnaire|patient health questionnaire/i.test(text);
        });
        if (depressionScreen) {
          lastEventDate = depressionScreen.startTime ? new Date(depressionScreen.startTime).toISOString().split('T')[0] : null;
          lastValue = 'PHQ-9 documented';
          dataElements.push({ source: 'encounter', field: 'Depression screening', value: 'PHQ-9', date: lastEventDate || undefined });
          const encDate = lastEventDate ? new Date(lastEventDate) : null;
          if (encDate && encDate >= periodStart) {
            status = 'met';
            explanation = `Depression screening (PHQ-9) was documented on ${lastEventDate}. This satisfies the annual screening requirement.`;
          } else {
            status = 'overdue';
            explanation = `Last depression screening was on ${lastEventDate}, outside the current reporting period. Annual screening is required.`;
          }
        } else {
          status = 'not_met';
          explanation = `No depression screening (PHQ-9) found in encounter documentation. Annual screening is recommended for all patients ≥12.`;
        }
        break;
      }

      // ─── Tobacco Use Screening ───
      case 'CMS144v13': {
        const tobaccoSocial = socialHistory.find((s) =>
          /tobacco|smoking|cigarette|nicotine|vaping|chewing/i.test(s.category || s.detail || ''),
        );
        const tobaccoEncounter = encounters.find((e) => {
          const text = `${e.soapNote?.subjective || ''} ${e.soapNote?.objective || ''}`.toLowerCase();
          return /tobacco|smoking|cigarette|nicotine|vaping|chewing/i.test(text);
        });
        if (tobaccoSocial || tobaccoEncounter) {
          const source = tobaccoSocial ? 'social_history' : 'encounter';
          const value = tobaccoSocial
            ? `${tobaccoSocial.category}: ${tobaccoSocial.status || ''} ${tobaccoSocial.detail || ''}`.trim()
            : 'Tobacco status documented in encounter';
          lastValue = value;
          lastEventDate = tobaccoSocial?.updatedAt
            ? new Date(tobaccoSocial.updatedAt).toISOString().split('T')[0]
            : tobaccoEncounter?.startTime
              ? new Date(tobaccoEncounter.startTime).toISOString().split('T')[0]
              : null;
          dataElements.push({ source, field: 'Tobacco status', value, date: lastEventDate || undefined });
          status = 'met';
          const isUser = /current|active|yes|daily|smoker/i.test(value);
          if (isUser) {
            const cessation = encounters.find((e) => {
              const text = `${e.soapNote?.plan || ''} ${e.soapNote?.assessment || ''}`.toLowerCase();
              return /cessation|quit.*smoking|nicotine.*replacement|varenicline|bupropion|counseling.*tobacco/i.test(text);
            });
            if (cessation) {
              explanation = `Tobacco use screening documented (${value}). Cessation intervention also documented. Measure fully satisfied.`;
            } else {
              explanation = `Tobacco use screening documented (${value}). Patient is a tobacco user but no cessation intervention found. Provide cessation counseling to fully satisfy this measure.`;
            }
          } else {
            explanation = `Tobacco use screening documented (${value}). Patient is a non-user. Measure satisfied.`;
          }
        } else {
          status = 'not_met';
          explanation = `No tobacco use screening found in social history or encounter documentation. Annual screening is required for all patients ≥12.`;
        }
        break;
      }

      default:
        status = 'not_applicable';
        explanation = `Measure ${measure.id} (${measure.title}) is recognized but calculation logic is not yet implemented.`;
    }

    return {
      measureId: measure.id,
      measureTitle: measure.title,
      program: measure.program,
      category: measure.category,
      status,
      lastValue,
      targetValue: measure.targetValue || null,
      lastEventDate,
      explanation,
      recommendation: status !== 'met' ? measure.suggestedAction || null : null,
      closeableInVisit: measure.closeableInVisit,
      suggestedAction: status !== 'met' ? measure.suggestedAction || null : null,
      priority: measure.priority,
      crossProgramMappings: measure.crossProgramMappings || [],
      dataElements,
    };
  }

  // ── AI Recommendations ─────────────────────────────────────────────────────

  private async generateAiRecommendations(
    patientName: string,
    patientAge: number | null,
    patientSex: string | null,
    measures: MeasureResult[],
  ): Promise<PatientQualityProfile['aiRecommendations']> {
    const openGaps = measures.filter((m) => m.status === 'not_met' || m.status === 'overdue');
    if (openGaps.length === 0) {
      return {
        topPriorities: [],
        visitReadiness: [],
        summary: 'All applicable quality measures are met. No action needed.',
      };
    }

    const gapsStr = openGaps
      .map((g) => `${g.measureTitle} (${g.program}): ${g.status} — ${g.explanation}`)
      .join('\n');

    const prompt = `You are a clinical quality measures assistant. Analyze the following open quality measure gaps for this patient and provide prioritized recommendations.

Patient: ${patientName}, Age: ${patientAge || 'Unknown'}, Sex: ${patientSex || 'Unknown'}

Open Quality Measure Gaps:
${gapsStr}

Return ONLY a JSON object with this exact shape:
{
  "topPriorities": [{"measureId": "string", "title": "string", "action": "string — specific action to close the gap", "impact": "string — estimated impact on quality score"}],
  "visitReadiness": [{"measureId": "string", "title": "string", "action": "string — can be closed during a routine visit"}],
  "summary": "string — brief summary of overall quality status and recommended next steps"
}

Prioritize by clinical impact and quality score impact. Include only gaps that can be acted upon.`;

    try {
      const result = await this.aiService.generateStructured<any>(prompt);
      return {
        topPriorities: (result.topPriorities || []).slice(0, 5),
        visitReadiness: (result.visitReadiness || []).slice(0, 5),
        summary: result.summary || `${openGaps.length} quality measure gaps identified.`,
      };
    } catch (err: any) {
      this.logger.warn(`AI recommendations failed: ${err.message}`);
      return null;
    }
  }

  private async generateAiInsights(
    measures: Array<{ measureId: string; measureTitle: string; eligible: number; met: number; notMet: number; overdue: number; complianceRate: number }>,
    overallCompliance: number,
    totalPatients: number,
  ): Promise<string | null> {
    const lowPerformers = measures
      .filter((m) => m.complianceRate < 70 && m.eligible > 0)
      .sort((a, b) => a.complianceRate - b.complianceRate)
      .slice(0, 5);

    if (lowPerformers.length === 0) {
      return `Quality performance is strong across all measures (overall compliance: ${overallCompliance}%). No critical gaps identified.`;
    }

    const prompt = `You are a practice quality improvement advisor. Analyze the following practice-level quality measure performance and provide actionable insights.

Overall compliance: ${overallCompliance}%
Total patients: ${totalPatients}

Lowest-performing measures:
${lowPerformers.map((m) => `${m.measureTitle}: ${m.complianceRate}% compliance (${m.met}/${m.eligible} met, ${m.notMet + m.overdue} gaps)`).join('\n')}

Provide a concise summary (2-3 sentences) of the key issues and recommended actions to improve quality scores. Focus on practical, high-impact interventions.`;

    try {
      return await this.aiService.generate(prompt);
    } catch (err: any) {
      this.logger.warn(`AI insights failed: ${err.message}`);
      return null;
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private async persistResults(
    tenantId: string,
    patientId: string,
    measures: MeasureResult[],
  ): Promise<void> {
    const period = this.getReportingPeriod();
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    for (const m of measures) {
      // Find existing record for this patient × measure × period
      const existing = await this.measureResultRepository.findOne({
        where: { tenantId, patientId, measureId: m.measureId },
      });

      const data = {
        tenantId,
        patientId,
        measureId: m.measureId,
        measureTitle: m.measureTitle,
        program: m.program,
        category: m.category,
        status: m.status,
        periodStart,
        periodEnd,
        lastValue: m.lastValue,
        targetValue: m.targetValue,
        lastEventDate: m.lastEventDate ? new Date(m.lastEventDate) : null,
        explanation: m.explanation,
        recommendation: m.recommendation,
        closeableInVisit: m.closeableInVisit,
        suggestedAction: m.suggestedAction,
        priority: m.priority,
        crossProgramMappings: m.crossProgramMappings,
        dataElements: m.dataElements,
      };

      if (existing) {
        await this.measureResultRepository.save({ ...existing, ...data });
      } else {
        const entity = this.measureResultRepository.create(data);
        await this.measureResultRepository.save(entity);
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildSummary(measures: MeasureResult[]) {
    const total = measures.length;
    const met = measures.filter((m) => m.status === 'met').length;
    const notMet = measures.filter((m) => m.status === 'not_met').length;
    const overdue = measures.filter((m) => m.status === 'overdue').length;
    const notApplicable = measures.filter((m) => m.status === 'not_applicable').length;
    const complianceRate = total > 0 ? Math.round((met / total) * 100) : 0;
    const openGaps = notMet + overdue;
    const closeableGaps = measures.filter((m) => (m.status === 'not_met' || m.status === 'overdue') && m.closeableInVisit).length;
    const estimatedQualityScore = Math.round(complianceRate * 0.9 + (closeableGaps === 0 ? 10 : 0));

    return {
      total,
      met,
      notMet,
      overdue,
      notApplicable,
      complianceRate,
      openGaps,
      closeableGaps,
      estimatedQualityScore: Math.min(estimatedQualityScore, 100),
    };
  }

  private getReportingPeriod(): { start: string; end: string } {
    const year = new Date().getFullYear();
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    };
  }

  private estimateQualityScore(measures: Array<{ complianceRate: number; eligible: number }>): number {
    const totalEligible = measures.reduce((s, m) => s + m.eligible, 0);
    if (totalEligible === 0) return 0;
    const weighted = measures.reduce((s, m) => s + (m.complianceRate * m.eligible), 0);
    return Math.round(weighted / totalEligible);
  }

  private extractRecentVitals(encounters: any[]): Array<{ metric: string; value: string }> {
    if (!encounters || encounters.length === 0) return [];
    const encounterWithVitals = encounters.find((e) => e.vitals && Object.keys(e.vitals).length > 0);
    if (!encounterWithVitals?.vitals) return [];
    const v = encounterWithVitals.vitals;
    const vitals: Array<{ metric: string; value: string }> = [];
    if (v.bloodPressure) vitals.push({ metric: 'Blood Pressure', value: v.bloodPressure });
    if (v.heartRate) vitals.push({ metric: 'Heart Rate', value: v.heartRate });
    if (v.temperature) vitals.push({ metric: 'Temperature', value: v.temperature });
    if (v.respiratoryRate) vitals.push({ metric: 'Respiratory Rate', value: v.respiratoryRate });
    if (v.oxygenSaturation) vitals.push({ metric: 'Oxygen Saturation', value: v.oxygenSaturation });
    if (v.weight) vitals.push({ metric: 'Weight', value: `${v.weight} ${v.weightUnit || ''}`.trim() });
    if (v.height) vitals.push({ metric: 'Height', value: `${v.height} ${v.heightUnit || ''}`.trim() });
    if (v.bmi) vitals.push({ metric: 'BMI', value: v.bmi });
    if (v.painScore) vitals.push({ metric: 'Pain Score', value: String(v.painScore) });
    if (v.bloodGlucose) vitals.push({ metric: 'Blood Glucose', value: v.bloodGlucose });
    return vitals;
  }

  private extractRecentLabs(labOrders: any[]): Array<{ test: string; value: string; unit?: string; date?: string }> {
    if (!labOrders || labOrders.length === 0) return [];
    const labs: Array<{ test: string; value: string; unit?: string; date?: string }> = [];
    for (const order of labOrders.slice(0, 20)) {
      const tests = order.tests || [];
      const results = order.results || [];
      for (const result of results) {
        if (result.value) {
          labs.push({
            test: result.testName || result.test_name || 'Unknown Test',
            value: result.value,
            unit: result.unit,
            date: result.resultedDate || order.orderedDate,
          });
        }
      }
      for (const test of tests) {
        if (test.resultValue) {
          labs.push({
            test: test.testName || test.test_name || 'Unknown Test',
            value: test.resultValue,
            unit: test.unit,
            date: test.resultedDate || order.orderedDate,
          });
        }
      }
    }
    return labs.slice(0, 30);
  }

  private calculateAge(dateOfBirth: Date | string | null): number | null {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 && age <= 120 ? age : null;
  }
}
