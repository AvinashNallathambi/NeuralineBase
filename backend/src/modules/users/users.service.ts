import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from './entities/user.entity';
import { ROLE_DEFINITIONS, getRoleDefinition } from './role-permissions';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const SALT_ROUNDS = 12;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDevUsers();
    } catch (error) {
      this.logger.warn('Failed to seed dev users:', error);
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────

  async findAll(tenantId: string): Promise<User[]> {
    return this.userRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { tenantId, id } });
    if (!user) throw new NotFoundException(`User "${id}" not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async create(
    tenantId: string,
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: string;
      phone?: string;
      department?: string;
    },
  ): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { tenantId, email: data.email },
    });
    if (existing) throw new ConflictException('Email already exists in this organization');

    if (data.role && !getRoleDefinition(data.role)) {
      throw new BadRequestException(`Invalid role: ${data.role}`);
    }

    // ─── Subscription limit enforcement ──────────────────────────────
    const currentCount = await this.userRepository.count({
      where: { tenantId, isActive: true },
    });
    const canAdd = await this.subscriptionsService.canAddProvider(tenantId, currentCount);
    if (!canAdd) {
      const { plan } = await this.subscriptionsService.getSubscriptionWithPlan(tenantId);
      const limit = plan.maxProviders === null ? 'unlimited' : String(plan.maxProviders);
      throw new ForbiddenException(
        `You've reached the user limit for the ${plan.name} plan (${limit} users). ` +
        `Please upgrade your subscription to add more users.`,
      );
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = this.userRepository.create({
      id: uuidv4(),
      tenantId,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'doctor',
      phone: data.phone || null,
      department: data.department || null,
      mfaEnabled: false,
      mfaSecret: null,
      isActive: true,
    });

    const saved = await this.userRepository.save(user);
    this.logger.log(`User created: ${saved.id} (${saved.email}) role=${saved.role}`);
    return saved;
  }

  /**
   * Returns the current user count and subscription plan limits for the tenant.
   * Used by the frontend to show usage and disable the Add User button when
   * the limit is reached.
   */
  async getSubscriptionLimits(tenantId: string): Promise<{
    currentCount: number;
    maxProviders: number | null;
    canAddMore: boolean;
    planName: string;
    planTier: string;
  }> {
    const currentCount = await this.userRepository.count({
      where: { tenantId, isActive: true },
    });

    try {
      const { plan } = await this.subscriptionsService.getSubscriptionWithPlan(tenantId);
      const canAddMore = await this.subscriptionsService.canAddProvider(tenantId, currentCount);
      return {
        currentCount,
        maxProviders: plan.maxProviders,
        canAddMore,
        planName: plan.name,
        planTier: plan.tier,
      };
    } catch {
      // If subscription lookup fails, allow without limit info
      return {
        currentCount,
        maxProviders: null,
        canAddMore: true,
        planName: 'Unknown',
        planTier: 'unknown',
      };
    }
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      phone: string;
      department: string;
      mfaEnabled: boolean;
      mfaSecret: string | null;
      isActive: boolean;
    }>,
  ): Promise<User> {
    const user = await this.findOne(tenantId, id);

    if (data.role && !getRoleDefinition(data.role)) {
      throw new BadRequestException(`Invalid role: ${data.role}`);
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { tenantId, email: data.email },
      });
      if (existing) throw new ConflictException('Email already in use');
    }

    Object.assign(user, data);
    const updated = await this.userRepository.save(user);
    this.logger.log(`User updated: ${id}`);
    return updated;
  }

  async changeRole(tenantId: string, id: string, role: string): Promise<User> {
    if (!getRoleDefinition(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    return this.update(tenantId, id, { role });
  }

  async toggleActive(tenantId: string, id: string): Promise<User> {
    const user = await this.findOne(tenantId, id);
    user.isActive = !user.isActive;
    const saved = await this.userRepository.save(user);
    this.logger.log(`User ${id} ${saved.isActive ? 'activated' : 'deactivated'}`);
    return saved;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const user = await this.findOne(tenantId, id);
    await this.userRepository.remove(user);
    this.logger.log(`User deleted: ${id}`);
  }

  async setPassword(tenantId: string, id: string, newPassword: string): Promise<void> {
    const user = await this.findOne(tenantId, id);
    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepository.save(user);
  }

  // ─── Role definitions ─────────────────────────────────────────────

  getRoleDefinitions() {
    return ROLE_DEFINITIONS;
  }

  // ─── Dev seeding ──────────────────────────────────────────────────

  async seedDevUsers(): Promise<void> {
    const count = await this.userRepository.count({
      where: { tenantId: DEV_TENANT_ID },
    });

    // One-time upgrade: promote the original dev admin to super_admin so
    // they can access the trial management endpoints.
    if (count > 0) {
      const sarah = await this.userRepository.findOne({
        where: { tenantId: DEV_TENANT_ID, email: 'dr.sarah.chen@neuraline.health' },
      });
      if (sarah && sarah.role === 'admin') {
        sarah.role = 'super_admin';
        await this.userRepository.save(sarah);
        this.logger.log('Upgraded dev user dr.sarah.chen@neuraline.health from admin → super_admin');
      }
      this.logger.log(`Dev users already seeded (${count}), skipping`);
      return;
    }

    const devUsers = [
      {
        email: 'dr.sarah.chen@neuraline.health',
        password: 'Neuraline@2025',
        firstName: 'Sarah',
        lastName: 'Chen',
        role: 'super_admin',
        phone: '(555) 100-2001',
        department: 'Primary Care',
      },
      {
        email: 'dr.james.wilson@neuraline.health',
        password: 'Neuraline@2025',
        firstName: 'James',
        lastName: 'Wilson',
        role: 'doctor',
        phone: '(555) 100-2002',
        department: 'Cardiology',
      },
      {
        email: 'maria.garcia@neuraline.health',
        password: 'Neuraline@2025',
        firstName: 'Maria',
        lastName: 'Garcia',
        role: 'nurse',
        phone: '(555) 100-2003',
        department: 'Primary Care',
      },
      {
        email: 'jennifer.adams@neuraline.health',
        password: 'Neuraline@2025',
        firstName: 'Jennifer',
        lastName: 'Adams',
        role: 'receptionist',
        phone: '(555) 100-2004',
        department: 'Front Desk',
      },
      {
        email: 'patricia.moore@neuraline.health',
        password: 'Neuraline@2025',
        firstName: 'Patricia',
        lastName: 'Moore',
        role: 'billing_staff',
        phone: '(555) 100-2005',
        department: 'Billing',
      },
    ];

    // Seed directly via repository to bypass subscription limit check
    // (dev seeding happens before the subscription may be initialized)
    for (const u of devUsers) {
      const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
      const user = this.userRepository.create({
        id: uuidv4(),
        tenantId: DEV_TENANT_ID,
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        phone: u.phone,
        department: u.department,
        mfaEnabled: false,
        mfaSecret: null,
        isActive: true,
      });
      await this.userRepository.save(user);
    }

    this.logger.log(`Seeded ${devUsers.length} dev users for tenant ${DEV_TENANT_ID}`);
  }

  // ─── Sanitization ─────────────────────────────────────────────────

  sanitize(user: User): Omit<User, 'passwordHash' | 'mfaSecret'> {
    const { passwordHash: _, mfaSecret: __, ...rest } = user;
    void _;
    void __;
    return rest;
  }
}
