import {
  Controller,
  Get,
  Post,
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
import { WorkflowService } from './workflow.service';
import {
  CreateWorkflowInstanceDto,
  TransitionWorkflowDto,
} from './dto/workflow-instance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string; firstName?: string; lastName?: string };
  tenantId: string;
}

@ApiTags('Workflow Instances')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflow/instances')
export class WorkflowInstancesController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @Roles('admin', 'doctor', 'receptionist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow instance for an entity' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateWorkflowInstanceDto,
  ) {
    const userName = req.user.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : req.user.email;
    return this.workflowService.createInstance(
      req.tenantId,
      dto,
      req.user.id,
      userName,
    );
  }

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List workflow instances' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'currentStep', required: false, type: String })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('entityType') entityType?: string,
    @Query('status') status?: string,
    @Query('currentStep') currentStep?: string,
  ) {
    return this.workflowService.findAllInstances(req.tenantId, {
      page: page || 1,
      limit: limit || 20,
      entityType,
      status,
      currentStep,
    });
  }

  @Get('entity/:entityType/:entityId')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get workflow instance for an entity' })
  @ApiParam({ name: 'entityType', type: String })
  @ApiParam({ name: 'entityId', type: String })
  async findByEntity(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.workflowService.findInstanceByEntity(
      req.tenantId,
      entityType,
      entityId,
    );
  }

  @Get('entity/:entityType/:entityId/transitions')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get available transitions for an entity workflow' })
  @ApiParam({ name: 'entityType', type: String })
  @ApiParam({ name: 'entityId', type: String })
  async getTransitions(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.workflowService.getAvailableTransitions(
      req.tenantId,
      entityType,
      entityId,
    );
  }

  @Post('entity/:entityType/:entityId/transition')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition workflow to next step' })
  @ApiParam({ name: 'entityType', type: String })
  @ApiParam({ name: 'entityId', type: String })
  async transition(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Body() dto: TransitionWorkflowDto,
  ) {
    const userName = req.user.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : req.user.email;
    return this.workflowService.transition(
      req.tenantId,
      entityType,
      entityId,
      dto,
      req.user.id,
      userName,
    );
  }

  @Post('entity/:entityType/:entityId/complete')
  @Roles('admin', 'doctor', 'receptionist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete (finalize) a workflow instance' })
  async complete(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.workflowService.completeWorkflow(
      req.tenantId,
      entityType,
      entityId,
    );
  }

  @Post('entity/:entityType/:entityId/cancel')
  @Roles('admin', 'doctor', 'receptionist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a workflow instance' })
  async cancel(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Body('reason') reason?: string,
  ) {
    return this.workflowService.cancelWorkflow(
      req.tenantId,
      entityType,
      entityId,
      reason,
    );
  }
}
