import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { PatientsService } from './patients.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { CarePlansService } from '../care-plans/care-plans.service';
import { ImmunizationsService } from '../immunizations/immunizations.service';
import { GrowthChartService } from '../growth/growth-chart.service';
import { LaboratoryService } from '../laboratory/laboratory.service';
import { BillingService } from '../billing/billing.service';
import { RemittanceService } from '../remittance/remittance.service';
import { InsuranceCardScanService } from '../billing/insurance-card-scan.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationPriority } from '../notifications/entities/notification.entity';
import { NsaService } from '../nsa/nsa.service';

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
    private readonly carePlansService: CarePlansService,
    private readonly immunizationsService: ImmunizationsService,
    private readonly growthChartService: GrowthChartService,
    private readonly laboratoryService: LaboratoryService,
    private readonly billingService: BillingService,
    private readonly remittanceService: RemittanceService,
    private readonly cardScanService: InsuranceCardScanService,
    private readonly notificationsService: NotificationsService,
    private readonly patientsService: PatientsService,
    private readonly nsaService: NsaService,
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

  @Get('imaging')
  @ApiOperation({ summary: 'Get patient imaging orders and results' })
  async getImagingResults(
    @Request() req: AuthenticatedPatientRequest,
    @Query('status') status?: string,
  ) {
    const result = await this.laboratoryService.findAllImaging(req.user.tenantId, {
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

  // ─── Care Plans ───────────────────────────────────────────────────

  @Get('care-plans')
  @ApiOperation({ summary: 'Get patient care plans (approved only)' })
  async getCarePlans(@Request() req: AuthenticatedPatientRequest) {
    const plans = await this.carePlansService.findByPatient(req.user.tenantId, req.user.id);
    // Only show approved plans to patients
    return plans.filter((p: any) => p.isApproved && p.status === 'active');
  }

  @Get('care-plans/:id')
  @ApiOperation({ summary: 'Get care plan details with goals and tasks' })
  async getCarePlan(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    const full = await this.carePlansService.getFullPlan(req.user.tenantId, id);
    // Verify this plan belongs to the patient
    if (full.plan.patientId !== req.user.id) {
      throw new BadRequestException('Care plan not found');
    }
    // Only show approved plans
    if (!full.plan.isApproved) {
      throw new BadRequestException('Care plan not found');
    }
    return full;
  }

  @Get('care-plans/:id/tasks')
  @ApiOperation({ summary: 'Get patient tasks for a care plan' })
  async getCarePlanTasks(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    const plan = await this.carePlansService.findOne(req.user.tenantId, id);
    if (plan.patientId !== req.user.id || !plan.isApproved) {
      throw new BadRequestException('Care plan not found');
    }
    const tasks = await this.carePlansService.findTasks(req.user.tenantId, id);
    // Only return tasks assigned to the patient
    return tasks.filter((t: any) => t.assignedTo === 'patient');
  }

  @Post('care-plans/tasks/:taskId/report')
  @ApiOperation({ summary: 'Patient reports a value for a monitoring task' })
  @HttpCode(HttpStatus.OK)
  async reportTaskValue(
    @Request() req: AuthenticatedPatientRequest,
    @Param('taskId') taskId: string,
    @Body() body: { reportedValue: string; patientNotes?: string },
  ) {
    return this.carePlansService.reportTaskValue(
      req.user.tenantId,
      taskId,
      body.reportedValue,
      body.patientNotes,
    );
  }

  @Post('care-plans/tasks/:taskId/complete')
  @ApiOperation({ summary: 'Patient marks a task as completed' })
  @HttpCode(HttpStatus.OK)
  async completeTask(
    @Request() req: AuthenticatedPatientRequest,
    @Param('taskId') taskId: string,
    @Body() body: { reportedValue?: string; patientNotes?: string },
  ) {
    return this.carePlansService.completeTask(
      req.user.tenantId,
      taskId,
      req.user.id,
      body.reportedValue,
      body.patientNotes,
    );
  }

  // ─── Immunizations ───────────────────────────────────────────────

  @Get('immunizations')
  @ApiOperation({ summary: 'Get patient immunization history' })
  async getImmunizations(
    @Request() req: AuthenticatedPatientRequest,
  ) {
    return this.immunizationsService.findByPatient(req.user.tenantId, req.user.id);
  }

  // ─── Growth Charts ───────────────────────────────────────────────

  @Get('growth-chart')
  @ApiOperation({ summary: 'Get patient growth chart data' })
  async getGrowthChart(
    @Request() req: AuthenticatedPatientRequest,
  ) {
    return this.growthChartService.getGrowthChart(req.user.tenantId, req.user.id);
  }

  // ─── Medical History (Problem List) ──────────────────────────────

  @Get('medical-history')
  @ApiOperation({ summary: 'Get patient medical history (problem list)' })
  async getMedicalHistory(
    @Request() req: AuthenticatedPatientRequest,
  ) {
    return this.patientsService.findProblems(req.user.tenantId, req.user.id, {});
  }

  @Post('medical-history')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Patient self-reports a medical condition' })
  async addMedicalHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Body() body: {
      code?: string;
      codeSystem?: string;
      description: string;
      onsetDate?: string;
      notes?: string;
    },
  ) {
    // Patient-reported conditions are marked as unconfirmed
    return this.patientsService.createProblem(
      req.user.tenantId,
      req.user.id,
      {
        code: body.code || 'R69',
        codeSystem: body.codeSystem || 'ICD-10-CM',
        description: body.description,
        clinicalStatus: 'active' as any,
        verificationStatus: 'unconfirmed' as any,
        onsetDate: body.onsetDate,
        notes: body.notes,
      } as any,
      req.user.id,
    );
  }

  @Delete('medical-history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Patient removes a self-reported condition' })
  async removeMedicalHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    return this.patientsService.removeProblem(req.user.tenantId, req.user.id, id);
  }

  // ─── Allergies ───────────────────────────────────────────────────

  @Get('allergies')
  @ApiOperation({ summary: 'Get patient allergies' })
  async getAllergies(
    @Request() req: AuthenticatedPatientRequest,
  ) {
    return this.patientsService.findAllergies(req.user.tenantId, req.user.id);
  }

  @Post('allergies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Patient self-reports an allergy' })
  async addAllergy(
    @Request() req: AuthenticatedPatientRequest,
    @Body() body: {
      allergen: string;
      reaction?: string;
      severity?: string;
      onsetDate?: string;
      notes?: string;
    },
  ) {
    return this.patientsService.createAllergy(
      req.user.tenantId,
      req.user.id,
      {
        ...body,
        verificationStatus: 'unconfirmed' as any,
        source: 'patient',
      } as any,
      req.user.id,
    );
  }

  @Delete('allergies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Patient removes a self-reported allergy' })
  async removeAllergy(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    return this.patientsService.removeAllergy(req.user.tenantId, req.user.id, id);
  }

  // ─── Family History ──────────────────────────────────────────────

  @Get('family-history')
  @ApiOperation({ summary: 'Get patient family history' })
  async getFamilyHistory(
    @Request() req: AuthenticatedPatientRequest,
  ) {
    return this.patientsService.findFamilyHistory(req.user.tenantId, req.user.id);
  }

  @Post('family-history')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Patient self-reports a family history entry' })
  async addFamilyHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Body() body: {
      relationship: string;
      memberName?: string;
      condition: string;
      code?: string;
      codeSystem?: string;
      ageOfOnset?: number;
      isDeceased?: boolean;
      ageAtDeath?: number;
      notes?: string;
    },
  ) {
    return this.patientsService.createFamilyHistory(
      req.user.tenantId,
      req.user.id,
      {
        ...body,
        source: 'patient',
      } as any,
      req.user.id,
    );
  }

  @Delete('family-history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Patient removes a self-reported family history entry' })
  async removeFamilyHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    return this.patientsService.removeFamilyHistory(req.user.tenantId, req.user.id, id);
  }

  // ─── Surgical History ────────────────────────────────────────────

  @Get('surgical-history')
  @ApiOperation({ summary: 'Get patient surgical history' })
  async getSurgicalHistory(
    @Request() req: AuthenticatedPatientRequest,
  ) {
    return this.patientsService.findSurgicalHistory(req.user.tenantId, req.user.id);
  }

  @Post('surgical-history')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Patient self-reports a surgical history entry' })
  async addSurgicalHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Body() body: {
      procedure: string;
      procedureDate?: string;
      surgeon?: string;
      facility?: string;
      bodySite?: string;
      outcome?: string;
      notes?: string;
    },
  ) {
    return this.patientsService.createSurgicalHistory(
      req.user.tenantId,
      req.user.id,
      {
        ...body,
        source: 'patient',
      } as any,
      req.user.id,
    );
  }

  @Delete('surgical-history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Patient removes a self-reported surgical history entry' })
  async removeSurgicalHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    return this.patientsService.removeSurgicalHistory(req.user.tenantId, req.user.id, id);
  }

  // ─── Social History ──────────────────────────────────────────────

  @Get('social-history')
  @ApiOperation({ summary: 'Get patient social history' })
  async getSocialHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Query('category') category?: string,
  ) {
    return this.patientsService.findSocialHistory(req.user.tenantId, req.user.id, category);
  }

  @Post('social-history')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Patient self-reports a social history entry' })
  async addSocialHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Body() body: {
      category: string;
      status?: string;
      detail?: string;
      frequency?: string;
      amount?: string;
      durationYears?: number;
      quitDate?: string;
      notes?: string;
    },
  ) {
    return this.patientsService.createSocialHistory(
      req.user.tenantId,
      req.user.id,
      {
        ...body,
        source: 'patient',
      } as any,
      req.user.id,
    );
  }

  @Delete('social-history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Patient removes a self-reported social history entry' })
  async removeSocialHistory(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    return this.patientsService.removeSocialHistory(req.user.tenantId, req.user.id, id);
  }

  // ─── NSA / Good Faith Estimates ──────────────────────────────────

  @Get('gfe-estimates')
  @ApiOperation({ summary: 'Patient views their Good Faith Estimates' })
  async getGfeEstimates(@Request() req: AuthenticatedPatientRequest) {
    return this.nsaService.findByPatient(req.user.tenantId, req.user.id);
  }

  @Get('gfe-estimates/:id')
  @ApiOperation({ summary: 'Patient views a specific Good Faith Estimate' })
  async getGfeEstimate(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    return this.nsaService.findOneGfe(req.user.tenantId, id);
  }

  @Post('gfe-estimates/:id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patient acknowledges receipt of a Good Faith Estimate' })
  async acknowledgeGfe(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') id: string,
  ) {
    return this.nsaService.acknowledgeGfe(req.user.tenantId, id, {
      acknowledgedBy: `Patient ${req.user.email} (portal)`,
    });
  }
}
