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
import { AppointmentsService, AppointmentWithWorkflow, PaginatedResult } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { CreateAppointmentWithWorkflowDto, TransitionAppointmentDto } from './dto/appointment-workflow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Appointments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List appointments with pagination, search, and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'patientId', required: false, type: String, description: 'Filter by patient ID' })
  @ApiQuery({ name: 'providerId', required: false, type: String, description: 'Filter by provider ID' })
  @ApiQuery({ name: 'appointmentType', required: false, type: String, description: 'Filter by appointment type' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by end date (ISO string)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in notes and reason for visit' })
  @ApiResponse({ status: 200, description: 'Paginated list of appointments' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: QueryAppointmentDto,
  ): Promise<PaginatedResult<any>> {
    return this.appointmentsService.findAll(req.tenantId, query);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get appointment by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment details' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.findOne(req.tenantId, id);
  }

  @Get(':id/workflow')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get appointment with workflow information' })
  @ApiParam({ name: 'id', type: String, description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment with workflow instance and available transitions' })
  async findOneWithWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentWithWorkflow> {
    return this.appointmentsService.findOneWithWorkflow(req.tenantId, id);
  }

  @Post()
  @Roles('admin', 'doctor', 'receptionist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new appointment' })
  @ApiResponse({ status: 201, description: 'Appointment created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Overlapping appointment exists' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() createAppointmentDto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(
      req.tenantId,
      createAppointmentDto,
      req.user.id,
      req.user.email,
    );
  }

  @Post('with-workflow')
  @Roles('admin', 'doctor', 'receptionist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new appointment with workflow initialization' })
  @ApiResponse({ status: 201, description: 'Appointment created with workflow instance' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Overlapping appointment exists' })
  async createWithWorkflow(
    @Request() req: AuthenticatedRequest,
    @Body('appointment') createAppointmentDto: CreateAppointmentDto,
    @Body('workflow') workflowDto: CreateAppointmentWithWorkflowDto,
  ): Promise<AppointmentWithWorkflow> {
    return this.appointmentsService.createWithWorkflow(
      req.tenantId,
      createAppointmentDto,
      workflowDto,
      req.user.id,
      req.user.email,
    );
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'receptionist')
  @ApiOperation({ summary: 'Update appointment details' })
  @ApiParam({ name: 'id', type: String, description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment updated successfully' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 409, description: 'Overlapping appointment exists' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(req.tenantId, id, updateAppointmentDto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an appointment' })
  @ApiParam({ name: 'id', type: String, description: 'Appointment UUID' })
  @ApiResponse({ status: 204, description: 'Appointment soft deleted' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.softDelete(req.tenantId, id);
  }

  // ── Workflow Integration Endpoints ────────────────────────────────────────

  @Get(':id/workflow/transitions')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get available workflow transitions for an appointment' })
  @ApiParam({ name: 'id', type: String, description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'List of available transitions' })
  async getAvailableTransitions(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.getAvailableTransitions(req.tenantId, id);
  }

  @Post(':id/workflow/transition')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Transition appointment workflow to next step' })
  @ApiParam({ name: 'id', type: String, description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment workflow transitioned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  async transitionWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() transitionDto: TransitionAppointmentDto,
  ): Promise<AppointmentWithWorkflow> {
    return this.appointmentsService.transitionWorkflow(
      req.tenantId,
      id,
      transitionDto,
      req.user.id,
      req.user.email,
    );
  }

  @Post(':id/workflow/complete')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Mark appointment workflow as completed' })
  @ApiParam({ name: 'id', type: String, description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment workflow completed' })
  async completeWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentWithWorkflow> {
    return this.appointmentsService.completeWorkflow(req.tenantId, id);
  }

  @Post(':id/workflow/cancel')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Cancel appointment workflow' })
  @ApiParam({ name: 'id', type: String, description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment workflow cancelled' })
  async cancelWorkflow(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ): Promise<AppointmentWithWorkflow> {
    return this.appointmentsService.cancelWorkflow(req.tenantId, id, reason);
  }
}
