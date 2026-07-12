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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { LaboratoryService, PaginatedResult } from './laboratory.service';
import { LaboratoryAiService } from './laboratory-ai.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { UpdateLabOrderStatusDto } from './dto/update-lab-order-status.dto';
import { SubmitLabResultsDto } from './dto/submit-lab-results.dto';
import {
  CreateImagingOrderDto,
  UpdateImagingOrderDto,
  ImagingFindingsDto,
} from './dto/imaging-order.dto';
import { CreateLabPanelDto } from './dto/create-lab-panel.dto';
import {
  CollectSpecimenDto,
  CancelLabOrderDto,
  AcknowledgeResultDto,
} from './dto/specimen-and-misc.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LabOrder } from './entities/lab-order.entity';
import { ImagingOrder } from './entities/imaging-order.entity';
import { LabResult } from './entities/lab-result.entity';
import { Specimen } from './entities/specimen.entity';
import { LabPanel } from './entities/lab-panel.entity';
import { ReferenceRange } from './entities/reference-range.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Laboratory')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('laboratory')
export class LaboratoryController {
  constructor(
    private readonly labService: LaboratoryService,
    private readonly labAiService: LaboratoryAiService,
  ) {}

  // ───────────────────────────────────────────────────────────
  // Statistics
  // ───────────────────────────────────────────────────────────

  @Get('stats')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech')
  @ApiOperation({ summary: 'Laboratory dashboard statistics' })
  async getStats(@Request() req: AuthenticatedRequest) {
    return this.labService.getStats(req.user.tenantId);
  }

  // ───────────────────────────────────────────────────────────
  // Lab Panels (catalog)
  // ───────────────────────────────────────────────────────────

  @Get('panels')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech')
  @ApiOperation({ summary: 'List available lab panels' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async findPanels(
    @Request() req: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<LabPanel[]> {
    return this.labService.findPanels(req.user.tenantId, includeInactive === true);
  }

  @Get('panels/:id')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech')
  @ApiOperation({ summary: 'Get lab panel by ID' })
  async findOnePanel(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LabPanel> {
    return this.labService.findOnePanel(req.user.tenantId, id);
  }

  @Post('panels')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom lab panel' })
  async createPanel(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateLabPanelDto,
  ): Promise<LabPanel> {
    return this.labService.createPanel(req.user.tenantId, dto);
  }

  // ───────────────────────────────────────────────────────────
  // Reference Ranges
  // ───────────────────────────────────────────────────────────

  @Get('reference-ranges')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech')
  @ApiOperation({ summary: 'Look up reference ranges by LOINC code' })
  @ApiQuery({ name: 'loincCode', required: true, type: String })
  @ApiQuery({ name: 'gender', required: false, type: String })
  @ApiQuery({ name: 'ageDays', required: false, type: Number })
  async findReferenceRanges(
    @Request() req: AuthenticatedRequest,
    @Query('loincCode') loincCode: string,
    @Query('gender') gender?: string,
    @Query('ageDays') ageDays?: number,
  ): Promise<ReferenceRange[]> {
    return this.labService.findReferenceRanges(
      req.user.tenantId,
      loincCode,
      gender,
      ageDays ? Number(ageDays) : undefined,
    );
  }

  // ───────────────────────────────────────────────────────────
  // Critical / Pending Review Results
  // ───────────────────────────────────────────────────────────

  @Get('results/critical')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'List unacknowledged critical results' })
  async findCriticalResults(@Request() req: AuthenticatedRequest): Promise<LabResult[]> {
    return this.labService.findCriticalResults(req.user.tenantId);
  }

  @Get('results/pending-review')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'List results pending provider review' })
  async findPendingReview(@Request() req: AuthenticatedRequest): Promise<LabResult[]> {
    return this.labService.findPendingReviewResults(req.user.tenantId);
  }

  @Patch('results/:resultId/acknowledge')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Acknowledge a lab result (critical value read-back)' })
  async acknowledgeResult(
    @Request() req: AuthenticatedRequest,
    @Param('resultId', ParseUUIDPipe) resultId: string,
    @Body() dto: AcknowledgeResultDto,
  ): Promise<LabResult> {
    return this.labService.acknowledgeResult(
      req.user.tenantId,
      resultId,
      dto,
      req.user.id,
    );
  }

  // ───────────────────────────────────────────────────────────
  // Patient Lab History (for trend analysis)
  // ───────────────────────────────────────────────────────────

  @Get('patient/:patientId/history')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Get all lab history for a patient (for trend analysis)' })
  @ApiQuery({ name: 'loincCode', required: false, type: String })
  async findPatientLabHistory(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
    @Query('loincCode') loincCode?: string,
  ) {
    return this.labService.findPatientLabHistory(
      req.user.tenantId,
      patientId,
      loincCode,
    );
  }

  // ───────────────────────────────────────────────────────────
  // Lab Orders
  // ───────────────────────────────────────────────────────────

  @Get('orders')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech')
  @ApiOperation({ summary: 'List lab orders with pagination, search, and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'priority', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  async findAllOrders(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('patientId') patientId?: string,
  ): Promise<PaginatedResult<LabOrder>> {
    return this.labService.findAllOrders(req.user.tenantId, {
      page: page || 1,
      limit: limit || 20,
      search,
      status,
      priority,
      patientId,
    });
  }

  @Get('orders/:id')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech')
  @ApiOperation({ summary: 'Get lab order with tests, specimens, results, and status history' })
  async findOneOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.labService.findOrderWithDetails(req.user.tenantId, id);
  }

