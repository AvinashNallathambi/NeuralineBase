import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { DenialRecord, DenialRootCause, DenialWorklistStatus } from '../denials/entities/denial-record.entity';

export interface RecoveryScore {
  denialId: string;
  probability: number; // 0-100
  estimatedRecovery: number;
  rationale: string;
  recommendedAction: string;
  confidenceLevel: 'low' | 'medium' | 'high';
}

export interface DenialCluster {
  clusterId: string;
  label: string;
  rootCause: DenialRootCause;
  count: number;
  totalAmount: number;
  avgRecoveryProbability: number;
  commonCarcCodes: string[];
  commonPayers: string[];
  recommendedAction: string;
  denialIds: string[];
}

export interface NlpAnalysisResult {
  denialId: string;
  extractedReason: string;
  rootCauseCategory: DenialRootCause;
  keywords: string[];
  sentiment: 'negative' | 'neutral' | 'positive';
  suggestedAction: string;
}

@Injectable()
export class DenialAiService {
  private readonly logger = new Logger(DenialAiService.name);

  constructor(
    @InjectRepository(DenialRecord)
    private readonly denialRepository: Repository<DenialRecord>,
    private readonly aiService: AiService,
  ) {}

  // ─── Recovery Scoring ──────────────────────────────────────────────

