import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsurancePayer } from './entities/insurance-payer.entity';

export interface CardScanResult {
  extractedData: {
    insurancePayerName?: string;
    policyNumber?: string;
    groupNumber?: string;
    subscriberName?: string;
    subscriberRelation?: 'self' | 'spouse' | 'child' | 'other';
    subscriberDob?: string;
    effectiveDate?: string;
    expirationDate?: string;
    copayAmount?: number;
    deductibleAmount?: number;
    coinsurancePercentage?: number;
    planType?: string;
    payerId?: string;
    rxbin?: string;
    rxpcn?: string;
    rxgroup?: string;
  };
  confidence: Record<string, number>;
  matchedPayerId?: string;
  matchedPayerName?: string;
  warnings: string[];
}

@Injectable()
export class InsuranceCardScanService {
  private readonly logger = new Logger(InsuranceCardScanService.name);

  constructor(
    private readonly aiService: AiService,
    @InjectRepository(InsurancePayer)
    private readonly payerRepository: Repository<InsurancePayer>,
  ) {}

  async scanCard(
    tenantId: string,
    frontImageBuffer: Buffer,
    backImageBuffer?: Buffer,
  ): Promise<CardScanResult> {
    const frontBase64 = frontImageBuffer.toString('base64');
    const images = [frontBase64];
    if (backImageBuffer) {
      images.push(backImageBuffer.toString('base64'));
    }

    const prompt = `You are an expert medical insurance card OCR system. Analyze the insurance card image(s) and extract all available information.

Return a JSON object with these fields (omit any field you cannot read with reasonable confidence):

{
  "extractedData": {
    "insurancePayerName": "Name of the insurance company (e.g., Blue Cross Blue Shield, Aetna, Cigna)",
    "policyNumber": "Member ID / Policy Number / Subscriber ID (the unique identifier for the member)",
    "groupNumber": "Group Number (if present, often labeled 'GRP' or 'Group')",
    "subscriberName": "Name of the subscriber/insured person (Last, First format)",
    "subscriberRelation": "Relationship to patient: self, spouse, child, or other",
    "subscriberDob": "Date of birth if shown (YYYY-MM-DD format)",
    "effectiveDate": "Effective date of coverage if shown (YYYY-MM-DD format)",
    "expirationDate": "Expiration date if shown (YYYY-MM-DD format)",
    "copayAmount": "Copay amount as a number (e.g., 25 for $25 copay)",
    "deductibleAmount": "Deductible amount as a number if shown",
    "coinsurancePercentage": "Coinsurance percentage as a number (e.g., 20 for 20%)",
    "planType": "Plan type if indicated (HMO, PPO, EPO, POS, Medicaid, Medicare, etc.)",
    "payerId": "Payer ID if shown (often used for electronic claims)",
    "rxbin": "Rx BIN number if shown on back of card",
    "rxpcn": "Rx PCN number if shown",
    "rxgroup": "Rx Group number if shown"
  },
  "confidence": {
    "insurancePayerName": 0-100,
    "policyNumber": 0-100,
    "groupNumber": 0-100,
    "subscriberName": 0-100,
    "subscriberRelation": 0-100,
    "subscriberDob": 0-100,
    "effectiveDate": 0-100,
    "expirationDate": 0-100,
    "copayAmount": 0-100,
    "deductibleAmount": 0-100,
    "coinsurancePercentage": 0-100,
    "planType": 0-100,
    "payerId": 0-100,
    "rxbin": 0-100,
    "rxpcn": 0-100,
    "rxgroup": 0-100
  },
  "warnings": ["Any data quality concerns, e.g., 'Policy number may be truncated', 'Card image is blurry'"]
}

Important:
- The policyNumber is the MEMBER ID, not the group number. These are different fields.
- If the card shows a copay like "PCP $25 / SPEC $40", use the PCP (primary care) copay amount.
- Confidence scores should reflect how clearly the text was readable (0-100).
- Only include warnings if there are actual concerns about data quality.`;

    let aiResult: any;
    try {
      aiResult = await this.aiService.visionGenerateStructured(prompt, images, {
        temperature: 0.1,
        maxTokens: 4096,
      });
    } catch (err: any) {
      this.logger.error(`Insurance card scan failed: ${err.message}`);
      throw new BadRequestException(
        `AI card scanning failed: ${err.message}. Ensure a vision-capable AI model is configured.`,
      );
    }

    // Match extracted payer name to our InsurancePayer master data
    let matchedPayerId: string | undefined;
    let matchedPayerName: string | undefined;

    if (aiResult?.extractedData?.insurancePayerName) {
      const payerName = aiResult.extractedData.insurancePayerName.toLowerCase();
      const payers = await this.payerRepository.find({
        where: { tenantId, status: 'active' },
      });

      // Try exact match first, then fuzzy match
      const exactMatch = payers.find(
        (p) => p.name.toLowerCase() === payerName,
      );
      if (exactMatch) {
        matchedPayerId = exactMatch.id;
        matchedPayerName = exactMatch.name;
      } else {
        // Fuzzy: check if payer name contains or is contained by the extracted name
        const fuzzyMatch = payers.find(
          (p) =>
            p.name.toLowerCase().includes(payerName) ||
            payerName.includes(p.name.toLowerCase()),
        );
        if (fuzzyMatch) {
          matchedPayerId = fuzzyMatch.id;
          matchedPayerName = fuzzyMatch.name;
        }
      }
    }

    // Generate warnings for low-confidence fields
    const warnings: string[] = aiResult?.warnings || [];
    if (aiResult?.confidence) {
      for (const [field, score] of Object.entries(aiResult.confidence)) {
        const numScore = Number(score);
        if (numScore < 70 && aiResult.extractedData[field]) {
          warnings.push(`Low confidence (${numScore}%) on ${field} — please verify manually.`);
        }
      }
    }

    if (!aiResult?.extractedData?.policyNumber) {
      warnings.push('Could not extract policy number — this is required. Please enter manually.');
    }

    if (!matchedPayerId && aiResult?.extractedData?.insurancePayerName) {
      warnings.push(
        `Could not auto-match payer "${aiResult.extractedData.insurancePayerName}" to master list. Please select the correct payer manually.`,
      );
    }

    return {
      extractedData: aiResult?.extractedData || {},
      confidence: aiResult?.confidence || {},
      matchedPayerId,
      matchedPayerName,
      warnings,
    };
  }
}
