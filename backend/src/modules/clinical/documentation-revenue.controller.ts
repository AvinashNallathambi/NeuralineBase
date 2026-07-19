import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentationRevenueService } from './documentation-revenue.service';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@Controller('clinical/documentation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentationRevenueController {
  constructor(private readonly revenueService: DocumentationRevenueService) {}

  @Get('revenue-risk/payer/:payerName')
  @Roles('admin', 'doctor', 'nurse')
  payerRisk(@Param('payerName') payerName: string, @Request() req: AuthenticatedRequest) {
    return this.revenueService.payerRisk(req.user.tenantId, payerName);
  }

  @Get('sessions/:sessionId/appeal-evidence/:denialId')
  @Roles('admin', 'doctor', 'nurse')
  appealEvidence(
    @Param('sessionId') sessionId: string,
    @Param('denialId') denialId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.revenueService.appealEvidence(req.user.tenantId, sessionId, denialId);
  }
}
