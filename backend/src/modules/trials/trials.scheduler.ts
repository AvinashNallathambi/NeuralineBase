import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * Schedules the daily expired trial cleanup job.
 * Runs at 9:00 AM every day to:
 *   - Find disabled accounts whose 30-day retention window has expired
 *   - Permanently purge their clinical data
 *   - Send final deletion confirmation emails
 *
 * Follows the existing SubscriptionSchedulerService Bull convention.
 */
@Injectable()
export class TrialsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TrialsSchedulerService.name);

  constructor(
    @InjectQueue('trials')
    private readonly trialsQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing trial cleanup scheduler...');

    try {
      const existingJobs = await this.trialsQueue.getRepeatableJobs();
      const existingJob = existingJobs.find((j) => j.name === 'cleanup-expired-trials');

      if (existingJob) {
        this.logger.log(`Removing existing scheduled job: ${existingJob.id}`);
        await this.trialsQueue.removeRepeatableByKey(existingJob.key);
      }

      await this.trialsQueue.add(
        'cleanup-expired-trials',
        {},
        {
          repeat: { cron: '0 9 * * *' },
          jobId: 'trial-daily-cleanup',
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      this.logger.log('Trial cleanup scheduler initialized — runs daily at 9:00 AM');
    } catch (error) {
      this.logger.error('Failed to initialize trial cleanup scheduler:', error);
    }
  }

  /**
   * Manually trigger the cleanup (for testing or admin override).
   */
  async triggerCleanup(): Promise<{ jobId: string; message: string }> {
    this.logger.log('Manually triggering trial cleanup');

    const job = await this.trialsQueue.add('cleanup-expired-trials', {}, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return {
      jobId: job.id.toString(),
      message: 'Trial cleanup queued successfully',
    };
  }
}
