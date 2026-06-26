import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FhirService, FhirResource, FhirBundle } from './fhir.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('FHIR')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('fhir')
export class FhirController {
  constructor(private readonly fhirService: FhirService) {}

  @Get('metadata')
  @ApiOperation({ summary: 'FHIR R4 Capability Statement' })
  @ApiResponse({ status: 200, description: 'FHIR CapabilityStatement resource' })
  getCapabilityStatement(): FhirResource {
    return this.fhirService.getCapabilityStatement();
  }

  @Get('Patient/:id')
  @ApiOperation({ summary: 'Get FHIR Patient resource by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'FHIR Patient resource (R4)' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async getPatient(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FhirResource> {
    return this.fhirService.getPatientResource(req.tenantId, id);
  }

  @Get('Patient')
  @ApiOperation({ summary: 'Search FHIR Patient resources' })
  @ApiQuery({ name: 'name', required: false, description: 'Patient name search' })
  @ApiQuery({ name: 'family', required: false, description: 'Family (last) name' })
  @ApiQuery({ name: 'given', required: false, description: 'Given (first) name' })
  @ApiQuery({ name: 'birthdate', required: false, description: 'Date of birth (YYYY-MM-DD)' })
  @ApiQuery({ name: 'gender', required: false, description: 'Gender (male | female | other | unknown)' })
  @ApiQuery({ name: 'identifier', required: false, description: 'Patient identifier (MRN)' })
  @ApiQuery({ name: '_count', required: false, description: 'Number of results per page' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of Patient resources' })
  async searchPatients(
    @Request() req: AuthenticatedRequest,
    @Query('name') name?: string,
    @Query('family') family?: string,
    @Query('given') given?: string,
    @Query('birthdate') birthdate?: string,
    @Query('gender') gender?: string,
    @Query('identifier') identifier?: string,
    @Query('_count') count?: number,
  ): Promise<FhirBundle> {
    return this.fhirService.searchPatients(req.tenantId, {
      name,
      family,
      given,
      birthdate,
      gender,
      identifier,
      count: count || 20,
    });
  }

  @Get('Encounter/:id')
  @ApiOperation({ summary: 'Get FHIR Encounter resource by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Encounter UUID' })
  @ApiResponse({ status: 200, description: 'FHIR Encounter resource (R4)' })
  @ApiResponse({ status: 404, description: 'Encounter not found' })
  async getEncounter(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FhirResource> {
    return this.fhirService.getEncounterResource(req.tenantId, id);
  }

  @Get('MedicationRequest/:id')
  @ApiOperation({ summary: 'Get FHIR MedicationRequest resource by ID' })
  @ApiParam({ name: 'id', type: String, description: 'MedicationRequest UUID' })
  @ApiResponse({ status: 200, description: 'FHIR MedicationRequest resource (R4)' })
  @ApiResponse({ status: 404, description: 'MedicationRequest not found' })
  async getMedicationRequest(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FhirResource> {
    return this.fhirService.getMedicationRequestResource(req.tenantId, id);
  }

  @Get('DiagnosticReport/:id')
  @ApiOperation({ summary: 'Get FHIR DiagnosticReport resource by ID' })
  @ApiParam({ name: 'id', type: String, description: 'DiagnosticReport UUID' })
  @ApiResponse({ status: 200, description: 'FHIR DiagnosticReport resource (R4)' })
  @ApiResponse({ status: 404, description: 'DiagnosticReport not found' })
  async getDiagnosticReport(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FhirResource> {
    return this.fhirService.getDiagnosticReportResource(req.tenantId, id);
  }

  @Get('Claim/:id')
  @ApiOperation({ summary: 'Get FHIR Claim resource by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Claim UUID' })
  @ApiResponse({ status: 200, description: 'FHIR Claim resource (R4)' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async getClaim(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FhirResource> {
    return this.fhirService.getClaimResource(req.tenantId, id);
  }
}
