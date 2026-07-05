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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { EncounterService } from './encounter.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateEncounterDto } from './dto/update-encounter.dto';
import { EncounterStatus } from './entities/encounter.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Clinical - Encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clinical/encounters')
export class EncounterController {
  constructor(private readonly encounterService: EncounterService) {}

  @Post()
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Create a new encounter' })
  @ApiResponse({ status: 201, description: 'Encounter created successfully' })
  async create(@Body() createEncounterDto: CreateEncounterDto, @Request() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.encounterService.create(tenantId, createEncounterDto);
  }

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List encounters with pagination, search, and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: EncounterStatus })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'providerId', required: false, type: String })
  @ApiQuery({ name: 'startDateFrom', required: false, type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'startDateTo', required: false, type: String, description: 'ISO date string' })
  async findAll(@Request() req: AuthenticatedRequest, @Query() query: Record<string, string>) {
    const tenantId = req.user.tenantId;
    const options = {
      page: parseInt(query['page']) || 1,
      limit: parseInt(query['limit']) || 10,
      search: query['search'],
      status: query['status'] as EncounterStatus | undefined,
      type: query['type'],
      patientId: query['patientId'],
      providerId: query['providerId'],
      startDateFrom: query['startDateFrom'],
      startDateTo: query['startDateTo'],
    };
    return this.encounterService.findAll(tenantId, options);
  }

  @Get('patient/:patientId')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get all encounters for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  async findByPatient(@Param('patientId') patientId: string, @Request() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.encounterService.findByPatient(patientId, tenantId);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get encounter by ID' })
  @ApiParam({ name: 'id', description: 'Encounter ID' })
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.encounterService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update encounter' })
  @ApiParam({ name: 'id', description: 'Encounter ID' })
  async update(
    @Param('id') id: string,
    @Body() updateEncounterDto: UpdateEncounterDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.encounterService.update(id, updateEncounterDto, tenantId);
  }

  @Delete(':id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Soft delete encounter' })
  @ApiParam({ name: 'id', description: 'Encounter ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.encounterService.remove(id, tenantId);
  }

  @Post(':id/transition')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Transition encounter status' })
  @ApiParam({ name: 'id', description: 'Encounter ID' })
  @ApiBody({ schema: { properties: { status: { type: 'string', enum: Object.values(EncounterStatus) } } } })
  async transitionStatus(
    @Param('id') id: string,
    @Body('status') status: EncounterStatus,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.encounterService.transitionStatus(id, status, req.user.id, tenantId);
  }

  @Post(':id/sign')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Sign a completed encounter (provider attestation)' })
  @ApiParam({ name: 'id', description: 'Encounter ID' })
  async sign(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.encounterService.sign(id, req.user.id, tenantId);
  }

  @Post(':id/lock')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Lock a signed encounter to prevent further edits' })
  @ApiParam({ name: 'id', description: 'Encounter ID' })
  async lock(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.encounterService.lock(id, req.user.id, tenantId);
  }

  @Post(':id/reopen')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Reopen a locked encounter for amendment' })
  @ApiParam({ name: 'id', description: 'Encounter ID' })
  @ApiBody({ schema: { properties: { reason: { type: 'string' } } } })
  async reopen(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.encounterService.reopen(id, req.user.id, reason, tenantId);
  }
}
