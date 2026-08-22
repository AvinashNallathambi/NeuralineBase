import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EpisodesService } from './episodes.service';
import {
  CreateEpisodeDto,
  UpdateEpisodeDto,
  LinkEncounterDto,
  LinkCarePlanDto,
  AssessOutcomeDto,
} from './dto/episode.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EpisodeStatus } from './entities/episode.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Episodes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('episodes')
export class EpisodesController {
  constructor(private readonly service: EpisodesService) {}

  @Post()
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an episode of care' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: CreateEpisodeDto,
  ) {
    return this.service.create(req.user.tenantId, dto, req.user.id);
  }

  @Get()
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator', 'receptionist')
  @ApiOperation({ summary: 'List episodes (optionally filter by patient or status)' })
  async list(
    @Request() req: AuthenticatedRequest,
    @Query('patientId') patientId?: string,
    @Query('status') status?: EpisodeStatus,
    @Query('includeInactive') includeInactive?: string,
  ) {
    if (patientId) {
      return this.service.findByPatient(req.user.tenantId, patientId, includeInactive === 'true');
    }
    return this.service.findAll(req.user.tenantId, status);
  }

  @Get('dashboard')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get episode management dashboard metrics' })
  async dashboard(@Request() req: AuthenticatedRequest) {
    return this.service.getDashboard(req.user.tenantId);
  }

  @Get(':id')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator', 'receptionist')
  @ApiOperation({ summary: 'Get a single episode with full details' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Update an episode' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: UpdateEpisodeDto,
  ) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Post(':id/close')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close an episode with outcome assessment' })
  async close(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: AssessOutcomeDto,
  ) {
    return this.service.close(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel and soft-delete an episode' })
  async delete(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(req.user.tenantId, id);
  }

  // ── Encounter Linking ─────────────────────────────────────────────

  @Post(':id/encounters')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link an encounter to this episode' })
  async linkEncounter(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: LinkEncounterDto,
  ) {
    return this.service.linkEncounter(req.user.tenantId, id, dto.encounterId);
  }

  @Delete(':id/encounters/:encounterId')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an encounter from this episode' })
  async unlinkEncounter(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('encounterId') encounterId: string,
  ) {
    return this.service.unlinkEncounter(req.user.tenantId, id, encounterId);
  }

  // ── Care Plan Linking ─────────────────────────────────────────────

  @Post(':id/care-plans')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link a care plan to this episode' })
  async linkCarePlan(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: LinkCarePlanDto,
  ) {
    return this.service.linkCarePlan(req.user.tenantId, id, dto.carePlanId);
  }

  @Delete(':id/care-plans/:carePlanId')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink a care plan from this episode' })
  async unlinkCarePlan(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('carePlanId') carePlanId: string,
  ) {
    return this.service.unlinkCarePlan(req.user.tenantId, id, carePlanId);
  }

  // ── Cost Calculation ──────────────────────────────────────────────

  @Post(':id/calculate-costs')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recalculate episode cost summary' })
  async calculateCosts(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.calculateCosts(req.user.tenantId, id);
  }

  // ── AI Features ───────────────────────────────────────────────────

  @Post('auto-detect')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Auto-detect whether an episode should be created from encounter patterns' })
  async autoDetect(
    @Request() req: AuthenticatedRequest,
    @Body() body: { patientId: string; encounters: any[] },
  ) {
    return this.service.autoDetect(req.user.tenantId, body.patientId, body.encounters);
  }

  @Post(':id/predict-cost')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator', 'billing_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Predict total episode cost based on condition and historical data' })
  async predictCost(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.predictCost(req.user.tenantId, id);
  }

  @Post(':id/detect-deviations')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Detect clinical pathway deviations for this episode' })
  async detectDeviations(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detectDeviations(req.user.tenantId, id);
  }

  @Post(':id/summary')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Generate a narrative episode summary for referrals or transitions of care' })
  async generateSummary(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.generateSummary(req.user.tenantId, id);
  }
}
