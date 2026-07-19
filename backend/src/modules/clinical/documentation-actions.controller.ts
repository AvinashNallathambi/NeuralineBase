import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentationActionsService } from './documentation-actions.service';
import { DocumentationSuggestionStatus } from './entities/documentation-suggestion.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@Controller('clinical/documentation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentationActionsController {
  constructor(private readonly actionsService: DocumentationActionsService) {}

  @Post('sessions/:id/action-drafts')
  @Roles('admin', 'doctor', 'nurse')
  generateDrafts(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.actionsService.generateDrafts(req.user.tenantId, id);
  }

  @Get('sessions/:id/action-drafts')
  @Roles('admin', 'doctor', 'nurse')
  list(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.actionsService.list(req.user.tenantId, id);
  }

  @Patch('action-drafts/:id/review')
  @Roles('admin', 'doctor', 'nurse')
  review(
    @Param('id') id: string,
    @Body('status') status: DocumentationSuggestionStatus,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.actionsService.review(req.user.tenantId, id, status, req.user.id);
  }
}
