import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PatientJwtAuthGuard } from './patient-jwt-auth.guard';
import { AppointmentsService } from '../appointments/appointments.service';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { LaboratoryService } from '../laboratory/laboratory.service';
import { BillingService } from '../billing/billing.service';
import { RemittanceService } from '../remittance/remittance.service';
import { InsuranceCardScanService } from '../billing/insurance-card-scan.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationPriority } from '../notifications/entities/notification.entity';

interface AuthenticatedPatientRequest {
  user: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

@ApiTags('Patient Portal')
@ApiBearerAuth('JWT-auth')
@UseGuards(PatientJwtAuthGuard)
@Controller('patients/portal')
export class PatientPortalController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly prescriptionsService: PrescriptionsService,
    private readonly laboratoryService: LaboratoryService,
    private readonly billingService: BillingService,
    private readonly remittanceService: RemittanceService,
    private readonly cardScanService: InsuranceCardScanService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Appointments ────────────────────────────────────────────────

  @Get('appointments')
  @ApiOperation({ summary: 'Get patient appointments' })
  async getAppointments(
    @Request() req: AuthenticatedPatientRequest,
    @Query('status') status?: string,
  ) {
    const result = await this.appointmentsService.findAll(req.user.tenantId, {
      patientId: req.user.id,
      status,
      page: 1,
      limit: 100,
    } as any);
    return result.data;
  }

  @Get('appointments/available-slots')
  @ApiOperation({ summary: 'Get available appointment slots for a provider' })
  async getAvailableSlots(
    @Request() req: AuthenticatedPatientRequest,
    @Query('providerId') providerId: string,
    @Query('date') date: string,
    @Query('appointmentType') appointmentType?: string,
  ) {
    return this.appointmentsService.getAvailableSlots(
      req.user.tenantId,
      providerId,
      new Date(date),
      appointmentType,
    );
  }

