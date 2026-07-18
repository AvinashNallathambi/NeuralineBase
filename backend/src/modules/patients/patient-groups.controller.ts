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
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PatientGroupsService } from './patient-groups.service';
import { PatientGroupAiService } from './patient-groups-ai.service';
import {
  CreatePatientGroupDto,
  UpdatePatientGroupDto,
  QueryPatientGroupDto,
  AddMembersDto,
  RemoveMembersDto,
  BulkActionDto,
  NaturalLanguageSearchDto,
} from './dto/patient-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Patient Groups')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patient-groups')
export class PatientGroupsController {
  constructor(
    private readonly groupsService: PatientGroupsService,
    private readonly groupsAiService: PatientGroupAiService,
  ) {}

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'List patient groups with pagination, search, and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'tag', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of patient groups' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: QueryPatientGroupDto,
  ) {
    return this.groupsService.findAll(req.user.tenantId, query);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'Get a patient group by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Patient group details' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new patient group' })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Group with same name already exists' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePatientGroupDto,
  ) {
    return this.groupsService.create(req.user.tenantId, dto, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Update a patient group' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Group updated successfully' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientGroupDto,
  ) {
    return this.groupsService.update(req.user.tenantId, id, dto, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Delete(':id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a patient group' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Group soft deleted' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.softDelete(req.user.tenantId, id, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Post(':id/archive')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Archive a patient group' })
  @ApiParam({ name: 'id', type: String })
  async archive(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.archive(req.user.tenantId, id, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Post(':id/restore')
  @Roles('admin')
  @ApiOperation({ summary: 'Restore an archived or deleted patient group' })
  @ApiParam({ name: 'id', type: String })
  async restore(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.restore(req.user.tenantId, id, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Post(':id/duplicate')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Duplicate an existing patient group' })
  @ApiParam({ name: 'id', type: String })
  async duplicate(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.duplicate(req.user.tenantId, id, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Get(':id/members')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'Get members of a patient group with pagination' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getMembers(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.groupsService.getMembers(req.user.tenantId, id, { page, limit, search });
  }

  @Post(':id/members')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Add patients to a manual group' })
  @ApiParam({ name: 'id', type: String })
  async addMembers(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.groupsService.addMembers(req.user.tenantId, id, dto.patientIds, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Delete(':id/members')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Remove patients from a manual group' })
  @ApiParam({ name: 'id', type: String })
  async removeMembers(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveMembersDto,
  ) {
    return this.groupsService.removeMembers(req.user.tenantId, id, dto.patientIds, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Post(':id/refresh')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Refresh dynamic group membership (re-evaluate rules)' })
  @ApiParam({ name: 'id', type: String })
  async refresh(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.refreshDynamicMembers(req.user.tenantId, id, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    });
  }

  @Get(':id/population-health')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'Get population health statistics for a group' })
  @ApiParam({ name: 'id', type: String })
  async getPopulationHealth(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.getPopulationHealthStats(req.user.tenantId, id);
  }

  @Get(':id/audit')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Get audit log for a patient group' })
  @ApiParam({ name: 'id', type: String })
  async getAuditLog(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ) {
    return this.groupsService.getAuditLog(req.user.tenantId, id, limit);
  }

  @Get(':id/export')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'Export group members as CSV' })
  @ApiParam({ name: 'id', type: String })
  async exportCsv(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const csv = await this.groupsService.exportMembersCsv(req.user.tenantId, id);
    const group = await this.groupsService.findOne(req.user.tenantId, id);
    const filename = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_members.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Post(':id/bulk-action')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'Execute a bulk action on all group members' })
  @ApiParam({ name: 'id', type: String })
  async bulkAction(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkActionDto,
  ) {
    const group = await this.groupsService.findOne(req.user.tenantId, id);
    const memberIds = group.memberIds || [];

    if (memberIds.length === 0) {
      throw new BadRequestException('Group has no members to perform bulk action on');
    }

    await this.groupsService.logAudit(req.user.tenantId, id, `BULK_${dto.action.toUpperCase()}`, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
    }, `Bulk action "${dto.action}" executed on ${memberIds.length} members`, dto.payload);

    return {
      action: dto.action,
      groupId: id,
      affectedCount: memberIds.length,
      status: 'queued',
      message: `Bulk ${dto.action} queued for ${memberIds.length} members`,
    };
  }

  // ─── AI Endpoints ──────────────────────────────────────────────────

  @Get('ai/suggestions')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get AI-suggested patient groups based on practice data' })
  async getSuggestedGroups(@Request() req: AuthenticatedRequest) {
    return this.groupsAiService.suggestGroups(req.user.tenantId);
  }

  @Post('ai/natural-language-search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search patients using natural language' })
  async naturalLanguageSearch(
    @Request() req: AuthenticatedRequest,
    @Body() dto: NaturalLanguageSearchDto,
  ) {
    const result = await this.groupsAiService.naturalLanguageSearch(req.user.tenantId, dto.query);
    if (result.rules) {
      const matchedIds = await this.groupsService.evaluateRules(req.user.tenantId, result.rules);
      result.matchedPatientIds = matchedIds;
      result.matchedCount = matchedIds.length;
    }
    return result;
  }

  @Post('ai/risk-prediction')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Predict risk scores for a set of patients' })
  async predictRisk(
    @Request() req: AuthenticatedRequest,
    @Body('patientIds') patientIds: string[],
  ) {
    if (!patientIds || patientIds.length === 0) {
      throw new BadRequestException('patientIds is required');
    }
    return this.groupsAiService.predictRisk(req.user.tenantId, patientIds);
  }

  @Post('ai/care-gaps')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Detect care gaps for a set of patients' })
  async detectCareGaps(
    @Request() req: AuthenticatedRequest,
    @Body('patientIds') patientIds: string[],
  ) {
    if (!patientIds || patientIds.length === 0) {
      throw new BadRequestException('patientIds is required');
    }
    return this.groupsAiService.detectCareGaps(req.user.tenantId, patientIds);
  }

  @Post('ai/no-show-prediction')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Predict no-show probability for patients' })
  async predictNoShow(
    @Request() req: AuthenticatedRequest,
    @Body('patientIds') patientIds: string[],
  ) {
    if (!patientIds || patientIds.length === 0) {
      throw new BadRequestException('patientIds is required');
    }
    return this.groupsAiService.predictNoShow(req.user.tenantId, patientIds);
  }

  @Get('ai/outreach-recommendations')
  @Roles('admin', 'doctor', 'nurse', 'billing_staff')
  @ApiOperation({ summary: 'Get AI-recommended outreach campaigns' })
  async getOutreachRecommendations(@Request() req: AuthenticatedRequest) {
    return this.groupsAiService.recommendOutreach(req.user.tenantId);
  }
}