  /**
   * Score a single denial for recovery probability using AI.
   * Considers CARC/RARC codes, root cause, amount, payer, and historical patterns.
   */
  async scoreRecovery(denialId: string): Promise<RecoveryScore> {
    const denial = await this.denialRepository.findOne({ where: { id: denialId } });
    if (!denial) throw new Error(`Denial ${denialId} not found`);

    const prompt = `You are a healthcare revenue cycle AI expert specializing in denial recovery.

Analyze this denied claim and predict the probability of successful recovery through appeal or resubmission.

Denial Details:
- CARC Code: ${denial.carcCode}
- CARC Description: ${denial.carcDescription || 'N/A'}
- RARC Code: ${denial.rarcCode || 'N/A'}
- RARC Description: ${denial.rarcDescription || 'N/A'}
- Root Cause Category: ${denial.rootCauseCategory}
- Denied Amount: $${denial.deniedAmount}
- Payer: ${denial.payerName || 'Unknown'}
- Patient: ${denial.patientName || 'N/A'}
- CPT Code: ${denial.cptCode || 'N/A'}
- Denial Reason Text: ${denial.denialReasonText || 'N/A'}
- Days Since Denial: ${denial.denialDate ? Math.floor((Date.now() - new Date(denial.denialDate).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A'}

Consider these factors:
1. CARC/RARC historical overturn rates (e.g., missing info denials have high recovery, medical necessity moderate, duplicates low)
2. Root cause category recovery patterns
3. Amount significance (higher amounts justify more effort)
4. Timeliness (closer to denial date = better recovery odds)
5. Whether the denial is appealable vs. requiring resubmission
6. Payer-specific behavior patterns

Respond with JSON:
{
  "probability": <0-100>,
  "estimatedRecovery": <dollar amount>,
  "rationale": "<detailed explanation>",
  "recommendedAction": "<appeal | resubmit | write_off | patient_bill | escalate>",
  "confidenceLevel": "<low | medium | high>"
}`;

    try {
      const result = await this.aiService.generateStructured<RecoveryScore>(prompt, {
        temperature: 0.2,
        maxTokens: 2048,
      });

      const score: RecoveryScore = {
        denialId,
        probability: Math.min(100, Math.max(0, result.probability || 50)),
        estimatedRecovery: result.estimatedRecovery || denial.deniedAmount * 0.5,
        rationale: result.rationale || '',
        recommendedAction: result.recommendedAction || 'appeal',
        confidenceLevel: result.confidenceLevel || 'medium',
      };

      // Persist the score
      denial.recoveryProbability = score.probability;
      denial.estimatedRecovery = score.estimatedRecovery;
      denial.metadata = {
        ...denial.metadata,
        recoveryScore: score,
        scoredAt: new Date().toISOString(),
      };
      await this.denialRepository.save(denial);

      return score;
    } catch (err: any) {
      this.logger.error(`Recovery scoring failed for denial ${denialId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Batch score multiple denials for recovery probability.
   */
  async batchScoreRecoveries(denialIds: string[]): Promise<RecoveryScore[]> {
    const results: RecoveryScore[] = [];
    for (const id of denialIds) {
      try {
        const score = await this.scoreRecovery(id);
        results.push(score);
      } catch (err: any) {
        this.logger.warn(`Skipping denial ${id}: ${err.message}`);
      }
    }
    return results;
  }

  // ─── NLP Analysis of Denial Reason Text ────────────────────────────

  /**
   * Use NLP to extract structured insights from free-text denial reasons.
   */
  async analyzeDenialText(denialId: string): Promise<NlpAnalysisResult> {
    const denial = await this.denialRepository.findOne({ where: { id: denialId } });
    if (!denial) throw new Error(`Denial ${denialId} not found`);

    const textToAnalyze = denial.denialReasonText || denial.carcDescription || '';
    if (!textToAnalyze.trim()) {
      return {
        denialId,
        extractedReason: 'No text available',
        rootCauseCategory: denial.rootCauseCategory,
        keywords: [],
        sentiment: 'neutral',
        suggestedAction: 'review',
      };
    }

    const prompt = `You are a medical billing NLP analyst. Analyze this denial reason text and extract structured insights.

Denial Reason Text: "${textToAnalyze}"

CARC Code: ${denial.carcCode}
Current Root Cause: ${denial.rootCauseCategory}

Extract:
1. The core reason for denial (concise summary)
2. The most accurate root cause category from: eligibility, prior_authorization, medical_necessity, coding_error, missing_information, duplicate, timely_filing, coordination_of_benefits, non_covered_service, bundling, fee_schedule, benefit_maximum, frequency_limit, wrong_payer, patient_responsibility, other
3. Key keywords/phrases that indicate the denial type
4. Sentiment (negative = likely upheld, neutral = uncertain, positive = likely overturnable)
5. Suggested next action

Respond with JSON:
{
  "extractedReason": "<concise summary>",
  "rootCauseCategory": "<one of the categories above>",
  "keywords": ["<keyword1>", "<keyword2>", ...],
  "sentiment": "<negative | neutral | positive>",
  "suggestedAction": "<appeal | resubmit | correct_coding | obtain_auth | provide_docs | write_off | patient_bill>"
}`;

    try {
      const result = await this.aiService.generateStructured<NlpAnalysisResult>(prompt, {
        temperature: 0.1,
        maxTokens: 1024,
      });

      const analysis: NlpAnalysisResult = {
        denialId,
        extractedReason: result.extractedReason || textToAnalyze,
        rootCauseCategory: result.rootCauseCategory as DenialRootCause || denial.rootCauseCategory,
        keywords: result.keywords || [],
        sentiment: result.sentiment || 'neutral',
        suggestedAction: result.suggestedAction || 'review',
      };

      // Update root cause if AI suggests a different category
      if (analysis.rootCauseCategory !== denial.rootCauseCategory) {
        denial.rootCauseCategory = analysis.rootCauseCategory;
        denial.metadata = {
          ...denial.metadata,
          nlpAnalysis: analysis,
          rootCauseAdjusted: true,
          originalRootCause: denial.rootCauseCategory,
        };
        await this.denialRepository.save(denial);
      }

      return analysis;
    } catch (err: any) {
      this.logger.error(`NLP analysis failed for denial ${denialId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Denial Pattern Clustering ─────────────────────────────────────

  /**
   * Cluster denials into patterns using AI to identify common themes.
   * This groups similar denials to enable batch processing.
   */
  async clusterDenials(tenantId: string, limit: number = 100): Promise<DenialCluster[]> {
    const denials = await this.denialRepository.find({
      where: { tenantId },
      take: limit,
      order: { deniedAmount: 'DESC' },
    });

    if (denials.length === 0) return [];

    // Build a summary of denials for the AI to cluster
    const denialSummaries = denials.map((d, i) => ({
      id: d.id,
      idx: i,
      carc: d.carcCode,
      rarc: d.rarcCode,
      rootCause: d.rootCauseCategory,
      amount: d.deniedAmount,
      payer: d.payerName,
      cpt: d.cptCode,
      reason: d.denialReasonText?.substring(0, 100),
    }));

    const prompt = `You are a healthcare data scientist. Cluster these denied claims into groups based on common patterns.

Denials to cluster (JSON):
${JSON.stringify(denialSummaries, null, 2)}

Group denials that share:
- Same or related CARC/RARC codes
- Same root cause category
- Same payer
- Similar denial reason text
- Similar CPT codes

Create 3-8 clusters. For each cluster, provide:
1. A descriptive label
2. The dominant root cause category
3. Count and total amount
4. Common CARC codes
5. Common payers
6. A recommended batch action

Respond with JSON array:
[
  {
    "clusterId": "<unique id>",
    "label": "<descriptive name>",
    "rootCause": "<category>",
    "count": <number>,
    "totalAmount": <number>,
    "avgRecoveryProbability": <0-100>,
    "commonCarcCodes": ["<code1>", ...],
    "commonPayers": ["<payer1>", ...],
    "recommendedAction": "<batch action description>",
    "denialIds": ["<id1>", "<id2>", ...]
  }
]`;

    try {
      const result = await this.aiService.generateStructured<DenialCluster[]>(prompt, {
        temperature: 0.3,
        maxTokens: 4096,
      });

      return result || [];
    } catch (err: any) {
      this.logger.error(`Clustering failed: ${err.message}`);
      // Fallback: simple rule-based clustering by root cause
      return this.fallbackCluster(denials);
    }
  }

  /**
   * Fallback clustering by root cause category (no AI).
   */
  private fallbackCluster(denials: DenialRecord[]): DenialCluster[] {
    const clusters = new Map<string, DenialRecord[]>();
    for (const d of denials) {
      const key = d.rootCauseCategory;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(d);
    }

    return Array.from(clusters.entries()).map(([rootCause, records]) => ({
      clusterId: `cluster-${rootCause}`,
      label: rootCause.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      rootCause: rootCause as DenialRootCause,
      count: records.length,
      totalAmount: records.reduce((sum, r) => sum + r.deniedAmount, 0),
      avgRecoveryProbability:
        records.filter((r) => r.recoveryProbability != null).length > 0
          ? records.reduce((sum, r) => sum + (r.recoveryProbability || 0), 0) / records.length
          : 0,
      commonCarcCodes: [...new Set(records.map((r) => r.carcCode))].slice(0, 5),
      commonPayers: [...new Set(records.map((r) => r.payerName).filter(Boolean))] as string[],
      recommendedAction: this.getDefaultAction(rootCause as DenialRootCause),
      denialIds: records.map((r) => r.id),
    }));
  }

  private getDefaultAction(rootCause: DenialRootCause): string {
    const actions: Record<DenialRootCause, string> = {
      [DenialRootCause.ELIGIBILITY]: 'Verify eligibility and resubmit with corrected insurance information',
      [DenialRootCause.PRIOR_AUTHORIZATION]: 'Obtain retroactive authorization or appeal with medical necessity documentation',
      [DenialRootCause.MEDICAL_NECESSITY]: 'Appeal with detailed clinical documentation supporting medical necessity',
      [DenialRootCause.CODING_ERROR]: 'Correct coding errors and resubmit corrected claim',
      [DenialRootCause.MISSING_INFORMATION]: 'Gather missing documentation and resubmit or appeal',
      [DenialRootCause.DUPLICATE]: 'Review for actual duplication; if not duplicate, appeal with explanation',
      [DenialRootCause.TIMELY_FILING]: 'Appeal with proof of timely filing or request exception',
      [DenialRootCause.COORDINATION_OF_BENEFITS]: 'Update COB information and resubmit to correct payer',
      [DenialRootCause.NON_COVERED_SERVICE]: 'Review patient benefits; bill patient or appeal if covered',
      [DenialRootCause.BUNDLING]: 'Review NCCI edits; appeal if unbundling is justified',
      [DenialRootCause.FEE_SCHEDULE]: 'Verify contracted rate; dispute if underpaid per contract',
      [DenialRootCause.BENEFIT_MAXIMUM]: 'Verify benefit limits; bill patient or secondary insurance',
      [DenialRootCause.FREQUENCY_LIMIT]: 'Verify medical necessity for exceeding frequency; appeal with documentation',
      [DenialRootCause.WRONG_PAYER]: 'Resubmit to correct payer',
      [DenialRootCause.PATIENT_RESPONSIBILITY]: 'Bill patient for deductible/coinsurance/copay',
      [DenialRootCause.OTHER]: 'Review denial details and determine appropriate action',
    };
    return actions[rootCause] || 'Review and determine appropriate action';
  }

  // ─── Batch Worklist Prioritization ─────────────────────────────────

  /**
   * AI-powered prioritization of the denial worklist.
   * Ranks denials by expected value of recovery effort.
   */
  async prioritizeWorklist(tenantId: string): Promise<{
    denialId: string;
    rank: number;
    expectedValue: number;
    reasoning: string;
  }[]> {
    const denials = await this.denialRepository.find({
      where: {
        tenantId,
        status: DenialWorklistStatus.NEW,
      },
      order: { deniedAmount: 'DESC' },
      take: 50,
    });

    if (denials.length === 0) return [];

    // Calculate expected value = recoveryProbability * deniedAmount / 100
    // For denials without a score, use a heuristic
    const ranked = denials
      .map((d) => {
        const prob = d.recoveryProbability || this.heuristicProbability(d);
        const expectedValue = (prob / 100) * d.deniedAmount;
        return {
          denialId: d.id,
          rank: 0,
          expectedValue,
          reasoning: `${d.rootCauseCategory} denial of $${d.deniedAmount.toFixed(2)} with ${prob.toFixed(0)}% recovery probability`,
        };
      })
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return ranked;
  }

  private heuristicProbability(denial: DenialRecord): number {
    // Base probabilities by root cause (industry averages)
    const baseProbabilities: Record<DenialRootCause, number> = {
      [DenialRootCause.MISSING_INFORMATION]: 75,
      [DenialRootCause.CODING_ERROR]: 70,
      [DenialRootCause.PRIOR_AUTHORIZATION]: 55,
      [DenialRootCause.MEDICAL_NECESSITY]: 45,
      [DenialRootCause.ELIGIBILITY]: 60,
      [DenialRootCause.WRONG_PAYER]: 80,
      [DenialRootCause.COORDINATION_OF_BENEFITS]: 65,
      [DenialRootCause.BUNDLING]: 40,
      [DenialRootCause.DUPLICATE]: 30,
      [DenialRootCause.TIMELY_FILING]: 25,
      [DenialRootCause.NON_COVERED_SERVICE]: 20,
      [DenialRootCause.FEE_SCHEDULE]: 50,
      [DenialRootCause.BENEFIT_MAXIMUM]: 15,
      [DenialRootCause.FREQUENCY_LIMIT]: 35,
      [DenialRootCause.PATIENT_RESPONSIBILITY]: 10,
      [DenialRootCause.OTHER]: 40,
    };

    let prob = baseProbabilities[denial.rootCauseCategory] || 40;

    // Adjust for amount (higher amounts justify more effort)
    if (denial.deniedAmount > 5000) prob += 10;
    else if (denial.deniedAmount > 1000) prob += 5;
    else if (denial.deniedAmount < 100) prob -= 10;

    // Adjust for age
    if (denial.denialDate) {
      const days = Math.floor((Date.now() - new Date(denial.denialDate).getTime()) / (1000 * 60 * 60 * 24));
      if (days > 90) prob -= 15;
      else if (days > 60) prob -= 5;
    }

    return Math.min(95, Math.max(5, prob));
  }
}
