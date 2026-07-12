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
}

@ApiTags('Patient Portal Auth')
@Controller('patients/auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patient portal login' })
  @ApiBody({ type: PatientLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: PatientLoginDto) {
    return this.patientAuthService.login(dto.email, dto.password, dto.tenantId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
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
    return this.patientAuthService.logout(req.user.id, body.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.patientAuthService.forgotPassword(dto.email, dto.tenantId);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.patientAuthService.resetPassword(dto.token, dto.newPassword);
  }

  @Post(':patientId/setup-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set up patient portal account (first-time setup)' })
  async setupAccount(
    @Param('patientId') patientId: string,
    @Body() dto: SetupAccountDto,
    @Query('tenantId') tenantId: string,
  ) {
    return this.patientAuthService.setupAccount(patientId, dto.password, tenantId);
  }

  @Get('me')
  @UseGuards(PatientJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current patient profile' })
  async getMe(@Request() req: AuthenticatedPatientRequest) {
    return this.patientAuthService.getMe(req.user.id);
  }
}
