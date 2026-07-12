import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { MessagingService } from './messaging.service';
import { PatientJwtAuthGuard } from '../patients/patient-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class StartConversationDto {
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  providerId?: string;
}

class ReplyDto {
  @IsString()
  @IsNotEmpty()
  body!: string;
}

interface AuthenticatedPatientRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

interface AuthenticatedStaffRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Patient Messaging')
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  // ─── Patient endpoints ──────────────────────────────────────────

  @Get('patient/conversations')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get patient conversations' })
  async getPatientConversations(@Request() req: AuthenticatedPatientRequest) {
    return this.messagingService.getPatientConversations(req.user.id);
  }

  @Get('patient/conversations/:id')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a conversation with messages' })
  async getPatientConversation(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') conversationId: string,
  ) {
    const result = await this.messagingService.getPatientConversation(req.user.id, conversationId);
    // Auto-mark as read
    await this.messagingService.markConversationReadByPatient(req.user.id, conversationId);
    return result;
  }

  @Post('patient/conversations')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new conversation' })
  async startConversation(
    @Request() req: AuthenticatedPatientRequest,
    @Body() dto: StartConversationDto,
  ) {
    const patientName = req.user.email; // Fallback — ideally fetch from patient record
    return this.messagingService.startConversation(
      req.user.tenantId,
      req.user.id,
      patientName,
      dto,
    );
  }

  @Post('patient/conversations/:id/reply')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reply to a conversation' })
  async patientReply(
    @Request() req: AuthenticatedPatientRequest,
    @Param('id') conversationId: string,
    @Body() dto: ReplyDto,
  ) {
    return this.messagingService.patientReply(
      req.user.tenantId,
      req.user.id,
      req.user.email,
      conversationId,
      dto.body,
    );
  }

  @Get('patient/unread-count')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get unread message count' })
  async getUnreadCount(@Request() req: AuthenticatedPatientRequest) {
    const count = await this.messagingService.getUnreadCount(req.user.id);
    return { count };
  }

  // ─── Provider/Staff endpoints ───────────────────────────────────

  @Get('provider/conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all conversations for provider/staff' })
  async getProviderConversations(
    @Request() req: AuthenticatedStaffRequest,
    @Query('providerId') providerId?: string,
  ) {
    return this.messagingService.getProviderConversations(req.tenantId, providerId);
  }

  @Get('provider/conversations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a conversation with messages (provider view)' })
  async getProviderConversation(
    @Request() req: AuthenticatedStaffRequest,
    @Param('id') conversationId: string,
  ) {
    const result = await this.messagingService.getProviderConversation(req.tenantId, conversationId);
    await this.messagingService.markConversationReadByProvider(req.tenantId, conversationId);
    return result;
  }

  @Post('provider/conversations/:id/reply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provider replies to a conversation' })
  async providerReply(
    @Request() req: AuthenticatedStaffRequest,
    @Param('id') conversationId: string,
    @Body() dto: ReplyDto,
  ) {
    return this.messagingService.providerReply(
      req.tenantId,
      req.user.id,
      req.user.email,
      conversationId,
      dto.body,
    );
  }

  @Post('provider/conversations/:id/close')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a conversation' })
  async closeConversation(
    @Request() req: AuthenticatedStaffRequest,
    @Param('id') conversationId: string,
  ) {
    await this.messagingService.closeConversation(req.tenantId, conversationId);
    return { message: 'Conversation closed' };
  }
}
