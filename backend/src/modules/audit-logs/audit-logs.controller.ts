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
import { AuditLogsService, PaginatedAuditLogs } from './audit-logs.service';
import { AuditAction } from './entities/audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('AuditLogs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List audit logs for the tenant (paginated, admin only)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default 50, max 200)' })
  @ApiQuery({ name: 'entityType', required: false, description: 'Filter by entity/controller name' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action (create/update/delete/view/...)' })
  @ApiQuery({ name: 'performedBy', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Free-text search over user name, entity type, URL' })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: AuditAction,
    @Query('performedBy') performedBy?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedAuditLogs> {
    return this.auditLogsService.findAll(req.user.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      entityType,
      action,
      performedBy,
      search,
    });
  }
}
