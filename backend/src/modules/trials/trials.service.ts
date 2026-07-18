import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { TrialRequest, TrialRequestStatus, TrialPlanType } from './entities/trial-request.entity';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { TenantWipeService } from '../../common/services/tenant-wipe.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationPriority } from '../notifications/entities/notification.entity';

export interface CreateTrialRequestDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  practiceName: string;
  planType: TrialPlanType;
  notes?: string;
}

export interface ApproveTrialRequestDto {
  trialDays?: number;
  notes?: string;
}

@Injectable()
export class TrialsService {
  private readonly logger = new Logger(TrialsService.name);

  constructor(
    @InjectRepository(TrialRequest)
    private readonly trialRequestRepository: Repository<TrialRequest>,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tenantWipeService: TenantWipeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Public: submit a demo / trial request from the marketing website.
   */
  async createRequest(dto: CreateTrialRequestDto): Promise<TrialRequest> {
    const existing = await this.trialRequestRepository.findOne({
      where: { email: dto.email },
    });
    if (existing && existing.status !== TrialRequestStatus.REJECTED) {
      throw new BadRequestException('A request with this email is already pending or active');
    }

    const request = this.trialRequestRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ?? null,
      practiceName: dto.practiceName,
      planType: dto.planType,
      notes: dto.notes ?? null,
      status: TrialRequestStatus.PENDING,
    });

