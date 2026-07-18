import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { TrialsService } from './trials.service';

/**
 * Bull queue processor for trial lifecycle jobs.
 */
@Processor('trials')
export class TrialsProcessor {
  private readonly logger = new Logger(TrialsProcessor.name);

  constructor(private readonly trialsService: TrialsService) {}

  @Process('cleanup-expired-trials')
  async handleCleanup(job: Job) {
    this.logger.log(`Processing trial cleanup (job ${job.id})`);

    try {
      const disabled = await this.trialsService.disableExpiredActiveTrials();
      const { warned, purged } = await this.trialsService.processExpiredDisabledAccounts();
      this.logger.log(`Trial cleanup completed: ${disabled} disabled, ${warned} warned, ${purged} purged`);
      return { disabled, warned, purged };
    } catch (error) {
      this.logger.error('Trial cleanup failed:', error);
      throw error;
    }
  }
}
