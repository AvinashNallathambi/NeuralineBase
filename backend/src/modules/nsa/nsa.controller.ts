import {
  Controller,
  Get,
  Post,
  Patch,
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
import { NsaService } from './nsa.service';
import {
  CreateGfeDto,
  GenerateGfeFromSuperbillDto,
  DeliverGfeDto,
  AcknowledgeGfeDto,
  UpdateGfeDto,
  CreateIdrCaseDto,
  UpdateIdrCaseDto,
} from './dto/nsa.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GfeStatus } from './entities/good-faith-estimate.entity';
import { IdrCaseStatus } from './entities/nsa-idr-case.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('NSA - No Surprises Act')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nsa')
export class NsaController {
  constructor(private readonly nsaService: NsaService) {}

  // ═══════════════════════════════════════════════════════════════════
  // P0: GFE CRUD
  // ═══════════════════════════════════════════════════════════════════

  @Post('gfe')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Good Faith Estimate manually' })
  async createGfe(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: CreateGfeDto,
  ) {
    return this.nsaService.createGfe(req.user.tenantId, dto, req.user.id);
  }

  @Post('gfe/generate-from-superbill')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a GFE from a superbill using AI and persist it' })
  async generateGfeFromSuperbill(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: GenerateGfeFromSuperbillDto,
  ) {
    return this.nsaService.generateGfeFromSuperbill(req.user.tenantId, dto, req.user.id);
  }

