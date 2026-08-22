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
  ApiQuery,
} from '@nestjs/swagger';
import { PatientMedicationsService } from './patient-medications.service';
import { CreatePatientMedicationDto } from './dto/create-patient-medication.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Patient Medications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patient-medications')
export class PatientMedicationsController {
  constructor(private readonly service: PatientMedicationsService) {}

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'List patient medications with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'source', required: false, type: String })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      page: page || 1,
      limit: limit || 200,
      patientId,
      status,
      source,
    });
  }

  @Get('patient/:patientId')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Get all medications for a patient' })
  async findByPatient(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
  ) {
    return this.service.findByPatient(req.user.tenantId, patientId);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Get a single patient medication' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Create a patient medication record' })
  @ApiResponse({ status: 201 })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePatientMedicationDto,
  ) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Update a patient medication' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreatePatientMedicationDto>,
  ) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/taking-status')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Update taking status (medication reconciliation)' })
  async updateTakingStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { takingStatus: string; takingNotes?: string },
  ) {
    return this.service.updateTakingStatus(
      req.user.tenantId,
      id,
      body.takingStatus,
      body.takingNotes,
    );
  }

  @Patch(':id/review')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Mark medication as reviewed during reconciliation' })
  async markReviewed(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markReviewed(req.user.tenantId, id, req.user.id);
  }

  @Delete(':id')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a patient medication' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.softDelete(req.user.tenantId, id);
  }
}
