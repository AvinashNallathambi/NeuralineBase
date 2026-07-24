import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { PatientAuthService } from './patient-auth.service';
import { PatientJwtAuthGuard } from './patient-jwt-auth.guard';

class PatientLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

class SetupAccountDto {
  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  token!: string; // invitation token issued by an admin via POST /patients/:id/portal/enable
}

class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

interface AuthenticatedPatientRequest {
  user: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
  ip?: string;
  headers?: { 'user-agent'?: string };
}

@ApiTags('Patient Portal Auth')
@Controller('patients/auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // HIPAA: 5 login attempts/min/IP
  @ApiOperation({ summary: 'Patient portal login' })
  @ApiBody({ type: PatientLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() dto: PatientLoginDto) {
    return this.patientAuthService.login(dto.email, dto.password, dto.tenantId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // HIPAA: 10 refreshes/min/IP
  @ApiOperation({ summary: 'Refresh patient access token' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.patientAuthService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patient logout' })
  async logout(@Request() req: AuthenticatedPatientRequest, @Body() body: { refreshToken?: string }) {
    return this.patientAuthService.logout(req.user.id, body.refreshToken, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
      reason: 'patient_logout',
    });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // HIPAA: 3 reset requests/min/IP
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.patientAuthService.forgotPassword(dto.email, dto.tenantId);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // HIPAA: 5 reset attempts/min/IP
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Request() req: AuthenticatedPatientRequest) {
    return this.patientAuthService.resetPassword(dto.token, dto.newPassword, {
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post(':patientId/setup-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set up patient portal account (requires invitation token)' })
  async setupAccount(
    @Param('patientId') patientId: string,
    @Body() dto: SetupAccountDto,
    @Query('tenantId') tenantId: string,
  ) {
    return this.patientAuthService.setupAccount(patientId, dto.password, tenantId, dto.token);
  }

  @Get('me')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current patient profile' })
  async getMe(@Request() req: AuthenticatedPatientRequest) {
    return this.patientAuthService.getMe(req.user.id);
  }
}
