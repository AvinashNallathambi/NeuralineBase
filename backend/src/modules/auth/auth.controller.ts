import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  encryptedPassword?: string;
}

class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  tenantName!: string;
}

class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

class EnableMfaDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

class VerifyMfaDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
  ip?: string;
  headers?: { 'user-agent'?: string };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('public-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get RSA public key for password encryption' })
  @ApiResponse({ status: 200, description: 'PEM-encoded RSA public key' })
  getPublicKey() {
    return { publicKey: this.authService.getPublicKey() };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // HIPAA: 5 login attempts/min/IP
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() loginDto: LoginDto) {
    const hasPlain = typeof loginDto.password === 'string' && loginDto.password.length > 0;
    const hasEncrypted = typeof loginDto.encryptedPassword === 'string' && loginDto.encryptedPassword.length > 0;
    if (!hasPlain && !hasEncrypted) {
      throw new BadRequestException('Either password or encryptedPassword is required');
    }
    const useEncrypted = hasEncrypted;
    const password = (useEncrypted ? loginDto.encryptedPassword : loginDto.password) as string;
    return this.authService.login(loginDto.email, password, { isEncrypted: useEncrypted });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new tenant and admin user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Tenant and admin user created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // HIPAA: 10 refreshes/min/IP
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'New tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable multi-factor authentication' })
  @ApiResponse({ status: 200, description: 'MFA secret and QR code returned' })
  async enableMfa(@Request() req: AuthenticatedRequest) {
    return this.authService.enableMfa(req.user.id, {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      tenantId: req.user.tenantId,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // HIPAA: 5 MFA attempts/min
  @ApiOperation({ summary: 'Verify MFA TOTP code' })
  @ApiBody({ type: VerifyMfaDto })
  @ApiResponse({ status: 200, description: 'MFA verification successful' })
  @ApiResponse({ status: 401, description: 'Invalid MFA code' })
  @ApiResponse({ status: 429, description: 'Too many MFA attempts' })
  async verifyMfa(
    @Request() req: AuthenticatedRequest,
    @Body() verifyMfaDto: VerifyMfaDto,
  ) {
    return this.authService.verifyMfa(req.user.id, verifyMfaDto.code);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate tokens' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Request() req: AuthenticatedRequest) {
    return this.authService.logout(
      req.user.id,
      undefined,
      {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        tenantId: req.user.tenantId,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      },
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // HIPAA: 3 reset requests/min/IP
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset email sent if account exists' })
  @ApiResponse({ status: 429, description: 'Too many password reset requests' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // HIPAA: 5 reset attempts/min/IP
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  @ApiResponse({ status: 429, description: 'Too many reset attempts' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
      {
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      },
    );
  }
}
