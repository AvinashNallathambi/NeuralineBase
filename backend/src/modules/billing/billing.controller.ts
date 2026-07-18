import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { BillingService } from './billing.service';
import { InsuranceCardScanService } from './insurance-card-scan.service';
import { CobService } from './cob.service';
import { CoverageGapDetectorService } from './coverage-gap-detector.service';
import { SecondaryClaimService } from './secondary-claim.service';
import { CreateEncounterClaimDto } from './dto/create-encounter-claim.dto';
import { UpdateEncounterClaimDto } from './dto/update-encounter-claim.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreatePatientInsuranceDto } from './dto/create-patient-insurance.dto';
import { UpdatePatientInsuranceDto } from './dto/update-patient-insurance.dto';
import { ClaimStatus } from './entities/encounter-claim.entity';
import { InvoiceStatus } from './entities/invoice.entity';
import { InsurancePriority } from './entities/patient-insurance.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; tenantId: string; role: string };
}

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly cardScanService: InsuranceCardScanService,
    private readonly cobService: CobService,
    private readonly coverageGapDetector: CoverageGapDetectorService,
    private readonly secondaryClaimService: SecondaryClaimService,
  ) {}

  // ─── Encounter Claims ─────────────────────────────────────────────

  @Post('claims')
  createClaim(@Body() createClaimDto: CreateEncounterClaimDto) {
    return this.billingService.createClaim(createClaimDto);
  }

  @Get('claims')
  findAllClaims(
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: ClaimStatus,
  ) {
    return this.billingService.findAllClaims({ patientId, providerId, status });
  }

  @Get('claims/:id')
  findOneClaim(@Param('id') id: string) {
    return this.billingService.findOneClaim(id);
  }

  @Patch('claims/:id')
  updateClaim(
    @Param('id') id: string,
    @Body() updateClaimDto: UpdateEncounterClaimDto,
  ) {
    return this.billingService.updateClaim(id, updateClaimDto);
  }

  @Delete('claims/:id')
  deleteClaim(@Param('id') id: string) {
    return this.billingService.deleteClaim(id);
  }

  @Patch('claims/:id/status')
  updateClaimStatus(
    @Param('id') id: string,
    @Body('status') status: ClaimStatus,
  ) {
    return this.billingService.updateClaimStatus(id, status);
  }

  @Post('claims/:id/calculate')
  calculateClaimTotals(@Param('id') id: string) {
    return this.billingService.calculateClaimTotals(id);
  }

  // ─── Invoices ───────────────────────────────────────────────────────

  @Post('invoices')
  createInvoice(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.billingService.createInvoice(createInvoiceDto);
  }

  @Get('invoices')
  findAllInvoices(
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.billingService.findAllInvoices({ patientId, providerId, status });
  }

  @Get('invoices/:id')
  findOneInvoice(@Param('id') id: string) {
    return this.billingService.findOneInvoice(id);
  }

  @Patch('invoices/:id')
  updateInvoice(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.billingService.updateInvoice(id, updateInvoiceDto);
  }

  @Delete('invoices/:id')
  deleteInvoice(@Param('id') id: string) {
    return this.billingService.deleteInvoice(id);
  }

  @Patch('invoices/:id/status')
  updateInvoiceStatus(
    @Param('id') id: string,
    @Body('status') status: InvoiceStatus,
  ) {
    return this.billingService.updateInvoiceStatus(id, status);
  }

  @Post('invoices/:id/payment')
  recordPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; paymentMethod: string; reference?: string },
  ) {
    return this.billingService.recordPayment(id, body.amount, body.paymentMethod, body.reference);
  }

  // ─── Insurance Payers ───────────────────────────────────────────────

  @Get('payers')
  findAllPayers() {
    return this.billingService.findAllPayers();
  }

  @Get('payers/:id')
  findOnePayer(@Param('id') id: string) {
    return this.billingService.findOnePayer(id);
  }

  @Post('payers')
  createPayer(@Body() body: any, @Request() req: AuthenticatedRequest) {
    return this.billingService.createPayer(req.user.tenantId, body);
  }

  @Patch('payers/:id')
  updatePayer(@Param('id') id: string, @Body() body: any, @Request() req: AuthenticatedRequest) {
    return this.billingService.updatePayer(req.user.tenantId, id, body);
  }

  // ─── Patient Insurance ──────────────────────────────────────────────

  @Get('patients/:patientId/insurance')
  findPatientInsurances(@Param('patientId') patientId: string) {
    return this.billingService.findPatientInsurances(patientId);
  }

  @Post('patients/:patientId/insurance')
  createPatientInsurance(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientInsuranceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.billingService.createPatientInsurance(req.user.tenantId, {
      ...dto,
      patientId,
    });
  }

  @Patch('patients/:patientId/insurance/:id')
  updatePatientInsurance(
    @Param('id') id: string,
    @Body() dto: UpdatePatientInsuranceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.billingService.updatePatientInsurance(req.user.tenantId, id, dto);
  }

  @Delete('patients/:patientId/insurance/:id')
  deletePatientInsurance(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.billingService.deletePatientInsurance(req.user.tenantId, id);
  }

  @Patch('patients/:patientId/insurance/:id/priority')
  updateInsurancePriority(
    @Param('id') id: string,
    @Body('priority') priority: InsurancePriority,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.billingService.updateInsurancePriority(req.user.tenantId, id, priority);
  }

  // ─── AI Insurance Card Scan ────────────────────────────────────────

  @Post('patients/:patientId/insurance/card-scan')
  @UseInterceptors(FileFieldsInterceptor(
    [
      { name: 'frontImage', maxCount: 1 },
      { name: 'backImage', maxCount: 1 },
    ],
    { limits: { fileSize: 10 * 1024 * 1024 } },
  ))
  async scanInsuranceCard(
    @Param('patientId') patientId: string,
    @UploadedFiles() files: { frontImage?: Express.Multer.File[]; backImage?: Express.Multer.File[] },
    @Request() req: AuthenticatedRequest,
  ) {
    if (!files.frontImage || files.frontImage.length === 0) {
      throw new BadRequestException('Front image of insurance card is required');
    }
    const frontImage = files.frontImage[0];
    const backImage = files.backImage?.[0];

    return this.cardScanService.scanCard(
      req.user.tenantId,
      frontImage.buffer,
      backImage?.buffer,
    );
  }

  // ─── AI COB Order Detection ────────────────────────────────────────

  @Post('patients/:patientId/insurance/suggest-cob-order')
  suggestCobOrder(
    @Param('patientId') patientId: string,
    @Body() body: { age?: number; employmentStatus?: string; hasEsrD?: boolean; esrdCoordinationStartDate?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cobService.suggestCobOrder(req.user.tenantId, patientId, body);
  }

  @Post('patients/:patientId/insurance/apply-cob-order')
  applyCobOrder(
    @Param('patientId') patientId: string,
    @Body() body: { order: Array<{ insuranceId: string; priority: string }> },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cobService.applyCobOrder(req.user.tenantId, patientId, body.order);
  }

  // ─── Coverage Gap Detection ────────────────────────────────────────

  @Post('coverage-gaps/scan')
  scanCoverageGaps(
    @Body('daysAhead') daysAhead?: number,
  ) {
    return this.coverageGapDetector.scanCoverageGaps(daysAhead || 7);
  }

  @Get('patients/:patientId/coverage-gaps')
  checkPatientCoverageGaps(
    @Param('patientId') patientId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.coverageGapDetector.checkPatientOnDemand(patientId, req.user.tenantId);
  }

  // ─── AI Secondary Claim Auto-Generation ─────────────────────────────

  @Post('claims/:id/analyze-secondary')
  analyzeForSecondaryClaim(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.secondaryClaimService.analyzeForSecondaryClaim(req.user.tenantId, id);
  }

  @Post('claims/:id/generate-secondary')
  generateSecondaryClaim(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.secondaryClaimService.generateSecondaryClaim(req.user.tenantId, id);
  }
}
