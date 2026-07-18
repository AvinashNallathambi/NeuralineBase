import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Logger,
  Request,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { AssemblyAiTranscriptionService } from './assemblyai-transcription.service';
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

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly assemblyAiTranscriptionService: AssemblyAiTranscriptionService,
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
  @UseInterceptors(FileInterceptor('file'))
  async transcribe(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    if (!file.mimetype.startsWith('audio/')) {
      throw new BadRequestException('Uploaded file must be an audio file');
    }

    // Limit uploaded audio to 100 MB to prevent abuse
    const MAX_SIZE_BYTES = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('Audio file exceeds 100 MB limit');
    }

    this.logger.debug(
      `Transcription requested [mime=${file.mimetype}, size=${file.size} bytes] — forwarding to AssemblyAI`,
    );

    const result = await this.assemblyAiTranscriptionService.transcribeAudioBuffer(
      file.buffer,
      file.mimetype,
    );

    return {
      text: result.text,
      duration: result.duration,
      confidence: result.confidence,
      words: result.words,
      utterances: result.utterances,
      languageCode: result.languageCode,
      provider: 'assemblyai',
    };
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
}
