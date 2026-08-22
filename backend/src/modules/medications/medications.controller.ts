import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MedicationsService } from './medications.service';
import { OpenFDAService } from './openfda.service';
import { DailyMedService } from './dailymed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Medications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medications')
export class MedicationsController {
  constructor(
    private readonly medicationsService: MedicationsService,
    private readonly openfdaService: OpenFDAService,
    private readonly dailymedService: DailyMedService,
  ) {}

  @Get('search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search medications (RxNorm + OpenFDA when enabled, otherwise local catalog)' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Medication search results' })
  async search(
    @Request() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.medicationsService.search(
      req.user.tenantId,
      q || '',
      limit ? Number(limit) : 25,
    );
    return { data, query: q || '', total: data.length };
  }

  // ── OpenFDA endpoints ──────────────────────────────────────────────────────

  @Get('openfda/search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search FDA drug database (NDC directory) via OpenFDA — covers all FDA-approved drugs including gene therapies' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'OpenFDA drug search results' })
  async searchOpenFda(
    @Request() req: AuthenticatedRequest,
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.openfdaService.searchDrugs(
      req.user.tenantId,
      q || '',
      limit ? Number(limit) : 25,
    );
    return { data, query: q || '', total: data.length };
  }

  @Get('openfda/label')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get full FDA drug label (indications, warnings, dosage, contraindications)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Drug label information' })
  async getDrugLabel(
    @Request() req: AuthenticatedRequest,
    @Query('q') q: string,
  ) {
    const data = await this.openfdaService.getDrugLabel(req.user.tenantId, q || '');
    return { data, query: q || '' };
  }

  @Get('openfda/adverse-events')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search FDA adverse event reports (FAERS) for a drug' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Adverse event reports' })
  async searchAdverseEvents(
    @Request() req: AuthenticatedRequest,
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.openfdaService.searchAdverseEvents(
      req.user.tenantId,
      q || '',
      limit ? Number(limit) : 25,
    );
    return { data, query: q || '', total: data.length };
  }

  @Get('openfda/recalls')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search FDA drug recalls (enforcement reports)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Drug recall reports' })
  async searchRecalls(
    @Request() req: AuthenticatedRequest,
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.openfdaService.searchRecalls(
      req.user.tenantId,
      q || '',
      limit ? Number(limit) : 25,
    );
    return { data, query: q || '', total: data.length };
  }

  // ── DailyMed endpoints ──────────────────────────────────────────────────────

  @Get('dailymed/search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search DailyMed for FDA-approved drug labels (SPL)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'DailyMed search results' })
  async searchDailyMed(
    @Request() req: AuthenticatedRequest,
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.dailymedService.searchLabels(
      req.user.tenantId,
      q || '',
      limit ? Number(limit) : 25,
    );
    return { data, query: q || '', total: data.length };
  }

  @Get('dailymed/label/:setId')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get full DailyMed label details by SPL set ID' })
  @ApiResponse({ status: 200, description: 'Full label information' })
  async getDailyMedLabel(
    @Request() req: AuthenticatedRequest,
    @Query('setId') setId: string,
  ) {
    const data = await this.dailymedService.getLabelDetails(req.user.tenantId, setId || '');
    return { data };
  }
}
