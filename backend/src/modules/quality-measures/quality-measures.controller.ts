import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QualityMeasuresService } from './quality-measures.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    tenantId: string;
    role: string;
  };
}

@ApiTags('Quality Measures')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quality-measures')
export class QualityMeasuresController {
  private readonly logger = new Logger(QualityMeasuresController.name);

  constructor(private readonly qualityMeasuresService: QualityMeasuresService) {}

  @Get('patients/:patientId')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'super_admin')
  @ApiOperation({ summary: 'Get quality measure profile for a patient' })
  async getPatientQualityProfile(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
  ) {
    return this.qualityMeasuresService.getPatientQualityProfile(
      req.user.tenantId,
      patientId,
    );
  }

  @Get('dashboard')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'super_admin')
  @ApiOperation({ summary: 'Get practice-level quality measures dashboard' })
  async getPracticeDashboard(@Request() req: AuthenticatedRequest) {
    return this.qualityMeasuresService.getPracticeDashboard(req.user.tenantId);
  }

  @Get('registry')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'super_admin')
  @ApiOperation({ summary: 'Get the quality measure registry (all measure definitions)' })
  async getMeasureRegistry() {
    // Import inline to avoid circular deps
    const { MEASURE_REGISTRY } = await import('./measure-registry');
    return MEASURE_REGISTRY;
  }
}
