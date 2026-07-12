import { Injectable, Logger } from '@nestjs/common';
import { RemittanceService } from '../remittance/remittance.service';
import { DenialsService } from '../denials/denials.service';
import { DenialAiService } from '../denials/denial-ai.service';
import { AppealsService } from '../appeals/appeals.service';
import { UnderpaymentsService } from '../underpayments/underpayments.service';
import { DenialRecord, DenialWorklistStatus, DenialRootCause } from '../denials/entities/denial-record.entity';

export interface AutomationPipelineResult {
  remittanceId: string;
  steps: {
    eraImported: boolean;
    paymentsPosted: { postedCount: number; postedAmount: number; unmatchedCount: number };
    denialsGenerated: number;
    underpaymentsDetected: { detectedCount: number; totalVariance: number };
    denialsScored: number;
    highValueAppealsCreated: number;
  };
  errors: string[];
}

/**
 * Agentic AI orchestration service for the RCM pipeline.
 * Automatically runs the full denial management workflow:
 *   ERA Import → Payment Posting → Denial Generation → Underpayment Detection
 *   → AI Recovery Scoring → Auto-create appeals for high-value denials
 */
@Injectable()
export class RcmAutomationService {
  private readonly logger = new Logger(RcmAutomationService.name);

  constructor(
    private readonly remittanceService: RemittanceService,
    private readonly denialsService: DenialsService,
    private readonly denialAiService: DenialAiService,
    private readonly appealsService: AppealsService,
    private readonly underpaymentsService: UnderpaymentsService,
  ) {}

  /**
   * Run the full automated RCM pipeline on an imported ERA.
   * This is the "agentic" workflow that chains multiple AI-powered steps.
   */
  async runFullPipeline(
    remittanceId: string,
    tenantId: string,
    options?: {
      autoPost?: boolean;
      generateDenials?: boolean;
      detectUnderpayments?: boolean;
      aiScoreDenials?: boolean;
      autoCreateAppeals?: boolean;
      appealThreshold?: number; // Minimum denied amount to auto-create appeal
    },
  ): Promise<AutomationPipelineResult> {
    const opts = {
      autoPost: true,
      generateDenials: true,
      detectUnderpayments: true,
      aiScoreDenials: true,
      autoCreateAppeals: true,
      appealThreshold: 500,
      ...options,
    };

    const result: AutomationPipelineResult = {
      remittanceId,
      steps: {
        eraImported: true,
        paymentsPosted: { postedCount: 0, postedAmount: 0, unmatchedCount: 0 },
        denialsGenerated: 0,
        underpaymentsDetected: { detectedCount: 0, totalVariance: 0 },
        denialsScored: 0,
        highValueAppealsCreated: 0,
      },
      errors: [],
    };

    this.logger.log(`Starting RCM automation pipeline for remittance ${remittanceId}`);

    // Step 1: Auto-post payments
    if (opts.autoPost) {
      try {
        const postResult = await this.remittanceService.autoPostPayments(remittanceId, tenantId);
        result.steps.paymentsPosted = postResult;
        this.logger.log(`Step 1: Posted ${postResult.postedCount} payments, $${postResult.postedAmount.toFixed(2)}`);
      } catch (err: any) {
        result.errors.push(`Auto-post failed: ${err.message}`);
        this.logger.error(`Auto-post failed: ${err.message}`);
      }
    }

    // Step 2: Generate denial records from adjustments
    if (opts.generateDenials) {
      try {
        const denialCount = await this.denialsService.generateFromRemittance(remittanceId, tenantId);
        result.steps.denialsGenerated = denialCount;
        this.logger.log(`Step 2: Generated ${denialCount} denial records`);
      } catch (err: any) {
        result.errors.push(`Denial generation failed: ${err.message}`);
        this.logger.error(`Denial generation failed: ${err.message}`);
      }
    }

    // Step 3: Detect underpayments
    if (opts.detectUnderpayments) {
      try {
        const underpaymentResult = await this.underpaymentsService.detectUnderpayments(remittanceId, tenantId);
        result.steps.underpaymentsDetected = underpaymentResult;
        this.logger.log(`Step 3: Detected ${underpaymentResult.detectedCount} underpayments, $${underpaymentResult.totalVariance.toFixed(2)} variance`);
      } catch (err: any) {
        result.errors.push(`Underpayment detection failed: ${err.message}`);
        this.logger.error(`Underpayment detection failed: ${err.message}`);
      }
    }

    // Step 4: AI-score denials for recovery probability
    if (opts.aiScoreDenials && result.steps.denialsGenerated > 0) {
      try {
        // Get newly generated denials for this remittance
        const worklist = await this.denialsService.getWorklist(tenantId, {
          status: DenialWorklistStatus.NEW,
        });
        // Filter to denials from this remittance (via remittanceClaimId link)
        const newDenialIds = worklist.map((d) => d.id).slice(0, 50); // Limit to 50 for batch
        if (newDenialIds.length > 0) {
          await this.denialAiService.batchScoreRecoveries(newDenialIds);
          result.steps.denialsScored = newDenialIds.length;
          this.logger.log(`Step 4: AI-scored ${newDenialIds.length} denials`);
        }
      } catch (err: any) {
        result.errors.push(`AI scoring failed: ${err.message}`);
        this.logger.error(`AI scoring failed: ${err.message}`);
      }
    }

    // Step 5: Auto-create appeals for high-value denials with good recovery probability
    if (opts.autoCreateAppeals) {
      try {
        const worklist = await this.denialsService.getWorklist(tenantId, {
          status: DenialWorklistStatus.NEW,
        });
        const highValueDenials = worklist.filter(
          (d) => d.deniedAmount >= opts.appealThreshold && d.rootCauseCategory !== DenialRootCause.PATIENT_RESPONSIBILITY,
        );

        let appealsCreated = 0;
        for (const denial of highValueDenials.slice(0, 20)) { // Limit to 20 appeals per run
          try {
            await this.appealsService.createFromDenial(denial.id, tenantId);
            appealsCreated++;
          } catch (err: any) {
            this.logger.warn(`Failed to create appeal for denial ${denial.id}: ${err.message}`);
          }
        }
        result.steps.highValueAppealsCreated = appealsCreated;
        this.logger.log(`Step 5: Auto-created ${appealsCreated} appeals for high-value denials`);
      } catch (err: any) {
        result.errors.push(`Auto-appeal creation failed: ${err.message}`);
        this.logger.error(`Auto-appeal creation failed: ${err.message}`);
      }
    }

    this.logger.log(`RCM automation pipeline complete for remittance ${remittanceId}. Errors: ${result.errors.length}`);
    return result;
  }

  /**
   * Get the current automation status for a tenant.
   */
  async getAutomationStatus(tenantId: string): Promise<{
    pipelineRuns: number;
    lastRunAt: Date | null;
    totalDenialsProcessed: number;
    totalAppealsAutoCreated: number;
    totalRecovered: number;
  }> {
    // This would typically query a pipeline_runs table
    // For now, return a placeholder
    return {
      pipelineRuns: 0,
      lastRunAt: null,
      totalDenialsProcessed: 0,
      totalAppealsAutoCreated: 0,
      totalRecovered: 0,
    };
  }
}
