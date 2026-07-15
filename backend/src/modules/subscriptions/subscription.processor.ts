import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { SubscriptionNotificationService } from './subscription-notification.service';

/**
 * Bull queue processor for subscription notification jobs.
 * Handles the daily notification check job.
 */
@Processor('subscriptions')
export class SubscriptionProcessor {
  private readonly logger = new Logger(SubscriptionProcessor.name);

  constructor(
    private readonly notificationService: SubscriptionNotificationService,
  ) {}

  @Process('daily-notification-check')
  async handleDailyCheck(job: Job) {
    this.logger.log(`Processing daily subscription notification check (job ${job.id})`);

    try {
      await this.notificationService.runDailyCheck();
      this.logger.log('Daily subscription notification check completed successfully');
    } catch (error) {
      this.logger.error('Daily subscription notification check failed:', error);
      throw error; // Let Bull retry with exponential backoff
    }
  }
}
