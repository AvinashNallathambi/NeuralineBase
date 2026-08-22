import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PriorAuthService } from './prior-auth.service';
import {
  CreatePriorAuthRequestDto,
  UpdatePriorAuthRequestDto,
  SubmitPriorAuthDto,
  PayerResponseDto,
  AssignPriorAuthDto,
  CreateAttachmentDto,
  CheckRequirementDto,
  AutoTriggerPaDto,
} from './dto/prior-auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PriorAuthStatus } from './entities/prior-auth-request.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Prior Authorization')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prior-auth')
export class PriorAuthController {
  constructor(private readonly paService: PriorAuthService) {}

  // ═══════════════════════════════════════════════════════════════════
  // P0: CRUD
  // ═══════════════════════════════════════════════════════════════════

  @Post()
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a prior authorization request' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: CreatePriorAuthRequestDto,
  ) {
    return this.paService.create(req.user.tenantId, dto, req.user.id);
  }

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'List prior auth requests (filter by patient, status, payer, assignee)' })
  async list(
    @Request() req: AuthenticatedRequest,
    @Query('patientId') patientId?: string,
    @Query('status') status?: PriorAuthStatus,
    @Query('payerName') payerName?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    return this.paService.list(req.user.tenantId, {
      patientId,
      status,
      payerName,
      assignedTo,
    });
  }

  @Get('worklist')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'Get PA worklist (filtered by status, assignee, payer, priority)' })
  async getWorklist(
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: PriorAuthStatus,
    @Query('assignedTo') assignedTo?: string,
    @Query('payerName') payerName?: string,
    @Query('priority') priority?: number,
  ) {
    return this.paService.getWorklist(req.user.tenantId, {
      status,
      assignedTo,
      payerName,
      priority,
    });
  }

  @Get('dashboard')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'PA dashboard with metrics, approval rates, expiring PAs' })
  async getDashboard(@Request() req: AuthenticatedRequest) {
    return this.paService.getDashboard(req.user.tenantId);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'Get a single PA request with attachments' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'Update a PA request (only in draft status)' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: UpdatePriorAuthRequestDto,
  ) {
    return this.paService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'doctor', 'billing_staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a PA request' })
  async cancel(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.paService.cancel(req.user.tenantId, id, body?.reason);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Lifecycle
  // ═══════════════════════════════════════════════════════════════════

  @Post(':id/submit')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit PA to payer (transitions draft → submitted → pending)' })
  async submit(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: SubmitPriorAuthDto,
  ) {
    return this.paService.submit(req.user.tenantId, id, dto, req.user.id);
  }

  @Post(':id/payer-response')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record payer response (approved/denied/p2p_scheduled). Auto-attaches auth number to superbill Box 23.' })
  async recordPayerResponse(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: PayerResponseDto,
  ) {
    return this.paService.recordPayerResponse(req.user.tenantId, id, dto);
  }

  @Post(':id/new-version')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new version (re-authorization). Supersedes the original.' })
  async createNewVersion(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paService.createNewVersion(req.user.tenantId, id);
  }

  @Post(':id/assign')
  @Roles('admin', 'doctor', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign PA to a staff member' })
  async assign(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: AssignPriorAuthDto,
  ) {
    return this.paService.assign(req.user.tenantId, id, dto);
  }

  @Patch(':id/priority')
  @Roles('admin', 'doctor', 'billing_staff')
  @ApiOperation({ summary: 'Set PA priority (1=highest, 5=lowest)' })
  async setPriority(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { priority: number },
  ) {
    return this.paService.setPriority(req.user.tenantId, id, body.priority);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Attachments
  // ═══════════════════════════════════════════════════════════════════

  @Post(':id/attachments')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a clinical evidence attachment to a PA request' })
  async addAttachment(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: CreateAttachmentDto,
  ) {
    return this.paService.addAttachment(req.user.tenantId, id, dto);
  }

  @Get(':id/attachments')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'List attachments for a PA request' })
  async getAttachments(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paService.getAttachments(req.user.tenantId, id);
  }

  @Delete('attachments/:attachmentId')
  @Roles('admin', 'doctor', 'billing_staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an attachment' })
  async deleteAttachment(
    @Request() req: AuthenticatedRequest,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.paService.deleteAttachment(req.user.tenantId, attachmentId);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Requirement Lookup
  // ═══════════════════════════════════════════════════════════════════

  @Post('check-requirement')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if PA is required for a payer × CPT combination (registry + AI prediction)' })
  async checkRequirement(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: CheckRequirementDto,
  ) {
    return this.paService.checkRequirement(req.user.tenantId, dto);
  }

  @Get('requirements')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'List PA requirement rules (optionally filter by payer)' })
  async getRequirements(
    @Request() req: AuthenticatedRequest,
    @Query('payerName') payerName?: string,
  ) {
    return this.paService.getRequirements(req.user.tenantId, payerName);
  }

  @Post('requirements/seed')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed the PA requirement registry with default payer × CPT rules' })
  async seedRequirements(@Request() req: AuthenticatedRequest) {
    return this.paService.seedRequirements(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Features
  // ═══════════════════════════════════════════════════════════════════

  @Post('auto-trigger')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A2: Auto-trigger PA at order entry — checks requirements and auto-drafts PA request + letter' })
  async autoTriggerPa(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: AutoTriggerPaDto,
  ) {
    return this.paService.autoTriggerPa(req.user.tenantId, dto, req.user.id);
  }

  @Post(':id/ai/requirement-prediction')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A1: Predict PA requirement probability and persist on request' })
  async runRequirementPrediction(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paService.runRequirementPrediction(req.user.tenantId, id);
  }

  @Post(':id/ai/approval-prediction')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A4: Predict approval probability and recommend actions to improve it' })
  async runApprovalPrediction(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paService.runApprovalPrediction(req.user.tenantId, id);
  }

  @Post(':id/ai/expiration-prediction')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A6: Predict PA expiration and recommend action (reschedule/re-auth)' })
  async runExpirationPrediction(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paService.runExpirationPrediction(req.user.tenantId, id);
  }

  @Post(':id/ai/assemble-evidence')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A3: Auto-assemble clinical evidence from patient chart for PA submission' })
  async assembleEvidence(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { chartData: any },
  ) {
    return this.paService.assembleEvidence(req.user.tenantId, id, body.chartData);
  }

  @Post(':id/ai/p2p-prep')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A5: Prepare peer-to-peer review coaching (denial rationale, counter-arguments, talking points)' })
  async prepareP2P(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paService.prepareP2P(req.user.tenantId, id);
  }

  @Post(':id/ai/learn-from-denial')
  @Roles('admin', 'doctor', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A7: Learn from denial — extract insights and update requirement registry' })
  async learnFromDenial(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paService.learnFromDenial(req.user.tenantId, id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Expiration Check (cron-callable)
  // ═══════════════════════════════════════════════════════════════════

  @Post('check-expirations')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check for expired and expiring-soon PAs (cron-callable)' })
  async checkExpirations(@Request() req: AuthenticatedRequest) {
    return this.paService.checkExpirations(req.user.tenantId);
  }
}
