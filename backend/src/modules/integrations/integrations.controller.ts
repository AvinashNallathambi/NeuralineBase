import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
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
  ApiQuery,
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

  @Get('schemas')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get config schemas for all integrations' })
  @ApiResponse({ status: 200, description: 'Integration config schemas' })
  async getSchemas() {
    return this.integrationsService.getAllConfigSchemas();
  }

  @Get('schemas/:key')
  @Roles('admin', 'doctor', 'nurse', 'receptionist')
  @ApiOperation({ summary: 'Get config schema for a single integration' })
  @ApiParam({ name: 'key', type: String, description: 'Integration key' })
  @ApiResponse({ status: 200, description: 'Integration config schema' })
  @ApiResponse({ status: 404, description: 'Schema not found' })
  async getSchema(@Param('key') key: string) {
    const schema = this.integrationsService.getConfigSchema(key);
    if (!schema) {
      return { key, fields: [], testable: false, requiresOAuth: false };
    }
    return schema;
  }

  @Get('audit-logs')
  @Roles('admin')
  @ApiOperation({ summary: 'Get audit logs for integration changes' })
  @ApiQuery({ name: 'key', required: false, description: 'Filter by integration key' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 50)' })
  @ApiResponse({ status: 200, description: 'Audit log entries' })
  async getAuditLogs(
    @Request() req: AuthenticatedRequest,
    @Query('key') key?: string,
    @Query('limit') limit?: string,
  ) {
    return this.integrationsService.getAuditLogs(
      req.user.tenantId,
      key,
      limit ? parseInt(limit, 10) : 50,
    );
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
    return this.integrationsService.update(req.user.tenantId, key, dto, req.user.email);
  }

  @Post(':key/test')
  @Roles('admin')
  @ApiOperation({ summary: 'Test connection for an integration' })
  @ApiParam({ name: 'key', type: String, description: 'Integration key' })
  @ApiResponse({ status: 200, description: 'Test result' })
  async testConnection(
    @Request() req: AuthenticatedRequest,
    @Param('key') key: string,
  ) {
    return this.integrationsService.testConnection(req.user.tenantId, key);
  }

  @Post(':key/oauth/url')
  @Roles('admin')
  @ApiOperation({ summary: 'Get OAuth authorization URL for an integration' })
  @ApiParam({ name: 'key', type: String, description: 'Integration key' })
  @ApiResponse({ status: 200, description: 'OAuth authorization URL' })
  async getOAuthUrl(
    @Request() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() body: { redirectUri?: string },
  ) {
    const defaultRedirect = `http://localhost:4000/api/v1/integrations/${key}/oauth/callback`;
    const redirectUri = body.redirectUri || defaultRedirect;
    return this.integrationsService.getOAuthUrl(req.user.tenantId, key, redirectUri);
  }

  @Post(':key/oauth/callback')
  @Roles('admin')
  @ApiOperation({ summary: 'Handle OAuth callback for an integration' })
  @ApiParam({ name: 'key', type: String, description: 'Integration key' })
  @ApiResponse({ status: 200, description: 'OAuth result' })
  async handleOAuthCallback(
    @Request() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() body: { code: string; redirectUri?: string },
  ) {
    const defaultRedirect = `http://localhost:4000/api/v1/integrations/${key}/oauth/callback`;
    const redirectUri = body.redirectUri || defaultRedirect;
    return this.integrationsService.handleOAuthCallback(
      req.user.tenantId,
      key,
      body.code,
      redirectUri,
    );
  }
}
