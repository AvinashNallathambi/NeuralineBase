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
import { UnderpaymentsService } from './underpayments.service';
import { UnderpaymentStatus } from './entities/underpayment-record.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('underpayments')
@UseGuards(JwtAuthGuard)
export class UnderpaymentsController {
  constructor(private readonly underpaymentsService: UnderpaymentsService) {}

  // ─── Contracts ─────────────────────────────────────────────────────

  @Post('contracts')
  createContract(@Body() data: any, @Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.underpaymentsService.createContract(data, tenantId);
  }

  @Get('contracts')
  findAllContracts(@Query('payerName') payerName?: string, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.underpaymentsService.findAllContracts(tenantId, payerName);
  }

  // ─── Detection ─────────────────────────────────────────────────────

  @Post('detect/:remittanceId')
  detectUnderpayments(@Param('remittanceId') remittanceId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.underpaymentsService.detectUnderpayments(remittanceId, tenantId);
  }

  // ─── Records ───────────────────────────────────────────────────────

  @Get()
  findAll(@Query('status') status?: UnderpaymentStatus, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.underpaymentsService.findAll(tenantId, status);
  }

  @Get('stats')
  getStats(@Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.underpaymentsService.getStats(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.underpaymentsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: UnderpaymentStatus; recoveredAmount?: number; notes?: string },
  ) {
    return this.underpaymentsService.updateStatus(id, body.status, body.recoveredAmount, body.notes);
  }
}
