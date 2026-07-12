import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RcmAutomationService } from './rcm-automation.service';
import { DenialPreventionService, PreSubmissionClaim } from './denial-prevention.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(
    private readonly rcmAutomationService: RcmAutomationService,
    private readonly denialPreventionService: DenialPreventionService,
  ) {}

  // ─── RCM Pipeline ──────────────────────────────────────────────────

  @Post('pipeline/:remittanceId')
  runPipeline(
    @Request() req: any,
    @Body() body: {
      remittanceId: string;
      autoPost?: boolean;
      generateDenials?: boolean;
      detectUnderpayments?: boolean;
      aiScoreDenials?: boolean;
      autoCreateAppeals?: boolean;
      appealThreshold?: number;
    },
  ) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.rcmAutomationService.runFullPipeline(body.remittanceId, tenantId, {
      autoPost: body.autoPost,
      generateDenials: body.generateDenials,
      detectUnderpayments: body.detectUnderpayments,
      aiScoreDenials: body.aiScoreDenials,
      autoCreateAppeals: body.autoCreateAppeals,
      appealThreshold: body.appealThreshold,
    });
  }

  @Get('pipeline/status')
  getPipelineStatus(@Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.rcmAutomationService.getAutomationStatus(tenantId);
  }

  // ─── Pre-Submission Denial Prevention ──────────────────────────────

  @Post('prevention/assess')
  assessClaimRisk(@Body() claim: PreSubmissionClaim) {
    return this.denialPreventionService.assessClaimRisk(claim);
  }

  @Post('prevention/quick-check')
  quickRiskCheck(@Body() claim: PreSubmissionClaim) {
    return this.denialPreventionService.quickRiskCheck(claim);
  }
}
