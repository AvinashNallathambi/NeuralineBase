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
  ApiParam,
} from '@nestjs/swagger';
import { PrescriptionsService, PaginatedResult } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Prescriptions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'List prescriptions with pagination, search, and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by patient name or medication' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'patientId', required: false, type: String, description: 'Filter by patient UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of prescriptions' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
  ): Promise<PaginatedResult<any>> {
    return this.prescriptionsService.findAll(req.tenantId, {
      page: page || 1,
      limit: limit || 20,
      search,
      status,
      patientId,
    });
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Get prescription by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiResponse({ status: 200, description: 'Prescription details' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.prescriptionsService.findOne(req.tenantId, id);
  }

  @Post()
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new prescription' })
  @ApiResponse({ status: 201, description: 'Prescription created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() createPrescriptionDto: CreatePrescriptionDto,
  ) {
    return this.prescriptionsService.create(req.tenantId, createPrescriptionDto);
  }

  @Patch(':id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Update prescription details' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiResponse({ status: 200, description: 'Prescription updated successfully' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePrescriptionDto: UpdatePrescriptionDto,
  ) {
    return this.prescriptionsService.update(req.tenantId, id, updatePrescriptionDto);
  }

  @Delete(':id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a prescription' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiResponse({ status: 204, description: 'Prescription soft deleted' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.prescriptionsService.softDelete(req.tenantId, id);
  }
}
