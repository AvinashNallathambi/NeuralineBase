import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingSeedService } from './billing-seed.service';
import { EncounterClaim } from './entities/encounter-claim.entity';
import { ClaimLineItem } from './entities/claim-line-item.entity';
import { Invoice } from './entities/invoice.entity';
import { InsurancePayer } from './entities/insurance-payer.entity';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { MockClaimsProvider } from './providers/mock-claims.provider';
import { StediClaimsProvider } from './providers/stedi-claims.provider';
import { CLAIMS_PROVIDER } from './providers/claims-provider.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EncounterClaim,
      ClaimLineItem,
      Invoice,
      InsurancePayer,
      PatientInsurance,
    ]),
    ConfigModule,
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingSeedService,
    {
      provide: CLAIMS_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const stediKey = configService.get<string>('STEDI_API_KEY');
        if (stediKey) {
          return new StediClaimsProvider(configService);
        }
        return new MockClaimsProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
