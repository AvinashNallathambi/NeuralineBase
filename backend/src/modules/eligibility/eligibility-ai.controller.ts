import {
  Controller,
  Post,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EligibilityService } from './eligibility.service';
import { EligibilityAiService } from './eligibility-ai.service';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
  tenantId: string;
}

@ApiTags('Eligibility AI')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('eligibility/ai')
export class EligibilityAiController {
  constructor(
    private readonly eligibilityService: EligibilityService,
    private readonly eligibilityAiService: EligibilityAiService,
  ) {}

  @Post('parse-271/:id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parse the raw 271 response payload for a verification using AI' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiResponse({ status: 200, description: 'Structured benefits data extracted from the 271 response' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async parse271Response(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<object> {
    const verification = await this.eligibilityService.findOne(req.tenantId, id);
    const payload = verification.responsePayload ?? {};
    return this.eligibilityAiService.parse271Response(payload);
  }

  @Post('summary/:id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a plain-English eligibility summary for front-desk staff' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiResponse({ status: 200, description: 'Plain-English eligibility summary', schema: { type: 'object', properties: { summary: { type: 'string' } } } })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async generateSummary(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ summary: string }> {
    const verification = await this.eligibilityService.findOne(req.tenantId, id);
    const summary = await this.eligibilityAiService.generateEligibilitySummary(verification);
    return { summary };
  }

  @Post('estimate-responsibility/:id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estimate patient financial responsibility for given CPT procedure codes' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['procedureCodes'],
      properties: {
        procedureCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'CPT procedure codes to estimate responsibility for',
          example: ['99213', '93000'],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Estimated patient cost breakdown by procedure' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async estimateResponsibility(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { procedureCodes: string[] },
  ): Promise<object> {
    const verification = await this.eligibilityService.findOne(req.tenantId, id);
    const procedureCodes: string[] = Array.isArray(body.procedureCodes) ? body.procedureCodes : [];
    return this.eligibilityAiService.estimatePatientResponsibility(verification, procedureCodes);
  }

  @Post('denial-risk/:id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assess claim denial risk based on coverage, diagnosis, and procedure codes' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['diagnosisCodes', 'procedureCodes'],
      properties: {
        diagnosisCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'ICD-10 diagnosis codes',
          example: ['Z00.00', 'I10'],
        },
        procedureCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'CPT procedure codes',
          example: ['99213', '93000'],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Denial risk assessment with riskLevel, riskFactors, and recommendations' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async assessDenialRisk(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { diagnosisCodes: string[]; procedureCodes: string[] },
  ): Promise<object> {
    const verification = await this.eligibilityService.findOne(req.tenantId, id);
    const diagnosisCodes: string[] = Array.isArray(body.diagnosisCodes) ? body.diagnosisCodes : [];
    const procedureCodes: string[] = Array.isArray(body.procedureCodes) ? body.procedureCodes : [];
    return this.eligibilityAiService.assessDenialRisk(verification, diagnosisCodes, procedureCodes);
  }

  @Post('prior-auth/:id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Draft a prior authorization request letter for a procedure' })
  @ApiParam({ name: 'id', type: String, description: 'Verification UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['procedure', 'clinicalNotes'],
      properties: {
        procedure: {
          type: 'string',
          description: 'Description of the procedure requiring prior authorization',
          example: 'MRI of the lumbar spine (CPT 72148) for evaluation of low back pain',
        },
        clinicalNotes: {
          type: 'string',
          description: 'Clinical notes supporting medical necessity',
          example: 'Patient presents with 6-week history of low back pain radiating to left leg. Conservative treatment failed.',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Drafted prior authorization request letter', schema: { type: 'object', properties: { letter: { type: 'string' } } } })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async generatePriorAuth(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { procedure: string; clinicalNotes: string },
  ): Promise<{ letter: string }> {
    const verification = await this.eligibilityService.findOne(req.tenantId, id);
    const procedure: string = body.procedure ?? '';
    const clinicalNotes: string = body.clinicalNotes ?? '';
    const letter = await this.eligibilityAiService.generatePriorAuthRequest(verification, procedure, clinicalNotes);
    return { letter };
  }
}
