import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './entities/integration.entity';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

export interface IntegrationDefinition {
  key: string;
  name: string;
  description: string;
  provider: string;
  icon: string;
  enabled: boolean;
}

export const DEFAULT_INTEGRATIONS: IntegrationDefinition[] = [
  {
    key: 'rxnorm',
    name: 'RxNorm Medication Database',
    description: 'Search FDA-approved medications and strengths via NIH RxNorm.',
    provider: 'NIH RxNorm',
    icon: '💊',
    enabled: false,
  },
  {
    key: 'pharmacy_network',
    name: 'Pharmacy Network',
    description: 'E-prescribing pharmacy directory (Surescripts-style).',
    provider: 'Surescripts',
    icon: '🏥',
    enabled: false,
  },
  {
    key: 'ai_prescribing',
    name: 'AI Prescribing Assistant',
    description: 'LLM-powered drug interaction, allergy, and contraindication review.',
    provider: 'Neuraline AI (Ollama)',
    icon: '🤖',
    enabled: true,
  },
  {
    key: 'voice_prescribing',
    name: 'Voice-to-Prescription',
    description: 'Transcribe provider dictation into structured prescription fields.',
    provider: 'Neuraline AI (Whisper + Ollama)',
    icon: '🎤',
    enabled: true,
  },
  {
    key: 'epcs',
    name: 'Electronic Prescribing of Controlled Substances',
    description: 'DEA-compliant EPCS for Schedule II-V medications.',
    provider: 'Surescripts EPCS',
    icon: '🔒',
    enabled: false,
  },
  {
    key: 'pdmp',
    name: 'Prescription Drug Monitoring Program',
    description: 'Query state PDMP before prescribing controlled substances.',
    provider: 'State PDMP',
    icon: '🔍',
    enabled: false,
  },
  {
    key: 'formulary',
    name: 'Real-Time Formulary',
    description: 'Patient-specific insurance formulary and copay information.',
    provider: 'Surescripts',
    icon: '📋',
    enabled: false,
  },
  {
    key: 'e_prior_auth',
    name: 'Electronic Prior Authorization',
    description: 'Automated prior authorization submission within the prescribing workflow.',
    provider: 'Surescripts',
    icon: '📄',
    enabled: false,
  },
  {
    key: 'medication_history',
    name: 'Medication History Import',
    description: 'Import patient medication history from PBMs and health exchanges.',
    provider: 'Surescripts',
    icon: '📜',
    enabled: false,
  },
  {
    key: 'lab_systems',
    name: 'Lab Systems',
    description: 'Connect with Quest Diagnostics and LabCorp for automated result delivery.',
    provider: 'Quest Diagnostics',
    icon: '🧪',
    enabled: true,
  },
  {
    key: 'insurance_clearinghouse',
    name: 'Insurance Clearinghouse',
    description: 'Real-time eligibility verification and claims submission.',
    provider: 'Availity',
    icon: '🏦',
    enabled: false,
  },
  {
    key: 'ehr_interoperability',
    name: 'EHR Interoperability',
    description: 'HL7 FHIR integration for health information exchange.',
    provider: 'FHIR R4',
    icon: '🔗',
    enabled: false,
  },
];

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Seed default integrations for the dev tenant so the UI always has rows.
    await this.ensureDefaults('00000000-0000-0000-0000-000000000000');
  }

  /**
   * Ensure default integration rows exist for a tenant.
   */
  async ensureDefaults(tenantId: string): Promise<void> {
    for (const def of DEFAULT_INTEGRATIONS) {
      const existing = await this.integrationRepository.findOne({
        where: { tenantId, key: def.key },
        withDeleted: true,
      });
      if (!existing) {
        const created = this.integrationRepository.create({
          ...def,
          tenantId,
          config: {},
        });
        await this.integrationRepository.save(created);
        this.logger.log(`Created default integration ${def.key} for tenant ${tenantId}`);
      }
    }
  }

  async findAll(tenantId: string): Promise<Integration[]> {
    await this.ensureDefaults(tenantId);
    return this.integrationRepository.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
  }

  async findOne(tenantId: string, key: string): Promise<Integration> {
    await this.ensureDefaults(tenantId);
    const integration = await this.integrationRepository.findOne({
      where: { tenantId, key },
    });
    if (!integration) {
      throw new NotFoundException(`Integration "${key}" not found`);
    }
    return integration;
  }

  async update(
    tenantId: string,
    key: string,
    dto: UpdateIntegrationDto,
  ): Promise<Integration> {
    const integration = await this.findOne(tenantId, key);

    if (typeof dto.enabled === 'boolean') {
      integration.enabled = dto.enabled;
    }
    if (dto.provider !== undefined) {
      integration.provider = dto.provider;
    }
    if (dto.config !== undefined) {
      integration.config = dto.config;
    }

    const saved = await this.integrationRepository.save(integration);
    this.logger.log(`Integration ${key} updated for tenant ${tenantId}: enabled=${saved.enabled}`);
    return saved;
  }

  async isEnabled(tenantId: string, key: string): Promise<boolean> {
    try {
      const integration = await this.findOne(tenantId, key);
      return integration.enabled;
    } catch {
      return false;
    }
  }
}