  @Post('appointments/request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a new appointment' })
  async requestAppointment(
    @Request() req: AuthenticatedPatientRequest,
    @Body() body: {
      providerId: string;
      appointmentType: string;
      reasonForVisit: string;
      preferredDate: string;
      isTelehealth?: boolean;
      notes?: string;
    },
  ) {
    return this.appointmentsService.create(req.user.tenantId, {
      patientId: req.user.id,
      providerId: body.providerId,
      appointmentType: body.appointmentType,
      reasonForVisit: body.reasonForVisit,
      startTime: body.preferredDate,
      endTime: body.preferredDate,
      isTelehealth: body.isTelehealth || false,
      notes: body.notes,
    } as any);
  }

  // ─── Prescriptions ───────────────────────────────────────────────

  @Get('prescriptions')
  @ApiOperation({ summary: 'Get patient prescriptions' })
  async getPrescriptions(
    @Request() req: AuthenticatedPatientRequest,
    @Query('status') status?: string,
  ) {
    const result = await this.prescriptionsService.findAll(req.user.tenantId, {
      patientId: req.user.id,
      status,
      page: 1,
      limit: 100,
    } as any);
    return result.data;
  }

  @Post('prescriptions/:id/refill')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a prescription refill' })
  async requestRefill(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') prescriptionId: string,
    @Body() body: { pharmacy?: string; notes?: string },
  ) {
    return this.prescriptionsService.createRefill(req.user.tenantId, prescriptionId, {
      pharmacy: body.pharmacy,
      notes: body.notes,
    } as any);
  }

  // ─── Lab Results ─────────────────────────────────────────────────

  @Get('lab-results')
  @ApiOperation({ summary: 'Get patient lab results' })
  async getLabResults(
    @Request() req: AuthenticatedPatientRequest,
    @Query('status') status?: string,
  ) {
    const result = await this.laboratoryService.findAllOrders(req.user.tenantId, {
      patientId: req.user.id,
      status,
      page: 1,
      limit: 100,
    } as any);
    return result.data;
  }

  // ─── Billing / Invoices ──────────────────────────────────────────

  @Get('invoices')
  @ApiOperation({ summary: 'Get patient invoices' })
  async getInvoices(
    @Request() req: AuthenticatedPatientRequest,
    @Query('status') status?: string,
  ) {
    return this.billingService.findAllInvoices({
      patientId: req.user.id,
      status: status as any,
    });
  }

  @Post('invoices/:id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make a payment on an invoice' })
  async payInvoice(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') invoiceId: string,
    @Body() body: { amount: number; paymentMethod: string; reference?: string },
  ) {
    return this.billingService.recordPayment(
      invoiceId,
      body.amount,
      body.paymentMethod,
      body.reference,
    );
  }

  // ─── EOB / Insurance ─────────────────────────────────────────────

  @Get('eobs')
  @ApiOperation({ summary: 'Get patient EOBs (Explanation of Benefits)' })
  async getEobs(@Request() req: AuthenticatedPatientRequest) {
    return this.remittanceService.findAllEobs(req.user.tenantId, req.user.id);
  }

  @Get('insurance')
  @ApiOperation({ summary: 'Get patient insurance policies' })
  async getInsurance(@Request() req: AuthenticatedPatientRequest) {
    return this.billingService.findPatientInsurances(req.user.id);
  }

  @Post('insurance/card-scan')
  @ApiOperation({ summary: 'Scan insurance card with AI OCR — patient self-service' })
  @UseInterceptors(FileFieldsInterceptor(
    [
      { name: 'frontImage', maxCount: 1 },
      { name: 'backImage', maxCount: 1 },
    ],
    { limits: { fileSize: 10 * 1024 * 1024 } },
  ))
  async scanInsuranceCard(
    @Request() req: AuthenticatedPatientRequest,
    @UploadedFiles() files: { frontImage?: Express.Multer.File[]; backImage?: Express.Multer.File[] },
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

  @Post('insurance/request-update')
  @ApiOperation({ summary: 'Request insurance update — patient submits card scan for staff review' })
  @HttpCode(HttpStatus.OK)
  async requestInsuranceUpdate(
    @Request() req: AuthenticatedPatientRequest,
    @Body() body: { extractedData: any; confidence: Record<string, number>; matchedPayerId?: string; notes?: string },
  ) {
    // Create a notification for staff to review the patient's insurance update request
    await this.notificationsService.notify({
      tenantId: req.user.tenantId,
      type: NotificationType.GENERAL,
      title: `Insurance Update Request from Patient`,
      message: `Patient has submitted an insurance card scan for review.\n\nExtracted data: ${JSON.stringify(body.extractedData, null, 2)}\n\nPatient notes: ${body.notes || 'None'}\n\nConfidence scores: ${JSON.stringify(body.confidence)}`,
      priority: NotificationPriority.HIGH,
      actionUrl: `/patients/${req.user.id}`,
      actionLabel: 'Review Patient',
      metadata: {
        type: 'insurance_update_request',
        patientId: req.user.id,
        extractedData: body.extractedData,
        confidence: body.confidence,
        matchedPayerId: body.matchedPayerId,
      },
    });

    return { status: 'submitted', message: 'Your insurance update request has been submitted for staff review.' };
  }

  // ─── Dashboard Summary ───────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Get patient portal dashboard summary' })
  async getDashboard(@Request() req: AuthenticatedPatientRequest) {
    const [appointments, prescriptions, labOrders, invoices, eobs] = await Promise.all([
      this.appointmentsService.findAll(req.user.tenantId, {
        patientId: req.user.id,
        page: 1,
        limit: 5,
      } as any),
      this.prescriptionsService.findAll(req.user.tenantId, {
        patientId: req.user.id,
        page: 1,
        limit: 5,
      } as any),
      this.laboratoryService.findAllOrders(req.user.tenantId, {
        patientId: req.user.id,
        page: 1,
        limit: 5,
      } as any),
      this.billingService.findAllInvoices({ patientId: req.user.id }),
      this.remittanceService.findAllEobs(req.user.tenantId, req.user.id),
    ]);

    const upcomingAppointments = appointments.data.filter(
      (a: any) => a.status === 'scheduled' || a.status === 'confirmed',
    );

    const unpaidInvoices = invoices.filter(
      (i: any) => i.status === 'sent' || i.status === 'overdue' || i.status === 'partially_paid',
    );

    const outstandingBalance = unpaidInvoices.reduce(
      (sum: number, i: any) => sum + Number(i.balanceDue || i.totalAmount || 0),
      0,
    );

    return {
      upcomingAppointments: upcomingAppointments.length,
      activePrescriptions: prescriptions.data.filter((p: any) => p.status === 'active').length,
      pendingLabResults: labOrders.data.filter(
        (l: any) => l.status === 'ordered' || l.status === 'in_progress',
      ).length,
      unpaidInvoices: unpaidInvoices.length,
      outstandingBalance,
      totalEobs: eobs.length,
      recentAppointments: appointments.data,
      recentPrescriptions: prescriptions.data,
      recentLabs: labOrders.data,
      recentInvoices: invoices.slice(0, 5),
      recentEobs: eobs.slice(0, 5),
    };
  }
}
