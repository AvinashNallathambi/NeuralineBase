import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import { DenialRecord, DenialWorklistStatus, DenialPriority } from './entities/denial-record.entity';
import {
  NotificationsService,
} from '../notifications/notifications.service';
import {
  NotificationType,
  NotificationPriority,
} from '../notifications/entities/notification.entity';

/**
 * Bull queue processor for the daily denial SLA deadline check.
 *
 * Scans all tenants for denials with approaching filing deadlines and
 * creates notifications so staff can prioritize appeals:
 *
 * - CRITICAL: ≤3 days to deadline (urgent notification per denial)
 * - APPROACHING: ≤7 days to deadline (single summary notification per tenant)
 *
 * Deduplication: each notification's metadata includes the denialId, and
 * we skip denials that already have a notification for today (checked via
 * the denial's metadata.slaNotifiedDates array).
 */
@Processor('denials')
export class DenialDeadlineProcessor {
  private readonly logger = new Logger(DenialDeadlineProcessor.name);

  constructor(
    @InjectRepository(DenialRecord)
    private readonly denialRepository: Repository<DenialRecord>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process({ name: 'daily-deadline-check', concurrency: 1 })
  async handleDeadlineCheck(job: Job): Promise<void> {
    this.logger.log('Starting daily denial SLA deadline check...');

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD for dedup

    // Critical: ≤3 days to deadline
    const criticalThreshold = new Date(now);
    criticalThreshold.setDate(criticalThreshold.getDate() + 3);

    // Approaching: ≤7 days to deadline (but >3 days, to avoid double-notify)
    const approachingThreshold = new Date(now);
    approachingThreshold.setDate(approachingThreshold.getDate() + 7);

    // Find all unresolved denials with a filing deadline within 7 days
    const denialsAtRisk = await this.denialRepository.find({
      where: {
        status: Not(DenialWorklistStatus.RESOLVED),
        filingDeadline: LessThanOrEqual(approachingThreshold),
      },
    });

    if (denialsAtRisk.length === 0) {
      this.logger.log('No denials with approaching deadlines found.');
      return;
    }

    // Group by tenant for batch notifications
    const byTenant = new Map<string, DenialRecord[]>();
    for (const d of denialsAtRisk) {
      const list = byTenant.get(d.tenantId) || [];
      list.push(d);
      byTenant.set(d.tenantId, list);
    }

    let criticalCount = 0;
    let approachingCount = 0;

    for (const [tenantId, denials] of byTenant) {
      const criticalDenials: DenialRecord[] = [];
      const approachingDenials: DenialRecord[] = [];

      for (const d of denials) {
        // Skip already-notified denials for today (dedup)
        const notifiedDates = (d.metadata?.slaNotifiedDates as string[]) || [];
        if (notifiedDates.includes(todayStr)) continue;

        if (!d.filingDeadline) continue;

        const daysLeft = Math.floor(
          (d.filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysLeft <= 3) {
          criticalDenials.push(d);
        } else if (daysLeft <= 7) {
          approachingDenials.push(d);
        }
      }

      // Send individual CRITICAL notifications for each denial ≤3 days
      for (const d of criticalDenials) {
        const daysLeft = Math.floor(
          (d.filingDeadline!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const amount = d.deniedAmount.toFixed(2);
        const payer = d.payerName || 'Unknown payer';
        const patient = d.patientName || 'Unknown patient';

        await this.notificationsService.notify({
          tenantId,
          type: NotificationType.DENIAL_DEADLINE_CRITICAL,
          title: `URGENT: Appeal deadline in ${daysLeft} day(s) — $${amount} at risk`,
          message:
            `Denial for ${patient} (${payer}) has a filing deadline of ` +
            `${d.filingDeadline!.toISOString().split('T')[0]}. ` +
            `Denied amount: $${amount}. CARC: ${d.carcCode}. ` +
            `This denial must be appealed immediately or the claim may be permanently unrecoverable.`,
          priority: NotificationPriority.URGENT,
          actionUrl: `/denials?status=new&id=${d.id}`,
          actionLabel: 'View Denial',
          metadata: {
            denialId: d.id,
            filingDeadline: d.filingDeadline,
            daysLeft,
            deniedAmount: d.deniedAmount,
          },
        });

        // Mark as notified for today
        await this.markNotified(d, todayStr);
        criticalCount++;
      }

      // Send a single summary APPROACHING notification per tenant for 4-7 day bucket
      if (approachingDenials.length > 0) {
        const totalAmount = approachingDenials.reduce((s, d) => s + d.deniedAmount, 0);
        const denialList = approachingDenials
          .map((d) => `• ${d.patientName || 'Unknown'} — ${d.payerName || 'Unknown'} — $${d.deniedAmount.toFixed(2)} — due ${d.filingDeadline!.toISOString().split('T')[0]}`)
          .join('\n');

        await this.notificationsService.notify({
          tenantId,
          type: NotificationType.DENIAL_DEADLINE_APPROACHING,
          title: `${approachingDenials.length} denial(s) with deadlines within 7 days ($${totalAmount.toFixed(2)} at risk)`,
          message:
            `The following denials have appeal deadlines within the next 4-7 days:\n\n${denialList}\n\n` +
            `Review and prioritize these appeals to avoid losing recoverable revenue.`,
          priority: NotificationPriority.HIGH,
          actionUrl: '/denials?status=new',
          actionLabel: 'Open Denial Worklist',
          metadata: {
            denialIds: approachingDenials.map((d) => d.id),
            totalAmount,
            count: approachingDenials.length,
          },
        });

        // Mark all as notified for today
        for (const d of approachingDenials) {
          await this.markNotified(d, todayStr);
        }
        approachingCount += approachingDenials.length;
      }
    }

    this.logger.log(
      `Denial SLA check complete: ${criticalCount} critical (≤3 days), ${approachingCount} approaching (4-7 days) across ${byTenant.size} tenants.`,
    );
  }

  /**
   * Record today's date in the denial's metadata to prevent duplicate
   * notifications on the same day.
   */
  private async markNotified(denial: DenialRecord, todayStr: string): Promise<void> {
    const notifiedDates = (denial.metadata?.slaNotifiedDates as string[]) || [];
    if (!notifiedDates.includes(todayStr)) {
      notifiedDates.push(todayStr);
      // Keep only the last 30 days to prevent unbounded growth
      const recent = notifiedDates.slice(-30);
      denial.metadata = {
        ...denial.metadata,
        slaNotifiedDates: recent,
      };
      await this.denialRepository.save(denial);
    }
  }
}
