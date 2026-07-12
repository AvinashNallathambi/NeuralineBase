import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RemittanceService } from './remittance.service';
import { ImportEraDto, ImportEobDto } from './dto/import-era.dto';
import { RemittanceStatus } from './entities/remittance.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('remittance')
@UseGuards(JwtAuthGuard)
export class RemittanceController {
  constructor(private readonly remittanceService: RemittanceService) {}

  // ─── ERA Import ────────────────────────────────────────────────────

  @Post('era/import')
  importEra(@Body() dto: ImportEraDto, @Request() req: any) {
    const tenantId = dto.tenantId || req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.remittanceService.importEra(dto, tenantId);
  }

  @Post('eob')
  importEob(@Body() dto: ImportEobDto, @Request() req: any) {
    const tenantId = dto.tenantId || req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.remittanceService.importEob(dto, tenantId);
  }

  @Post('era/:id/repost')
  repostEra(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.remittanceService.autoPostPayments(id, tenantId);
  }

  // ─── Remittance Queries ────────────────────────────────────────────

  @Get()
  findAllRemittances(
    @Query('status') status?: RemittanceStatus,
    @Request() req?: any,
  ) {
    const tenantId = req?.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.remittanceService.findAllRemittances(tenantId, status);
  }

  @Get('stats')
  getStats(@Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.remittanceService.getStats(tenantId);
  }

  @Get(':id')
  findOneRemittance(@Param('id') id: string) {
    return this.remittanceService.findOneRemittance(id);
  }

  @Get(':id/claims')
  getRemittanceClaims(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.remittanceService.getRemittanceClaims(id, tenantId);
  }

  @Get('claims/:claimId')
  findOneRemittanceClaim(@Param('claimId') claimId: string) {
    return this.remittanceService.findOneRemittanceClaim(claimId);
  }

  // ─── EOB Management ────────────────────────────────────────────────

  @Get('eob')
  findAllEobs(@Query('patientId') patientId?: string, @Request() req?: any) {
    const tenantId = req?.user?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.remittanceService.findAllEobs(tenantId, patientId);
  }

  @Get('eob/:id')
  findOneEob(@Param('id') id: string) {
    return this.remittanceService.findOneEob(id);
  }

  // ─── CARC/RARC Code Lookup ─────────────────────────────────────────

  @Get('codes/carc')
  findCarcCodes(@Query('q') q?: string) {
    return this.remittanceService.findCarcCodes(q);
  }

  @Get('codes/rarc')
  findRarcCodes(@Query('q') q?: string) {
    return this.remittanceService.findRarcCodes(q);
  }

  @Get('codes/carc/:code')
  findOneCarc(@Param('code') code: string) {
    return this.remittanceService.findOneCarc(code);
  }

  @Get('codes/rarc/:code')
  findOneRarc(@Param('code') code: string) {
    return this.remittanceService.findOneRarc(code);
  }
}
