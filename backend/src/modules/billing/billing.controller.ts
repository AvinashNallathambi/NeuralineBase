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
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateEncounterClaimDto } from './dto/create-encounter-claim.dto';
import { UpdateEncounterClaimDto } from './dto/update-encounter-claim.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ClaimStatus } from './entities/encounter-claim.entity';
import { InvoiceStatus } from './entities/invoice.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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

  @Post('claims/:id/submit')
  submitClaim(@Param('id') id: string) {
    return this.billingService.submitClaim(id);
  }

  @Get('claims/:id/submission-status')
  getClaimSubmissionStatus(@Param('id') id: string) {
    return this.billingService.getClaimSubmissionStatus(id);
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

  // ─── Patient Insurance ──────────────────────────────────────────────

  @Get('patients/:patientId/insurance')
  findPatientInsurances(@Param('patientId') patientId: string) {
    return this.billingService.findPatientInsurances(patientId);
  }
}
