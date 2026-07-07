import { Controller, Post, Body, Get, UseGuards, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly aiService: AiService) {}

  @Get('health')
  async health() {
    return this.aiService.healthCheck();
  }

  @Post('generate-soap')
  async generateSoap(@Body() dto: GenerateSoapDto) {
    this.logger.debug('Generating SOAP note from transcript');

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

    return this.aiService.generateStructured(prompt);
  }

  @Post('suggest-codes')
  async suggestCodes(@Body() dto: SuggestCodesDto) {
    this.logger.debug('Suggesting medical codes from SOAP note');

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

    return this.aiService.generateStructured(prompt);
  }

  @Post('suggest-diagnosis')
  async suggestDiagnosis(@Body() dto: SuggestDiagnosisDto) {
    this.logger.debug(`Suggesting ICD-10 codes from natural language query: "${dto.query.slice(0, 100)}"`);

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

    return this.aiService.generateStructured(prompt);
  }

  @Post('transcribe')
  async transcribe(@Body() dto: { audioUrl?: string }) {
    // This is a proxy endpoint — in production it would forward to the Whisper service
    // For local dev, we return a mock or call the whisper service
    this.logger.debug('Transcription requested — proxy to whisper service');
    return { text: 'Transcription service available at /api/v1/ai/transcribe', note: 'Upload audio to Whisper service at port 8001' };
  }
}