  @Get('orders/:id/status-history')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'Get lab order status change history' })
  async getOrderStatusHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.labService.getOrderStatusHistory(req.user.tenantId, id);
  }

  @Get('orders/:id/specimens')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'List specimens for a lab order' })
  async findSpecimens(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Specimen[]> {
    return this.labService.findSpecimens(req.user.tenantId, id);
  }

  @Get('orders/:id/results')
  @Roles('admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech')
  @ApiOperation({ summary: 'Get all results for a lab order' })
  async findResults(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LabResult[]> {
    return this.labService.findResults(req.user.tenantId, id);
  }

  @Post('orders')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new lab order with tests' })
  async createOrder(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateLabOrderDto,
  ): Promise<LabOrder> {
    return this.labService.createOrder(req.user.tenantId, dto);
  }

  @Post('orders/:id/collect')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record specimen collection for a lab order' })
  async collectSpecimen(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectSpecimenDto,
  ): Promise<Specimen> {
    return this.labService.collectSpecimen(req.user.tenantId, id, dto);
  }

  @Post('orders/:id/results')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'Submit lab results for an order' })
  async submitResults(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitLabResultsDto,
  ): Promise<LabResult[]> {
    return this.labService.submitResults(req.user.tenantId, id, dto);
  }

  @Post('orders/:id/status')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'Transition lab order status' })
  async updateOrderStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabOrderStatusDto,
  ) {
    return this.labService.updateOrderStatus(req.user.tenantId, id, dto, req.user.id);
  }

  @Post('orders/:id/cancel')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Cancel a lab order with reason' })
  async cancelOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelLabOrderDto,
  ) {
    return this.labService.cancelOrder(req.user.tenantId, id, dto, req.user.id);
  }

  @Patch('orders/:id')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update lab order (only in draft/ordered status)' })
  async updateOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabOrderDto,
  ): Promise<LabOrder> {
    return this.labService.updateOrder(req.user.tenantId, id, dto);
  }

  @Delete('orders/:id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a lab order' })
  async deleteOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.labService.softDeleteOrder(req.user.tenantId, id);
  }

  // ───────────────────────────────────────────────────────────
  // Imaging Orders
  // ───────────────────────────────────────────────────────────

  @Get('imaging')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'List imaging orders' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  async findAllImaging(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
  ): Promise<PaginatedResult<ImagingOrder>> {
    return this.labService.findAllImaging(req.user.tenantId, {
      page: page || 1,
      limit: limit || 20,
      search,
      status,
      patientId,
    });
  }

  @Get('imaging/:id')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'Get imaging order by ID' })
  async findOneImaging(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImagingOrder> {
    return this.labService.findOneImaging(req.user.tenantId, id);
  }

  @Post('imaging')
  @Roles('admin', 'doctor', 'nurse')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new imaging order' })
  async createImaging(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateImagingOrderDto,
  ): Promise<ImagingOrder> {
    return this.labService.createImaging(req.user.tenantId, dto);
  }

  @Patch('imaging/:id')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'Update imaging order' })
  async updateImaging(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImagingOrderDto,
  ): Promise<ImagingOrder> {
    return this.labService.updateImaging(req.user.tenantId, id, dto);
  }

  @Post('imaging/:id/findings')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'Submit radiology findings for an imaging order' })
  async submitImagingFindings(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImagingFindingsDto,
  ): Promise<ImagingOrder> {
    return this.labService.submitImagingFindings(req.user.tenantId, id, dto);
  }

  @Delete('imaging/:id')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an imaging order' })
  async deleteImaging(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.labService.softDeleteImaging(req.user.tenantId, id);
  }

  // ───────────────────────────────────────────────────────────
  // AI Features (Phase 1)
  // ───────────────────────────────────────────────────────────

  @Post('orders/:id/summarize')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'AI: Generate a plain-English summary of lab results for an order' })
  async summarizeResults(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.labAiService.summarizeLabResults(req.user.tenantId, id);
  }

  @Get('ai/triage')
  @Roles('admin', 'doctor', 'nurse', 'lab_tech')
  @ApiOperation({ summary: 'AI: Smart triage of abnormal results with urgency scoring' })
  async triageAbnormalResults(@Request() req: AuthenticatedRequest) {
    return this.labAiService.triageAbnormalResults(req.user.tenantId);
  }

  @Post('ai/query')
  @Roles('admin', 'doctor', 'nurse')
  @ApiOperation({ summary: 'AI: Natural language lab query (e.g. "Which patients have high HbA1c?")' })
  async naturalLanguageQuery(
    @Request() req: AuthenticatedRequest,
    @Body() body: { query: string },
  ) {
    if (!body?.query || !body.query.trim()) {
      return {
        interpretation: 'Empty query',
        matchedOrders: [],
        summary: 'Please provide a search query.',
      };
    }
    return this.labAiService.naturalLanguageQuery(
      req.user.tenantId,
      body.query.trim(),
    );
  }
}