  @Get('gfe')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'List GFEs (optionally filter by patient or status)' })
  async listGfes(
    @Request() req: AuthenticatedRequest,
    @Query('patientId') patientId?: string,
    @Query('status') status?: GfeStatus,
  ) {
    if (patientId) return this.nsaService.findByPatient(req.user.tenantId, patientId);
    if (status) return this.nsaService.findByStatus(req.user.tenantId, status);
    return this.nsaService.findByPatient(req.user.tenantId, '');
  }

  @Get('gfe/:id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'Get a single GFE' })
  async getGfe(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nsaService.findOneGfe(req.user.tenantId, id);
  }

  @Patch('gfe/:id')
  @Roles('admin', 'doctor', 'nurse', 'billing')
  @ApiOperation({ summary: 'Update a GFE (creates a new version if already delivered)' })
  async updateGfe(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: UpdateGfeDto,
  ) {
    return this.nsaService.updateGfe(req.user.tenantId, id, dto);
  }

  @Post('gfe/:id/new-version')
  @Roles('admin', 'doctor', 'nurse', 'billing')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new version of a GFE (supersedes the original)' })
  async createNewVersion(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: UpdateGfeDto,
  ) {
    return this.nsaService.createNewVersion(req.user.tenantId, id, dto);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: GFE Delivery Tracking
  // ═══════════════════════════════════════════════════════════════════

  @Post('gfe/:id/deliver')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a GFE as delivered and check on-time compliance' })
  async deliverGfe(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: DeliverGfeDto,
  ) {
    return this.nsaService.deliverGfe(req.user.tenantId, id, dto);
  }

  @Post('gfe/:id/acknowledge')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record patient acknowledgment of a GFE' })
  async acknowledgeGfe(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: AcknowledgeGfeDto,
  ) {
    return this.nsaService.acknowledgeGfe(req.user.tenantId, id, dto);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: $400 Variance Detector
  // ═══════════════════════════════════════════════════════════════════

  @Post('gfe/:id/variance')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Detect variance between GFE and final billed amount ($400 NSA threshold)' })
  async detectVariance(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      finalBilledAmount: number;
      finalPaidAmount: number;
      actualLineItems?: Array<{ cptCode: string; actualAmount: number }>;
      claimId?: string;
      remittanceClaimId?: string;
    },
  ) {
    return this.nsaService.detectVariance(
      req.user.tenantId,
      id,
      body.finalBilledAmount,
      body.finalPaidAmount,
      body.actualLineItems,
      body.claimId,
      body.remittanceClaimId,
    );
  }

  @Get('variance')
  @Roles('admin', 'billing_staff')
  @ApiOperation({ summary: 'List variance records' })
  async listVariances(
    @Request() req: AuthenticatedRequest,
    @Query('gfeId') gfeId?: string,
  ) {
    return this.nsaService.findVarianceRecords(req.user.tenantId, gfeId);
  }

  @Post('variance/:id/resolve')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a variance record' })
  async resolveVariance(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { resolutionNotes: string },
  ) {
    return this.nsaService.resolveVariance(req.user.tenantId, id, body.resolutionNotes);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P0: Compliance Dashboard
  // ═══════════════════════════════════════════════════════════════════

  @Get('dashboard')
  @Roles('admin', 'billing_staff')
  @ApiOperation({ summary: 'Get NSA compliance dashboard metrics' })
  async getDashboard(@Request() req: AuthenticatedRequest) {
    return this.nsaService.getComplianceDashboard(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P1: AI Features
  // ═══════════════════════════════════════════════════════════════════

  @Post('gfe/:id/predict-accuracy')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Predict estimate accuracy and flag high-risk GFEs' })
  async predictAccuracy(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nsaService.predictAccuracy(req.user.tenantId, id);
  }

  @Post('gfe/:id/reconcile')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Reconcile GFE with final claim and generate rate corrections' })
  async reconcileGfe(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      finalBilledAmount: number;
      finalPaidAmount: number;
      actualLineItems: Array<{ cptCode: string; actualAmount: number }>;
    },
  ) {
    return this.nsaService.reconcileGfe(
      req.user.tenantId,
      id,
      body.finalBilledAmount,
      body.finalPaidAmount,
      body.actualLineItems,
    );
  }

  @Post('gfe/:id/patient-explanation')
  @Roles('admin', 'doctor', 'nurse', 'billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Generate patient-friendly explanation of the GFE' })
  async generatePatientExplanation(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nsaService.generatePatientExplanation(req.user.tenantId, id);
  }

  @Post('gfe/:id/predict-diagnosis')
  @Roles('admin', 'doctor', 'nurse', 'billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Predict diagnosis codes for pre-encounter GFE' })
  async predictDiagnosis(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      patientHistory: { conditions: string[]; medications: string[]; recentEncounters: string[] };
      chiefComplaint: string;
      scheduledProcedure: string;
    },
  ) {
    return this.nsaService.predictDiagnosisCodes(
      req.user.tenantId,
      id,
      body.patientHistory,
      body.chiefComplaint,
      body.scheduledProcedure,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // P2: IDR Case Management
  // ═══════════════════════════════════════════════════════════════════

  @Post('idr')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an IDR (Independent Dispute Resolution) case' })
  async createIdrCase(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: CreateIdrCaseDto,
  ) {
    return this.nsaService.createIdrCase(req.user.tenantId, dto);
  }

  @Get('idr')
  @Roles('admin', 'billing_staff')
  @ApiOperation({ summary: 'List IDR cases' })
  async listIdrCases(
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: IdrCaseStatus,
  ) {
    return this.nsaService.findIdrCases(req.user.tenantId, status as IdrCaseStatus);
  }

  @Get('idr/:id')
  @Roles('admin', 'billing_staff')
  @ApiOperation({ summary: 'Get a single IDR case' })
  async getIdrCase(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nsaService.findOneIdrCase(req.user.tenantId, id);
  }

  @Patch('idr/:id')
  @Roles('admin', 'billing_staff')
  @ApiOperation({ summary: 'Update an IDR case (status, offers, amounts)' })
  async updateIdrCase(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: UpdateIdrCaseDto,
  ) {
    return this.nsaService.updateIdrCase(req.user.tenantId, id, dto);
  }

  @Post('idr/:id/assess-eligibility')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Assess IDR eligibility and determine jurisdiction' })
  async assessEligibility(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      patientState: string;
      paidAmount: number;
      serviceType: string;
      isEmergency: boolean;
      isAirAmbulance: boolean;
      payerType: string;
    },
  ) {
    return this.nsaService.assessIdrEligibility(req.user.tenantId, id, body);
  }

  @Post('idr/:id/generate-offer')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Generate open negotiation offer with QPA analysis' })
  async generateOffer(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { medianInNetworkRates?: Array<{ cptCode: string; medianRate: number }> },
  ) {
    return this.nsaService.generateOpenNegotiationOffer(req.user.tenantId, id, body.medianInNetworkRates);
  }

  @Post('idr/:id/route-jurisdiction')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Route to federal or state-specific dispute process' })
  async routeJurisdiction(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      patientState: string;
      payerType: string;
      serviceType: string;
      isEmergency: boolean;
    },
  ) {
    return this.nsaService.routeJurisdiction(
      req.user.tenantId,
      id,
      body.patientState,
      body.payerType,
      body.serviceType,
      body.isEmergency,
    );
  }

  @Post('idr/:id/acuity-letter')
  @Roles('admin', 'doctor', 'billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Generate patient acuity letter from encounter notes' })
  async generateAcuityLetter(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { age?: number; sex?: string; conditions: string[] },
  ) {
    return this.nsaService.generateAcuityLetter(req.user.tenantId, id, body);
  }

  // ═══════════════════════════════════════════════════════════════════
  // P3: AI Win-Probability + Deadline Tracking
  // ═══════════════════════════════════════════════════════════════════

  @Post('idr/:id/win-probability')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Predict IDR win probability and recommend final offer' })
  async predictWinProbability(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nsaService.predictWinProbability(req.user.tenantId, id);
  }

  @Get('idr/:id/deadlines')
  @Roles('admin', 'billing_staff')
  @ApiOperation({ summary: 'List deadlines for an IDR case' })
  async getDeadlines(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nsaService.findDeadlines(req.user.tenantId, id);
  }

  @Get('deadlines')
  @Roles('admin', 'billing_staff')
  @ApiOperation({ summary: 'List all IDR deadlines (optionally update statuses first)' })
  async getAllDeadlines(@Request() req: AuthenticatedRequest) {
    await this.nsaService.updateDeadlineStatuses(req.user.tenantId);
    return this.nsaService.findDeadlines(req.user.tenantId);
  }

  @Post('deadlines/:id/met')
  @Roles('admin', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an IDR deadline as met' })
  async markDeadlineMet(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nsaService.markDeadlineMet(req.user.tenantId, id);
  }
}
