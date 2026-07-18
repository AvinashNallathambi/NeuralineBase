import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CptCodeService } from './cpt-code.service';
import { SearchCptDto } from './dto/search-cpt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('CPT/HCPCS Codes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cpt')
export class CptCodeController {
  constructor(private readonly service: CptCodeService) {}

  @Get('search')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'Search CPT/HCPCS codes by code or description' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query (code or description)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Query(new ValidationPipe({ transform: true })) dto: SearchCptDto) {
    return this.service.search(dto);
  }

  @Get(':code')
  @Roles('admin', 'doctor', 'nurse', 'receptionist', 'billing_staff')
  @ApiOperation({ summary: 'Look up a CPT/HCPCS code by exact code value' })
  @ApiResponse({ status: 200, description: 'CPT code found' })
  @ApiResponse({ status: 404, description: 'Code not found' })
  async lookup(@Param('code') code: string) {
    const result = await this.service.findByCode(code);
    if (!result) return { found: false, code };
    return { found: true, data: result };
  }
}
