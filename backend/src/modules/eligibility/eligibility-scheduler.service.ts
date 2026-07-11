import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class EligibilitySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(EligibilitySchedulerService.name);

  constructor(
    @InjectQueue('eligibility')
    private readonly eligibilityQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing eligibility verification scheduler...');
    
    try {
      // Remove any existing repeatable jobs with the same name to avoid duplicates
      const existingJobs = await this.eligibilityQueue.getRepeatableJobs();
      const existingScheduledJob = existingJobs.find(job => job.name === 'scheduled-verification');
      
      if (existingScheduledJob) {
        this.logger.log(`Removing existing scheduled job: ${existingScheduledJob.id}`);
        await this.eligibilityQueue.removeRepeatableByKey(existingScheduledJob.key);
      }

      // Add repeatable job for scheduled verification
      await this.eligibilityQueue.add(
        'scheduled-verification',
        { tenantId: 'default-tenant' }, // For dev; multi-tenant can be expanded later
        {
          repeat: { cron: '0 6 * * *' }, // Every day at 6 AM
          jobId: 'eligibility-scheduled-verification', // Unique job ID to prevent duplicates
          attempts: 3, // Retry up to 3 times on failure
          backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5 seconds delay
          },
        },
      );

      this.logger.log('Eligibility verification scheduler initialized successfully');
      this.logger.log('Scheduled verification will run daily at 6:00 AM');
    } catch (error) {
      this.logger.error('Failed to initialize eligibility verification scheduler:', error);
      throw error;
    }
  }

  /**
   * Manually trigger a scheduled verification job
   */
  async triggerScheduledVerification(tenantId: string = 'default-tenant') {
    this.logger.log(`Manually triggering eligibility verification for tenant: ${tenantId}`);
    
    try {
      const job = await this.eligibilityQueue.add(
        'scheduled-verification',
        { tenantId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      this.logger.log(`Manual verification job queued with ID: ${job.id}`);
      return {
        jobId: job.id,
        tenantId,
        message: 'Eligibility verification job queued successfully',
      };
    } catch (error) {
      this.logger.error('Failed to trigger manual eligibility verification:', error);
      throw error;
    }
  }

  /**
   * Get the status of repeatable jobs
   */
  async getRepeatableJobs() {
    try {
      const jobs = await this.eligibilityQueue.getRepeatableJobs();
      return jobs.map(job => ({
        id: job.id,
        name: job.name,
        cron: job.cron,
        next: job.next,
      }));
    } catch (error) {
      this.logger.error('Failed to get repeatable jobs:', error);
      throw error;
    }
  }

  /**
   * Remove the scheduled verification job
   */
  async removeScheduledJob() {
    try {
      const jobs = await this.eligibilityQueue.getRepeatableJobs();
      const scheduledJob = jobs.find(job => job.name === 'scheduled-verification');
      
      if (scheduledJob) {
        await this.eligibilityQueue.removeRepeatableByKey(scheduledJob.key);
        this.logger.log(`Removed scheduled job: ${scheduledJob.id}`);
        return { success: true, message: 'Scheduled verification job removed' };
      }
      
      return { success: false, message: 'No scheduled verification job found' };
    } catch (error) {
      this.logger.error('Failed to remove scheduled job:', error);
      throw error;
    }
  }
}