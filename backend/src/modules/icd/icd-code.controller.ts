import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IcdCodeService } from './icd-code.service';
import { SearchIcdDto } from './dto/search-icd.dto';
import { UpdateIcdDto } from './dto/update-icd.dto';
import { UnifiedSearchDto } from './dto/unified-search.dto';
import { CreateFavoriteDiagnosisDto } from './dto/create-favorite-diagnosis.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('ICD-10 Codes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('icd')
export class IcdCodeController {
  constructor(private readonly service: IcdCodeService) {}

  @Get('search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Search ICD-10 codes by code or description' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query (code or description)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Query(new ValidationPipe({ transform: true })) dto: SearchIcdDto) {
    return this.service.search(dto);
  }

  @Get('unified-search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Unified diagnosis search across patient problems, favorites, ICD-10, and recent diagnoses' })
  @ApiResponse({ status: 200, description: 'Grouped search results' })
  async unifiedSearch(
    @Request() req: AuthenticatedRequest,
    @Query(new ValidationPipe({ transform: true })) dto: UnifiedSearchDto,
  ) {
    return this.service.unifiedSearch(req.user.tenantId, dto);
  }

  @Get('favorites')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get favorite diagnoses for the provider or tenant' })
  @ApiQuery({ name: 'providerId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of favorite diagnoses' })
  async findFavorites(
    @Request() req: AuthenticatedRequest,
    @Query('providerId') providerId?: string,
  ) {
    return this.service.findFavorites(req.user.tenantId, providerId || req.user.id);
  }

  @Post('favorites')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a favorite diagnosis' })
  async createFavorite(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateFavoriteDiagnosisDto,
  ) {
    return this.service.createFavorite(req.user.tenantId, dto, req.user.id);
  }

  @Delete('favorites/:id')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a favorite diagnosis' })
  async removeFavorite(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeFavorite(req.user.tenantId, id, req.user.id);
  }

  @Get(':code')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Look up an ICD-10 code by exact code value' })
  @ApiResponse({ status: 200, description: 'ICD-10 code found' })
  @ApiResponse({ status: 404, description: 'Code not found' })
  async lookup(@Param('code') code: string) {
    const result = await this.service.findByCode(code);
    if (!result) return { found: false, code };
    return { found: true, data: result };
  }

  @Get('id/:id')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get ICD-10 code by internal ID' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update ICD-10 code metadata (admin only)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIcdDto) {
    return this.service.update(id, dto);
  }

  @Post('refresh-vectors')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh PostgreSQL full-text search vectors' })
  async refreshVectors() {
    const count = await this.service.refreshSearchVectors();
    return { updated: count };
  }

  @Delete('all')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all ICD-10 codes (admin only)' })
  async deleteAll() {
    await this.service.deleteAll();
  }
}
