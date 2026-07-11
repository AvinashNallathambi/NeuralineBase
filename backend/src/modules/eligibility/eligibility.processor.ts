import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EligibilityService } from './eligibility.service';
import { PatientInsurance } from '../billing/entities/patient-insurance.entity';

interface ScheduledVerificationJobData {
  tenantId: string;
}

@Processor('eligibility')
export class EligibilityProcessor {
  private readonly logger = new Logger(EligibilityProcessor.name);

  constructor(
    private readonly eligibilityService: EligibilityService,
    @InjectRepository(PatientInsurance)
    private readonly patientInsuranceRepo: Repository<PatientInsurance>,
  ) {}

  @Process('scheduled-verification')
  async handleScheduledVerification(job: Job<ScheduledVerificationJobData>) {
    const { tenantId } = job.data;
    this.logger.log(`Starting scheduled eligibility verification for tenant: ${tenantId}`);

    try {
      // Query all PatientInsurance with status='active' to get unique patientIds
      const activeInsurances = await this.patientInsuranceRepo.find({
        where: { tenantId, status: 'active' },
        select: ['patientId'],
      });

      // Get unique patient IDs
      const patientIds = [...new Set(activeInsurances.map(insurance => insurance.patientId))];
      
      if (patientIds.length === 0) {
        this.logger.log(`No active insurance policies found for tenant: ${tenantId}`);
        return { processed: 0, message: 'No active insurance policies found' };
      }

      this.logger.log(`Found ${patientIds.length} patients with active insurance for verification`);

      // Call batchVerify with system actor
      const results = await this.eligibilityService.batchVerify(
        tenantId,
        patientIds,
        'system',
        'Scheduled Verification',
        'system',
      );

      this.logger.log(`Successfully processed ${results.length} eligibility verifications for tenant: ${tenantId}`);
      
      return {
        processed: results.length,
        tenantId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error during scheduled eligibility verification for tenant ${tenantId}:`, error);
      throw error;
    }
  }
}