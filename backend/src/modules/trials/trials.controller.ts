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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TrialsService, CreateTrialRequestDto, ApproveTrialRequestDto } from './trials.service';
import { TrialRequestStatus, TrialPlanType } from './entities/trial-request.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

class CreateTrialRequestApiDto implements CreateTrialRequestDto {
  email!: string;
  firstName!: string;
  lastName!: string;
  phone?: string;
  practiceName!: string;
  planType!: TrialPlanType;
  notes?: string;
}

@ApiTags('Trials')
@Controller('trials')
export class TrialsController {
  constructor(private readonly trialsService: TrialsService) {}

  // ── Public: submit demo request ─────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a demo / trial request (public)' })
  @ApiBody({ type: CreateTrialRequestApiDto })
  async create(@Body() dto: CreateTrialRequestDto) {
    return this.trialsService.createRequest(dto);
  }

  // ── Admin endpoints ─────────────────────────────────────────────────

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List trial requests (super_admin only)' })
  @ApiQuery({ name: 'status', required: false, enum: TrialRequestStatus })
  async findAll(@Query('status') status?: TrialRequestStatus) {
    return this.trialsService.findAll(status);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a trial request by ID (super_admin only)' })
  async findOne(@Param('id') id: string) {
    return this.trialsService.findOne(id);
  }

  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Approve a trial request and provision tenant (super_admin only)' })
  async approve(@Param('id') id: string, @Body() dto?: ApproveTrialRequestDto) {
    return this.trialsService.approve(id, dto);
  }

  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reject a trial request (super_admin only)' })
  async reject(@Param('id') id: string, @Body() body?: { notes?: string }) {
    return this.trialsService.reject(id, body?.notes);
  }

  @Post('admin/:id/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Disable an active / converted account (super_admin only)' })
  async disable(@Param('id') id: string, @Body() body?: { notes?: string }) {
    return this.trialsService.disable(id, body?.notes);
  }

  @Post('admin/:id/convert')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Convert trial to paid and keep data (super_admin only)' })
  async convert(@Param('id') id: string) {
    return this.trialsService.convertToPaid(id);
  }

  @Post('admin/:id/wipe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Wipe clinical data and convert to paid (super_admin only)' })
  async wipe(@Param('id') id: string) {
    return this.trialsService.purchaseAndWipe(id);
  }

  // ── Customer self-service endpoints ─────────────────────────────────

  @Post(':id/convert')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Convert own trial to paid and keep data' })
  async convertOwn(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const request = await this.trialsService.findOne(id);
    if (request.tenantId !== req.user.tenantId) {
      throw new ForbiddenException();
    }
    return this.trialsService.convertToPaid(id);
  }

  @Post(':id/wipe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Wipe own data and convert to paid' })
  async wipeOwn(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const request = await this.trialsService.findOne(id);
    if (request.tenantId !== req.user.tenantId) {
      throw new ForbiddenException();
    }
    return this.trialsService.purchaseAndWipe(id);
  }
}
