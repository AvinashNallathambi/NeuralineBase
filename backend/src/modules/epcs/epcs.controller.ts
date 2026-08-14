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
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  EpcsService,
  StartEnrollmentDto,
  VerifyTwoFactorDto,
  GrantAccessControlDto,
} from './epcs.service';
import { EpcsAiService } from './epcs-ai.service';
import { ControlledSubstanceRulesEngine, validateDeaNumber } from './controlled-substance-rules.engine';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string; firstName?: string; lastName?: string; name?: string };
  ip?: string;
  headers: Record<string, string>;
}

@ApiTags('EPCS')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('epcs')
export class EpcsController {
  private readonly logger = new Logger(EpcsController.name);

  constructor(
    private readonly epcsService: EpcsService,
    private readonly epcsAiService: EpcsAiService,
    private readonly rulesEngine: ControlledSubstanceRulesEngine,
  ) {}

  private userName(req: AuthenticatedRequest): string {
    return req.user.name || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVIDER ENROLLMENT
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('enrollments')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'List all EPCS enrollments' })
  async getEnrollments(@Request() req: AuthenticatedRequest) {
    return this.epcsService.getEnrollments(req.user.tenantId);
  }

  @Get('enrollments/me')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get current user EPCS enrollment status' })
  async getMyEnrollment(@Request() req: AuthenticatedRequest) {
    const enrollment = await this.epcsService.getEnrollmentByUserId(req.user.tenantId, req.user.id);
    if (!enrollment) {
      return { enrolled: false, status: 'not_started' };
    }
    return { enrolled: true, ...enrollment, isEpcsReady: enrollment.isEpcsReady };
  }

  @Get('enrollments/:id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get a specific EPCS enrollment' })
  async getEnrollment(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.epcsService.getEnrollmentByUserId(req.user.tenantId, id);
  }

  @Post('enrollments')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Start EPCS enrollment for the current provider' })
  async startEnrollment(@Request() req: AuthenticatedRequest, @Body() dto: StartEnrollmentDto) {
    return this.epcsService.startEnrollment(req.user.tenantId, req.user.id, this.userName(req), dto);
  }

  @Post('enrollments/:id/identity-proofing')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Complete identity proofing (IAL2) for a provider' })
  async completeIdentityProofing(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { verifiedByUserId: string; method?: string },
  ) {
    return this.epcsService.completeIdentityProofing(
      req.user.tenantId,
      id,
      body.verifiedByUserId,
      body.method || 'document_verification',
    );
  }

  @Post('enrollments/:id/two-factor/setup')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Set up two-factor authentication for EPCS' })
  async setupTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { method?: 'totp' | 'hard_token' | 'biometric' | 'push' },
  ) {
    return this.epcsService.setupTwoFactor(req.user.tenantId, id, body.method || 'totp');
  }

  @Post('enrollments/:id/two-factor/verify')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Verify a 2FA token' })
  async verifyTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: VerifyTwoFactorDto,
  ) {
    const valid = await this.epcsService.verifyTwoFactorToken(req.user.tenantId, id, dto.token);
    return { valid };
  }

  @Post('enrollments/:id/access-control')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Grant EPCS access (two-person rule)' })
  async grantAccessControl(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: GrantAccessControlDto,
  ) {
    return this.epcsService.grantAccessControl(req.user.tenantId, id, dto);
  }

  @Post('enrollments/:id/suspend')
  @Roles('admin')
  @ApiOperation({ summary: 'Suspend EPCS enrollment' })
  async suspendEnrollment(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.epcsService.suspendEnrollment(req.user.tenantId, id, body.reason, req.user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRESCRIPTION SIGNING
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('prescriptions/:id/sign')
  @Roles('doctor')
  @ApiOperation({ summary: 'Sign a controlled substance prescription with 2FA (EPCS)' })
  async signPrescription(
    @Request() req: AuthenticatedRequest,
    @Param('id') prescriptionId: string,
    @Body() body: { twoFactorToken: string },
  ) {
    return this.epcsService.signPrescription(
      req.user.tenantId,
      {
        prescriptionId,
        twoFactorToken: body.twoFactorToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.user.id,
      this.userName(req),
    );
  }

  @Post('prescriptions/:id/cancel')
  @Roles('doctor')
  @ApiOperation({ summary: 'Cancel a transmitted EPCS prescription (CancelRx)' })
  async cancelPrescription(
    @Request() req: AuthenticatedRequest,
    @Param('id') prescriptionId: string,
    @Body() body: { reason: string },
  ) {
    return this.epcsService.cancelPrescription(
      req.user.tenantId,
      prescriptionId,
      body.reason,
      req.user.id,
      this.userName(req),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDMP
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('pdmp/query')
  @Roles('doctor')
  @ApiOperation({ summary: 'Query the Prescription Drug Monitoring Program' })
  async queryPdmp(
    @Request() req: AuthenticatedRequest,
    @Body() body: { patientId: string; patientName: string; state: string },
  ) {
    return this.epcsService.queryPdmp(
      req.user.tenantId,
      body.patientId,
      body.patientName,
      req.user.id,
      this.userName(req),
      body.state,
    );
  }

  @Get('pdmp/:id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get a PDMP query result' })
  async getPdmpQuery(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.epcsService['pdmpRepo'].findOne({ where: { id, tenantId: req.user.tenantId } });
  }

  @Get('pdmp/patient/:patientId')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get PDMP query history for a patient' })
  async getPdmpHistory(@Request() req: AuthenticatedRequest, @Param('patientId') patientId: string) {
    return this.epcsService['pdmpRepo'].find({
      where: { tenantId: req.user.tenantId, patientId },
      order: { createdAt: 'DESC' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('audit-logs')
  @Roles('admin')
  @ApiOperation({ summary: 'Get EPCS audit logs (paginated)' })
  async getAuditLogs(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.epcsService.getAuditLogs(req.user.tenantId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 50);
  }

  @Get('audit-logs/prescription/:id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get audit trail for a specific prescription' })
  async getPrescriptionAuditTrail(@Request() req: AuthenticatedRequest, @Param('id') prescriptionId: string) {
    return this.epcsService.getAuditTrail(req.user.tenantId, prescriptionId);
  }

  @Get('audit-logs/verify')
  @Roles('admin')
  @ApiOperation({ summary: 'Verify the integrity of the EPCS audit chain' })
  async verifyAuditChain(@Request() req: AuthenticatedRequest) {
    return this.epcsService.verifyAuditChain(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSMISSION LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('transmission-logs')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get EPCS transmission logs' })
  async getTransmissionLogs(
    @Request() req: AuthenticatedRequest,
    @Query('prescriptionId') prescriptionId?: string,
  ) {
    return this.epcsService.getTransmissionLogs(req.user.tenantId, prescriptionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROLLED SUBSTANCE LOOKUP & VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('medications/search')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Search controlled substances' })
  async searchControlledSubstances(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.rulesEngine.searchControlledSubstances(query, limit ? parseInt(limit) : 20);
  }

  @Get('medications/schedule/:schedule')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Get all controlled substances for a DEA schedule' })
  async getBySchedule(@Param('schedule') schedule: 'II' | 'III' | 'IV' | 'V') {
    return this.rulesEngine.getBySchedule(schedule);
  }

  @Post('validate')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Validate a controlled substance prescription against rules' })
  async validatePrescription(
    @Body() body: {
      schedule: 'II' | 'III' | 'IV' | 'V';
      quantity: number;
      refills: number;
      daysSupply?: number;
      state?: string;
    },
  ) {
    return this.rulesEngine.validate(
      body.schedule,
      body.quantity,
      body.refills,
      body.daysSupply || null,
      body.state,
    );
  }

  @Post('validate/dea-number')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Validate a DEA number' })
  async validateDea(@Body() body: { deaNumber: string }) {
    return { valid: validateDeaNumber(body.deaNumber) };
  }

  @Get('states/epcs-mandates')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'List states with EPCS mandates' })
  async getEpcsMandateStates() {
    return { states: this.rulesEngine.getEpcsMandateStates() };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI FEATURES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('ai/opioid-risk-score')
  @Roles('doctor')
  @ApiOperation({ summary: 'AI: Score patient opioid overdose/misuse risk' })
  async scoreOpioidRisk(
    @Request() req: AuthenticatedRequest,
    @Body() body: {
      patientId: string;
      patientName: string;
      proposedMedication: string;
      patientContext?: {
        age?: number;
        diagnoses?: string[];
        priorOpioidRx?: number;
        benzoCoPrescribed?: boolean;
        mentalHealthHistory?: string[];
        substanceUseHistory?: string[];
      };
    },
  ) {
    return this.epcsAiService.scoreOpioidRisk(
      req.user.tenantId,
      body.patientId,
      body.patientName,
      body.proposedMedication,
      body.patientContext,
    );
  }

  @Post('ai/diversion-check')
  @Roles('doctor')
  @ApiOperation({ summary: 'AI: Detect diversion patterns from PDMP data' })
  async detectDiversion(
    @Request() req: AuthenticatedRequest,
    @Body() body: { patientId: string; patientName: string; pdmpQueryId?: string },
  ) {
    let pdmpData = null;
    if (body.pdmpQueryId) {
      pdmpData = await this.epcsService['pdmpRepo'].findOne({
        where: { id: body.pdmpQueryId, tenantId: req.user.tenantId },
      });
    }
    return this.epcsAiService.detectDiversion(req.user.tenantId, body.patientId, body.patientName, pdmpData);
  }

  @Post('ai/alternative-therapy')
  @Roles('doctor')
  @ApiOperation({ summary: 'AI: Recommend non-opioid alternative therapies' })
  async recommendAlternatives(
    @Body() body: {
      proposedMedication: string;
      diagnosis?: string;
      patientContext?: {
        allergies?: string[];
        renalImpairment?: boolean;
        hepaticImpairment?: boolean;
        age?: number;
        priorMedications?: string[];
      };
    },
  ) {
    return this.epcsAiService.recommendAlternatives(
      body.proposedMedication,
      body.diagnosis,
      body.patientContext,
    );
  }

  @Post('ai/pdmp-summary')
  @Roles('doctor')
  @ApiOperation({ summary: 'AI: Generate plain-language PDMP summary' })
  async generatePdmpSummary(
    @Request() req: AuthenticatedRequest,
    @Body() body: { pdmpQueryId: string; patientName: string },
  ) {
    const pdmpData = await this.epcsService['pdmpRepo'].findOne({
      where: { id: body.pdmpQueryId, tenantId: req.user.tenantId },
    });
    if (!pdmpData) throw new BadRequestException('PDMP query not found.');
    return this.epcsAiService.generatePdmpSummary(req.user.tenantId, pdmpData.patientId, body.patientName, pdmpData);
  }

  @Post('ai/behavioral-nudge')
  @Roles('doctor')
  @ApiOperation({ summary: 'AI: Generate behavioral nudge for safer prescribing' })
  async generateNudge(
    @Request() req: AuthenticatedRequest,
    @Body() body: {
      providerId: string;
      providerName: string;
      proposedMedication: string;
      patientRiskScore?: any;
    },
  ) {
    return this.epcsAiService.generateNudge(
      req.user.tenantId,
      body.providerId,
      body.providerName,
      body.proposedMedication,
      body.patientRiskScore,
    );
  }

  @Post('ai/quantity-optimizer')
  @Roles('doctor')
  @ApiOperation({ summary: 'AI: Check quantity against CDC opioid guidelines' })
  async optimizeQuantity(
    @Body() body: {
      medicationName: string;
      quantity: number;
      daysSupply?: number;
      isAcutePain?: boolean;
    },
  ) {
    return this.epcsAiService.optimizeQuantity(
      body.medicationName,
      body.quantity,
      body.daysSupply || null,
      body.isAcutePain ?? true,
    );
  }

  @Post('ai/anomaly-detection')
  @Roles('admin')
  @ApiOperation({ summary: 'AI: Detect anomalous EPCS prescribing patterns' })
  async detectAnomalies(@Request() req: AuthenticatedRequest) {
    return this.epcsAiService.detectAnomalies(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MME CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('mme/calculate')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Calculate Morphine Milligram Equivalents (MME)' })
  async calculateMme(
    @Body() body: { medicationName: string; strength: number; quantityPerDay: number },
  ) {
    const mme = this.rulesEngine.calculateMme(body.medicationName, body.strength, body.quantityPerDay);
    const risk = this.rulesEngine.getMmeRiskLevel(mme);
    return { mme, ...risk };
  }
}
