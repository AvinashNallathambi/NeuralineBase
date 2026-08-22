import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GrowthChartService } from './growth-chart.service';
import { GrowthPercentileService } from './growth-percentile.service';
import { SpecialtyChart, SPECIALTY_CHART_LABELS } from './data/specialty-lms.data';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Growth Charts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('growth')
export class GrowthController {
  constructor(
    private readonly growthChartService: GrowthChartService,
    private readonly percentileService: GrowthPercentileService,
  ) {}

  @Get('chart/:patientId')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get complete growth chart data for a patient' })
  @ApiQuery({ name: 'specialty', required: false, enum: ['down-syndrome', 'achondroplasia', 'turner-syndrome'] })
  async getGrowthChart(
    @Request() req: AuthenticatedRequest,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('specialty') specialty?: SpecialtyChart,
  ) {
    return this.growthChartService.getGrowthChart(req.user.tenantId, patientId, specialty);
  }

  @Get('specialty-charts')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List available specialty growth charts' })
  getSpecialtyCharts() {
    return Object.entries(SPECIALTY_CHART_LABELS).map(([value, label]) => ({ value, label }));
  }
}
