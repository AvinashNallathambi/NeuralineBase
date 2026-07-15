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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
