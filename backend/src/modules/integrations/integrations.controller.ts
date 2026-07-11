import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Integrations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'List all integrations for the tenant' })
  @ApiResponse({ status: 200, description: 'Tenant integrations' })
  async findAll(@Request() req: AuthenticatedRequest) {
    return this.integrationsService.findAll(req.user.tenantId);
  }

  @Get(':key')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get a single integration' })
  @ApiParam({ name: 'key', type: String, description: 'Integration key' })
  @ApiResponse({ status: 200, description: 'Integration details' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('key') key: string,
  ) {
    return this.integrationsService.findOne(req.user.tenantId, key);
  }

  @Put(':key')
  @Roles('admin')
  @ApiOperation({ summary: 'Update integration settings (admin only)' })
  @ApiParam({ name: 'key', type: String, description: 'Integration key' })
  @ApiResponse({ status: 200, description: 'Integration updated' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(req.user.tenantId, key, dto);
  }
}