    const saved = await this.trialRequestRepository.save(request);
    this.logger.log(`Trial request created: ${saved.id} (${saved.email})`);
    return saved;
  }

  /**
   * Admin: list all trial requests, optionally filtered by status.
   */
  async findAll(status?: TrialRequestStatus): Promise<TrialRequest[]> {
    const where = status ? { status } : {};
    return this.trialRequestRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Admin: get a single trial request.
   */
  async findOne(id: string): Promise<TrialRequest> {
    const request = await this.trialRequestRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException(`Trial request "${id}" not found`);
    return request;
  }

  /**
   * Admin: approve a pending request.
   * Creates the tenant admin user + subscription and emails credentials.
   */
  async approve(id: string, dto?: ApproveTrialRequestDto): Promise<{ request: TrialRequest; password: string }> {
    const request = await this.findOne(id);

    if (request.status !== TrialRequestStatus.PENDING && request.status !== TrialRequestStatus.REJECTED) {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    const tenantId = uuidv4();
    const tempPassword = this.generatePassword();

    const adminUser = await this.usersService.create(tenantId, {
      email: request.email,
      password: tempPassword,
      firstName: request.firstName,
      lastName: request.lastName,
      role: 'tenant_admin',
      phone: request.phone ?? undefined,
    });

    const trialDays = dto?.trialDays ?? (request.planType === TrialPlanType.ENTERPRISE ? 30 : 14);

    const subscription = await this.subscriptionsService.createSubscription({
      tenantId,
      tenantName: request.practiceName,
      tenantEmail: request.email,
      planTier: request.planType,
      trialDays,
    });

    request.tenantId = tenantId;
    request.adminUserId = adminUser.id;
    request.status = TrialRequestStatus.ACTIVE;
    request.trialEndsAt = subscription.trialEndsAt;
    request.notes = dto?.notes ?? request.notes;

    const saved = await this.trialRequestRepository.save(request);
    this.logger.log(`Trial request approved: ${saved.id} tenant=${tenantId}`);

    await this.sendWelcomeEmail(saved, tempPassword);

    return { request: saved, password: tempPassword };
  }

  /**
   * Admin: reject a pending request.
   */
  async reject(id: string, notes?: string): Promise<TrialRequest> {
    const request = await this.findOne(id);
    if (request.status !== TrialRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot reject request with status ${request.status}`);
    }

    request.status = TrialRequestStatus.REJECTED;
    request.notes = notes ?? request.notes;
    const saved = await this.trialRequestRepository.save(request);
    this.logger.log(`Trial request rejected: ${saved.id}`);
    return saved;
  }

  /**
   * Admin: disable an active / converted account.
   */
  async disable(id: string, notes?: string): Promise<TrialRequest> {
    const request = await this.findOne(id);
    if (
      request.status !== TrialRequestStatus.ACTIVE &&
      request.status !== TrialRequestStatus.CONVERTED &&
      request.status !== TrialRequestStatus.EXPIRED
    ) {
      throw new BadRequestException(`Cannot disable request with status ${request.status}`);
    }

    if (request.tenantId) {
      // Deactivate all tenant users
      const users = await this.usersService.findAll(request.tenantId);
      for (const user of users) {
        if (user.isActive) {
          await this.usersService.update(request.tenantId, user.id, { isActive: false });
        }
      }
    }

    request.status = TrialRequestStatus.DISABLED;
    request.disabledAt = new Date();
    request.notes = notes ?? request.notes;

    const saved = await this.trialRequestRepository.save(request);
    this.logger.log(`Trial account disabled: ${saved.id}`);

    await this.notificationsService.notify({
      tenantId: saved.tenantId ?? uuidv4(),
      type: NotificationType.ACCOUNT_SUSPENDED,
      title: 'Your Neuraline account has been suspended',
      message: `Your account for ${saved.practiceName} has been disabled. Contact support to retain access.`,
      priority: NotificationPriority.HIGH,
      sendEmail: true,
      emailTo: saved.email,
      emailToName: `${saved.firstName} ${saved.lastName}`,
      metadata: { trialRequestId: saved.id },
    });

    return saved;
  }

  /**
   * Admin or customer: convert an active trial to paid, keeping existing data.
   */
  async convertToPaid(id: string): Promise<TrialRequest> {
    const request = await this.findOne(id);
    if (request.status !== TrialRequestStatus.ACTIVE && request.status !== TrialRequestStatus.EXPIRED) {
      throw new BadRequestException(`Cannot convert request with status ${request.status}`);
    }

    if (!request.tenantId) {
      throw new BadRequestException('Request has no associated tenant');
    }

    const subscription = await this.subscriptionsService.getSubscription(request.tenantId);
    subscription.status = SubscriptionStatus.ACTIVE;
    await this.subscriptionsService.updateSubscription(subscription);

    request.status = TrialRequestStatus.CONVERTED;
    request.convertedAt = new Date();

    const saved = await this.trialRequestRepository.save(request);
    this.logger.log(`Trial converted to paid: ${saved.id}`);

    await this.notificationsService.notify({
      tenantId: saved.tenantId!,
      type: NotificationType.PAYMENT_SUCCEEDED,
      title: 'Welcome to Neuraline',
      message: 'Your subscription is now active. Thank you for joining.',
      priority: NotificationPriority.MEDIUM,
      sendEmail: true,
      emailTo: saved.email,
      emailToName: `${saved.firstName} ${saved.lastName}`,
      metadata: { trialRequestId: saved.id },
    });

    return saved;
  }

  /**
   * Admin or customer: purchase after trial but start fresh.
   * Wipes clinical data and converts the subscription to active.
   */
  async purchaseAndWipe(id: string): Promise<TrialRequest> {
    const request = await this.findOne(id);
    if (request.status !== TrialRequestStatus.ACTIVE && request.status !== TrialRequestStatus.EXPIRED) {
      throw new BadRequestException(`Cannot wipe/convert request with status ${request.status}`);
    }

    if (!request.tenantId) {
      throw new BadRequestException('Request has no associated tenant');
    }

    await this.tenantWipeService.wipeClinicalData(request.tenantId);

    const subscription = await this.subscriptionsService.getSubscription(request.tenantId);
    subscription.status = SubscriptionStatus.ACTIVE;
    await this.subscriptionsService.updateSubscription(subscription);

    request.status = TrialRequestStatus.WIPED;
    request.wipedAt = new Date();

    const saved = await this.trialRequestRepository.save(request);
    this.logger.log(`Trial wiped and converted: ${saved.id}`);

    await this.notificationsService.notify({
      tenantId: saved.tenantId!,
      type: NotificationType.PAYMENT_SUCCEEDED,
      title: 'Your Neuraline subscription is active',
      message: 'Your previous trial data has been cleared and your paid subscription has started.',
      priority: NotificationPriority.MEDIUM,
      sendEmail: true,
      emailTo: saved.email,
      emailToName: `${saved.firstName} ${saved.lastName}`,
      metadata: { trialRequestId: saved.id },
    });

    return saved;
  }

  /**
   * Cron: disable any active trial whose trial_ends_at has passed.
   */
  async disableExpiredActiveTrials(): Promise<number> {
    const now = new Date();
    const expired = await this.trialRequestRepository.find({
      where: {
        status: TrialRequestStatus.ACTIVE,
        trialEndsAt: LessThan(now),
      },
    });

    let disabled = 0;
    for (const request of expired) {
      if (request.tenantId) {
        const users = await this.usersService.findAll(request.tenantId);
        for (const user of users) {
          if (user.isActive) {
            await this.usersService.update(request.tenantId, user.id, { isActive: false });
          }
        }
      }

      request.status = TrialRequestStatus.DISABLED;
      request.disabledAt = now;
      await this.trialRequestRepository.save(request);

      await this.notificationsService.notify({
        tenantId: request.tenantId ?? uuidv4(),
        type: NotificationType.TRIAL_EXPIRED,
        title: 'Your Neuraline trial has expired',
        message: `Your ${request.planType} trial for ${request.practiceName} has ended. Your account is now disabled. Data will be retained for 30 days, after which it will be permanently deleted. Contact support to purchase and retain your data.`,
        priority: NotificationPriority.HIGH,
        sendEmail: true,
        emailTo: request.email,
        emailToName: `${request.firstName} ${request.lastName}`,
        metadata: { trialRequestId: request.id },
      });

      disabled++;
      this.logger.log(`Expired active trial disabled: ${request.id}`);
    }

    return disabled;
  }

  /**
   * Cron: find all disabled accounts whose 30-day retention window has passed
   * and hard-delete their clinical data.
   *
   * Two-stage lifecycle:
   *   1. After 30 days disabled: send a final 24-hour deletion warning.
   *   2. After 31 days disabled (24h after warning): permanently purge data.
   */
  async processExpiredDisabledAccounts(): Promise<{ warned: number; purged: number }> {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(now - 30 * day);
    const thirtyOneDaysAgo = new Date(now - 31 * day);

    // Stage 1: send final 24-hour deletion warning
    const warnCandidates = await this.trialRequestRepository.find({
      where: {
        status: TrialRequestStatus.DISABLED,
        disabledAt: LessThan(thirtyDaysAgo),
        deletionWarningSentAt: IsNull(),
      },
    });

    let warned = 0;
    for (const request of warnCandidates) {
      request.deletionWarningSentAt = new Date();
      await this.trialRequestRepository.save(request);

      await this.notificationsService.notify({
        tenantId: request.tenantId ?? uuidv4(),
        type: NotificationType.GENERAL,
        title: 'Your trial data is scheduled for permanent deletion within 24 hours',
        message: `Your trial data for ${request.practiceName} will be permanently deleted within 24 hours in accordance with our retention policy. Contact support immediately to purchase and retain access.`,
        priority: NotificationPriority.URGENT,
        sendEmail: true,
        emailTo: request.email,
        emailToName: `${request.firstName} ${request.lastName}`,
        metadata: { trialRequestId: request.id },
      });

      warned++;
      this.logger.log(`Deletion warning sent: ${request.id}`);
    }

    // Stage 2: purge disabled accounts that are at least 31 days old
    const purgeCandidates = await this.trialRequestRepository.find({
      where: {
        status: TrialRequestStatus.DISABLED,
        disabledAt: LessThan(thirtyOneDaysAgo),
      },
    });

    let purged = 0;
    for (const request of purgeCandidates) {
      if (request.tenantId) {
        await this.tenantWipeService.wipeClinicalData(request.tenantId);

        // Remove all tenant users to complete account cleanup while
        // preserving provider/audit records per TenantWipeService policy.
        const users = await this.usersService.findAll(request.tenantId);
        for (const user of users) {
          await this.usersService.remove(request.tenantId, user.id);
        }
      }

      request.status = TrialRequestStatus.EXPIRED;
      await this.trialRequestRepository.save(request);

      await this.notificationsService.notify({
        tenantId: request.tenantId ?? uuidv4(),
        type: NotificationType.GENERAL,
        title: 'Trial data permanently deleted',
        message: 'Your trial data has been permanently deleted in accordance with our retention policy.',
        priority: NotificationPriority.MEDIUM,
        sendEmail: true,
        emailTo: request.email,
        emailToName: `${request.firstName} ${request.lastName}`,
        metadata: { trialRequestId: request.id },
      });

      purged++;
      this.logger.log(`Expired disabled account purged: ${request.id}`);
    }

    return { warned, purged };
  }

  private generatePassword(): string {
    return crypto.randomBytes(12).toString('base64url').slice(0, 16) + '!Aa1';
  }

  private async sendWelcomeEmail(request: TrialRequest, password: string): Promise<void> {
    await this.notificationsService.notify({
      tenantId: request.tenantId ?? uuidv4(),
      userId: request.adminUserId,
      type: NotificationType.GENERAL,
      title: 'Your Neuraline trial is ready',
      message: `Your ${request.planType} trial has been approved. Login with ${request.email} and the temporary password provided below.`,
      priority: NotificationPriority.HIGH,
      sendEmail: true,
      emailTo: request.email,
      emailToName: `${request.firstName} ${request.lastName}`,
      emailHtmlBody: this.welcomeEmailHtml(request, password),
      emailTextBody: this.welcomeEmailText(request, password),
      metadata: { trialRequestId: request.id },
    });
  }

  private welcomeEmailHtml(request: TrialRequest, password: string): string {
    return `<!DOCTYPE html>
<html>
<body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f7fa;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;">
    <h1 style="color:#0D7C8A;font-size:24px;margin:0 0 8px;">Neuraline Health</h1>
    <h2 style="color:#1a2b3c;font-size:20px;margin-bottom:16px;">Your trial is ready</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;">Hi ${request.firstName},</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;">Your <strong>${request.planType}</strong> trial for <strong>${request.practiceName}</strong> has been approved.</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;"><strong>Email:</strong> ${request.email}</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;"><strong>Temporary password:</strong> <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">${password}</code></p>
    <p style="color:#475569;font-size:15px;line-height:1.6;">Please log in and change your password as soon as possible.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
    <p style="color:#94a3b8;font-size:12px;text-align:center;">© 2026 Neuraline Health Technologies.</p>
  </div>
</body>
</html>`;
  }

  private welcomeEmailText(request: TrialRequest, password: string): string {
    return `Neuraline Health - Your trial is ready

Hi ${request.firstName},

Your ${request.planType} trial for ${request.practiceName} has been approved.

Email: ${request.email}
Temporary password: ${password}

Please log in and change your password as soon as possible.

© 2026 Neuraline Health Technologies.`;
  }

}
