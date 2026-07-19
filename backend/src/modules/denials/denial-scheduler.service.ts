import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * Schedules the daily denial SLA deadline check via Bull queue.
 * Runs at 7:00 AM every day and scans for denials with approaching
 * filing deadlines, creating notifications so staff can prioritize
 * appeals before deadlines expire.
 *
 * Pattern follows the existing SubscriptionSchedulerService convention.
 */
@Injectable()
export class DenialSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DenialSchedulerService.name);

  constructor(
    @InjectQueue('denials')
    private readonly denialsQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing denial SLA deadline scheduler...');

    try {
      // Remove existing repeatable job to avoid duplicates
      const existingJobs = await this.denialsQueue.getRepeatableJobs();
      const existingJob = existingJobs.find((j) => j.name === 'daily-deadline-check');

      if (existingJob) {
        this.logger.log(`Removing existing scheduled job: ${existingJob.id}`);
        await this.denialsQueue.removeRepeatableByKey(existingJob.key);
      }

      // Schedule daily at 7:00 AM
      await this.denialsQueue.add(
        'daily-deadline-check',
        {},
        {
          repeat: { cron: '0 7 * * *' },
          jobId: 'denial-daily-deadline-check',
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      this.logger.log('Denial SLA deadline scheduler initialized — runs daily at 7:00 AM');
    } catch (error) {
      this.logger.error('Failed to initialize denial scheduler:', error);
      // Don't throw — the app should still start even if Redis is unavailable
    }
  }

  /**
   * Manually trigger the daily deadline check (for testing or admin override).
   */
  async triggerDeadlineCheck(): Promise<{ jobId: string; message: string }> {
    this.logger.log('Manually triggering denial deadline check');

    const job = await this.denialsQueue.add('daily-deadline-check', {}, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return {
      jobId: job.id.toString(),
      message: 'Denial deadline check queued successfully',
    };
  }
}
