import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

export interface AppealGenerationInput {
  payerName: string;
  patientName: string;
  claimNumber: string;
  serviceDate: string;
  cptCodes: string[];
  diagnosisCodes: string[];
  deniedAmount: number;
  carcCode: string;
  carcDescription: string;
  rarcCode?: string;
  rarcDescription?: string;
  denialReasonText?: string;
  clinicalNotes?: string;
  providerName: string;
  providerNPI: string;
  facilityName?: string;
}

export interface AppealGenerationResult {
  subject: string;
  letter: string;
  successProbability: number; // 0-100
  rationale: string;
  keyArguments: string[];
  recommendedDocuments: string[];
}

@Injectable()
export class AppealAiService {
  private readonly logger = new Logger(AppealAiService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Generate an appeal letter using GenAI (Ollama/Mistral).
   * The AI reads the denial reason, clinical notes, and claim data,
   * then generates a payer-specific, evidence-based appeal letter.
   */
  async generateAppealLetter(input: AppealGenerationInput): Promise<AppealGenerationResult> {
    this.logger.log(`Generating appeal letter for claim ${input.claimNumber}, CARC ${input.carcCode}`);

    const prompt = this.buildPrompt(input);

    try {
      const result = await this.aiService.generateStructured<AppealGenerationResult>(prompt, {
        temperature: 0.3,
        maxTokens: 4096,
      });

      // Validate and sanitize
      return {
        subject: result.subject || `Appeal for Denied Claim ${input.claimNumber}`,
        letter: result.letter || '',
        successProbability: Math.min(100, Math.max(0, result.successProbability || 50)),
        rationale: result.rationale || '',
        keyArguments: result.keyArguments || [],
        recommendedDocuments: result.recommendedDocuments || [],
      };
    } catch (err: any) {
      this.logger.error(`AI appeal generation failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Predict the probability of appeal success based on denial data.
   */
  async predictAppealSuccess(input: AppealGenerationInput): Promise<{
    probability: number;
    rationale: string;
  }> {
    const prompt = `You are a healthcare revenue cycle expert specializing in claim appeals.

Analyze this denied claim and predict the probability of a successful appeal (0-100%).

Claim Details:
- Claim Number: ${input.claimNumber}
- Payer: ${input.payerName}
- Denied Amount: $${input.deniedAmount}
- CARC Code: ${input.carcCode} (${input.carcDescription})
- RARC Code: ${input.rarcCode || 'N/A'} (${input.rarcDescription || 'N/A'})
- CPT Codes: ${input.cptCodes.join(', ')}
- Diagnosis Codes: ${input.diagnosisCodes.join(', ')}
- Service Date: ${input.serviceDate}
- Denial Reason: ${input.denialReasonText || 'N/A'}
- Clinical Notes: ${input.clinicalNotes || 'N/A'}

Consider:
1. The specific CARC/RARC code and its typical overturn rate
2. Whether the denial is likely a documentation issue vs. policy issue
3. Whether additional documentation could support the appeal
4. The payer's historical appeal behavior patterns
5. The strength of the clinical evidence

Respond with JSON:
{
  "probability": <number 0-100>,
  "rationale": "<explanation of the prediction>"
}`;

    try {
      const result = await this.aiService.generateStructured<{ probability: number; rationale: string }>(
        prompt,
        { temperature: 0.2, maxTokens: 1024 },
      );
      return {
        probability: Math.min(100, Math.max(0, result.probability || 50)),
        rationale: result.rationale || '',
      };
    } catch (err: any) {
      this.logger.error(`Appeal success prediction failed: ${err.message}`);
      return { probability: 50, rationale: 'Unable to generate prediction' };
    }
  }

  private buildPrompt(input: AppealGenerationInput): string {
    return `You are an expert healthcare billing advocate who writes persuasive, evidence-based appeal letters for denied medical claims.

Write a formal appeal letter for the following denied claim:

CLAIM DETAILS:
- Claim Number: ${input.claimNumber}
- Patient Name: ${input.patientName}
- Payer: ${input.payerName}
- Provider: ${input.providerName} (NPI: ${input.providerNPI})
- Facility: ${input.facilityName || input.providerName}
- Service Date: ${input.serviceDate}
- CPT Codes: ${input.cptCodes.join(', ')}
- Diagnosis Codes (ICD-10): ${input.diagnosisCodes.join(', ')}
- Denied Amount: $${input.deniedAmount.toFixed(2)}

DENIAL DETAILS:
- CARC Code: ${input.carcCode}
- CARC Description: ${input.carcDescription}
- RARC Code: ${input.rarcCode || 'N/A'}
- RARC Description: ${input.rarcDescription || 'N/A'}
- Denial Reason Text: ${input.denialReasonText || 'N/A'}

CLINICAL SUPPORT:
${input.clinicalNotes || 'No additional clinical notes provided.'}

REQUIREMENTS:
1. Write a professional, formal appeal letter addressed to the payer
2. Include a clear subject line referencing the claim number and denial
3. Cite the specific denial code and explain why the denial should be overturned
4. Reference relevant medical necessity criteria, coverage policies, or coding guidelines
5. Include the clinical evidence that supports the service being medically necessary
6. Request specific action (full payment of $${input.deniedAmount.toFixed(2)})
7. Include a deadline for response (30 days)
8. Be persuasive but professional — not aggressive
9. Structure: Header (date, payer address), Subject, Body (3-4 paragraphs), Closing

Also provide:
- successProbability: Your estimate (0-100) of the likelihood this appeal will be overturned
- rationale: Brief explanation of why you assigned that probability
- keyArguments: Array of 3-5 key arguments used in the letter
- recommendedDocuments: Array of supporting documents that should accompany the appeal

Respond with JSON:
{
  "subject": "<appeal subject line>",
  "letter": "<full appeal letter text with proper formatting>",
  "successProbability": <number 0-100>,
  "rationale": "<explanation>",
  "keyArguments": ["<argument 1>", "<argument 2>", ...],
  "recommendedDocuments": ["<document 1>", "<document 2>", ...]
}`;
  }
}
