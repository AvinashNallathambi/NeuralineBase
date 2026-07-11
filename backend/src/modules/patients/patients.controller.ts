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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PatientsService, PaginatedResult } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientProblemDto } from './dto/create-patient-problem.dto';
import { UpdatePatientProblemDto } from './dto/update-patient-problem.dto';
import { QueryPatientProblemDto } from './dto/query-patient-problem.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Patients')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List patients with pagination, search, and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name, MRN, email, or phone' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status (active, inactive, deceased)' })
  @ApiQuery({ name: 'gender', required: false, type: String, description: 'Filter by gender' })
  @ApiResponse({ status: 200, description: 'Paginated list of patients' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('gender') gender?: string,
  ): Promise<PaginatedResult<any>> {
    return this.patientsService.findAll(req.user.tenantId, {
      page: page || 1,
      limit: limit || 20,
      search,
      status,
      gender,
    });
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Patient details' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @Roles('admin', 'doctor', 'receptionist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Patient with same MRN already exists' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() createPatientDto: CreatePatientDto,
  ) {
    return this.patientsService.create(req.user.tenantId, createPatientDto);
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'receptionist')
  @ApiOperation({ summary: 'Update patient details' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Patient updated successfully' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePatientDto: Partial<CreatePatientDto>,
  ) {
    return this.patientsService.update(req.user.tenantId, id, updatePatientDto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a patient' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 204, description: 'Patient soft deleted' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.softDelete(req.user.tenantId, id);
  }

  @Get(':id/encounters')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get all encounters for a patient' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'List of patient encounters' })
  async getEncounters(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.getEncounters(req.user.tenantId, id);
  }

  @Get(':id/prescriptions')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist')
  @ApiOperation({ summary: 'Get all prescriptions for a patient' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'List of patient prescriptions' })
  async getPrescriptions(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.getPrescriptions(req.user.tenantId, id);
  }

  @Post(':id/documents')
  @Roles('admin', 'doctor', 'nurse')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document for a patient' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: ['lab_report', 'imaging', 'consent', 'referral', 'other'] },
        description: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  async uploadDocument(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
    @Body('description') description: string,
  ) {
    return this.patientsService.uploadDocument(
      req.user.tenantId,
      id,
      file,
      documentType,
      description,
    );
  }

  @Get(':id/problems')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get patient problem list' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'List of patient problems' })
  async findProblems(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryPatientProblemDto,
  ) {
    return this.patientsService.findProblems(req.user.tenantId, id, query);
  }

  @Post(':id/problems')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a problem to the patient problem list' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 201, description: 'Problem created' })
  async createProblem(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePatientProblemDto,
  ) {
    return this.patientsService.createProblem(req.user.tenantId, id, dto, req.user.id);
  }

  @Patch(':id/problems/:problemId')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update a patient problem' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'problemId', type: String, description: 'Problem UUID' })
  async updateProblem(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Body() dto: UpdatePatientProblemDto,
  ) {
    return this.patientsService.updateProblem(req.user.tenantId, id, problemId, dto);
  }

  @Delete(':id/problems/:problemId')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a patient problem' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'problemId', type: String, description: 'Problem UUID' })
  async removeProblem(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('problemId', ParseUUIDPipe) problemId: string,
  ) {
    return this.patientsService.removeProblem(req.user.tenantId, id, problemId);
  }
}
