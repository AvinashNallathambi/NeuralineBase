import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DenialsService } from './denials.service';
import { DenialAiService } from './denial-ai.service';
import {
  DenialRootCause,
  DenialPriority,
  DenialWorklistStatus,
} from './entities/denial-record.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('denials')
@UseGuards(JwtAuthGuard)
export class DenialsController {
  constructor(
    private readonly denialsService: DenialsService,
    private readonly denialAiService: DenialAiService,
  ) {}

  // ─── Auto-generate from remittance ─────────────────────────────────

  @Post('generate/:remittanceId')
  generateFromRemittance(@Param('remittanceId') remittanceId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.denialsService.generateFromRemittance(remittanceId, tenantId);
  }

  // ─── Worklist ──────────────────────────────────────────────────────

  @Get('worklist')
  getWorklist(
    @Query('status') status?: DenialWorklistStatus,
    @Query('priority') priority?: DenialPriority,
    @Query('rootCause') rootCause?: DenialRootCause,
    @Query('assignedTo') assignedTo?: string,
    @Query('payerName') payerName?: string,
    @Request() req?: any,
  ) {
    const tenantId = req?.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.denialsService.getWorklist(tenantId, {
      status,
      priority,
      rootCause,
      assignedTo,
      payerName,
    });
  }

  @Get('stats')
  getStats(@Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.denialsService.getStats(tenantId);
  }

  @Get('analytics')
  getAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    const tenantId = req?.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return this.denialsService.getAnalytics(tenantId, from, to);
  }

  @Get('aging')
  getClaimAging(@Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.denialsService.getClaimAging(tenantId);
  }

  @Get('payer-performance')
  getPayerPerformance(@Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.denialsService.getPayerPerformance(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.denialsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: DenialWorklistStatus; resolutionNotes?: string },
  ) {
    return this.denialsService.updateStatus(id, body.status, body.resolutionNotes);
  }

  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() body: { assignedTo: string; assignedName: string },
  ) {
    return this.denialsService.assign(id, body.assignedTo, body.assignedName);
  }

  @Patch(':id/recovery')
  setRecoveryPrediction(
    @Param('id') id: string,
    @Body() body: { probability: number; estimatedRecovery: number },
  ) {
    return this.denialsService.setRecoveryPrediction(id, body.probability, body.estimatedRecovery);
  }

  // ─── AI-Powered Features ───────────────────────────────────────────

  @Post('ai/score/:id')
  aiScoreRecovery(@Param('id') id: string) {
    return this.denialAiService.scoreRecovery(id);
  }

  @Post('ai/score-batch')
  aiBatchScore(@Body() body: { denialIds: string[] }) {
    return this.denialAiService.batchScoreRecoveries(body.denialIds);
  }

  @Post('ai/nlp/:id')
  aiAnalyzeText(@Param('id') id: string) {
    return this.denialAiService.analyzeDenialText(id);
  }

  @Post('ai/cluster')
  aiCluster(@Request() req: any, @Body() body: { limit?: number }) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.denialAiService.clusterDenials(tenantId, body.limit || 100);
  }

  @Post('ai/prioritize')
  aiPrioritize(@Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.denialAiService.prioritizeWorklist(tenantId);
  }
}
