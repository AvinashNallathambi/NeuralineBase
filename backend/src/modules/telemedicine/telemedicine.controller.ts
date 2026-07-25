import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { TelemedicineService } from './telemedicine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../patients/patient-jwt-auth.guard';
import { TelemedicineSessionStatus } from './entities/telemedicine-session.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Telemedicine')
@ApiBearerAuth('JWT-auth')
@Controller('telemedicine')
@UseGuards(JwtAuthGuard)
export class TelemedicineController {
  constructor(private readonly telemedicineService: TelemedicineService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a telemedicine session for an appointment' })
  createSession(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      appointmentId?: string;
      patientId: string;
      providerId: string;
      enableRecording?: boolean;
      recordingConsent?: boolean;
    },
  ) {
    return this.telemedicineService.createSession(
      req.tenantId ?? req.user.tenantId,
      body,
      req.user.id,
    );
  }

  @Post('sessions/for-appointment/:appointmentId')
  @ApiOperation({ summary: 'Find or create a telemedicine session for an appointment' })
  findOrCreateForAppointment(
    @Req() req: AuthenticatedRequest,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.telemedicineService.findOrCreateForAppointment(
      req.tenantId ?? req.user.tenantId,
      appointmentId,
      req.user.id,
    );
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List telemedicine sessions' })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: TelemedicineSessionStatus,
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.telemedicineService.findAll(req.tenantId ?? req.user.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      patientId,
      providerId,
    });
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a telemedicine session' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.telemedicineService.findOne(req.tenantId ?? req.user.tenantId, id);
  }

  @Get('sessions/:id/token')
  @ApiOperation({ summary: 'Get a token to join the video room' })
  async getToken(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('role') role: 'provider' | 'patient' | 'interpreter' = 'provider',
  ) {
    return this.telemedicineService.getToken(
      req.tenantId ?? req.user.tenantId,
      id,
      req.user.id,
      role,
    );
  }

  @Patch('sessions/:id/end')
  @ApiOperation({ summary: 'End a telemedicine session and generate encounter/superbill' })
  endSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: {
      transcript?: string;
      providerNotes?: string;
      generateEncounter?: boolean;
      generateSuperbill?: boolean;
    } = {},
  ) {
    return this.telemedicineService.endSession(
      req.tenantId ?? req.user.tenantId,
      id,
      req.user.id,
      body,
    );
  }

  @Patch('sessions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a telemedicine session' })
  cancelSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.telemedicineService.cancelSession(
      req.tenantId ?? req.user.tenantId,
      id,
      req.user.id,
      body.reason,
    );
  }

  @Post('sessions/:id/recording')
  @ApiOperation({ summary: 'Upload a visit recording (browser MediaRecorder blob)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  uploadRecording(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.telemedicineService.uploadRecording(
      req.tenantId ?? req.user.tenantId,
      id,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
      req.user.id,
    );
  }

  @Post('sessions/:id/transcribe')
  @ApiOperation({ summary: 'Transcribe a session recording with AssemblyAI' })
  transcribeRecording(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.telemedicineService.transcribeRecording(
      req.tenantId ?? req.user.tenantId,
      id,
    );
  }

  @Get('sessions/:id/care-plan')
  @ApiOperation({ summary: 'Generate AI post-visit care plan' })
  postVisitCarePlan(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.telemedicineService.postVisitCarePlan(
      req.tenantId ?? req.user.tenantId,
      id,
    );
  }

  @Post('sessions/:id/intake')
  @ApiOperation({ summary: 'AI pre-visit intake triage' })
  preVisitIntake(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { symptoms: string },
  ) {
    return this.telemedicineService.preVisitIntake(
      req.tenantId ?? req.user.tenantId,
      id,
      body.symptoms,
    );
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Telemedicine session analytics' })
  analytics(
    @Req() req: AuthenticatedRequest,
    @Query('providerId') providerId?: string,
    @Query('patientId') patientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.telemedicineService.getAnalytics({
      tenantId: req.tenantId ?? req.user.tenantId,
      providerId,
      patientId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}

@ApiTags('Patient Portal Telemedicine')
@Controller('patients/portal/telemedicine')
export class PatientPortalTelemedicineController {
  constructor(private readonly telemedicineService: TelemedicineService) {}

  @Post('sessions/for-appointment/:appointmentId')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Patient finds or creates a telemedicine session for their appointment' })
  async findOrCreateForAppointment(
    @Req() req: AuthenticatedRequest,
    @Param('appointmentId') appointmentId: string,
  ) {
    const tenantId = req.tenantId ?? req.user.tenantId;
    const patientId = req.user.id;

    // Validate the appointment belongs to this patient before creating
    // a telemedicine session. The TelemedicineService.findOrCreateForAppointment
    // validates the appointment exists and is telehealth, but we also need to
    // ensure the patient owns it.
    const session = await this.telemedicineService.findOrCreateForAppointment(
      tenantId,
      appointmentId,
      patientId,
    );

    // Ownership check: the session's patientId must match the logged-in patient
    if (session.patientId !== patientId) {
      throw new BadRequestException('You are not authorized to join this appointment');
    }

    return session;
  }

  @Get('sessions/:id')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Patient gets details of their telemedicine session' })
  async getSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId ?? req.user.tenantId;
    const session = await this.telemedicineService.findOne(tenantId, id);

    // Ensure the patient owns this session
    if (session.patientId !== req.user.id) {
      throw new BadRequestException('You are not authorized to view this session');
    }

    return session;
  }

  @Get('sessions/:id/token')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Patient gets a token to join the video room' })
  async getToken(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.telemedicineService.getToken(
      req.tenantId ?? req.user.tenantId,
      id,
      req.user.id,
      'patient',
    );
  }
}
