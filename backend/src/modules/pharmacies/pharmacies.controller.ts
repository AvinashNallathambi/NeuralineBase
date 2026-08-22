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
import { PharmaciesService } from './pharmacies.service';
import { NPPESPharmacyService } from './nppes-pharmacy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Pharmacies')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pharmacies')
export class PharmaciesController {
  constructor(
    private readonly pharmaciesService: PharmaciesService,
    private readonly nppesService: NPPESPharmacyService,
  ) {}

  @Get('search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search pharmacies (NPPES + network when enabled, otherwise local directory)' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Pharmacy search results' })
  async search(
    @Request() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.pharmaciesService.search(
      req.user.tenantId,
      q || '',
      limit ? Number(limit) : 25,
    );
    return { data, query: q || '', total: data.length };
  }

  // ── NPPES endpoints ──────────────────────────────────────────────────────────

  @Get('nppes/search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search NPPES NPI Registry for real US pharmacies (free, no API key)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'NPPES pharmacy search results' })
  async searchNppes(
    @Request() req: AuthenticatedRequest,
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.nppesService.searchPharmacies(
      req.user.tenantId,
      q || '',
      limit ? Number(limit) : 25,
    );
    return { data, query: q || '', total: data.length };
  }

  @Get('nppes/:npi')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get a specific pharmacy by NPI number from NPPES' })
  @ApiQuery({ name: 'npi', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Pharmacy details' })
  async getPharmacyByNpi(
    @Request() req: AuthenticatedRequest,
    @Query('npi') npi: string,
  ) {
    const data = await this.nppesService.getPharmacyByNpi(req.user.tenantId, npi || '');
    return { data };
  }
}
