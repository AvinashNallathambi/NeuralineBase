import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { LabOrder } from './entities/lab-order.entity';
import { LabTest } from './entities/lab-test.entity';
import { LabResult } from './entities/lab-result.entity';
import { Specimen } from './entities/specimen.entity';
import { LabPanel } from './entities/lab-panel.entity';
import { ReferenceRange } from './entities/reference-range.entity';
import { ImagingOrder } from './entities/imaging-order.entity';
import { LabOrderStatusHistory } from './entities/lab-order-status-history.entity';
import { CreateLabOrderDto, LabTestDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { UpdateLabOrderStatusDto } from './dto/update-lab-order-status.dto';
import { SubmitLabResultsDto, LabResultEntryDto } from './dto/submit-lab-results.dto';
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

export interface LabPaginationOptions {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  priority?: string;
  patientId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['collected', 'cancelled'],
  collected: ['in_progress', 'cancelled'],
  in_progress: ['resulted', 'cancelled'],
  resulted: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const EDITABLE_STATUSES = ['draft', 'ordered'];
const IMAGING_TRANSITIONS: Record<string, string[]> = {
  ordered: ['scheduled', 'in_progress', 'completed', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

@Injectable()
export class LaboratoryService {
  private readonly logger = new Logger(LaboratoryService.name);

  constructor(
    @InjectRepository(LabOrder)
    private readonly orderRepository: Repository<LabOrder>,
    @InjectRepository(LabTest)
    private readonly testRepository: Repository<LabTest>,
    @InjectRepository(LabResult)
    private readonly resultRepository: Repository<LabResult>,
    @InjectRepository(Specimen)
    private readonly specimenRepository: Repository<Specimen>,
    @InjectRepository(LabPanel)
    private readonly panelRepository: Repository<LabPanel>,
    @InjectRepository(ReferenceRange)
    private readonly referenceRangeRepository: Repository<ReferenceRange>,
    @InjectRepository(ImagingOrder)
    private readonly imagingRepository: Repository<ImagingOrder>,
    @InjectRepository(LabOrderStatusHistory)
    private readonly statusHistoryRepository: Repository<LabOrderStatusHistory>,
    private readonly dataSource: DataSource,
  ) {}

  // ───────────────────────────────────────────────────────────
  // Lab Orders
  // ───────────────────────────────────────────────────────────

  async findAllOrders(
    tenantId: string,
    options: LabPaginationOptions,
  ): Promise<PaginatedResult<LabOrder>> {
    const { page, limit, search, status, priority, patientId } = options;
    const skip = (page - 1) * limit;

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .where('order.tenantId = :tenantId', { tenantId });

    if (search) {
      qb.andWhere(
        '(order.patientName ILIKE :search OR order.providerName ILIKE :search OR order.notes ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (status) qb.andWhere('order.status = :status', { status });
    if (priority) qb.andWhere('order.priority = :priority', { priority });
    if (patientId) qb.andWhere('order.patientId = :patientId', { patientId });

    qb.orderBy('order.orderedDate', 'DESC').skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();

    // Attach tests to each order for the list view
    if (data.length > 0) {
      const orderIds = data.map((o) => o.id);
      const tests = await this.testRepository.find({
        where: { tenantId, orderId: In(orderIds) },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
      const testsByOrderId = tests.reduce((map, t) => {
        if (!map[t.orderId]) map[t.orderId] = [];
        map[t.orderId].push(t);
        return map;
      }, {} as Record<string, LabTest[]>);
      for (const order of data) {
        (order as any).tests = testsByOrderId[order.id] || [];
      }
    }

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneOrder(tenantId: string, id: string): Promise<LabOrder> {
    const order = await this.orderRepository.findOne({ where: { id, tenantId } });
    if (!order) throw new NotFoundException(`Lab order "${id}" not found`);
    return order;
  }

  async findOrderWithDetails(tenantId: string, id: string) {
    const order = await this.findOneOrder(tenantId, id);
    const [tests, specimens, results, statusHistory] = await Promise.all([
      this.testRepository.find({
        where: { tenantId, orderId: id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.specimenRepository.find({ where: { tenantId, orderId: id } }),
      this.resultRepository.find({ where: { tenantId, orderId: id } }),
      this.statusHistoryRepository.find({
        where: { tenantId, orderId: id },
        order: { createdAt: 'DESC' },
      }),
    ]);
    return { ...order, tests, specimens, results, statusHistory };
  }

  async createOrder(
    tenantId: string,
    dto: CreateLabOrderDto,
  ): Promise<LabOrder> {
    return this.dataSource.transaction(async (manager) => {
      const orderedDate = dto.orderedDate ? new Date(dto.orderedDate) : new Date();
      const status = (dto.status || 'ordered') as LabOrder['status'];

      const order = manager.create(LabOrder, {
        tenantId,
        patientId: dto.patientId,
        patientName: dto.patientName,
        providerId: dto.providerId,
        providerName: dto.providerName,
        encounterId: dto.encounterId || null,
        status,
        priority: (dto.priority || 'routine') as any,
        fastingRequired: dto.fastingRequired || false,
        notes: dto.notes || null,
        orderedDate,
        labFacilityId: dto.labFacilityId || null,
        labFacilityName: dto.labFacilityName || null,
        diagnosisCodes: dto.diagnosisCodes || [],
        aoeQuestions: dto.aoeQuestions || null,
      });
      const savedOrder = await manager.save(order);

      // Create child LabTest rows
      const testEntities = dto.tests.map((t, i) =>
        manager.create(LabTest, {
          tenantId,
          orderId: savedOrder.id,
          name: t.name,
          loincCode: t.loincCode || null,
          cptCode: t.cptCode || null,
          category: t.category || null,
          specimenType: t.specimenType || null,
          status: 'pending',
          sortOrder: t.sortOrder ?? i,
          notes: t.notes || null,
        }),
      );
      await manager.save(testEntities);

      // Record initial status history
      const history = manager.create(LabOrderStatusHistory, {
        tenantId,
        orderId: savedOrder.id,
        previousStatus: null,
        newStatus: status,
        changedBy: null,
        reason: 'Order created',
      });
      await manager.save(history);

      this.logger.log(`Lab order created: ${savedOrder.id} in tenant ${tenantId}`);
      return savedOrder;
    });
  }

  async updateOrder(
    tenantId: string,
    id: string,
    dto: UpdateLabOrderDto,
  ): Promise<LabOrder> {
    const order = await this.findOneOrder(tenantId, id);
    if (!EDITABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Lab order in status "${order.status}" cannot be edited`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const { tests, ...updateData } = dto;
      Object.assign(order, updateData);
      const updated = await manager.save(order);

      if (tests) {
        // Replace tests
        await manager.delete(LabTest, { tenantId, orderId: id });
        const newTests = tests.map((t, i) =>
          manager.create(LabTest, {
            tenantId,
            orderId: id,
            name: t.name,
            loincCode: t.loincCode || null,
            cptCode: t.cptCode || null,
            category: t.category || null,
            specimenType: t.specimenType || null,
            status: 'pending',
            sortOrder: t.sortOrder ?? i,
            notes: t.notes || null,
          }),
        );
        await manager.save(newTests);
      }

      this.logger.log(`Lab order updated: ${id} in tenant ${tenantId}`);
      return updated;
    });
  }

  async updateOrderStatus(
    tenantId: string,
    id: string,
    dto: UpdateLabOrderStatusDto,
    changedBy?: string,
  ): Promise<LabOrder> {
    const order = await this.findOneOrder(tenantId, id);
    const currentStatus = order.status;
    const newStatus = dto.status;

    if (currentStatus === newStatus) return order;

    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
      );
    }

    order.status = newStatus as any;
    if (newStatus === 'collected' && !order.collectedDate) {
      order.collectedDate = new Date();
    }
    if (newStatus === 'completed' && !order.completedDate) {
      order.completedDate = new Date();
    }

    const updated = await this.orderRepository.save(order);

    const history = this.statusHistoryRepository.create({
      tenantId,
      orderId: order.id,
      previousStatus: currentStatus,
      newStatus,
      changedBy: changedBy || null,
      reason: dto.reason || null,
    });
    await this.statusHistoryRepository.save(history);

    this.logger.log(
      `Lab order status: ${id} ${currentStatus} -> ${newStatus} in tenant ${tenantId}`,
    );
    return updated;
  }

  async cancelOrder(
    tenantId: string,
    id: string,
    dto: CancelLabOrderDto,
    changedBy?: string,
  ): Promise<LabOrder> {
    return this.updateOrderStatus(
      tenantId,
      id,
      { status: 'cancelled', reason: dto.reason },
      changedBy,
    );
  }

  async collectSpecimen(
    tenantId: string,
    orderId: string,
    dto: CollectSpecimenDto,
  ): Promise<Specimen> {
    const order = await this.findOneOrder(tenantId, orderId);
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot collect specimen for order in status "${order.status}"`,
      );
    }

    const specimen = this.specimenRepository.create({
      tenantId,
      orderId,
      testId: dto.testId || null,
      specimenType: dto.specimenType,
      collectionMethod: dto.collectionMethod || null,
      volume: dto.volume || null,
      containerType: dto.containerType || null,
      collectedAt: new Date(),
      collectedBy: dto.collectedBy || null,
      condition: (dto.condition || 'good') as any,
      rejectionReason: dto.rejectionReason || null,
      trackingNumber: dto.trackingNumber || null,
    });
    const saved = await this.specimenRepository.save(specimen);

    // Auto-transition order to collected if currently ordered
    if (order.status === 'ordered') {
      await this.updateOrderStatus(
        tenantId,
        orderId,
        { status: 'collected', reason: 'Specimen collected' },
        dto.collectedBy,
      );
    }

    this.logger.log(`Specimen collected for order ${orderId}: ${saved.id}`);
    return saved;
  }

  async findSpecimens(tenantId: string, orderId: string): Promise<Specimen[]> {
    await this.findOneOrder(tenantId, orderId);
    return this.specimenRepository.find({
      where: { tenantId, orderId },
      order: { collectedAt: 'DESC' },
    });
  }

  async softDeleteOrder(tenantId: string, id: string): Promise<void> {
    const order = await this.findOneOrder(tenantId, id);
    await this.orderRepository.softRemove(order);
    this.logger.log(`Lab order soft deleted: ${id} in tenant ${tenantId}`);
  }

  async getOrderStatusHistory(tenantId: string, id: string) {
    await this.findOneOrder(tenantId, id);
    return this.statusHistoryRepository.find({
      where: { tenantId, orderId: id },
      order: { createdAt: 'DESC' },
    });
  }

  // ───────────────────────────────────────────────────────────
  // Lab Results
  // ───────────────────────────────────────────────────────────

  async submitResults(
    tenantId: string,
    orderId: string,
    dto: SubmitLabResultsDto,
  ): Promise<LabResult[]> {
    const order = await this.findOneOrder(tenantId, orderId);
    if (order.status === 'cancelled') {
      throw new BadRequestException('Cannot submit results for a cancelled order');
    }

    return this.dataSource.transaction(async (manager) => {
      const savedResults: LabResult[] = [];

      for (const entry of dto.results) {
        const test = await manager.findOne(LabTest, {
          where: { id: entry.testId, tenantId, orderId },
        });
        if (!test) {
          throw new NotFoundException(
            `Test "${entry.testId}" not found in order ${orderId}`,
          );
        }

        // Auto-flag abnormal based on numeric value + reference range
        const flag = entry.flag || this.computeFlag(test, entry);

        const result = manager.create(LabResult, {
          tenantId,
          orderId,
          testId: entry.testId,
          value: entry.value,
          numericValue: entry.numericValue ?? null,
          unit: entry.unit || test.unit || null,
          flag,
          referenceRange: entry.referenceRange || test.referenceRange || null,
          interpretation: entry.interpretation || null,
          resultStatus: entry.resultStatus || 'final',
          resultedAt: entry.resultedAt ? new Date(entry.resultedAt) : new Date(),
          resultedBy: dto.resultedBy || null,
          isAcknowledged: false,
        });
        const saved = await manager.save(result);
        savedResults.push(saved);

        // Update the LabTest with result info
        test.resultValue = entry.value;
        test.resultNumeric = entry.numericValue ?? null;
        test.unit = entry.unit || test.unit;
        test.referenceRange = entry.referenceRange || test.referenceRange;
        test.abnormalFlag = (flag as any) || null;
        test.resultStatus = (entry.resultStatus as any) || 'final';
        test.resultedAt = entry.resultedAt ? new Date(entry.resultedAt) : new Date();
        test.resultedBy = dto.resultedBy || null;
        test.status = flag === 'critical_high' || flag === 'critical_low'
          ? 'critical'
          : flag && flag !== 'normal'
            ? 'abnormal'
            : 'resulted';
        await manager.save(test);
      }

      // Auto-transition order to resulted if currently in_progress or collected
      if (order.status === 'in_progress' || order.status === 'collected') {
        await this.updateOrderStatus(
          tenantId,
          orderId,
          { status: 'resulted', reason: 'Results submitted' },
          dto.resultedBy,
        );
      }

      this.logger.log(
        `Results submitted for order ${orderId}: ${savedResults.length} result(s)`,
      );
      return savedResults;
    });
  }

  async findResults(tenantId: string, orderId: string): Promise<LabResult[]> {
    await this.findOneOrder(tenantId, orderId);
    return this.resultRepository.find({
      where: { tenantId, orderId },
      order: { resultedAt: 'DESC' },
    });
  }

  async findCriticalResults(tenantId: string): Promise<LabResult[]> {
    return this.resultRepository.find({
      where: { tenantId, isAcknowledged: false, flag: In(['critical_high', 'critical_low']) },
      order: { resultedAt: 'DESC' },
    });
  }

  async findPendingReviewResults(tenantId: string): Promise<LabResult[]> {
    return this.resultRepository.find({
      where: { tenantId, isAcknowledged: false },
      order: { resultedAt: 'DESC' },
    });
  }

  async acknowledgeResult(
    tenantId: string,
    resultId: string,
    dto: AcknowledgeResultDto,
    acknowledgedBy?: string,
  ): Promise<LabResult> {
    const result = await this.resultRepository.findOne({
      where: { id: resultId, tenantId },
    });
    if (!result) throw new NotFoundException(`Result "${resultId}" not found`);
    if (result.isAcknowledged) {
      throw new BadRequestException('Result already acknowledged');
    }
    result.isAcknowledged = true;
    result.acknowledgedBy = acknowledgedBy || null;
    result.acknowledgedAt = new Date();
    if (dto.note) {
      result.interpretation = result.interpretation
        ? `${result.interpretation}\n\n[Acknowledgment]: ${dto.note}`
        : `[Acknowledgment]: ${dto.note}`;
    }
    const updated = await this.resultRepository.save(result);
    this.logger.log(`Result acknowledged: ${resultId} by ${acknowledgedBy}`);
    return updated;
  }

  // ───────────────────────────────────────────────────────────
  // Reference Range Validation
  // ───────────────────────────────────────────────────────────

  private computeFlag(test: LabTest, entry: LabResultEntryDto): string | null {
    if (entry.numericValue === undefined || entry.numericValue === null) {
      return 'normal';
    }
    const value = entry.numericValue;

    // Check critical thresholds first
    if (test.referenceRangeLow !== null && test.referenceRangeHigh !== null) {
      // We don't store critical thresholds on the test entity itself; if needed
      // we can look up ReferenceRange by LOINC. For now use the basic range.
      if (value < test.referenceRangeLow) return 'low';
      if (value > test.referenceRangeHigh) return 'high';
      return 'normal';
    }
    return 'normal';
  }

  async findReferenceRanges(
    tenantId: string,
    loincCode: string,
    patientGender?: string,
    patientAgeDays?: number,
  ): Promise<ReferenceRange[]> {
    const qb = this.referenceRangeRepository
      .createQueryBuilder('r')
      .where('r.loincCode = :loincCode', { loincCode })
      .andWhere('(r.tenantId IS NULL OR r.tenantId = :tenantId)', { tenantId });

    if (patientGender && patientGender !== 'all') {
      qb.andWhere('(r.gender = :gender OR r.gender = :all)', {
        gender: patientGender,
        all: 'all',
      });
    }
    if (patientAgeDays !== undefined) {
      qb.andWhere('r.ageMinDays <= :ageDays', { ageDays: patientAgeDays });
      qb.andWhere('(r.ageMaxDays IS NULL OR r.ageMaxDays >= :ageDays)', {
        ageDays: patientAgeDays,
      });
    }
    return qb.getMany();
  }

  // ───────────────────────────────────────────────────────────
  // Lab Panels (catalog)
  // ───────────────────────────────────────────────────────────

  async findPanels(tenantId: string, includeInactive = false): Promise<LabPanel[]> {
    const qb = this.panelRepository
      .createQueryBuilder('p')
      .where('(p.tenantId IS NULL OR p.tenantId = :tenantId)', { tenantId });
    if (!includeInactive) qb.andWhere('p.isActive = :active', { active: true });
    qb.orderBy('p.name', 'ASC');
    return qb.getMany();
  }

  async findOnePanel(tenantId: string, id: string): Promise<LabPanel> {
    const panel = await this.panelRepository
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('(p.tenantId IS NULL OR p.tenantId = :tenantId)', { tenantId })
      .getOne();
    if (!panel) throw new NotFoundException(`Lab panel "${id}" not found`);
    return panel;
  }

  async createPanel(tenantId: string, dto: CreateLabPanelDto): Promise<LabPanel> {
    const panel = this.panelRepository.create({
      tenantId,
      name: dto.name,
      code: dto.code || null,
      loincCode: dto.loincCode || null,
      category: dto.category || null,
      tests: dto.tests,
      defaultPriority: dto.defaultPriority || 'routine',
      fastingRequired: dto.fastingRequired || false,
      isActive: true,
      description: dto.description || null,
    });
    const saved = await this.panelRepository.save(panel);
    this.logger.log(`Lab panel created: ${saved.id} in tenant ${tenantId}`);
    return saved;
  }

  // ───────────────────────────────────────────────────────────
  // Patient History (for trend analysis)
  // ───────────────────────────────────────────────────────────

  async findPatientLabHistory(
    tenantId: string,
    patientId: string,
    loincCode?: string,
  ): Promise<any[]> {
    const orders = await this.orderRepository.find({
      where: { tenantId, patientId },
      order: { orderedDate: 'DESC' },
      take: 200,
    });

    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return [];

    const testWhere: any = { tenantId, orderId: In(orderIds) };
    if (loincCode) testWhere.loincCode = loincCode;
    const tests = await this.testRepository.find({ where: testWhere });

    const testsByOrder = tests.reduce((acc, t) => {
      (acc[t.orderId] ||= []).push(t);
      return acc;
    }, {} as Record<string, LabTest[]>);

    // Also fetch results so we have actual values for trend analysis
    const results = await this.resultRepository.find({
      where: { tenantId, orderId: In(orderIds) },
      order: { resultedAt: 'DESC' },
    });

    const resultsByTest = results.reduce((acc, r) => {
      (acc[r.testId] ||= []).push(r);
      return acc;
    }, {} as Record<string, LabResult[]>);

    // Build a flat list of result entries with test and order context
    const history: any[] = [];
    for (const test of tests) {
      const testResults = resultsByTest[test.id] || [];
      for (const result of testResults) {
        history.push({
          ...result,
          testName: test.name,
          loincCode: test.loincCode,
          orderOrderedDate: orders.find((o) => o.id === test.orderId)?.orderedDate,
        });
      }
      // If no results yet, still include the test entry (pending)
      if (testResults.length === 0) {
        history.push({
          id: test.id,
          orderId: test.orderId,
          testId: test.id,
          testName: test.name,
          loincCode: test.loincCode,
          value: null,
          numericValue: null,
          unit: null,
          flag: null,
          referenceRange: null,
          interpretation: null,
          resultStatus: 'pending',
          resultedAt: orders.find((o) => o.id === test.orderId)?.orderedDate || new Date(),
          resultedBy: null,
          isAcknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          orderOrderedDate: orders.find((o) => o.id === test.orderId)?.orderedDate,
        });
      }
    }

    // Sort by resultedAt descending
    history.sort((a, b) => new Date(b.resultedAt).getTime() - new Date(a.resultedAt).getTime());
    return history;
  }

  // ───────────────────────────────────────────────────────────
  // Statistics
  // ───────────────────────────────────────────────────────────

  async getStats(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [pending, completedToday, abnormalResults, criticalUnacknowledged] =
      await Promise.all([
        this.orderRepository.count({
          where: { tenantId, status: In(['ordered', 'collected', 'in_progress']) },
        }),
        this.orderRepository
          .createQueryBuilder('o')
          .where('o.tenantId = :tenantId', { tenantId })
          .andWhere('o.status = :status', { status: 'completed' })
          .andWhere('o.completedDate >= :today', { today })
          .andWhere('o.completedDate < :tomorrow', { tomorrow })
          .getCount(),
        this.testRepository.count({
          where: { tenantId, status: In(['abnormal', 'critical']) },
        }),
        this.resultRepository.count({
          where: { tenantId, isAcknowledged: false, flag: In(['critical_high', 'critical_low']) },
        }),
      ]);

    return {
      pendingOrders: pending,
      completedToday,
      abnormalResults,
      criticalUnacknowledged,
    };
  }

  // ───────────────────────────────────────────────────────────
  // Imaging Orders
  // ───────────────────────────────────────────────────────────

  async findAllImaging(
    tenantId: string,
    options: LabPaginationOptions,
  ): Promise<PaginatedResult<ImagingOrder>> {
    const { page, limit, search, status, patientId } = options;
    const skip = (page - 1) * limit;

    const qb = this.imagingRepository
      .createQueryBuilder('img')
      .where('img.tenantId = :tenantId', { tenantId });

    if (search) {
      qb.andWhere(
        '(img.patientName ILIKE :search OR img.studyName ILIKE :search OR img.bodyPart ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (status) qb.andWhere('img.status = :status', { status });
    if (patientId) qb.andWhere('img.patientId = :patientId', { patientId });

    qb.orderBy('img.orderedDate', 'DESC').skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneImaging(tenantId: string, id: string): Promise<ImagingOrder> {
    const img = await this.imagingRepository.findOne({ where: { id, tenantId } });
    if (!img) throw new NotFoundException(`Imaging order "${id}" not found`);
    return img;
  }

  async createImaging(
    tenantId: string,
    dto: CreateImagingOrderDto,
  ): Promise<ImagingOrder> {
    const imaging = this.imagingRepository.create({
      tenantId,
      patientId: dto.patientId,
      patientName: dto.patientName,
      providerId: dto.providerId,
      providerName: dto.providerName,
      encounterId: dto.encounterId || null,
      modality: dto.modality as any,
      bodyPart: dto.bodyPart,
      studyName: dto.studyName,
      cptCode: dto.cptCode || null,
      status: (dto.status || 'ordered') as any,
      priority: dto.priority || 'routine',
      notes: dto.notes || null,
      orderedDate: dto.orderedDate ? new Date(dto.orderedDate) : new Date(),
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
    });
    const saved = await this.imagingRepository.save(imaging);
    this.logger.log(`Imaging order created: ${saved.id} in tenant ${tenantId}`);
    return saved;
  }

  async updateImaging(
    tenantId: string,
    id: string,
    dto: UpdateImagingOrderDto,
  ): Promise<ImagingOrder> {
    const img = await this.findOneImaging(tenantId, id);
    if (img.status === 'completed' || img.status === 'cancelled') {
      throw new BadRequestException(
        `Imaging order in status "${img.status}" cannot be edited`,
      );
    }

    if (dto.status && dto.status !== img.status) {
      const allowed = IMAGING_TRANSITIONS[img.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid imaging status transition from "${img.status}" to "${dto.status}"`,
        );
      }
    }

    if (dto.scheduledDate) (dto as any).scheduledDate = new Date(dto.scheduledDate);
    if (dto.status === 'completed' && !img.completedDate) {
      (img as any).completedDate = new Date();
    }
    Object.assign(img, dto);
    const updated = await this.imagingRepository.save(img);
    this.logger.log(`Imaging order updated: ${id} in tenant ${tenantId}`);
    return updated;
  }

  async submitImagingFindings(
    tenantId: string,
    id: string,
    dto: ImagingFindingsDto,
  ): Promise<ImagingOrder> {
    const img = await this.findOneImaging(tenantId, id);
    img.findings = dto.findings;
    img.impression = dto.impression || null;
    img.radiologyReportUrl = dto.radiologyReportUrl || null;
    if (img.status !== 'completed' && img.status !== 'cancelled') {
      img.status = 'completed' as any;
      img.completedDate = new Date();
    }
    const updated = await this.imagingRepository.save(img);
    this.logger.log(`Imaging findings submitted: ${id} in tenant ${tenantId}`);
    return updated;
  }

  async softDeleteImaging(tenantId: string, id: string): Promise<void> {
    const img = await this.findOneImaging(tenantId, id);
    await this.imagingRepository.softRemove(img);
    this.logger.log(`Imaging order soft deleted: ${id} in tenant ${tenantId}`);
  }
}
