import { Controller, Post, Body, UseGuards, Logger, BadRequestException } from '@nestjs/common';
import { AiService } from '../../modules/ai/ai.service';
import { SuperbillsService } from './superbills.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { ScrubSuperbillDto, PredictDenialDto, GenerateGfeDto, SmartCodeFromNotesDto } from './dto/superbill-ai.dto';
import { SuperbillStatus } from './entities/superbill.entity';

interface ScrubFinding {
  severity: 'critical' | 'warning' | 'info';
  category: 'documentation' | 'coding' | 'compliance' | 'billing';
  message: string;
  suggestion: string;
  field?: string;
}

interface ScrubResult {
  qualityScore: number;
  findings: ScrubFinding[];
  isClean: boolean;
  summary: string;
}

interface DenialRiskResult {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  topReasons: string[];
  recommendedActions: string[];
  estimatedReimbursement: number;
}

interface GfeItem {
  service: string;
  cptCode: string;
  charge: number;
  insuranceEstimate: number;
  patientEstimate: number;
}

interface GfeResult {
  totalCharge: number;
  insuranceEstimate: number;
  patientEstimate: number;
  items: GfeItem[];
  disclaimers: string[];
  complianceNotes: string[];
}

interface SmartCodeResult {
  suggestedDiagnoses: Array<{
    code: string;
    description: string;
    confidence: number;
    rationale: string;
  }>;
  suggestedProcedures: Array<{
    code: string;
    description: string;
    confidence: number;
    rationale: string;
    suggestedModifiers: string[];
  }>;
  missingDocumentation: string[];
  codingTips: string[];
}

@Controller('superbills/ai')
@UseGuards(JwtAuthGuard)
export class SuperbillAiController {
  private readonly logger = new Logger(SuperbillAiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly superbillsService: SuperbillsService,
  ) {}

  @Post('scrub')
  async scrubSuperbill(@Body() dto: ScrubSuperbillDto): Promise<ScrubResult> {
    this.logger.debug(`Scrubbing superbill ${dto.superbillId}`);

    const superbill = await this.superbillsService.findOne(dto.superbillId);

    const prompt = `You are a certified medical billing auditor (CPMA). Perform a quality scrub on the following superbill. Identify missing required fields, coding errors, documentation gaps, and compliance issues.

Superbill Data:
- Patient: ${superbill.patientName}, DOB: ${superbill.patientDOB}
- Provider: ${superbill.providerName}, NPI: ${superbill.providerNPI}
- Service Date: ${superbill.serviceDate}
- Insurance: ${superbill.insurance.provider}, Policy: ${superbill.insurance.policyNumber}, Payer ID: ${superbill.insurance.payerId}
- Status: ${superbill.status}
- Total Amount: $${superbill.totalAmount}

Diagnoses:
${superbill.diagnoses.map((d, i) => `${i + 1}. ${d.icdCode} - ${d.description} (${d.type})`).join('\n') || 'None'}

Procedures:
${superbill.procedures.map((p, i) => `${i + 1}. ${p.cptCode} - ${p.description}, Units: ${p.units}, Charge: $${p.charge}, Modifiers: ${p.modifiers?.join(', ') || 'None'}, DX Pointer: ${p.diagnosisPointer?.join(', ') || 'None'}`).join('\n') || 'None'}

Additional Charges:
${superbill.charges.map((c, i) => `${i + 1}. ${c.description} - $${c.amount} (${c.type})`).join('\n') || 'None'}

${dto.clinicalNotes ? `Clinical Notes Context:\n${dto.clinicalNotes}` : ''}

Return ONLY a JSON object with this exact shape:
{
  "qualityScore": number from 0 to 100,
  "isClean": boolean,
  "summary": "2-3 sentence summary of the superbill quality",
  "findings": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "documentation" | "coding" | "compliance" | "billing",
      "message": "description of the issue",
      "suggestion": "how to fix it",
      "field": "optional field name like 'diagnoses' or 'procedures'"
    }
  ]
}

Scrub Rules:
- CRITICAL: Missing patient name, DOB, insurance info, provider NPI, or service date.
- CRITICAL: CPT code without linked diagnosis pointer.
- CRITICAL: Missing modifiers when required (e.g., E/M with procedure should have modifier 25).
- WARNING: Diagnosis codes without proper specificity.
- WARNING: High charge without supporting documentation.
- INFO: Suggestions to improve billing accuracy.`;

    return this.aiService.generateStructured<ScrubResult>(prompt);
  }

