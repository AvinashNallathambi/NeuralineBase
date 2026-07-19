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
}
