import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * Schedules the daily subscription notification check via Bull queue.
 * Runs at 8:00 AM every day (covers trial expirations, renewal reminders,
 * dunning sequences, and win-back emails).
 *
 * Pattern follows the existing EligibilitySchedulerService convention.
 */
@Injectable()
export class SubscriptionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    @InjectQueue('subscriptions')
    private readonly subscriptionQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing subscription notification scheduler...');

    try {
      // Remove existing repeatable job to avoid duplicates
      const existingJobs = await this.subscriptionQueue.getRepeatableJobs();
      const existingJob = existingJobs.find((j) => j.name === 'daily-notification-check');

      if (existingJob) {
        this.logger.log(`Removing existing scheduled job: ${existingJob.id}`);
        await this.subscriptionQueue.removeRepeatableByKey(existingJob.key);
      }

      // Schedule daily at 8:00 AM
      await this.subscriptionQueue.add(
        'daily-notification-check',
        {},
        {
          repeat: { cron: '0 8 * * *' },
          jobId: 'subscription-daily-notifications',
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      this.logger.log('Subscription notification scheduler initialized — runs daily at 8:00 AM');
    } catch (error) {
      this.logger.error('Failed to initialize subscription scheduler:', error);
      // Don't throw — the app should still start even if Redis is unavailable
    }
  }

  /**
   * Manually trigger the daily check (for testing or admin override).
   */
  async triggerDailyCheck(): Promise<{ jobId: string; message: string }> {
    this.logger.log('Manually triggering subscription notification check');

    const job = await this.subscriptionQueue.add('daily-notification-check', {}, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return {
      jobId: job.id.toString(),
      message: 'Subscription notification check queued successfully',
    };
  }
}
