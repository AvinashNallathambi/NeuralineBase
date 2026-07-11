import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EligibilityService } from './eligibility.service';
import { EligibilitySchedulerService } from './eligibility-scheduler.service';
import { CreateInsuranceVerificationDto } from './dto/create-insurance-verification.dto';
import { UpdateInsuranceVerificationDto } from './dto/update-insurance-verification.dto';
import { QueryInsuranceVerificationDto } from './dto/query-insurance-verification.dto';
import { CoverageSummaryDto } from './dto/coverage-summary.dto';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Insurance Eligibility')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('eligibility/verifications')
export class EligibilityController {
  constructor(
    private readonly eligibilityService: EligibilityService,
    private readonly eligibilitySchedulerService: EligibilitySchedulerService,
  ) {}

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List eligibility verifications with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of verifications' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: QueryInsuranceVerificationDto,
  ) {
    return this.eligibilityService.findAll(req.tenantId, query);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get verification by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiResponse({ status: 200, description: 'Verification details' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eligibilityService.findOne(req.tenantId, id);
  }

  @Post()
  @Roles('admin', 'doctor', 'receptionist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and run a new eligibility verification' })
  @ApiBody({ type: CreateInsuranceVerificationDto })
  @ApiResponse({ status: 201, description: 'Verification created and run' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateInsuranceVerificationDto,
  ) {
    return this.eligibilityService.create(
      req.tenantId,
      dto,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Post(':id/rerun')
  @Roles('admin', 'doctor', 'receptionist')
  @ApiOperation({ summary: 'Re-run an existing eligibility verification' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiResponse({ status: 200, description: 'Verification re-run successfully' })
  async rerun(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eligibilityService.rerun(
      req.tenantId,
      id,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'receptionist')
  @ApiOperation({ summary: 'Update verification notes or metadata' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiResponse({ status: 200, description: 'Verification updated' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInsuranceVerificationDto,
  ) {
    return this.eligibilityService.update(
      req.tenantId,
      id,
      dto,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Delete(':id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a verification' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiResponse({ status: 204, description: 'Verification soft deleted' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.eligibilityService.remove(
      req.tenantId,
      id,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Get('counts')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get verification counts grouped by status' })
  @ApiResponse({ status: 200, description: 'Status counts for dashboard' })
  async getCounts(@Request() req: AuthenticatedRequest) {
    return this.eligibilityService.getCounts(req.tenantId);
  }

  @Post('batch')
  @Roles('admin', 'doctor', 'receptionist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run batch eligibility verification for multiple patients' })
  @ApiBody({ schema: { type: 'object', properties: { patientIds: { type: 'array', items: { type: 'string' } } } } })
  @ApiResponse({ status: 200, description: 'Batch verification results' })
  async batchVerify(
    @Request() req: AuthenticatedRequest,
    @Body() body: { patientIds: string[] },
  ) {
    return this.eligibilityService.batchVerify(
      req.tenantId,
      body.patientIds,
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }

  @Get('patients/:patientId/history')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get verification history for a patient' })
  @ApiParam({ name: 'patientId', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Paginated verification history' })
  async findHistoryByPatient(
    @Request() req: AuthenticatedRequest,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: QueryInsuranceVerificationDto,
  ) {
    return this.eligibilityService.findHistoryByPatient(req.tenantId, patientId, query);
  }

  @Get('patients/:patientId/coverage')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get latest coverage summary for a patient' })
  @ApiParam({ name: 'patientId', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Coverage summary' })
  async coverageSummary(
    @Request() req: AuthenticatedRequest,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<CoverageSummaryDto | null> {
    return this.eligibilityService.coverageSummary(req.tenantId, patientId);
  }

  @Post('scheduled/trigger')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger scheduled eligibility verification' })
  @ApiResponse({ status: 200, description: 'Scheduled verification job triggered successfully' })
  async triggerScheduledVerification(@Request() req: AuthenticatedRequest) {
    return this.eligibilitySchedulerService.triggerScheduledVerification(req.tenantId);
  }

  @Get('scheduled/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Get status of scheduled eligibility verification jobs' })
  @ApiResponse({ status: 200, description: 'Status of repeatable jobs' })
  async getScheduledJobsStatus(@Request() req: AuthenticatedRequest) {
    return this.eligibilitySchedulerService.getRepeatableJobs();
  }

  @Delete('scheduled')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove scheduled eligibility verification job' })
  @ApiResponse({ status: 200, description: 'Scheduled job removed successfully' })
  async removeScheduledJob(@Request() req: AuthenticatedRequest) {
    return this.eligibilitySchedulerService.removeScheduledJob();
  }
}
