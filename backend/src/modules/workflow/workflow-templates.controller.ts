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
import { WorkflowService } from './workflow.service';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from './dto/update-workflow-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Workflow Templates')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflow/templates')
export class WorkflowTemplatesController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateWorkflowTemplateDto,
  ) {
    return this.workflowService.createTemplate(req.tenantId, dto);
  }

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List workflow templates' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('entityType') entityType?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.workflowService.findAllTemplates(req.tenantId, {
      page: page || 1,
      limit: limit || 20,
      entityType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  @Get('entity/:entityType')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get active workflow template for an entity type' })
  @ApiParam({ name: 'entityType', type: String })
  async findByEntityType(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
  ) {
    const template = await this.workflowService.findActiveTemplateForEntity(
      req.tenantId,
      entityType,
    );
    if (!template) {
      return { data: null, message: `No active workflow for entity "${entityType}"` };
    }
    return { data: template };
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get workflow template by ID' })
  @ApiParam({ name: 'id', type: String })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflowService.findTemplateById(req.tenantId, id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update workflow template' })
  @ApiParam({ name: 'id', type: String })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowTemplateDto,
  ) {
    return this.workflowService.updateTemplate(req.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete workflow template' })
  @ApiParam({ name: 'id', type: String })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflowService.deleteTemplate(req.tenantId, id);
  }
}