  @Post('predict-denial')
  async predictDenial(@Body() dto: PredictDenialDto): Promise<DenialRiskResult> {
    this.logger.debug(`Predicting denial risk for superbill ${dto.superbillId}`);

    const superbill = await this.superbillsService.findOne(dto.superbillId);

    const prompt = `You are a revenue cycle management (RCM) analyst with expertise in payer denial patterns. Predict the likelihood of claim denial for the following superbill based on common payer rules, NCCI edits, and LCD/NCD guidelines.

Superbill Data:
- Payer: ${superbill.insurance.provider}, Payer ID: ${superbill.insurance.payerId}
- Provider NPI: ${superbill.providerNPI}
- Service Date: ${superbill.serviceDate}
- Total Amount: $${superbill.totalAmount}

Diagnoses:
${superbill.diagnoses.map((d) => `- ${d.icdCode}: ${d.description}`).join('\n') || 'None'}

Procedures:
${superbill.procedures.map((p) => `- ${p.cptCode}: ${p.description}, Units: ${p.units}, Modifiers: ${p.modifiers?.join(', ') || 'None'}, DX Pointer: ${p.diagnosisPointer?.join(', ') || 'None'}`).join('\n') || 'None'}

${dto.payerHistory ? `Payer History / Context:\n${dto.payerHistory}` : ''}

Return ONLY a JSON object with this exact shape:
{
  "riskScore": number from 0 to 100,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "topReasons": ["reason 1", "reason 2", ...],
  "recommendedActions": ["action 1", "action 2", ...],
  "estimatedReimbursement": number (dollar amount estimate)
}

Denial Prediction Rules:
- Score 0-25 = low risk: clean claim, likely to pass.
- Score 26-50 = medium risk: minor issues that may cause delay.
- Score 51-75 = high risk: likely denial, needs fixes before submission.
- Score 76-100 = critical risk: almost certain denial.
- Consider NCCI edits (e.g., 99213 + 99213 same day = conflict).
- Consider modifier requirements (e.g., modifier 25 for E/M with procedure).
- Consider medical necessity (diagnosis must support procedure).`;

    return this.aiService.generateStructured<DenialRiskResult>(prompt);
  }

  @Post('generate-gfe')
  async generateGoodFaithEstimate(@Body() dto: GenerateGfeDto): Promise<GfeResult> {
    this.logger.debug(`Generating GFE for superbill ${dto.superbillId}`);

    const superbill = await this.superbillsService.findOne(dto.superbillId);

    const prompt = `You are a healthcare pricing transparency specialist. Generate a Good Faith Estimate (GFE) compliant with the No Surprises Act for the following out-of-network patient services.

Superbill Data:
- Patient: ${superbill.patientName}, DOB: ${superbill.patientDOB}
- Service Date: ${superbill.serviceDate}
- Insurance: ${superbill.insurance.provider}

Procedures & Charges:
${superbill.procedures.map((p) => `- ${p.cptCode}: ${p.description}, Units: ${p.units}, Charge: $${p.charge}`).join('\n') || 'None'}

Additional Charges:
${superbill.charges.map((c) => `- ${c.description}: $${c.amount} (${c.type})`).join('\n') || 'None'}

Total Amount: $${superbill.totalAmount}

Return ONLY a JSON object with this exact shape:
{
  "totalCharge": number,
  "insuranceEstimate": number (estimated insurance allowed amount),
  "patientEstimate": number (estimated patient out-of-pocket),
  "items": [
    {
      "service": "description",
      "cptCode": "code",
      "charge": number,
      "insuranceEstimate": number,
      "patientEstimate": number
    }
  ],
  "disclaimers": ["disclaimer 1", ...],
  "complianceNotes": ["compliance note 1", ...]
}

Rules:
- Insurance estimate is typically 60-80% of charge for out-of-network.
- Patient estimate is typically 20-40% of charge after insurance.
- Include standard No Surprises Act disclaimers.
- Include compliance notes about GFE requirements.`;

    return this.aiService.generateStructured<GfeResult>(prompt);
  }

  @Post('smart-codes')
  async smartCodesFromNotes(@Body() dto: SmartCodeFromNotesDto): Promise<SmartCodeResult> {
    this.logger.debug('Generating smart codes from clinical notes');

    const prompt = `You are a certified medical coder (CPC) and clinical documentation improvement (CDI) specialist. Analyze the following clinical notes and suggest accurate ICD-10 and CPT codes.

Clinical Notes:
"""${dto.clinicalNotes}"""

${dto.existingDiagnoses?.length ? `Existing Diagnoses:\n${dto.existingDiagnoses.map((d) => `- ${d.icdCode}: ${d.description}`).join('\n')}` : ''}

${dto.existingProcedures?.length ? `Existing Procedures:\n${dto.existingProcedures.map((p) => `- ${p.cptCode}: ${p.description}`).join('\n')}` : ''}

Return ONLY a JSON object with this exact shape:
{
  "suggestedDiagnoses": [
    { "code": "ICD-10", "description": "description", "confidence": 0.95, "rationale": "why" }
  ],
  "suggestedProcedures": [
    { "code": "CPT", "description": "description", "confidence": 0.92, "rationale": "why", "suggestedModifiers": ["25"] }
  ],
  "missingDocumentation": ["list of documentation that is missing or could be improved"],
  "codingTips": ["practical coding tip 1", ...]
}

Rules:
- Suggest at most 5 diagnoses and 3 procedures.
- Confidence must be 0.0-1.0.
- Include rationale for each code.
- Suggest modifiers when clinically appropriate.
- Highlight missing documentation that would support higher-level coding.`;

    return this.aiService.generateStructured<SmartCodeResult>(prompt);
  }
}
