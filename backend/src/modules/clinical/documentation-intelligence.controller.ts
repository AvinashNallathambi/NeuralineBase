import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentationIntelligenceService } from './documentation-intelligence.service';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@Controller('clinical/documentation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentationIntelligenceController {
  constructor(private readonly intelligenceService: DocumentationIntelligenceService) {}

  @Get('preferences/:providerId')
  @Roles('admin', 'doctor', 'nurse')
  getPreference(@Param('providerId') providerId: string, @Request() req: AuthenticatedRequest) {
    return this.intelligenceService.getPreference(req.user.tenantId, providerId);
  }

  @Patch('preferences/:providerId')
  @Roles('admin', 'doctor')
  savePreference(@Param('providerId') providerId: string, @Body() body: Record<string, unknown>, @Request() req: AuthenticatedRequest) {
    return this.intelligenceService.savePreference(req.user.tenantId, req.user, providerId, body);
  }

  @Post('sessions/:id/evidence')
  @Roles('admin', 'doctor', 'nurse')
  buildEvidence(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.intelligenceService.buildEvidence(req.user.tenantId, id);
  }

  @Get('sessions/:id/evidence')
  @Roles('admin', 'doctor', 'nurse')
  getEvidence(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.intelligenceService.getEvidence(req.user.tenantId, id);
  }

  @Get('sessions/:id/quality')
  @Roles('admin', 'doctor', 'nurse')
  qualityCheck(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.intelligenceService.qualityCheck(req.user.tenantId, id);
  }

  @Get('previsit/:patientId/:providerId')
  @Roles('admin', 'doctor', 'nurse')
  prepareChart(@Param('patientId') patientId: string, @Param('providerId') providerId: string, @Request() req: AuthenticatedRequest) {
    return this.intelligenceService.prepareChart(req.user.tenantId, patientId, providerId);
  }
}
