import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PatientFlagsService } from './patient-flags.service';
import {
  CreatePatientFlagDto,
  UpdatePatientFlagDto,
  ResolvePatientFlagDto,
  AcknowledgePatientFlagDto,
  QueryPatientFlagDto,
  PatientFlagSeverity,
  PatientFlagCategory,
} from './dto/patient-flag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Patient Flags')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientFlagsController {
  constructor(private readonly flagsService: PatientFlagsService) {}

  @Get(':id/flags')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List patient flags (defaults to active only)' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiQuery({ name: 'severity', required: false, enum: PatientFlagSeverity })
  @ApiQuery({ name: 'category', required: false, enum: PatientFlagCategory })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'resolved'] })
  @ApiQuery({ name: 'showAsBanner', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of patient flags' })
  async list(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryPatientFlagDto,
  ) {
    return this.flagsService.list(req.user.tenantId, id, query);
  }

  @Get(':id/flags/summary')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get flag counts by severity + banner flags for patient list tiles' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Flag summary' })
  async summary(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flagsService.getSummary(req.user.tenantId, id);
  }

  @Get(':id/flags/unacknowledged')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get critical flags the current user has not yet acknowledged' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Unacknowledged critical flags' })
  async listUnacknowledged(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flagsService.listUnacknowledged(req.user.tenantId, id, req.user.id);
  }

  @Post(':id/flags')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a flag to a patient chart' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 201, description: 'Flag created' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePatientFlagDto,
  ) {
    return this.flagsService.create(req.user.tenantId, id, dto, req.user.id);
  }

  @Patch(':id/flags/:flagId')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update a patient flag' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'flagId', type: String, description: 'Flag UUID' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flagId', ParseUUIDPipe) flagId: string,
    @Body() dto: UpdatePatientFlagDto,
  ) {
    return this.flagsService.update(req.user.tenantId, id, flagId, dto);
  }

  @Post(':id/flags/:flagId/resolve')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Resolve a patient flag (resolution reason required for critical)' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'flagId', type: String, description: 'Flag UUID' })
  async resolve(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flagId', ParseUUIDPipe) flagId: string,
    @Body() dto: ResolvePatientFlagDto,
  ) {
    return this.flagsService.resolve(req.user.tenantId, id, flagId, dto, req.user.id);
  }

  @Post(':id/flags/:flagId/acknowledge')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a critical flag for the current user (idempotent)' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'flagId', type: String, description: 'Flag UUID' })
  async acknowledge(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flagId', ParseUUIDPipe) flagId: string,
    @Body() dto: AcknowledgePatientFlagDto,
  ) {
    return this.flagsService.acknowledge(
      req.user.tenantId,
      id,
      flagId,
      { userEmail: dto.userEmail || req.user.email },
      req.user.id,
    );
  }

  @Get(':id/flags/:flagId/acknowledgements')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'List who has acknowledged a flag (audit trail)' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'flagId', type: String, description: 'Flag UUID' })
  async listAcknowledgements(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flagId', ParseUUIDPipe) flagId: string,
  ) {
    return this.flagsService.listAcknowledgements(req.user.tenantId, id, flagId);
  }

  @Delete(':id/flags/:flagId')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a patient flag' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'flagId', type: String, description: 'Flag UUID' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('flagId', ParseUUIDPipe) flagId: string,
  ) {
    return this.flagsService.remove(req.user.tenantId, id, flagId);
  }
}
