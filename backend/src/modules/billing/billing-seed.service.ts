import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsurancePayer } from './entities/insurance-payer.entity';

/**
 * Seeds the InsurancePayer master table with common US payers on first boot.
 *
 * Payer IDs follow the payer's standard identifier (e.g. CMS Medicare ID = 00007,
 * Availity/Stedi trading-partner IDs are stored in metadata.tradingPartnerId).
 *
 * The seed is tenant-agnostic: payers are global reference data keyed by `payerId`
 * (unique constraint). The `tenantId` column is populated with a well-known
 * sentinel UUID so that lookups remain tenant-scoped in queries but the seed
 * data is shared across tenants. Tenants can add their own payers with their
 * own tenantId.
 */
@Injectable()
export class BillingSeedService {
  private readonly logger = new Logger(BillingSeedService.name);

  // Sentinel tenant UUID for global/shared reference data.
  private static readonly SHARED_TENANT_ID = '00000000-0000-0000-0000-000000000000';

  constructor(
    @InjectRepository(InsurancePayer)
    private readonly payerRepository: Repository<InsurancePayer>,
  ) {}

  async onModuleInit() {
    await this.seedPayers();
  }

  private async seedPayers() {
    const count = await this.payerRepository.count();
    if (count > 0) {
      this.logger.log(`Insurance payers already seeded (${count}), skipping`);
      return;
    }
    this.logger.log('Seeding insurance payers...');
    const payers = this.getPayerData();
    await this.payerRepository
      .createQueryBuilder()
      .insert()
      .into(InsurancePayer)
      .values(payers as any[])
      .orIgnore()
      .execute();
    this.logger.log(`Insurance payers seeded: ${payers.length}`);
  }

  private getPayerData(): Partial<InsurancePayer>[] {
    const tenantId = BillingSeedService.SHARED_TENANT_ID;
    return [
      {
        tenantId,
        payerId: 'MEDICARE',
        name: 'Centers for Medicare & Medicaid Services (Medicare)',
        payerType: 'medicare',
        phone: '1-800-633-4227',
        website: 'https://www.medicare.gov',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'CMS-MEDICARE', ediPayerId: '00007', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'MEDICAID',
        name: 'State Medicaid Agency',
        payerType: 'medicaid',
        phone: null,
        website: 'https://www.medicaid.gov',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'MEDICAID', clearinghouse: 'stedi', note: 'State-specific; set tradingPartnerId per state' },
      },
      {
        tenantId,
        payerId: 'AETNA',
        name: 'Aetna',
        payerType: 'commercial',
        phone: '1-800-624-0756',
        website: 'https://www.aetna.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'AETNA', ediPayerId: '60054', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'BCBS',
        name: 'Blue Cross Blue Shield',
        payerType: 'commercial',
        phone: '1-800-521-2227',
        website: 'https://www.bcbs.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'BCBS', ediPayerId: '60054', clearinghouse: 'stedi', note: 'Multiple state plans; set plan-specific tradingPartnerId' },
      },
      {
        tenantId,
        payerId: 'CIGNA',
        name: 'Cigna',
        payerType: 'commercial',
        phone: '1-800-466-5215',
        website: 'https://www.cigna.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'CIGNA', ediPayerId: '62308', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'UHC',
        name: 'UnitedHealthcare',
        payerType: 'commercial',
        phone: '1-877-842-3210',
        website: 'https://www.uhc.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'UHC', ediPayerId: '87726', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'HUMANA',
        name: 'Humana',
        payerType: 'commercial',
        phone: '1-800-448-6262',
        website: 'https://www.humana.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'HUMANA', ediPayerId: '61101', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'MOLINA',
        name: 'Molina Healthcare',
        payerType: 'medicaid',
        phone: '1-888-665-4621',
        website: 'https://www.molinahealthcare.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'MOLINA', ediPayerId: '11200', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'ANTHEM',
        name: 'Anthem (Elevance Health)',
        payerType: 'commercial',
        phone: '1-833-836-7533',
        website: 'https://www.anthem.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'ANTHEM', ediPayerId: '60054', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'KAISER',
        name: 'Kaiser Permanente',
        payerType: 'commercial',
        phone: '1-800-390-3507',
        website: 'https://www.kaiserpermanente.org',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'KAISER', ediPayerId: '03010', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'TRICARE',
        name: 'TRICARE (Health Net Federal Services)',
        payerType: 'military',
        phone: '1-877-874-2273',
        website: 'https://www.tricare-west.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'TRICARE', ediPayerId: '30597', clearinghouse: 'stedi' },
      },
      {
        tenantId,
        payerId: 'AETNA_BETTER_HEALTH',
        name: 'Aetna Better Health (Medicaid Managed Care)',
        payerType: 'medicaid',
        phone: '1-800-822-2444',
        website: 'https://www.aetnabetterhealth.com',
        electronicClaimUrl: null,
        status: 'active',
        metadata: { tradingPartnerId: 'AETNA_BH', clearinghouse: 'stedi' },
      },
    ];
  }
}
