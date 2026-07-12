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
import { CreateRefillDto } from './dto/create-refill.dto';
import { UpdateRefillDto } from './dto/update-refill.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
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
    return this.prescriptionsService.findAll(req.user.tenantId, {
      page: page || 1,
      limit: limit || 20,
      search,
      status,
      patientId,
    });
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Get prescription by ID or list refill requests' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiQuery({ name: 'prescriptionId', required: false, type: String, description: 'Filter refills by prescription UUID' })
  @ApiResponse({ status: 200, description: 'Prescription details or refill list' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('prescriptionId') prescriptionId?: string,
  ) {
    if (id === 'refills') {
      return this.prescriptionsService.findRefills(req.user.tenantId, prescriptionId);
    }
    return this.prescriptionsService.findOne(req.user.tenantId, id);
  }

  @Get(':id/refills')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'List refill requests for a specific prescription' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiResponse({ status: 200, description: 'List of refill requests for the prescription' })
  async findRefills(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.prescriptionsService.findRefills(req.user.tenantId, id);
  }

  @Get(':id/status-history')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Get prescription status change history' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiResponse({ status: 200, description: 'Status history entries' })
  async getStatusHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.prescriptionsService.getStatusHistory(req.user.tenantId, id);
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
    return this.prescriptionsService.create(req.user.tenantId, createPrescriptionDto);
  }

  @Post(':id/refill')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a refill for a prescription' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiResponse({ status: 201, description: 'Refill request created' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  @ApiResponse({ status: 400, description: 'Refill not allowed for this status' })
  async createRefill(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createRefillDto: CreateRefillDto,
  ) {
    return this.prescriptionsService.createRefill(
      req.user.tenantId,
      id,
      createRefillDto,
      req.user.id,
    );
  }

  @Post(':id/status')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Transition prescription status' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async updateStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrescriptionStatusDto,
  ) {
    return this.prescriptionsService.updateStatus(
      req.user.tenantId,
      id,
      dto,
      req.user.id,
    );
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
    return this.prescriptionsService.update(req.user.tenantId, id, updatePrescriptionDto);
  }

  @Patch(':id/refills/:refillId')
  @Roles('admin', 'doctor', 'pharmacist')
  @ApiOperation({ summary: 'Update a refill request status' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiParam({ name: 'refillId', type: String, description: 'Refill request UUID' })
  @ApiResponse({ status: 200, description: 'Refill request updated' })
  @ApiResponse({ status: 400, description: 'Invalid refill status transition' })
  @ApiResponse({ status: 404, description: 'Refill request not found' })
  async updateRefill(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('refillId', ParseUUIDPipe) refillId: string,
    @Body() dto: UpdateRefillDto,
  ) {
    return this.prescriptionsService.updateRefill(
      req.user.tenantId,
      refillId,
      dto,
      req.user.id,
    );
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
    return this.prescriptionsService.softDelete(req.user.tenantId, id);
  }

  @Delete(':id/refills/:refillId')
  @Roles('admin', 'doctor', 'pharmacist')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a refill request' })
  @ApiParam({ name: 'id', type: String, description: 'Prescription UUID' })
  @ApiParam({ name: 'refillId', type: String, description: 'Refill request UUID' })
  @ApiResponse({ status: 204, description: 'Refill request deleted' })
  @ApiResponse({ status: 404, description: 'Refill request not found' })
  async deleteRefill(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('refillId', ParseUUIDPipe) refillId: string,
  ) {
    return this.prescriptionsService.deleteRefill(req.user.tenantId, refillId);
  }
}
