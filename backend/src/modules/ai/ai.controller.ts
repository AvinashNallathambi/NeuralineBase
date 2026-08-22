import { Controller, Post, Body, Get, UseGuards, Logger, Request, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntegrationsService } from '../integrations/integrations.service';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

interface GenerateSoapDto {
  transcript: string;
  patientContext?: { name?: string; age?: number; gender?: string; chiefComplaint?: string };
}

interface SuggestCodesDto {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface SuggestDiagnosisDto {
  query: string;
  limit?: number;
}

interface ReviewMedication {
  medication: string;
  dosage: string;
  frequency: string;
  route?: string;
  duration?: string;
  quantity?: number;
  refills?: number;
  rxNormCode?: string;
}

interface ReviewMedicationsDto {
  medications: ReviewMedication[];
  allergies?: string[];
  conditions?: string[];
  age?: number;
  gender?: string;
}

interface ParsePrescriptionDto {
  transcript: string;
}

interface PriorAuthLetterDto {
  patientName: string;
  patientDob: string;
  medicationName: string;
  diagnosis: string;
  clinicalNotes: string;
  insurancePlan: string;
}

interface DenialRiskDto {
  cptCodes: string[];
  icd10Codes: string[];
  modifierCodes?: string[];
  patientAge: number;
  patientGender: string;
  insuranceType: string;
  priorDenials: number;
}

interface CodingAuditDto {
  soapNote: string;
  cptCodes: string[];
  icd10Codes: string[];
}

interface NoShowPredictionDto {
  patientAge: number;
  patientGender: string;
  appointmentType: string;
  daysSinceLastVisit: number;
  historicalNoShows: number;
  dayOfWeek: string;
  timeOfDay: string;
  distanceFromClinic: number;
}

interface CdiReviewDto {
  soapNote: string;
  encounterType: string;
}

interface DrugDosingDto {
  medicationName: string;
  patientAge: number;
  patientWeight: number;
  patientSex: string;
  creatinine: number;
  diagnosis: string;
  currentMedications: string[];
}

interface ReferralLetterDto {
  patientName: string;
  patientDob: string;
  referringProvider: string;
  specialistName: string;
  specialty: string;
  reasonForReferral: string;
  clinicalSummary: string;
  urgent: boolean;
}

interface GenerateCarePlanDto {
  patientName: string;
  patientAge?: number;
  patientSex?: string;
  conditions: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  currentMedications: Array<{ name: string; dosage?: string }>;
  recentLabs?: Array<{ test: string; value: string; unit?: string; date?: string }>;
  vitals?: Array<{ metric: string; value: string; date?: string }>;
  allergies?: string[];
  providerName?: string;
}

interface SuggestMonitoringTasksDto {
  conditions: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  currentMedications: Array<{ name: string; dosage?: string }>;
  recentLabs?: Array<{ test: string; value: string; unit?: string }>;
}

interface RiskStratificationDto {
  patientName: string;
  patientAge?: number;
  patientSex?: string;
  conditions: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  currentMedications: Array<{ name: string }>;
  recentLabs?: Array<{ test: string; value: string; unit?: string }>;
  vitals?: Array<{ metric: string; value: string }>;
  hospitalizationsLastYear?: number;
  edVisitsLastYear?: number;
}

interface CareGapDetectionDto {
  patientAge?: number;
  patientSex?: string;
  conditions: Array<{ condition: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  currentMedications: Array<{ name: string }>;
  recentLabs?: Array<{ test: string; value: string; date?: string }>;
  lastImaging?: Array<{ type: string; date?: string }>;
  immunizations?: Array<{ name: string; date?: string }>;
  lastAppointmentDate?: string;
}

interface ImmunizationForecastDto {
  patientAgeMonths: number;
  patientSex?: string;
  immunizationHistory: Array<{ vaccineName: string; cvxCode?: string; date: string; doseNumber?: number }>;
  gestationalAgeWeeks?: number;
  conditions?: Array<{ condition: string; icd10Code?: string }>;
  allergies?: string[];
}

interface ContraindicationCheckDto {
  vaccineName: string;
  cvxCode?: string;
  patientAgeMonths: number;
  patientSex?: string;
  conditions?: Array<{ condition: string; icd10Code?: string }>;
  allergies?: string[];
  currentMedications?: Array<{ name: string }>;
  priorReactions?: string[];
  immunizationHistory?: Array<{ vaccineName: string; date: string }>;
}

interface VaccineEducationDto {
  vaccineName: string;
  patientAgeMonths: number;
  patientSex?: string;
  language?: string;
  readingLevel?: string;
}

interface TravelVaccineDto {
  destinations: string[];
  departureDate: string;
  returnDate?: string;
  patientAgeMonths: number;
  patientSex?: string;
  immunizationHistory?: Array<{ vaccineName: string; date: string }>;
  conditions?: Array<{ condition: string; icd10Code?: string }>;
  allergies?: string[];
  pregnancy?: boolean;
}

interface GrowthAssessmentDto {
  patientAgeMonths: number;
  patientSex: string;
  gestationalAgeWeeks?: number;
  weightMeasurements: Array<{ date: string; value: number; unit: string; percentile?: number }>;
  heightMeasurements: Array<{ date: string; value: number; unit: string; percentile?: number }>;
  headCircumferenceMeasurements?: Array<{ date: string; value: number; percentile?: number }>;
  bmiMeasurements?: Array<{ date: string; value: number; percentile?: number }>;
  conditions?: Array<{ condition: string; icd10Code?: string }>;
  midParentalHeight?: { targetHeightCm: number; rangeLowCm: number; rangeHighCm: number };
}

interface GrowthCounselingDto {
  patientAgeMonths: number;
  patientSex: string;
  patientName?: string;
  weightPercentile?: number;
  heightPercentile?: number;
  headCircumferencePercentile?: number;
  bmiPercentile?: number;
  weightTrend?: string;
  heightTrend?: string;
  midParentalHeight?: { targetHeightCm: number; rangeLowCm: number; rangeHighCm: number };
  conditions?: Array<{ condition: string }>;
  language?: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  @Get('health')
  async health() {
    return this.aiService.healthCheck();
  }

