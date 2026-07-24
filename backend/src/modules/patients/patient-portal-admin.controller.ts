import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { PatientPortalAdminService } from './patient-portal-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  temporaryPassword?: string;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}

class DisablePortalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

interface AuthenticatedStaffRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
  ip?: string;
  headers?: { 'user-agent'?: string };
}

/**
 * Admin-facing endpoints for managing patient portal access.
 *
 * All endpoints require a staff JWT (JwtAuthGuard) and the
 * 'admin' or 'receptionist' role. Every mutation is recorded
 * in the HIPAA audit log.
 */
@ApiTags('Patient Portal Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientPortalAdminController {
  constructor(private readonly portalAdminService: PatientPortalAdminService) {}

  @Get(':id/portal/status')
  @Roles('admin', 'receptionist', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get patient portal access status' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Portal status' })
  async getStatus(
    @Request() req: AuthenticatedStaffRequest,
    @Param('id', ParseUUIDPipe) patientId: string,
  ) {
    return this.portalAdminService.getStatus(req.user.tenantId, patientId);
  }

  @Post(':id/portal/enable')
  @Roles('admin', 'receptionist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable patient portal access and issue invitation' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Portal enabled; invitation token and URL returned' })
  @ApiResponse({ status: 400, description: 'Patient has no email on file' })
  async enablePortal(
    @Request() req: AuthenticatedStaffRequest,
    @Param('id', ParseUUIDPipe) patientId: string,
  ) {
    return this.portalAdminService.enablePortal(req.user.tenantId, patientId, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post(':id/portal/disable')
  @Roles('admin', 'receptionist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable patient portal access and revoke all sessions' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Portal disabled' })
  async disablePortal(
    @Request() req: AuthenticatedStaffRequest,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body() body?: DisablePortalDto,
  ) {
    return this.portalAdminService.disablePortal(
      req.user.tenantId,
      patientId,
      {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      },
      body?.reason,
    );
  }

  @Post(':id/portal/reset-password')
  @Roles('admin', 'receptionist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin-triggered patient portal password reset' })
  @ApiParam({ name: 'id', type: String, description: 'Patient UUID' })
  @ApiResponse({ status: 200, description: 'Password reset issued or temporary password set' })
  async resetPassword(
    @Request() req: AuthenticatedStaffRequest,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body() body: ResetPasswordDto,
  ) {
    return this.portalAdminService.resetPassword(
      req.user.tenantId,
      patientId,
      {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      },
      { temporaryPassword: body?.temporaryPassword, sendEmail: body?.sendEmail },
    );
  }
}
