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
import { PatientMedicationsService } from './patient-medications.service';
import {
  CreatePatientMedicationDto,
  UpdatePatientMedicationDto,
  DiscontinuePatientMedicationDto,
  QueryPatientMedicationDto,
  PatientMedicationStatus,
  PatientMedicationSource,
} from './dto/patient-medication.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Patient Medications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientMedicationsController {
  constructor(private readonly medicationsService: PatientMedicationsService) {}

  @Get(':id/medications')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: "List a patient's medication list entries" })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiQuery({ name: 'status', required: false, enum: PatientMedicationStatus })
  @ApiQuery({ name: 'source', required: false, enum: PatientMedicationSource })
  @ApiResponse({ status: 200, description: 'List of patient medications' })
  async list(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryPatientMedicationDto,
  ) {
    return this.medicationsService.list(req.user.tenantId, id, query);
  }

  @Post(':id/medications')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add a medication to a patient's medication list" })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 201, description: 'Medication created' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePatientMedicationDto,
  ) {
    return this.medicationsService.create(req.user.tenantId, id, dto, req.user.id);
  }

  @Patch(':id/medications/:medicationId')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update a patient medication entry' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'medicationId', type: String, description: 'Medication UUID' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('medicationId', ParseUUIDPipe) medicationId: string,
    @Body() dto: UpdatePatientMedicationDto,
  ) {
    return this.medicationsService.update(
      req.user.tenantId,
      id,
      medicationId,
      dto,
      req.user.id,
    );
  }

  @Post(':id/medications/:medicationId/discontinue')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Discontinue a patient medication' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'medicationId', type: String, description: 'Medication UUID' })
  async discontinue(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('medicationId', ParseUUIDPipe) medicationId: string,
    @Body() dto: DiscontinuePatientMedicationDto,
  ) {
    return this.medicationsService.discontinue(
      req.user.tenantId,
      id,
      medicationId,
      dto,
      req.user.id,
    );
  }

  @Delete(':id/medications/:medicationId')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a patient medication entry' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'medicationId', type: String, description: 'Medication UUID' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('medicationId', ParseUUIDPipe) medicationId: string,
  ) {
    return this.medicationsService.remove(req.user.tenantId, id, medicationId);
  }
}
