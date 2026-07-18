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
  Res,
  Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { SuperbillsService } from './superbills.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ClaimFormService } from './claim-form.service';
import { CreateSuperbillDto } from './dto/create-superbill.dto';
import { UpdateSuperbillDto } from './dto/update-superbill.dto';
import { CreateSuperbillPaymentDto } from './dto/create-superbill-payment.dto';
import { SuperbillStatus } from './entities/superbill.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditAction } from '../audit-logs/entities/audit-log.entity';

interface RequestUser {
  id: string;
  email: string;
  tenantId: string;
  role: string;
}

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('superbills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuperbillsController {
  constructor(
    private readonly superbillsService: SuperbillsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly claimFormService: ClaimFormService,
  ) {}

  private getUser(req: AuthenticatedRequest): RequestUser {
    return req.user;
  }

  private async log(
    req: AuthenticatedRequest,
    action: AuditAction,
    entityId: string,
    details?: Record<string, any>,
  ) {
    const user = this.getUser(req);
    await this.auditLogsService.log({
      action,
      entityType: 'superbill',
      entityId,
      performedBy: user.id,
      performedByName: user.email,
      details,
    });
  }

  @Post()
  @Roles('admin', 'provider')
  async create(
    @Body() createSuperbillDto: CreateSuperbillDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const created = await this.superbillsService.create(createSuperbillDto);
    await this.log(req, AuditAction.CREATE, created.id, {
      patientId: created.patientId,
      totalAmount: created.totalAmount,
    });
    return created;
  }

  @Get()
  @Roles('admin', 'provider', 'patient')
  findAll(
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: SuperbillStatus,
  ) {
    if (patientId) {
      return this.superbillsService.findByPatient(patientId);
    }
    if (providerId) {
      return this.superbillsService.findByProvider(providerId);
    }
    if (status) {
      return this.superbillsService.findByStatus(status);
    }
    return this.superbillsService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'provider', 'patient')
  findOne(@Param('id') id: string) {
    return this.superbillsService.findOne(id);
  }

  @Get(':id/audit')
  @Roles('admin', 'provider', 'patient')
  findAudit(@Param('id') id: string) {
    return this.auditLogsService.findByEntity('superbill', id);
  }

  @Patch(':id')
  @Roles('admin', 'provider')
  async update(
    @Param('id') id: string,
    @Body() updateSuperbillDto: UpdateSuperbillDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const updated = await this.superbillsService.update(id, updateSuperbillDto);
    await this.log(req, AuditAction.UPDATE, id, {
      fields: Object.keys(updateSuperbillDto),
    });
    return updated;
  }

  @Delete(':id')
  @Roles('admin', 'provider')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.superbillsService.remove(id);
    await this.log(req, AuditAction.DELETE, id);
  }

  @Post(':id/submit')
  @Roles('admin', 'provider')
  async submitForProcessing(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const submitted = await this.superbillsService.submitForProcessing(id);
    await this.log(req, AuditAction.SUBMIT, id, {
      status: submitted.status,
      submissionDate: submitted.submissionDate,
    });
    return submitted;
  }

  @Post(':id/calculate')
  @Roles('admin', 'provider')
  async calculateTotals(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const totals = await this.superbillsService.calculateTotals(id);
    await this.log(req, AuditAction.UPDATE, id, {
      reason: 'calculate-totals',
      ...totals,
    });
    return totals;
  }

  @Post(':id/resubmit')
  @Roles('admin', 'provider')
  async resubmit(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const resubmitted = await this.superbillsService.resubmit(id);
    await this.log(req, AuditAction.RESUBMIT, id, {
      status: resubmitted.status,
      submissionDate: resubmitted.submissionDate,
    });
    return resubmitted;
  }

  @Post(':id/void')
  @Roles('admin', 'provider')
  async markVoid(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const voided = await this.superbillsService.markVoid(id);
    await this.log(req, AuditAction.VOID, id, { status: voided.status });
    return voided;
  }

  @Post(':id/corrected-claim')
  @Roles('admin', 'provider')
  async correctedClaim(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const corrected = await this.superbillsService.correctedClaim(id);
    await this.log(req, AuditAction.CORRECTED, id, {
      status: corrected.status,
    });
    return corrected;
  }

  @Post(':id/payments')
  @Roles('admin', 'provider')
  async addPayment(
    @Param('id') id: string,
    @Body() createPaymentDto: CreateSuperbillPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.superbillsService.addPayment(
      id,
      createPaymentDto.type,
      createPaymentDto.amount,
      createPaymentDto.date,
      createPaymentDto.note,
      createPaymentDto.source,
    );
    await this.log(req, AuditAction.PAYMENT, id, {
      type: createPaymentDto.type,
      amount: createPaymentDto.amount,
      source: createPaymentDto.source,
    });
    return result;
  }

  @Post(':id/adjustments')
  @Roles('admin', 'provider')
  async addAdjustment(
    @Param('id') id: string,
    @Body() createAdjustmentDto: CreateSuperbillPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.superbillsService.addPayment(
      id,
      createAdjustmentDto.type,
      createAdjustmentDto.amount,
      createAdjustmentDto.date,
      createAdjustmentDto.note,
      createAdjustmentDto.source,
    );
    await this.log(req, AuditAction.ADJUSTMENT, id, {
      type: createAdjustmentDto.type,
      amount: createAdjustmentDto.amount,
      source: createAdjustmentDto.source,
    });
    return result;
  }

  @Get(':id/cms1500')
  @Roles('admin', 'provider', 'patient')
  async generateCms1500(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.claimFormService.generateCms1500(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cms1500-${id}.pdf"`,
    );
    res.end(pdf);
  }
}
