import {
  Controller,
  Get,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RiskManagementService } from './risk-management.service';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Risk Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk-management')
export class RiskManagementController {
  constructor(private readonly riskManagementService: RiskManagementService) {}

  @Get('patients/:patientId')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get comprehensive risk management profile for a patient' })
  @ApiResponse({ status: 200, description: 'Risk management profile with AI risk score, clinical scores, medication risk, and care gaps' })
  async getRiskProfile(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
  ) {
    const data = await this.riskManagementService.getRiskProfile(
      req.user.tenantId,
      patientId,
    );
    return { data };
  }
}
