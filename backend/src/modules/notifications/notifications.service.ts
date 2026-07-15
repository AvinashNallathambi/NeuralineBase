import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
  NotificationPriority,
} from './entities/notification.entity';
import {
  EmailProvider,
  EMAIL_PROVIDER,
  SendEmailRequest,
} from './providers/email-provider.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @Inject(EMAIL_PROVIDER)
    private emailProvider: EmailProvider,
  ) {}

  /**
   * Create an in-app notification and optionally send an email.
   */
  async notify(params: {
    tenantId: string;
    userId?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    actionUrl?: string | null;
    actionLabel?: string | null;
    sendEmail?: boolean;
    emailTo?: string;
    emailToName?: string;
    emailHtmlBody?: string;
    emailTextBody?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Notification> {
    const notification = this.notificationRepository.create({
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority ?? NotificationPriority.MEDIUM,
      actionUrl: params.actionUrl ?? null,
      actionLabel: params.actionLabel ?? null,
      metadata: params.metadata ?? {},
    });
    const saved = await this.notificationRepository.save(notification);

    // Send email if requested
    if (params.sendEmail && params.emailTo) {
      try {
        const emailReq: SendEmailRequest = {
          to: params.emailTo,
          toName: params.emailToName,
          subject: params.title,
          htmlBody:
            params.emailHtmlBody ??
            this.defaultEmailHtml(params.title, params.message, params.actionUrl, params.actionLabel),
          textBody: params.emailTextBody ?? params.message,
          metadata: params.metadata,
        };
        const result = await this.emailProvider.send(emailReq);

        saved.emailSent = result.status === 'sent';
        saved.emailSentAt = result.status === 'sent' ? new Date() : null;
        await this.notificationRepository.save(saved);

        if (result.status === 'sent') {
          this.logger.log(`Email sent for notification ${saved.id} via ${this.emailProvider.name}`);
        } else {
          this.logger.warn(`Email failed for notification ${saved.id}: ${result.error}`);
        }
      } catch (err) {
        this.logger.error(`Email send error for notification ${saved.id}: ${(err as Error).message}`);
      }
    }

    return saved;
  }

  /**
   * Get notifications for a tenant (optionally filtered by user).
   */
  async getNotifications(
    tenantId: string,
    options?: {
      userId?: string;
      unreadOnly?: boolean;
      limit?: number;
    },
  ): Promise<Notification[]> {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.tenant_id = :tenantId', { tenantId })
      .orderBy('n.created_at', 'DESC')
      .limit(options?.limit ?? 50);

    if (options?.userId) {
      qb.andWhere('(n.user_id = :userId OR n.user_id IS NULL)', { userId: options.userId });
    }
    if (options?.unreadOnly) {
      qb.andWhere('n.is_read = false');
    }

    return qb.getMany();
  }

  /**
   * Get unread count for a tenant.
   */
  async getUnreadCount(tenantId: string, userId?: string): Promise<number> {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.tenant_id = :tenantId', { tenantId })
      .andWhere('n.is_read = false');

    if (userId) {
      qb.andWhere('(n.user_id = :userId OR n.user_id IS NULL)', { userId });
    }

    return qb.getCount();
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(id: string): Promise<void> {
    await this.notificationRepository.update(id, {
      isRead: true,
      readAt: new Date(),
    });
  }

  /**
   * Mark all notifications as read for a tenant.
   */
  async markAllAsRead(tenantId: string, userId?: string): Promise<void> {
    const qb = this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('is_read = false');

    if (userId) {
      qb.andWhere('(user_id = :userId OR user_id IS NULL)', { userId });
    }

    await qb.execute();
  }

  /**
   * Check if a notification of a specific type was already sent recently
   * (idempotency check to prevent duplicate notifications).
   */
  async wasRecentlyNotified(
    tenantId: string,
    type: NotificationType,
    withinHours: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const count = await this.notificationRepository.count({
      where: { tenantId, type },
    });
    if (count === 0) return false;

    // Check if any was created after the cutoff
    const recent = await this.notificationRepository.findOne({
      where: { tenantId, type },
      order: { createdAt: 'DESC' },
    });
    return recent ? recent.createdAt > since : false;
  }

  private defaultEmailHtml(
    title: string,
    message: string,
    actionUrl?: string | null,
    actionLabel?: string | null,
  ): string {
    const buttonHtml =
      actionUrl && actionLabel
        ? `<a href="${actionUrl}" style="display:inline-block;background:#0D7C8A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">${actionLabel}</a>`
        : '';

    return `<!DOCTYPE html>
<html>
<body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f7fa;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#0D7C8A;font-size:24px;margin:0;">Neuraline Health</h1>
    </div>
    <h2 style="color:#1a2b3c;font-size:20px;margin-bottom:16px;">${title}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;">${message}</p>
    ${buttonHtml}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
    <p style="color:#94a3b8;font-size:12px;text-align:center;">
      This is an automated message from Neuraline Health.<br>
      © 2026 Neuraline Health Technologies.
    </p>
  </div>
</body>
</html>`;
  }
}
