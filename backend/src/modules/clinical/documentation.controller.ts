import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateDocumentationSessionDto } from './dto/create-documentation-session.dto';
import { UpdateDocumentationNoteDto } from './dto/update-documentation-note.dto';
import { DocumentationService, DocumentationSessionListFilters } from './documentation.service';
import { DocumentationSessionStatus } from './entities/documentation-session.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@Controller('clinical/documentation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentationController {
  constructor(private readonly documentationService: DocumentationService) {}

  @Post('sessions')
  @Roles('admin', 'doctor', 'nurse')
  createSession(@Body() dto: CreateDocumentationSessionDto, @Request() req: AuthenticatedRequest) {
    return this.documentationService.createSession(req.user.tenantId, req.user, dto);
  }

  @Get('sessions')
  @Roles('admin', 'doctor', 'nurse')
  list(
    @Query() query: {
      patientId?: string;
      providerId?: string;
      status?: string;
      encounterId?: string;
      page?: string;
      limit?: string;
    },
    @Request() req: AuthenticatedRequest,
  ) {
    const filters: DocumentationSessionListFilters = {
      patientId: query.patientId,
      providerId: query.providerId,
      status: query.status as DocumentationSessionStatus | undefined,
      encounterId: query.encounterId,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
    };
    return this.documentationService.listForTenant(req.user.tenantId, filters);
  }

  @Get('sessions/:id')
  @Roles('admin', 'doctor', 'nurse')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.documentationService.findOne(req.user.tenantId, id);
  }

  @Get('sessions/:id/intelligence')
  @Roles('admin', 'doctor', 'nurse')
  getWithIntelligence(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.documentationService.getWithIntelligence(req.user.tenantId, id);
  }

  @Post('encounters/:encounterId/resume')
  @Roles('admin', 'doctor', 'nurse')
  findOrCreateForEncounter(@Param('encounterId') encounterId: string, @Request() req: AuthenticatedRequest) {
    return this.documentationService.findOrCreateForEncounter(req.user.tenantId, req.user, encounterId);
  }

  @Get('sessions/:id/versions')
  @Roles('admin', 'doctor', 'nurse')
  getVersions(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.documentationService.getVersions(req.user.tenantId, id);
  }

  @Post('sessions/:id/transcribe')
  @Roles('admin', 'doctor', 'nurse')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  transcribe(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.documentationService.transcribeAudio(req.user.tenantId, req.user, id, file);
  }

  @Patch('sessions/:id/transcript')
  @Roles('admin', 'doctor', 'nurse')
  saveTranscript(
    @Param('id') id: string,
    @Body() body: { transcript: string; languageCode?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.documentationService.saveTranscript(req.user.tenantId, req.user, id, body.transcript, body.languageCode);
  }

  @Post('sessions/:id/generate-note')
  @Roles('admin', 'doctor', 'nurse')
  generateNote(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.documentationService.generateNote(req.user.tenantId, req.user, id);
  }

  @Patch('sessions/:id/note')
  @Roles('admin', 'doctor', 'nurse')
  updateNote(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentationNoteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.documentationService.updateNote(req.user.tenantId, req.user, id, dto);
  }

  @Post('sessions/:id/apply-to-encounter')
  @Roles('admin', 'doctor', 'nurse')
  applyToEncounter(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.documentationService.applyToEncounter(req.user.tenantId, req.user, id);
  }

  @Post('sessions/:id/sign')
  @Roles('admin', 'doctor')
  sign(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.documentationService.sign(req.user.tenantId, req.user, id);
  }

  @Post('sessions/:id/send-avs')
  @Roles('admin', 'doctor', 'nurse')
  sendAfterVisitSummary(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.documentationService.sendAfterVisitSummary(req.user.tenantId, req.user, id);
  }
}
