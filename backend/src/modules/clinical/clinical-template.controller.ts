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
  ApiBody,
} from '@nestjs/swagger';
import { ClinicalTemplateService } from './clinical-template.service';
import { CreateClinicalTemplateDto } from './dto/create-clinical-template.dto';
import { UpdateClinicalTemplateDto } from './dto/update-clinical-template.dto';
import { ClinicalTemplateStatus } from './entities/clinical-template.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Clinical - Templates')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clinical/templates')
export class ClinicalTemplateController {
  constructor(private readonly service: ClinicalTemplateService) {}

  @Post()
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Create a clinical template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateClinicalTemplateDto,
  ) {
    return this.service.create(req.user.tenantId, dto, req.user.id, req.user.email);
  }

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List clinical templates with search, filters, pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'specialty', required: false, type: String })
  @ApiQuery({ name: 'visitType', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'isFavorite', required: false, type: Boolean })
  @ApiQuery({ name: 'recentlyUsed', required: false, type: Boolean })
  @ApiQuery({ name: 'status', required: false, enum: ClinicalTemplateStatus })
  @ApiQuery({ name: 'sort', required: false, type: String })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    const options = {
      page: parseInt(query['page']) || 1,
      limit: parseInt(query['limit']) || 24,
      search: query['search'] || undefined,
      specialty: query['specialty'] || undefined,
      visitType: query['visitType'] || undefined,
      department: query['department'] || undefined,
      isFavorite: query['isFavorite'] === 'true' ? true : undefined,
      recentlyUsed: query['recentlyUsed'] === 'true' ? true : undefined,
      status: (query['status'] as ClinicalTemplateStatus) || undefined,
      sort: query['sort'] || undefined,
    };
    return this.service.findAll(req.user.tenantId, options);
  }

  @Get('specialties')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List distinct specialties for filters' })
  async findSpecialties(@Request() req: AuthenticatedRequest) {
    return { data: await this.service.findSpecialties(req.user.tenantId) };
  }

  @Get('visit-types')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List distinct visit types for filters' })
  async findVisitTypes(@Request() req: AuthenticatedRequest) {
    return { data: await this.service.findVisitTypes(req.user.tenantId) };
  }

  @Get('departments')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List distinct departments for filters' })
  async findDepartments(@Request() req: AuthenticatedRequest) {
    return { data: await this.service.findDepartments(req.user.tenantId) };
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get clinical template by ID' })
  @ApiParam({ name: 'id', type: String })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Update clinical template' })
  @ApiParam({ name: 'id', type: String })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicalTemplateDto,
  ) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Post(':id/duplicate')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate a clinical template' })
  @ApiParam({ name: 'id', type: String })
  async duplicate(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.duplicate(req.user.tenantId, id, req.user.id, req.user.email);
  }

  @Post(':id/archive')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Archive a clinical template' })
  @ApiParam({ name: 'id', type: String })
  async archive(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(req.user.tenantId, id);
  }

  @Post(':id/default')
  @Roles('admin')
  @ApiOperation({ summary: 'Set template as default for its specialty + visit type' })
  @ApiParam({ name: 'id', type: String })
  async setDefault(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setDefault(req.user.tenantId, id);
  }

  @Post(':id/favorite')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Toggle favorite flag on a clinical template' })
  @ApiParam({ name: 'id', type: String })
  async toggleFavorite(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.toggleFavorite(req.user.tenantId, id);
  }

  @Post(':id/apply')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get template payload for new encounter creation' })
  @ApiParam({ name: 'id', type: String })
  async apply(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.apply(req.user.tenantId, id);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a clinical template (admin only)' })
  @ApiParam({ name: 'id', type: String })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(req.user.tenantId, id);
  }
}
