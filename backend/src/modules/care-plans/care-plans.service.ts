import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CarePlan } from './entities/care-plan.entity';
import { CarePlanGoal } from './entities/care-plan-goal.entity';
import { CarePlanTask } from './entities/care-plan-task.entity';
import { CreateCarePlanDto } from './dto/create-care-plan.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class CarePlansService {
  private readonly logger = new Logger(CarePlansService.name);

  constructor(
    @InjectRepository(CarePlan)
    private readonly planRepository: Repository<CarePlan>,
    @InjectRepository(CarePlanGoal)
    private readonly goalRepository: Repository<CarePlanGoal>,
    @InjectRepository(CarePlanTask)
    private readonly taskRepository: Repository<CarePlanTask>,
  ) {}

  // ── Care Plans ──────────────────────────────────────────────────────────────

  async findByPatient(tenantId: string, patientId: string): Promise<CarePlan[]> {
    return this.planRepository.find({
      where: { tenantId, patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<CarePlan> {
    const plan = await this.planRepository.findOne({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException(`Care plan "${id}" not found`);
    return plan;
  }

  async create(tenantId: string, dto: CreateCarePlanDto): Promise<CarePlan> {
    const plan = this.planRepository.create({
      ...dto,
      tenantId,
      status: (dto.status || 'active') as any,
      intent: (dto.intent || 'plan') as any,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    }) as CarePlan;
    const saved = await this.planRepository.save(plan);
    this.logger.log(`Care plan created: ${saved.id}`);
    return saved;
  }

  async update(tenantId: string, id: string, dto: Partial<CreateCarePlanDto>): Promise<CarePlan> {
    const plan = await this.findOne(tenantId, id);
    const { startDate, endDate, ...rest } = dto;
    Object.assign(plan, rest);
    if (startDate !== undefined) plan.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) plan.endDate = endDate ? new Date(endDate) : null;
    return this.planRepository.save(plan);
  }

  async approve(tenantId: string, id: string, approvedBy: string): Promise<CarePlan> {
    const plan = await this.findOne(tenantId, id);
    plan.isApproved = true;
    plan.approvedAt = new Date();
    plan.approvedBy = approvedBy;
    return this.planRepository.save(plan);
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const plan = await this.findOne(tenantId, id);
    await this.planRepository.softRemove(plan);
  }

  // ── Goals ───────────────────────────────────────────────────────────────────

  async findGoals(tenantId: string, planId: string): Promise<CarePlanGoal[]> {
    await this.findOne(tenantId, planId);
    return this.goalRepository.find({
      where: { tenantId, carePlanId: planId },
      order: { priority: 'ASC', createdAt: 'DESC' },
    });
  }

  async createGoal(tenantId: string, dto: CreateGoalDto): Promise<CarePlanGoal> {
    await this.findOne(tenantId, dto.carePlanId);
    const goal = this.goalRepository.create({
      ...dto,
      tenantId,
      status: (dto.status || 'active') as any,
      priority: (dto.priority || 'medium') as any,
      targetDirection: dto.targetDirection as any,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
    }) as CarePlanGoal;
    const saved = await this.goalRepository.save(goal);
    this.logger.log(`Care plan goal created: ${saved.id}`);
    return saved;
  }

  async updateGoal(tenantId: string, goalId: string, dto: Partial<CreateGoalDto>): Promise<CarePlanGoal> {
    const goal = await this.goalRepository.findOne({ where: { id: goalId, tenantId } });
    if (!goal) throw new NotFoundException(`Goal "${goalId}" not found`);
    const { targetDate, startDate, ...rest } = dto;
    Object.assign(goal, rest);
    if (targetDate !== undefined) goal.targetDate = targetDate ? new Date(targetDate) : null;
    if (startDate !== undefined) goal.startDate = startDate ? new Date(startDate) : null;
    return this.goalRepository.save(goal);
  }

  async updateGoalProgress(
    tenantId: string,
    goalId: string,
    currentValue: string,
  ): Promise<CarePlanGoal> {
    const goal = await this.goalRepository.findOne({ where: { id: goalId, tenantId } });
    if (!goal) throw new NotFoundException(`Goal "${goalId}" not found`);
    goal.currentValue = currentValue;
    goal.lastMeasuredAt = new Date();
    // Auto-check if goal is achieved
    if (goal.targetValue && goal.targetDirection) {
      const current = parseFloat(currentValue);
      const target = parseFloat(goal.targetValue);
      if (!isNaN(current) && !isNaN(target)) {
        if (goal.targetDirection === 'decrease' && current <= target) {
          goal.status = 'achieved';
          goal.achievedDate = new Date();
        } else if (goal.targetDirection === 'increase' && current >= target) {
          goal.status = 'achieved';
          goal.achievedDate = new Date();
        } else if (goal.targetDirection === 'maintain' && current === target) {
          goal.status = 'achieved';
          goal.achievedDate = new Date();
        }
      }
    }
    return this.goalRepository.save(goal);
  }

  async deleteGoal(tenantId: string, goalId: string): Promise<void> {
    const goal = await this.goalRepository.findOne({ where: { id: goalId, tenantId } });
    if (!goal) throw new NotFoundException(`Goal "${goalId}" not found`);
    await this.goalRepository.softRemove(goal);
  }

  // ── Tasks ───────────────────────────────────────────────────────────────────

  async findTasks(tenantId: string, planId: string): Promise<CarePlanTask[]> {
    await this.findOne(tenantId, planId);
    return this.taskRepository.find({
      where: { tenantId, carePlanId: planId },
      order: { status: 'ASC', dueDate: 'ASC', createdAt: 'DESC' },
    });
  }

  async findTasksByPatient(
    tenantId: string,
    patientId: string,
    status?: string,
  ): Promise<CarePlanTask[]> {
    const where: any = { tenantId, patientId };
    if (status) where.status = status;
    return this.taskRepository.find({
      where,
      order: { status: 'ASC', dueDate: 'ASC', createdAt: 'DESC' },
    });
  }

  async createTask(tenantId: string, dto: CreateTaskDto): Promise<CarePlanTask> {
    await this.findOne(tenantId, dto.carePlanId);
    const task = this.taskRepository.create({
      ...dto,
      tenantId,
      taskType: (dto.taskType || 'custom') as any,
      status: (dto.status || 'pending') as any,
      assignedTo: (dto.assignedTo || 'patient') as any,
      frequency: (dto.frequency || 'one_time') as any,
      priority: (dto.priority || 'medium') as any,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    }) as CarePlanTask;
    const saved = await this.taskRepository.save(task);
    this.logger.log(`Care plan task created: ${saved.id}`);
    return saved;
  }

  async updateTask(tenantId: string, taskId: string, dto: Partial<CreateTaskDto>): Promise<CarePlanTask> {
    const task = await this.taskRepository.findOne({ where: { id: taskId, tenantId } });
    if (!task) throw new NotFoundException(`Task "${taskId}" not found`);
    const { startDate, dueDate, ...rest } = dto;
    Object.assign(task, rest);
    if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    return this.taskRepository.save(task);
  }

  async completeTask(
    tenantId: string,
    taskId: string,
    completedBy: string,
    reportedValue?: string,
    patientNotes?: string,
  ): Promise<CarePlanTask> {
    const task = await this.taskRepository.findOne({ where: { id: taskId, tenantId } });
    if (!task) throw new NotFoundException(`Task "${taskId}" not found`);
    task.status = 'completed';
    task.completedAt = new Date();
    task.completedBy = completedBy;
    if (reportedValue !== undefined) {
      task.reportedValue = reportedValue;
      task.reportedAt = new Date();
    }
    if (patientNotes !== undefined) task.patientNotes = patientNotes;
    return this.taskRepository.save(task);
  }

  async reportTaskValue(
    tenantId: string,
    taskId: string,
    reportedValue: string,
    patientNotes?: string,
  ): Promise<CarePlanTask> {
    const task = await this.taskRepository.findOne({ where: { id: taskId, tenantId } });
    if (!task) throw new NotFoundException(`Task "${taskId}" not found`);
    task.reportedValue = reportedValue;
    task.reportedAt = new Date();
    if (patientNotes !== undefined) task.patientNotes = patientNotes;
    // If this task is linked to a goal, update the goal progress
    if (task.goalId) {
      try {
        await this.updateGoalProgress(tenantId, task.goalId, reportedValue);
      } catch (err) {
        this.logger.warn(`Failed to update goal ${task.goalId}: ${err}`);
      }
    }
    return this.taskRepository.save(task);
  }

  async deleteTask(tenantId: string, taskId: string): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id: taskId, tenantId } });
    if (!task) throw new NotFoundException(`Task "${taskId}" not found`);
    await this.taskRepository.softRemove(task);
  }

  // ── Full plan with goals and tasks ──────────────────────────────────────────

  async getFullPlan(tenantId: string, id: string): Promise<{
    plan: CarePlan;
    goals: CarePlanGoal[];
    tasks: CarePlanTask[];
  }> {
    const plan = await this.findOne(tenantId, id);
    const [goals, tasks] = await Promise.all([
      this.findGoals(tenantId, id),
      this.findTasks(tenantId, id),
    ]);
    return { plan, goals, tasks };
  }
}
