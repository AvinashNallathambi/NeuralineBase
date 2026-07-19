import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { SubscriptionNotificationService } from './subscription-notification.service';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Bull queue processor for subscription jobs.
 * Handles the daily notification check and mock billing simulation jobs.
 */
@Processor('subscriptions')
export class SubscriptionProcessor {
  private readonly logger = new Logger(SubscriptionProcessor.name);

  constructor(
    private readonly notificationService: SubscriptionNotificationService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Process('daily-notification-check')
  async handleDailyCheck(job: Job) {
    this.logger.log(`Processing daily subscription check (job ${job.id})`);

    try {
      // Run mock billing simulation before notifications so status is current
      await this.subscriptionsService.processMockBillingSimulation();
      await this.notificationService.runDailyCheck();
      this.logger.log('Daily subscription check completed successfully');
    } catch (error) {
      this.logger.error('Daily subscription check failed:', error);
      throw error; // Let Bull retry with exponential backoff
    }
  }
}
