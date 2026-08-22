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
import { ScreeningService } from './screening.service';
import { ScreeningAiService } from './screening-ai.service';
import {
  CreateCustomInstrumentDto,
  UpdateInstrumentDto,
  StartScreeningDto,
  SubmitAnswersDto,
  SaveProgressDto,
} from './dto/screening.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InstrumentCategory } from './entities/screening-instrument.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string; name?: string };
}

@ApiTags('Screening')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('screening')
export class ScreeningController {
  constructor(
    private readonly service: ScreeningService,
    private readonly aiService: ScreeningAiService,
  ) {}

  // ── Instrument Management ─────────────────────────────────────────

  @Get('instruments')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator', 'receptionist')
  @ApiOperation({ summary: 'List all screening instruments (predefined + custom)' })
  async listInstruments(
    @Request() req: AuthenticatedRequest,
    @Query('category') category?: InstrumentCategory,
  ) {
    return this.service.listInstruments(req.user.tenantId, category);
  }

  @Get('instruments/:id')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator', 'receptionist')
  @ApiOperation({ summary: 'Get a single screening instrument with all questions' })
  async getInstrument(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getInstrument(req.user.tenantId, id);
  }

  @Post('instruments')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom screening instrument' })
  async createCustomInstrument(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: CreateCustomInstrumentDto,
  ) {
    return this.service.createCustomInstrument(req.user.tenantId, dto, req.user.id);
  }

  @Patch('instruments/:id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Update a screening instrument (locked instruments: only administration rules)' })
  async updateInstrument(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: UpdateInstrumentDto,
  ) {
    return this.service.updateInstrument(req.user.tenantId, id, dto);
  }

  @Post('instruments/seed')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed predefined screening instruments (PHQ-9, GAD-7, AUDIT-C, C-SSRS, etc.)' })
  async seedInstruments(@Request() req: AuthenticatedRequest) {
    const count = await this.service.seedPredefinedInstruments(req.user.tenantId);
    return { seeded: count, message: `${count} predefined instruments seeded` };
  }

  // ── Screening Administration ──────────────────────────────────────

  @Post('start')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator', 'receptionist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new screening session for a patient' })
  async startScreening(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) dto: StartScreeningDto,
  ) {
    return this.service.startScreening(req.user.tenantId, dto, req.user.id, req.user.name || req.user.email);
  }

  @Post(':id/save-progress')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save in-progress screening answers (auto-save)' })
  async saveProgress(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: SaveProgressDto,
  ) {
    return this.service.saveProgress(req.user.tenantId, id, dto.answers);
  }

  @Post(':id/submit')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit completed screening — auto-scores and checks alerts' })
  async submitScreening(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) dto: SubmitAnswersDto,
  ) {
    return this.service.submitScreening(req.user.tenantId, id, dto);
  }

  @Post(':id/discontinue')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Discontinue an in-progress screening' })
  async discontinue(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.discontinueScreening(req.user.tenantId, id);
  }

  // ── Results ───────────────────────────────────────────────────────

  @Get('results')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator', 'receptionist')
  @ApiOperation({ summary: 'Get screening results (filter by patient or instrument)' })
  async getResults(
    @Request() req: AuthenticatedRequest,
    @Query('patientId') patientId?: string,
    @Query('instrumentCode') instrumentCode?: string,
  ) {
    if (patientId) {
      return this.service.getResultsByPatient(req.user.tenantId, patientId, instrumentCode);
    }
    // Return all recent results
    return this.service.getDashboard(req.user.tenantId);
  }

  @Get('results/:id')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get a single screening result with answers and score' })
  async getResult(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getResult(req.user.tenantId, id);
  }

  @Get('trend')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get score trend for a patient and instrument' })
  async getScoreTrend(
    @Request() req: AuthenticatedRequest,
    @Query('patientId') patientId: string,
    @Query('instrumentCode') instrumentCode: string,
  ) {
    return this.service.getScoreTrend(req.user.tenantId, patientId, instrumentCode);
  }

  @Get('dashboard')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @ApiOperation({ summary: 'Get screening dashboard metrics' })
  async dashboard(@Request() req: AuthenticatedRequest) {
    return this.service.getDashboard(req.user.tenantId);
  }

  // ── AI Features ───────────────────────────────────────────────────

  @Post('ai/recommend')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Recommend which screening instruments to administer' })
  async recommendInstruments(
    @Request() req: AuthenticatedRequest,
    @Body() body: { patientId: string; age: number; sex: string; chiefComplaint?: string; activeDiagnoses: string[]; recentScreenings: any[] },
  ) {
    const instruments = await this.service.listInstruments(req.user.tenantId);
    return this.aiService.recommendInstruments(
      {
        age: body.age,
        sex: body.sex,
        chiefComplaint: body.chiefComplaint,
        activeDiagnoses: body.activeDiagnoses || [],
        recentScreenings: body.recentScreenings || [],
      },
      instruments,
    );
  }

  @Post('results/:id/interpret')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Interpret a screening score in plain language' })
  async interpretScore(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { age: number; sex: string; activeDiagnoses: string[] },
  ) {
    const result = await this.service.getResult(req.user.tenantId, id);
    const instrument = await this.service.getInstrument(req.user.tenantId, result.instrumentId);
    return this.aiService.interpretScore(instrument, result, {
      age: body.age,
      sex: body.sex,
      activeDiagnoses: body.activeDiagnoses || [],
    });
  }

  @Post('ai/risk-stratification')
  @Roles('admin', 'doctor', 'nurse', 'care_coordinator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI: Stratify patient behavioral health risk based on screening history' })
  async riskStratification(
    @Request() req: AuthenticatedRequest,
    @Body() body: { patientId: string; age: number; sex: string; activeDiagnoses: string[]; medications: string[] },
  ) {
    const history = await this.service.getResultsByPatient(req.user.tenantId, body.patientId);
    return this.aiService.stratifyRisk(body.patientId, history, {
      age: body.age,
      sex: body.sex,
      activeDiagnoses: body.activeDiagnoses || [],
      medications: body.medications || [],
    });
  }
}
