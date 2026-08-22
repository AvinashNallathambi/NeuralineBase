import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
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
import { createReadStream } from 'fs';
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload a document for a patient' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: ['lab_report', 'imaging', 'consent', 'referral', 'insurance_card', 'identity', 'other'] },
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
      req.user.id,
    );
  }

  @Get(':id/documents')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List documents for a patient' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'List of patient documents' })
  async getDocuments(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.getDocuments(req.user.tenantId, id);
  }

  @Get(':id/documents/:documentId/download')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Download a patient document' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'documentId', type: String, description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document file stream' })
  async downloadDocument(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) res: import('express').Response,
  ): Promise<StreamableFile> {
    const { document, absPath } = await this.patientsService.getDocumentForDownload(
      req.user.tenantId,
      id,
      documentId,
    );
    res.set({
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(document.fileName)}"`,
      'Content-Length': String(document.fileSize),
    });
    return new StreamableFile(createReadStream(absPath));
  }

  @Delete(':id/documents/:documentId')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a patient document' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiParam({ name: 'documentId', type: String, description: 'Document UUID' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  async deleteDocument(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.patientsService.deleteDocument(req.user.tenantId, id, documentId);
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

  // ─── Allergies ───────────────────────────────────────────────────

  @Get(':id/allergies')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get patient allergies' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  async findAllergies(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('clinicalStatus') clinicalStatus?: string,
  ) {
    return this.patientsService.findAllergies(req.user.tenantId, id, clinicalStatus);
  }

  @Post(':id/allergies')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an allergy to the patient record' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  async createAllergy(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      allergen: string;
      reaction?: string;
      severity?: string;
      clinicalStatus?: string;
      onsetDate?: string;
      notes?: string;
    },
  ) {
    return this.patientsService.createAllergy(req.user.tenantId, id, body as any, req.user.id);
  }

  @Patch(':id/allergies/:allergyId')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update a patient allergy' })
  async updateAllergy(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('allergyId', ParseUUIDPipe) allergyId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.patientsService.updateAllergy(req.user.tenantId, id, allergyId, body as any);
  }

  @Delete(':id/allergies/:allergyId')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a patient allergy' })
  async removeAllergy(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('allergyId', ParseUUIDPipe) allergyId: string,
  ) {
    return this.patientsService.removeAllergy(req.user.tenantId, id, allergyId);
  }

  // ─── Family History ──────────────────────────────────────────────

  @Get(':id/family-history')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get patient family history' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  async findFamilyHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.findFamilyHistory(req.user.tenantId, id);
  }

  @Post(':id/family-history')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a family history entry' })
  async createFamilyHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      relationship: string;
      memberName?: string;
      condition: string;
      code?: string;
      codeSystem?: string;
      ageOfOnset?: number;
      isDeceased?: boolean;
      ageAtDeath?: number;
      notes?: string;
    },
  ) {
    return this.patientsService.createFamilyHistory(req.user.tenantId, id, body as any, req.user.id);
  }

  @Patch(':id/family-history/:fhId')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update a family history entry' })
  async updateFamilyHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fhId', ParseUUIDPipe) fhId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.patientsService.updateFamilyHistory(req.user.tenantId, id, fhId, body as any);
  }

  @Delete(':id/family-history/:fhId')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a family history entry' })
  async removeFamilyHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fhId', ParseUUIDPipe) fhId: string,
  ) {
    return this.patientsService.removeFamilyHistory(req.user.tenantId, id, fhId);
  }

  // ─── Surgical History ────────────────────────────────────────────

  @Get(':id/surgical-history')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get patient surgical history' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  async findSurgicalHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.findSurgicalHistory(req.user.tenantId, id);
  }

  @Post(':id/surgical-history')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a surgical history entry' })
  async createSurgicalHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      procedure: string;
      procedureCode?: string;
      procedureDate?: string;
      surgeon?: string;
      facility?: string;
      bodySite?: string;
      outcome?: string;
      notes?: string;
    },
  ) {
    return this.patientsService.createSurgicalHistory(req.user.tenantId, id, body as any, req.user.id);
  }

  @Patch(':id/surgical-history/:shId')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update a surgical history entry' })
  async updateSurgicalHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shId', ParseUUIDPipe) shId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.patientsService.updateSurgicalHistory(req.user.tenantId, id, shId, body as any);
  }

  @Delete(':id/surgical-history/:shId')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a surgical history entry' })
  async removeSurgicalHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shId', ParseUUIDPipe) shId: string,
  ) {
    return this.patientsService.removeSurgicalHistory(req.user.tenantId, id, shId);
  }

  // ─── Social History ──────────────────────────────────────────────

  @Get(':id/social-history')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get patient social history' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  async findSocialHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('category') category?: string,
  ) {
    return this.patientsService.findSocialHistory(req.user.tenantId, id, category);
  }

  @Post(':id/social-history')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a social history entry' })
  async createSocialHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      category: string;
      status?: string;
      detail?: string;
      frequency?: string;
      amount?: string;
      durationYears?: number;
      quitDate?: string;
      notes?: string;
    },
  ) {
    return this.patientsService.createSocialHistory(req.user.tenantId, id, body as any, req.user.id);
  }

  @Patch(':id/social-history/:shId')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update a social history entry' })
  async updateSocialHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shId', ParseUUIDPipe) shId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.patientsService.updateSocialHistory(req.user.tenantId, id, shId, body as any);
  }

  @Delete(':id/social-history/:shId')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a social history entry' })
  async removeSocialHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shId', ParseUUIDPipe) shId: string,
  ) {
    return this.patientsService.removeSocialHistory(req.user.tenantId, id, shId);
  }
}