  @Post('generate-soap')
  async generateSoap(@Body() dto: GenerateSoapDto) {
    this.logger.debug('Generating SOAP note from transcript');

    if (!dto.transcript || !dto.transcript.trim()) {
      throw new HttpException('Transcript is required', HttpStatus.BAD_REQUEST);
    }

    const prompt = `You are a medical documentation assistant. Convert the following clinical encounter transcript into a structured SOAP note.

Transcript:
"""${dto.transcript}"""

${dto.patientContext?.chiefComplaint ? `Chief Complaint: ${dto.patientContext.chiefComplaint}` : ''}

Return ONLY a JSON object with this exact shape:
{
  "subjective": "string — patient-reported symptoms, history, concerns",
  "objective": "string — vitals, exam findings, observations",
  "assessment": "string — clinical assessment, differential diagnoses",
  "plan": "string — treatment plan, medications, follow-up, referrals"
}

Be concise but clinically thorough. Use professional medical terminology.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`SOAP generation failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI SOAP generation failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('suggest-codes')
  async suggestCodes(@Body() dto: SuggestCodesDto) {
    this.logger.debug('Suggesting medical codes from SOAP note');

    if (!dto.subjective && !dto.objective && !dto.assessment && !dto.plan) {
      throw new HttpException('SOAP note content is required', HttpStatus.BAD_REQUEST);
    }

    const prompt = `You are a certified medical coder (CPC). Based on the following SOAP note, suggest the most accurate ICD-10 diagnosis codes and CPT procedure codes.

SOAP Note:
Subjective: ${dto.subjective}
Objective: ${dto.objective}
Assessment: ${dto.assessment}
Plan: ${dto.plan}

Return ONLY a JSON object with this exact shape:
{
  "diagnoses": [
    { "code": "ICD-10 code", "description": "description", "confidence": 0.95, "rationale": "why this code fits" }
  ],
  "procedures": [
    { "code": "CPT code", "description": "description", "confidence": 0.92, "rationale": "why this code fits", "suggestedModifiers": ["25"] }
  ]
}

Rules:
- Include at most 5 diagnoses and 3 procedures.
- Confidence must be between 0.0 and 1.0.
- Only include codes you are highly confident about.
- Suggest modifiers when clinically appropriate (e.g., modifier 25 for E/M with procedure).`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Code suggestion failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI code suggestion failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('suggest-diagnosis')
  async suggestDiagnosis(@Body() dto: SuggestDiagnosisDto) {
    this.logger.debug(`Suggesting ICD-10 codes from natural language query: "${dto.query.slice(0, 100)}"`);

    if (!dto.query || !dto.query.trim()) {
      throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
    }

    const prompt = `You are a certified medical coder (CPC). Convert the following natural language clinical description into accurate ICD-10-CM diagnosis codes.

Clinical Description: "${dto.query}"

Return ONLY a JSON object with this exact shape:
{
  "suggestions": [
    {
      "code": "ICD-10-CM code",
      "description": "full code description",
      "confidence": 0.95,
      "rationale": "brief clinical rationale"
    }
  ]
}

Rules:
- Return up to ${dto.limit ?? 8} suggestions.
- Confidence must be between 0.0 and 1.0.
- Include the most specific code available.
- Only suggest codes you are highly confident about.
- If the query is not a medical condition, return an empty array.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Diagnosis suggestion failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI diagnosis suggestion failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('transcribe')
  async transcribe(@Body() dto: { audioUrl?: string }) {
    // This is a proxy endpoint — in production it would forward to the Whisper service
    // For local dev, we return a mock or call the whisper service
    this.logger.debug('Transcription requested — proxy to whisper service');
    return { text: 'Transcription service available at /api/v1/ai/transcribe', note: 'Upload audio to Whisper service at port 8001' };
  }

  @Post('review-medications')
  async reviewMedications(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ReviewMedicationsDto,
  ) {
    const enabled = await this.integrationsService.isEnabled(req.user.tenantId, 'ai_prescribing');
    if (!enabled) {
      throw new ForbiddenException('AI prescribing assistant is not enabled for this tenant');
    }

    this.logger.debug('Reviewing medications with AI assistant');

    const prompt = `You are a clinical pharmacist assistant. Review the following medication list against the patient's allergies and conditions.

Medications:
${JSON.stringify(dto.medications, null, 2)}

Patient Allergies: ${(dto.allergies || []).join(', ') || 'None known'}
Patient Conditions: ${(dto.conditions || []).join(', ') || 'None known'}
${dto.age ? `Age: ${dto.age}` : ''}
${dto.gender ? `Gender: ${dto.gender}` : ''}

Return ONLY a JSON object with this exact shape:
{
  "score": 0-100 integer representing overall prescription safety,
  "summary": "1-2 sentence clinical summary",
  "issues": [
    { "severity": "error" | "warning" | "info", "message": "concise explanation and recommendation" }
  ]
}

Rules:
- Include drug-drug interactions, drug-allergy contraindications, condition-related cautions, dosing red flags, and duplicate therapy.
- If no issues, return an empty issues array.
- Be concise and clinically accurate.`;

    return this.aiService.generateStructured<{
      score: number;
      summary: string;
      issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string }>;
    }>(prompt);
  }

  @Post('parse-prescription')
  async parsePrescription(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ParsePrescriptionDto,
  ) {
    const enabled = await this.integrationsService.isEnabled(req.user.tenantId, 'voice_prescribing');
    if (!enabled) {
      throw new ForbiddenException('Voice-to-prescription is not enabled for this tenant');
    }

    this.logger.debug('Parsing prescription transcript into structured fields');

    const prompt = `You are a medical prescription parser. Convert the following provider dictation into structured prescription data.

Transcript:
"""${dto.transcript}"""

Return ONLY a JSON object with this exact shape:
{
  "medications": [
    {
      "medication": "string",
      "dosage": "string",
      "frequency": "string",
      "route": "string",
      "duration": "string",
      "quantity": number,
      "refills": number,
      "instructions": "string"
    }
  ],
  "notes": "string"
}

Rules:
- Infer sensible defaults if information is missing (e.g., route Oral, refills 0).
- Quantity should be a number.
- Refills should be a number.
- Do not include explanations outside the JSON.`;

    return this.aiService.generateStructured<{
      medications: ReviewMedication[];
      notes?: string;
    }>(prompt);
  }

  @Post('prior-auth-letter')
  async generatePriorAuthLetter(@Body() dto: PriorAuthLetterDto) {
    this.logger.debug('Generating prior authorization letter');

    if (!dto.patientName || !dto.patientName.trim()) {
      throw new HttpException('patientName is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.medicationName || !dto.medicationName.trim()) {
      throw new HttpException('medicationName is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.clinicalNotes || !dto.clinicalNotes.trim()) {
      throw new HttpException('clinicalNotes is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.aiService.generatePriorAuthLetter({
        patientName: dto.patientName,
        patientDob: dto.patientDob,
        medicationName: dto.medicationName,
        diagnosis: dto.diagnosis,
        clinicalNotes: dto.clinicalNotes,
        insurancePlan: dto.insurancePlan,
      });
    } catch (err: any) {
      this.logger.error(`Prior auth letter generation failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI prior auth letter generation failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('denial-risk')
  async predictDenialRisk(@Body() dto: DenialRiskDto) {
    this.logger.debug('Predicting claim denial risk');

    if (!dto.cptCodes || dto.cptCodes.length === 0) {
      throw new HttpException('cptCodes is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.icd10Codes || dto.icd10Codes.length === 0) {
      throw new HttpException('icd10Codes is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.aiService.predictDenialRisk({
        cptCodes: dto.cptCodes,
        icd10Codes: dto.icd10Codes,
        modifierCodes: dto.modifierCodes,
        patientAge: dto.patientAge,
        patientGender: dto.patientGender,
        insuranceType: dto.insuranceType,
        priorDenials: dto.priorDenials,
      });
    } catch (err: any) {
      this.logger.error(`Denial risk prediction failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI denial risk prediction failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('coding-audit')
  async codingAudit(@Body() dto: CodingAuditDto) {
    this.logger.debug('Auditing clinical documentation for coding completeness');

    if (!dto.soapNote || !dto.soapNote.trim()) {
      throw new HttpException('soapNote is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.aiService.auditCoding({
        soapNote: dto.soapNote,
        cptCodes: dto.cptCodes || [],
        icd10Codes: dto.icd10Codes || [],
      });
    } catch (err: any) {
      this.logger.error(`Coding audit failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI coding audit failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('noshow-prediction')
  async noshowPrediction(@Body() dto: NoShowPredictionDto) {
    this.logger.debug('Predicting appointment no-show risk');

    if (!dto.appointmentType || !dto.appointmentType.trim()) {
      throw new HttpException('appointmentType is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.aiService.predictNoShow({
        patientAge: dto.patientAge,
        patientGender: dto.patientGender,
        appointmentType: dto.appointmentType,
        daysSinceLastVisit: dto.daysSinceLastVisit,
        historicalNoShows: dto.historicalNoShows,
        dayOfWeek: dto.dayOfWeek,
        timeOfDay: dto.timeOfDay,
        distanceFromClinic: dto.distanceFromClinic,
      });
    } catch (err: any) {
      this.logger.error(`No-show prediction failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI no-show prediction failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('cdi-review')
  async cdiReview(@Body() dto: CdiReviewDto) {
    this.logger.debug('Reviewing clinical documentation for completeness (CDI)');

    if (!dto.soapNote || !dto.soapNote.trim()) {
      throw new HttpException('soapNote is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.encounterType || !dto.encounterType.trim()) {
      throw new HttpException('encounterType is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.aiService.cdiReview({
        soapNote: dto.soapNote,
        encounterType: dto.encounterType,
      });
    } catch (err: any) {
      this.logger.error(`CDI review failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI CDI review failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('drug-dosing')
  async drugDosing(@Body() dto: DrugDosingDto) {
    this.logger.debug('Generating AI drug dosing recommendations');

    if (!dto.medicationName || !dto.medicationName.trim()) {
      throw new HttpException('medicationName is required', HttpStatus.BAD_REQUEST);
    }
    if (dto.patientAge === undefined || dto.patientAge === null) {
      throw new HttpException('patientAge is required', HttpStatus.BAD_REQUEST);
    }
    if (dto.patientWeight === undefined || dto.patientWeight === null) {
      throw new HttpException('patientWeight is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.aiService.recommendDrugDosing({
        medicationName: dto.medicationName,
        patientAge: dto.patientAge,
        patientWeight: dto.patientWeight,
        patientSex: dto.patientSex,
        creatinine: dto.creatinine,
        diagnosis: dto.diagnosis,
        currentMedications: dto.currentMedications || [],
      });
    } catch (err: any) {
      this.logger.error(`Drug dosing recommendation failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI drug dosing recommendation failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('referral-letter')
  async generateReferralLetter(@Body() dto: ReferralLetterDto) {
    this.logger.debug('Generating referral letter');

    if (!dto.patientName || !dto.patientName.trim()) {
      throw new HttpException('patientName is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.specialistName || !dto.specialistName.trim()) {
      throw new HttpException('specialistName is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.reasonForReferral || !dto.reasonForReferral.trim()) {
      throw new HttpException('reasonForReferral is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.aiService.generateReferralLetter({
        patientName: dto.patientName,
        patientDob: dto.patientDob,
        referringProvider: dto.referringProvider,
        specialistName: dto.specialistName,
        specialty: dto.specialty,
        reasonForReferral: dto.reasonForReferral,
        clinicalSummary: dto.clinicalSummary,
        urgent: dto.urgent,
      });
    } catch (err: any) {
      this.logger.error(`Referral letter generation failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI referral letter generation failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ── Care Plan AI Endpoints ──────────────────────────────────────────────────

  @Post('generate-care-plan')
  async generateCarePlan(@Body() dto: GenerateCarePlanDto) {
    this.logger.debug('Generating AI care plan');

    if (!dto.conditions || dto.conditions.length === 0) {
      throw new HttpException('conditions are required', HttpStatus.BAD_REQUEST);
    }

    const conditionsStr = dto.conditions.map((c) => `${c.condition}${(c.code || c.icd10Code) ? ` (${c.code || c.icd10Code}${c.codeSystem ? ' — ' + c.codeSystem : ''})` : ''}`).join(', ');
    const medsStr = dto.currentMedications.map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`).join(', ');
    const labsStr = (dto.recentLabs || []).map((l) => `${l.test}: ${l.value}${l.unit || ''}${l.date ? ` (${l.date})` : ''}`).join(', ');
    const vitalsStr = (dto.vitals || []).map((v) => `${v.metric}: ${v.value}${v.date ? ` (${v.date})` : ''}`).join(', ');

    const prompt = `You are a clinical care plan assistant. Generate a comprehensive, evidence-based care plan for this patient.

Patient: ${dto.patientName}
Age: ${dto.patientAge || 'Unknown'}, Sex: ${dto.patientSex || 'Unknown'}
Conditions: ${conditionsStr}
Current Medications: ${medsStr || 'None'}
Recent Labs: ${labsStr || 'None'}
Vitals: ${vitalsStr || 'None'}
Allergies: ${(dto.allergies || []).join(', ') || 'None'}
Provider: ${dto.providerName || 'Unknown'}

Return ONLY a JSON object with this exact shape:
{
  "title": "string — concise plan title (e.g. 'Type 2 Diabetes Management Plan')",
  "description": "string — brief plan summary",
  "category": "string — one of: chronic_care, post_discharge, preventive, palliative, behavioral",
  "addresses": [{"condition": "string", "code": "string?", "codeSystem": "string?", "description": "string", "severity": "low|moderate|high|critical"}],
  "goals": [{"description": "string — measurable goal", "targetValue": "string?", "targetUnit": "string?", "metricName": "string?", "targetDirection": "decrease|increase|maintain?", "priority": "high|medium|low", "targetDate": "string? (ISO date)"}],
  "tasks": [{"title": "string", "description": "string?", "taskType": "monitoring|lab_order|medication_adherence|patient_education|lifestyle|follow_up|referral|custom", "assignedTo": "patient|care_team", "frequency": "one_time|daily|weekly|monthly|quarterly", "priority": "high|medium|low", "metricName": "string?", "targetValue": "string?", "targetUnit": "string?"}],
  "patientEducation": [{"title": "string", "content": "string"}],
  "careTeam": [{"role": "string", "description": "string?"}]
}

Base the plan on current clinical guidelines. Include 3-7 goals and 5-15 tasks. Be specific and actionable.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Care plan generation failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI care plan generation failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('suggest-monitoring-tasks')
  async suggestMonitoringTasks(@Body() dto: SuggestMonitoringTasksDto) {
    this.logger.debug('Suggesting monitoring tasks');

    if (!dto.conditions || dto.conditions.length === 0) {
      throw new HttpException('conditions are required', HttpStatus.BAD_REQUEST);
    }

    const conditionsStr = dto.conditions.map((c) => `${c.condition}${(c.code || c.icd10Code) ? ` (${c.code || c.icd10Code}${c.codeSystem ? ' — ' + c.codeSystem : ''})` : ''}`).join(', ');
    const medsStr = dto.currentMedications.map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`).join(', ');
    const labsStr = (dto.recentLabs || []).map((l) => `${l.test}: ${l.value}${l.unit || ''}`).join(', ');

    const prompt = `You are a clinical monitoring assistant. Based on the patient's conditions, medications, and labs, suggest monitoring tasks that should be added to their care plan.

Conditions: ${conditionsStr}
Current Medications: ${medsStr || 'None'}
Recent Labs: ${labsStr || 'None'}

Return ONLY a JSON object with this exact shape:
{
  "tasks": [{"title": "string", "description": "string?", "taskType": "monitoring|lab_order|medication_adherence|patient_education|lifestyle|follow_up", "assignedTo": "patient|care_team", "frequency": "one_time|daily|weekly|monthly|quarterly", "priority": "high|medium|low", "metricName": "string?", "targetValue": "string?", "targetUnit": "string?", "rationale": "string — why this task is recommended"}]
}

Focus on evidence-based monitoring for the specific conditions. Include vital sign tracking, lab frequency, medication adherence checks, and lifestyle modifications.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Monitoring task suggestion failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI monitoring task suggestion failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('risk-stratification')
  async riskStratification(@Body() dto: RiskStratificationDto) {
    this.logger.debug('Running AI risk stratification');

    if (!dto.conditions || dto.conditions.length === 0) {
      throw new HttpException('conditions are required', HttpStatus.BAD_REQUEST);
    }

    const conditionsStr = dto.conditions.map((c) => `${c.condition}${(c.code || c.icd10Code) ? ` (${c.code || c.icd10Code}${c.codeSystem ? ' — ' + c.codeSystem : ''})` : ''}`).join(', ');
    const medsStr = dto.currentMedications.map((m) => m.name).join(', ');
    const labsStr = (dto.recentLabs || []).map((l) => `${l.test}: ${l.value}${l.unit || ''}`).join(', ');
    const vitalsStr = (dto.vitals || []).map((v) => `${v.metric}: ${v.value}`).join(', ');

    const prompt = `You are a clinical risk stratification assistant. Analyze this patient's risk for adverse outcomes (hospitalization, ED visits, complications, mortality) based on their clinical profile.

Patient: ${dto.patientName}
Age: ${dto.patientAge || 'Unknown'}, Sex: ${dto.patientSex || 'Unknown'}
Conditions: ${conditionsStr}
Medications: ${medsStr || 'None'}
Recent Labs: ${labsStr || 'None'}
Vitals: ${vitalsStr || 'None'}
Hospitalizations (last year): ${dto.hospitalizationsLastYear ?? 'Unknown'}
ED Visits (last year): ${dto.edVisitsLastYear ?? 'Unknown'}

Return ONLY a JSON object with this exact shape:
{
  "riskLevel": "low|moderate|high|very_high",
  "riskScore": "number 0-100",
  "riskFactors": [{"factor": "string", "severity": "low|moderate|high", "modifiable": "boolean"}],
  "predictedRisks": [{"outcome": "string (e.g. hospitalization, stroke, MI)", "probability": "string (e.g. '15%')", "timeframe": "string (e.g. '1 year')"}],
  "recommendations": [{"action": "string", "priority": "high|medium|low", "rationale": "string"}],
  "careManagementEnrollment": "boolean — should this patient be enrolled in care management?",
  "summary": "string — brief clinical summary of risk profile"
}

Be evidence-based and conservative. Do not overstate risk.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Risk stratification failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI risk stratification failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('care-gap-detection')
  async careGapDetection(@Body() dto: CareGapDetectionDto) {
    this.logger.debug('Running AI care gap detection');

    if (!dto.conditions || dto.conditions.length === 0) {
      throw new HttpException('conditions are required', HttpStatus.BAD_REQUEST);
    }

    const conditionsStr = dto.conditions.map((c) => `${c.condition}${(c.code || c.icd10Code) ? ` (${c.code || c.icd10Code}${c.codeSystem ? ' — ' + c.codeSystem : ''})` : ''}`).join(', ');
    const medsStr = dto.currentMedications.map((m) => m.name).join(', ');
    const labsStr = (dto.recentLabs || []).map((l) => `${l.test}: ${l.value}${l.date ? ` (${l.date})` : ''}`).join(', ');
    const imagingStr = (dto.lastImaging || []).map((i) => `${i.type}${i.date ? ` (${i.date})` : ''}`).join(', ');
    const immunizationsStr = (dto.immunizations || []).map((i) => `${i.name}${i.date ? ` (${i.date})` : ''}`).join(', ');

    const prompt = `You are a clinical quality and care gap assistant. Identify care gaps for this patient based on clinical guidelines, preventive care recommendations, and chronic disease management standards.

Patient Age: ${dto.patientAge || 'Unknown'}, Sex: ${dto.patientSex || 'Unknown'}
Conditions: ${conditionsStr}
Medications: ${medsStr || 'None'}
Recent Labs: ${labsStr || 'None'}
Last Imaging: ${imagingStr || 'None'}
Immunizations: ${immunizationsStr || 'None'}
Last Appointment: ${dto.lastAppointmentDate || 'Unknown'}

Return ONLY a JSON object with this exact shape:
{
  "careGaps": [{"gap": "string — description of the care gap", "category": "preventive|chronic_care|medication_safety|lab_monitoring|imaging|immunization", "severity": "low|moderate|high", "recommendation": "string — what should be done", "guideline": "string — source guideline (e.g. USPSTF, ADA, ACC/AHA)", "dueDate": "string? (ISO date when it should be completed)"}],
  "qualityMeasures": [{"measure": "string (e.g. 'HbA1c testing for diabetes')", "status": "met|not_met|overdue", "lastValue": "string?", "targetValue": "string?"}],
  "summary": "string — brief summary of care gap status"
}

Focus on actionable, evidence-based gaps. Include preventive screenings, chronic disease monitoring, medication safety checks, and immunizations.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Care gap detection failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI care gap detection failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─── Immunization AI Endpoints ──────────────────────────────────

  @Post('immunization-forecast')
  async immunizationForecast(@Body() dto: ImmunizationForecastDto) {
    this.logger.debug('Running AI immunization forecast');

    if (!dto.immunizationHistory) {
      throw new HttpException('immunizationHistory is required', HttpStatus.BAD_REQUEST);
    }

    const historyStr = dto.immunizationHistory
      .map((i) => `${i.vaccineName}${i.cvxCode ? ` (CVX ${i.cvxCode})` : ''} — dose ${i.doseNumber || 1} on ${i.date}`)
      .join('\n  ');
    const conditionsStr = (dto.conditions || []).map((c) => `${c.condition}${c.icd10Code ? ` (${c.icd10Code})` : ''}`).join(', ');
    const allergiesStr = (dto.allergies || []).join(', ');

    const prompt = `You are a pediatric immunization expert following the CDC ACIP immunization schedule. Analyze this patient's immunization history and forecast what vaccines are due now, overdue, or upcoming.

Patient Age: ${dto.patientAgeMonths} months old
Sex: ${dto.patientSex || 'Unknown'}
Gestational Age: ${dto.gestationalAgeWeeks ? dto.gestationalAgeWeeks + ' weeks' : 'Term (37+ weeks)'}
Conditions: ${conditionsStr || 'None'}
Allergies: ${allergiesStr || 'None'}

Immunization History:
  ${historyStr || 'No immunizations recorded'}

Return ONLY a JSON object with this exact shape:
{
  "dueNow": [{"vaccineName": "string", "cvxCode": "string?", "doseNumber": "number", "reason": "string — why it's due now", "earliestDate": "string (ISO date)", "recommendedDate": "string (ISO date)"}],
  "overdue": [{"vaccineName": "string", "cvxCode": "string?", "doseNumber": "number", "reason": "string — why it's overdue", "overdueSince": "string (ISO date)", "catchUpRecommendation": "string"}],
  "upcoming": [{"vaccineName": "string", "cvxCode": "string?", "doseNumber": "number", "dueDate": "string (ISO date)", "reason": "string"}],
  "completed": [{"vaccineName": "string", "dosesReceived": "number", "dosesRequired": "number", "status": "complete|incomplete", "nextDoseDue": "string? (ISO date)"}],
  "summary": "string — brief summary of immunization status"
}

Base recommendations on the current CDC ACIP immunization schedule. For catch-up scheduling, follow ACIP catch-up guidance. Consider gestational age for preemie adjustments (only first 2 years). Flag any vaccines contraindicated by conditions or allergies.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Immunization forecast failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI immunization forecast failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('immunization-contraindication')
  async immunizationContraindication(@Body() dto: ContraindicationCheckDto) {
    this.logger.debug(`Running AI contraindication check for ${dto.vaccineName}`);

    const conditionsStr = (dto.conditions || []).map((c) => `${c.condition}${c.icd10Code ? ` (${c.icd10Code})` : ''}`).join(', ');
    const allergiesStr = (dto.allergies || []).join(', ');
    const medsStr = (dto.currentMedications || []).map((m) => m.name).join(', ');
    const reactionsStr = (dto.priorReactions || []).join(', ');
    const historyStr = (dto.immunizationHistory || []).map((i) => `${i.vaccineName} on ${i.date}`).join(', ');

    const prompt = `You are an immunization safety expert. Evaluate whether the following vaccine is contraindicated for this patient based on their medical history, conditions, allergies, medications, and prior reactions.

Vaccine: ${dto.vaccineName}${dto.cvxCode ? ` (CVX ${dto.cvxCode})` : ''}
Patient Age: ${dto.patientAgeMonths} months
Sex: ${dto.patientSex || 'Unknown'}
Conditions: ${conditionsStr || 'None'}
Allergies: ${allergiesStr || 'None'}
Current Medications: ${medsStr || 'None'}
Prior Vaccine Reactions: ${reactionsStr || 'None'}
Prior Immunizations: ${historyStr || 'None'}

Return ONLY a JSON object with this exact shape:
{
  "safe": "boolean — true if vaccine can be administered, false if contraindicated",
  "contraindications": [{"reason": "string — the contraindication", "severity": "absolute|relative|precaution", "detail": "string — clinical explanation", "source": "string — guideline source (e.g. ACIP, CDC Pink Book)"}],
  "warnings": [{"reason": "string — the warning", "detail": "string — what to watch for"}],
  "recommendations": ["string — actionable steps (e.g. 'Administer in observation setting', 'Consider alternative vaccine', 'Defer until condition resolves')"],
  "alternativeVaccines": ["string — alternative vaccines if contraindicated"],
  "summary": "string — brief clinical summary"
}

Consider: severe allergies (anaphylaxis to vaccine components), immunocompromised states (live vaccines), pregnancy (live vaccines), encephalopathy after prior dose (DTaP), Guillain-Barré after influenza, moderate/severe acute illness, and immunosuppressive medications. Distinguish absolute contraindications from precautions.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Contraindication check failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI contraindication check failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('vaccine-education')
  async vaccineEducation(@Body() dto: VaccineEducationDto) {
    this.logger.debug(`Generating vaccine education for ${dto.vaccineName}`);

    const lang = dto.language || 'English';
    const readingLevel = dto.readingLevel || '6th grade';

    const prompt = `You are a patient education specialist. Generate clear, empathetic, age-appropriate vaccine education material for parents/patients.

Vaccine: ${dto.vaccineName}
Patient Age: ${dto.patientAgeMonths} months
Sex: ${dto.patientSex || 'Unknown'}
Language: ${lang}
Target Reading Level: ${readingLevel}

Return ONLY a JSON object with this exact shape:
{
  "vaccineName": "string",
  "whatItProtectsAgainst": "string — plain language description of the disease(s) prevented",
  "whyImportant": "string — why this vaccine matters at this age",
  "howGiven": "string — how the vaccine is administered (route, number of doses, schedule)",
  "commonSideEffects": ["string — mild, expected side effects"],
  "rareSideEffects": ["string — rare but serious side effects to watch for"],
  "whenToCallDoctor": ["string — warning signs that require medical attention"],
  "whatToExpectAfter": "string — what to expect in the 24-48 hours after vaccination",
  "mythsAndFacts": [{"myth": "string", "fact": "string"}],
  "parentTips": ["string — practical tips for the visit and aftercare"],
  "summary": "string — one-sentence summary"
}

Write at a ${readingLevel} reading level in ${lang}. Be warm, reassuring, and factual. Do not minimize risks but do not alarm unnecessarily. Reference CDC and AAP guidance implicitly.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Vaccine education failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI vaccine education failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('travel-vaccines')
  async travelVaccines(@Body() dto: TravelVaccineDto) {
    this.logger.debug(`Running AI travel vaccine recommendations for: ${dto.destinations.join(', ')}`);

    if (!dto.destinations || dto.destinations.length === 0) {
      throw new HttpException('destinations is required', HttpStatus.BAD_REQUEST);
    }

    const historyStr = (dto.immunizationHistory || []).map((i) => `${i.vaccineName} on ${i.date}`).join(', ');
    const conditionsStr = (dto.conditions || []).map((c) => `${c.condition}${c.icd10Code ? ` (${c.icd10Code})` : ''}`).join(', ');
    const allergiesStr = (dto.allergies || []).join(', ');

    const prompt = `You are a travel medicine specialist. Recommend travel-specific vaccines and preventive measures for this patient based on CDC travel health guidelines (Yellow Book).

Destinations: ${dto.destinations.join(', ')}
Departure Date: ${dto.departureDate}
Return Date: ${dto.returnDate || 'Unknown'}
Patient Age: ${dto.patientAgeMonths} months
Sex: ${dto.patientSex || 'Unknown'}
Pregnant: ${dto.pregnancy ? 'Yes' : 'No'}
Conditions: ${conditionsStr || 'None'}
Allergies: ${allergiesStr || 'None'}
Immunization History: ${historyStr || 'None'}

Return ONLY a JSON object with this exact shape:
{
  "requiredVaccines": [{"vaccineName": "string", "reason": "string — why required for this destination", "isRequired": "boolean — true if required for entry, false if recommended", "dosesNeeded": "number", "schedule": "string — timing (e.g. 'at least 10 days before travel')", "alreadyCovered": "boolean"}],
  "recommendedVaccines": [{"vaccineName": "string", "reason": "string", "dosesNeeded": "number", "schedule": "string", "alreadyCovered": "boolean"}],
  "routineBoosters": [{"vaccineName": "string", "reason": "string — why a booster is needed before travel", "dueDate": "string?"}],
  "medications": [{"medication": "string — e.g. antimalarial", "reason": "string", "schedule": "string — prophylaxis timing", "duration": "string"}],
  "precautions": ["string — general travel health precautions"],
  "destinationSpecificRisks": [{"destination": "string", "risks": ["string — disease risks for this destination"], "notes": "string"}],
  "timeSensitive": ["string — items that must be done X days before departure"],
  "summary": "string — brief summary"
}

Base recommendations on CDC Yellow Book, WHO IHR, and destination-specific requirements. Consider:
- Yellow fever (required for some African/South American countries)
- Typhoid, Hepatitis A, Hepatitis B
- Japanese encephalitis, rabies (for rural/extended stay)
- Meningococcal (Hajj/Umrah)
- Cholera, polio boosters
- Malaria prophylaxis
- Altitude sickness medication if applicable
- Check if patient's existing immunizations already cover recommended vaccines`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Travel vaccine recommendations failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI travel vaccine recommendations failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ─── Growth AI Endpoints ────────────────────────────────────────

  @Post('growth-assessment')
  async growthAssessment(@Body() dto: GrowthAssessmentDto) {
    this.logger.debug('Running AI growth assessment');

    if (!dto.weightMeasurements || dto.weightMeasurements.length === 0) {
      throw new HttpException('weightMeasurements are required', HttpStatus.BAD_REQUEST);
    }

    const weightStr = dto.weightMeasurements.map((w) => `${w.date}: ${w.value}${w.unit} (${w.percentile ? w.percentile + 'th %ile' : 'no %ile'})`).join(', ');
    const heightStr = dto.heightMeasurements.map((h) => `${h.date}: ${h.value}${h.unit} (${h.percentile ? h.percentile + 'th %ile' : 'no %ile'})`).join(', ');
    const headStr = (dto.headCircumferenceMeasurements || []).map((h) => `${h.date}: ${h.value}cm (${h.percentile ? h.percentile + 'th %ile' : 'no %ile'})`).join(', ');
    const bmiStr = (dto.bmiMeasurements || []).map((b) => `${b.date}: ${b.value} (${b.percentile ? b.percentile + 'th %ile' : 'no %ile'})`).join(', ');
    const conditionsStr = (dto.conditions || []).map((c) => `${c.condition}${c.icd10Code ? ` (${c.icd10Code})` : ''}`).join(', ');
    const mphStr = dto.midParentalHeight ? `Target: ${dto.midParentalHeight.targetHeightCm}cm (range ${dto.midParentalHeight.rangeLowCm}-${dto.midParentalHeight.rangeHighCm}cm)` : 'Not available';

    const prompt = `You are a pediatric growth and nutrition expert. Analyze this patient's growth trajectory and identify any concerns.

Patient Age: ${dto.patientAgeMonths} months
Sex: ${dto.patientSex}
Gestational Age: ${dto.gestationalAgeWeeks ? dto.gestationalAgeWeeks + ' weeks' : 'Term'}
Conditions: ${conditionsStr || 'None'}
Mid-Parental Height: ${mphStr}

Weight History: ${weightStr}
Height History: ${heightStr}
Head Circumference History: ${headStr || 'None'}
BMI History: ${bmiStr || 'None'}

Return ONLY a JSON object with this exact shape:
{
  "overallAssessment": "string — overall growth status (normal, concerning, abnormal)",
  "weightStatus": {"percentile": "number?", "trend": "string — increasing|stable|decreasing|crossing-down|crossing-up", "concern": "string? — concern if any"},
  "heightStatus": {"percentile": "number?", "trend": "string", "concern": "string?"},
  "headCircumferenceStatus": {"percentile": "number?", "trend": "string", "concern": "string?"},
  "bmiStatus": {"percentile": "number?", "category": "string — underweight|healthy|overweight|obese", "concern": "string?"},
  "growthVelocity": {"weightVelocity": "string? — kg/month or kg/year", "heightVelocity": "string? — cm/month or cm/year", "assessment": "string — normal|slow|rapid"},
  "concerns": [{"type": "failure_to_thrive|stunting|wasting|overweight|obesity|microcephaly|macrocephaly|crossing_percentiles", "severity": "mild|moderate|severe", "detail": "string — clinical explanation", "evidence": "string — what data supports this"}],
  "recommendations": [{"action": "string — what should be done", "priority": "high|moderate|low", "timeframe": "string — when to act", "rationale": "string"}],
  "followUp": {"timeframe": "string — when to reassess", "measurements": ["string — what to measure at follow-up"], "referralNeeded": "boolean", "referralType": "string? — e.g. endocrinology, nutrition, gastroenterology"},
  "summary": "string — brief clinical summary"
}

Key clinical rules to apply:
- Failure to thrive: weight crossing 2 major percentile lines downward, or weight < 5th percentile, or weight-for-length < 5th percentile
- Stunting: height-for-age < 5th percentile or crossing downward
- Overweight: BMI 85th-95th percentile; Obesity: BMI > 95th percentile
- Microcephaly: head circumference < 3rd percentile; Macrocephaly: > 97th percentile
- Growth velocity concerns: < 5 cm/year after age 2, or any downward crossing of percentiles
- Consider mid-parental height: if height percentile is far below expected based on parents, investigate`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Growth assessment failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI growth assessment failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('growth-counseling')
  async growthCounseling(@Body() dto: GrowthCounselingDto) {
    this.logger.debug('Generating AI growth counseling');

    const lang = dto.language || 'English';
    const conditionsStr = (dto.conditions || []).map((c) => c.condition).join(', ');
    const mphStr = dto.midParentalHeight ? `Target adult height: ${dto.midParentalHeight.targetHeightCm}cm (expected range ${dto.midParentalHeight.rangeLowCm}-${dto.midParentalHeight.rangeHighCm}cm)` : 'Not available';

    const prompt = `You are a pediatrician explaining growth chart results to a parent in a warm, reassuring, and clear manner.

Child's Age: ${dto.patientAgeMonths} months
Sex: ${dto.patientSex}
Child's Name: ${dto.patientName || 'your child'}

Growth Percentiles:
- Weight: ${dto.weightPercentile !== undefined ? dto.weightPercentile + 'th percentile' : 'not available'}
- Height: ${dto.heightPercentile !== undefined ? dto.heightPercentile + 'th percentile' : 'not available'}
- Head Circumference: ${dto.headCircumferencePercentile !== undefined ? dto.headCircumferencePercentile + 'th percentile' : 'not available'}
- BMI: ${dto.bmiPercentile !== undefined ? dto.bmiPercentile + 'th percentile' : 'not available'}

Weight Trend: ${dto.weightTrend || 'not available'}
Height Trend: ${dto.heightTrend || 'not available'}
Mid-Parental Height: ${mphStr}
Conditions: ${conditionsStr || 'None'}
Language: ${lang}

Return ONLY a JSON object with this exact shape:
{
  "greeting": "string — warm, personalized greeting",
  "weightExplanation": "string — what the weight percentile means in plain language",
  "heightExplanation": "string — what the height percentile means in plain language",
  "headCircumferenceExplanation": "string? — if applicable, what head circumference means",
  "bmiExplanation": "string? — if applicable, what BMI percentile means",
  "overallMessage": "string — overall growth summary, reassuring but honest",
  "whatThePercentilesMean": "string — brief explanation of what percentiles are",
  "whatToWatchFor": ["string — things parents should monitor"],
  "nutritionTips": ["string — age-appropriate nutrition guidance"],
  "activityTips": ["string — age-appropriate physical activity guidance"],
  "whenToRecheck": "string — when the next growth check should happen",
  "whenToCallDoctor": ["string — warning signs that need medical attention"],
  "encouragement": "string — closing encouraging message"
}

Write at a 6th grade reading level in ${lang}. Be warm and supportive. Avoid medical jargon. Explain percentiles simply (e.g. "if 100 children were lined up by size, your child would be number X"). Never alarm unnecessarily, but don't minimize real concerns.`;

    try {
      return await this.aiService.generateStructured(prompt);
    } catch (err: any) {
      this.logger.error(`Growth counseling failed: ${err.message}`);
      throw new HttpException(
        err.message || 'AI growth counseling failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
