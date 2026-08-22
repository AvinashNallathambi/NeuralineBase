import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CodesService } from './codes.service';
import { SearchCodesDto } from './dto/search-codes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Unified Code Search')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('codes')
export class CodesController {
  constructor(private readonly service: CodesService) {}

  @Get('search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'Unified search across ICD-10, ICD-9, CPT, HCPCS, SNOMED, and custom codes' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query (code or description)' })
  @ApiQuery({ name: 'types', required: false, type: String, description: 'Comma-separated code systems (e.g. ICD-10-CM,CPT,HCPCS)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Unified search results grouped by code system' })
  async search(
    @Request() req: AuthenticatedRequest,
    @Query(new ValidationPipe({ transform: true })) dto: SearchCodesDto,
  ) {
    return this.service.search(req.user.tenantId, dto);
  }
}
