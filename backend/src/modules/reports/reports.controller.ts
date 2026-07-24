import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  UseGuards,
  Request,
  ParseEnumPipe,
  StreamableFile,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportAiService } from './report-ai.service';
import { ReportExportService, ExportFormat } from './report-export.service';
import {
  ReportQueryDto,
  AiReportQueryDto,
  NaturalLanguageReportDto,
  ReportExportFormat,
  ReportDateRange,
} from './dto/report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportAiService: ReportAiService,
    private readonly exportService: ReportExportService,
  ) {}

  // ─── Core Reports ───────────────────────────────────────────────────────────

  @Get('revenue')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Revenue report — claims, collections, payer mix' })
  @ApiResponse({ status: 200 })
  async revenue(@Request() req: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.getRevenueReport(req.user.tenantId, query);
  }

  @Get('appointments')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Appointments report — volume, no-shows, utilization' })
  async appointments(@Request() req: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.getAppointmentsReport(req.user.tenantId, query);
  }

  @Get('clinical')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Clinical report — encounters, diagnoses, prescriptions, labs' })
  async clinical(@Request() req: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.getClinicalReport(req.user.tenantId, query);
  }

  @Get('providers')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Provider performance report — productivity, revenue, utilization' })
  async providers(@Request() req: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.getProviderPerformanceReport(req.user.tenantId, query);
  }

  @Get('rcm')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'RCM & Denials report — A/R aging, denial reasons, claim status' })
  async rcm(@Request() req: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.getRcmReport(req.user.tenantId, query);
  }

  @Get('patient-flags')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Patient flag distribution report — safety, behavioral, legal flags' })
  async patientFlags(@Request() req: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.getPatientFlagReport(req.user.tenantId, query);
  }

  @Get('dashboard')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Executive dashboard — all report categories in one call' })
  async dashboard(@Request() req: AuthenticatedRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.getExecutiveDashboard(req.user.tenantId, query);
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  @Get('export/:reportType')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Export a report as CSV, Excel, PDF, or JSON' })
  @ApiQuery({ name: 'format', enum: ['csv', 'excel', 'pdf', 'json'], required: false })
  async exportReport(
    @Request() req: AuthenticatedRequest,
    @Param('reportType') reportType: string,
    @Query() query: ReportQueryDto,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fmt: ExportFormat = (format as ExportFormat) || 'csv';

    // Fetch the report data
    let reportData: any;
    let titlePrefix: string;
    switch (reportType) {
      case 'revenue':
        reportData = await this.reportsService.getRevenueReport(req.user.tenantId, query);
        titlePrefix = 'Revenue Report';
        break;
      case 'appointments':
        reportData = await this.reportsService.getAppointmentsReport(req.user.tenantId, query);
        titlePrefix = 'Appointments Report';
        break;
      case 'clinical':
        reportData = await this.reportsService.getClinicalReport(req.user.tenantId, query);
        titlePrefix = 'Clinical Report';
        break;
      case 'providers':
        reportData = await this.reportsService.getProviderPerformanceReport(req.user.tenantId, query);
        titlePrefix = 'Provider Performance';
        break;
      case 'rcm':
        reportData = await this.reportsService.getRcmReport(req.user.tenantId, query);
        titlePrefix = 'RCM & Denials Report';
        break;
      case 'patient-flags':
        reportData = await this.reportsService.getPatientFlagReport(req.user.tenantId, query);
        titlePrefix = 'Patient Flag Report';
        break;
      default:
        reportData = await this.reportsService.getExecutiveDashboard(req.user.tenantId, query);
        titlePrefix = 'Executive Dashboard';
    }

    // For JSON format, just return the raw data
    if (fmt === 'json') {
      return reportData;
    }

    // Flatten the report into exportable sections; pick the largest tabular section
    const sections = this.exportService.flattenReport(reportData, titlePrefix);
    const primary = sections[0] || {
      filename: reportType,
      title: titlePrefix,
      columns: ['data'],
      rows: [{ data: JSON.stringify(reportData) }],
    };

    const result = await this.exportService.export(primary, fmt);
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });
    return new StreamableFile(result.buffer);
  }

  // ─── AI-Powered Reports ─────────────────────────────────────────────────────

  @Post('ai/insights')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'AI-generated narrative insights for a report tab' })
  async aiInsights(
    @Request() req: AuthenticatedRequest,
    @Body() body: { tab: string } & AiReportQueryDto,
  ) {
    const query: ReportQueryDto = {
      dateRange: body.dateRange,
      startDate: body.startDate,
      endDate: body.endDate,
    };
    return this.reportAiService.generateInsights(req.user.tenantId, query, body.tab);
  }

  @Post('ai/ask')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Natural-language report builder — ask a question in plain English' })
  async aiAsk(
    @Request() req: AuthenticatedRequest,
    @Body() dto: NaturalLanguageReportDto,
  ) {
    return this.reportAiService.naturalLanguageReport(req.user.tenantId, dto);
  }

  @Get('ai/no-show-risk')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Predict no-show risk for upcoming appointments' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Look-ahead days (default: 7)' })
  async noShowRisk(
    @Request() req: AuthenticatedRequest,
    @Query('days') days?: number,
  ) {
    return this.reportAiService.predictNoShowRisk(req.user.tenantId, days || 7);
  }

  @Get('ai/denial-risk')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Predict denial risk for unsubmitted claims' })
  async denialRisk(@Request() req: AuthenticatedRequest) {
    return this.reportAiService.predictDenialRisk(req.user.tenantId);
  }

  @Get('ai/revenue-leakage')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'AI revenue leakage report — coverage gaps, secondary claims, underpayments, denials at risk' })
  async revenueLeakage(@Request() req: AuthenticatedRequest) {
    return this.reportAiService.getRevenueLeakageReport(req.user.tenantId);
  }

  @Get('ai/anomalies')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Detect anomalies — deviations from 30-day baseline' })
  async anomalies(@Request() req: AuthenticatedRequest) {
    return this.reportAiService.detectAnomalies(req.user.tenantId);
  }
}
