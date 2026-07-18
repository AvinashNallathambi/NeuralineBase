import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { InsuranceCardScanService } from './insurance-card-scan.service';
import { CobService } from './cob.service';
import { CoverageGapDetectorService } from './coverage-gap-detector.service';
import { SecondaryClaimService } from './secondary-claim.service';
import { EncounterClaim } from './entities/encounter-claim.entity';
import { ClaimLineItem } from './entities/claim-line-item.entity';
import { Invoice } from './entities/invoice.entity';
import { InsurancePayer } from './entities/insurance-payer.entity';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { InsuranceVerification } from '../eligibility/entities/insurance-verification.entity';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EncounterClaim,
      ClaimLineItem,
      Invoice,
      InsurancePayer,
      PatientInsurance,
      Appointment,
      InsuranceVerification,
    ]),
    AiModule,
    NotificationsModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, InsuranceCardScanService, CobService, CoverageGapDetectorService, SecondaryClaimService],
  exports: [BillingService, InsuranceCardScanService, CobService, CoverageGapDetectorService, SecondaryClaimService],
})
export class BillingModule {}
