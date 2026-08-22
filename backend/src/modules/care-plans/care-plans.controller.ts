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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CarePlansService } from './care-plans.service';
import { CreateCarePlanDto } from './dto/create-care-plan.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Care Plans')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('care-plans')
export class CarePlansController {
  constructor(private readonly service: CarePlansService) {}

  // ── Care Plans ──

  @Get('patient/:patientId')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get all care plans for a patient' })
  async findByPatient(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
  ) {
    return this.service.findByPatient(req.user.tenantId, patientId);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get a care plan with goals and tasks' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getFullPlan(req.user.tenantId, id);
  }

  @Post()
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Create a care plan' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCarePlanDto,
  ) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Update a care plan' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCarePlanDto>,
  ) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/approve')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Approve an AI-generated care plan' })
  async approve(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.approve(req.user.tenantId, id, req.user.id);
  }

  @Delete(':id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a care plan' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.softDelete(req.user.tenantId, id);
  }

  // ── Goals ──

  @Get(':id/goals')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get goals for a care plan' })
  async findGoals(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findGoals(req.user.tenantId, id);
  }

  @Post('goals')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Create a goal' })
  async createGoal(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateGoalDto,
  ) {
    return this.service.createGoal(req.user.tenantId, dto);
  }

  @Patch('goals/:goalId')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Update a goal' })
  async updateGoal(
    @Request() req: AuthenticatedRequest,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: Partial<CreateGoalDto>,
  ) {
    return this.service.updateGoal(req.user.tenantId, goalId, dto);
  }

  @Patch('goals/:goalId/progress')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Update goal progress (current value)' })
  async updateGoalProgress(
    @Request() req: AuthenticatedRequest,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() body: { currentValue: string },
  ) {
    return this.service.updateGoalProgress(req.user.tenantId, goalId, body.currentValue);
  }

  @Delete('goals/:goalId')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGoal(
    @Request() req: AuthenticatedRequest,
    @Param('goalId', ParseUUIDPipe) goalId: string,
  ) {
    await this.service.deleteGoal(req.user.tenantId, goalId);
  }

  // ── Tasks ──

  @Get(':id/tasks')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get tasks for a care plan' })
  async findTasks(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findTasks(req.user.tenantId, id);
  }

  @Get('tasks/patient/:patientId')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get all tasks for a patient (across all plans)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findTasksByPatient(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
    @Query('status') status?: string,
  ) {
    return this.service.findTasksByPatient(req.user.tenantId, patientId, status);
  }

  @Post('tasks')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Create a task' })
  async createTask(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateTaskDto,
  ) {
    return this.service.createTask(req.user.tenantId, dto);
  }

  @Patch('tasks/:taskId')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Update a task' })
  async updateTask(
    @Request() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: Partial<CreateTaskDto>,
  ) {
    return this.service.updateTask(req.user.tenantId, taskId, dto);
  }

  @Patch('tasks/:taskId/complete')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Mark a task as completed' })
  async completeTask(
    @Request() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: { completedBy?: string; reportedValue?: string; patientNotes?: string },
  ) {
    return this.service.completeTask(
      req.user.tenantId,
      taskId,
      body.completedBy || req.user.id,
      body.reportedValue,
      body.patientNotes,
    );
  }

  @Patch('tasks/:taskId/report')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Patient reports a value for a monitoring task' })
  async reportTaskValue(
    @Request() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: { reportedValue: string; patientNotes?: string },
  ) {
    return this.service.reportTaskValue(
      req.user.tenantId,
      taskId,
      body.reportedValue,
      body.patientNotes,
    );
  }

  @Delete('tasks/:taskId')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(
    @Request() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    await this.service.deleteTask(req.user.tenantId, taskId);
  }
}
