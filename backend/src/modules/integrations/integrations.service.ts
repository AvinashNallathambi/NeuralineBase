import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Integration, IntegrationStatus, IntegrationCategory } from './entities/integration.entity';
import { IntegrationAuditLog } from './entities/integration-audit-log.entity';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { INTEGRATION_CONFIG_SCHEMAS, splitConfigFields, IntegrationConfigSchema } from './providers/config-schemas';
import { CalendarProvider } from './providers/calendar-provider.interface';
import { SmsProvider } from './providers/sms-provider.interface';
import { VideoProvider } from './providers/video-provider.interface';
import { MockCalendarProvider } from './providers/mock-calendar.provider';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { OutlookCalendarProvider } from './providers/outlook-calendar.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { TwilioSmsProvider } from './providers/twilio-sms.provider';
import { RingCentralProvider } from './providers/ringcentral.provider';
import { MockVideoProvider } from './providers/mock-video.provider';
import { ZoomProvider } from './providers/zoom.provider';
import { MsTeamsProvider } from './providers/ms-teams.provider';
import { GoogleMeetProvider } from './providers/google-meet.provider';

export interface IntegrationDefinition {
  key: string;
  name: string;
  description: string;
  provider: string;
  icon: string;
  enabled: boolean;
  category: IntegrationCategory;
  requiresOAuth: boolean;
  configurable: boolean;
}

export const DEFAULT_INTEGRATIONS: IntegrationDefinition[] = [
  // ── Clinical ──────────────────────────────────────────────────────────────
  {
    key: 'rxnorm',
    name: 'RxNorm Medication Database',
    description: 'Search FDA-approved medications and strengths via NIH RxNorm.',
    provider: 'NIH RxNorm',
    icon: '💊',
    enabled: false,
    category: 'clinical',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'ai_prescribing',
    name: 'AI Prescribing Assistant',
    description: 'LLM-powered drug interaction, allergy, and contraindication review.',
    provider: 'Neuraline AI (Ollama)',
    icon: '🤖',
    enabled: true,
    category: 'ai',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'voice_prescribing',
    name: 'Voice-to-Prescription',
    description: 'Transcribe provider dictation into structured prescription fields.',
    provider: 'Neuraline AI (Whisper + Ollama)',
    icon: '🎤',
    enabled: true,
    category: 'ai',
    requiresOAuth: false,
    configurable: true,
  },

  // ── Calendar ──────────────────────────────────────────────────────────────
  {
    key: 'google_calendar',
    name: 'Google Calendar',
    description: 'Two-way appointment sync with Google Calendar. Auto-create Google Meet links.',
    provider: 'Google',
    icon: '📅',
    enabled: false,
    category: 'calendar',
    requiresOAuth: true,
    configurable: true,
  },
  {
    key: 'outlook_calendar',
    name: 'Outlook / Microsoft 365 Calendar',
    description: 'Two-way appointment sync with Outlook via Microsoft Graph API.',
    provider: 'Microsoft',
    icon: '📆',
    enabled: false,
    category: 'calendar',
    requiresOAuth: true,
    configurable: true,
  },

  // ── Communication ──────────────────────────────────────────────────────────
  {
    key: 'twilio_sms',
    name: 'Twilio SMS',
    description: 'Send SMS appointment reminders, patient notifications, and enable two-way texting.',
    provider: 'Twilio',
    icon: '📱',
    enabled: false,
    category: 'communication',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'ringcentral',
    name: 'RingCentral',
    description: 'Voice calls, SMS, and fax via RingCentral.',
    provider: 'RingCentral',
    icon: '☎️',
    enabled: false,
    category: 'communication',
    requiresOAuth: true,
    configurable: true,
  },
  {
    key: 'email_notifications',
    name: 'Email Notifications',
    description: 'Email delivery via Resend, SendGrid, AWS SES, or SMTP.',
    provider: 'Resend',
    icon: '📧',
    enabled: true,
    category: 'patient_engagement',
    requiresOAuth: false,
    configurable: true,
  },

  // ── Video ───────────────────────────────────────────────────────────────────
  {
    key: 'zoom',
    name: 'Zoom',
    description: 'Create Zoom meetings for telehealth appointments.',
    provider: 'Zoom',
    icon: '🎥',
    enabled: false,
    category: 'video',
    requiresOAuth: true,
    configurable: true,
  },
  {
    key: 'ms_teams',
    name: 'Microsoft Teams',
    description: 'Create Teams meetings for telehealth via Microsoft Graph.',
    provider: 'Microsoft',
    icon: '👥',
    enabled: false,
    category: 'video',
    requiresOAuth: true,
    configurable: true,
  },
  {
    key: 'google_meet',
    name: 'Google Meet',
    description: 'Create Google Meet links for telehealth appointments.',
    provider: 'Google',
    icon: '📹',
    enabled: false,
    category: 'video',
    requiresOAuth: true,
    configurable: true,
  },

  // ── Pharmacy ─────────────────────────────────────────────────────────────────
  {
    key: 'pharmacy_network',
    name: 'Pharmacy Network',
    description: 'E-prescribing pharmacy directory (Surescripts-style).',
    provider: 'Surescripts',
    icon: '🏥',
    enabled: false,
    category: 'pharmacy',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'epcs',
    name: 'Electronic Prescribing of Controlled Substances',
    description: 'DEA-compliant EPCS for Schedule II-V medications.',
    provider: 'Surescripts EPCS',
    icon: '🔒',
    enabled: false,
    category: 'pharmacy',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'pdmp',
    name: 'Prescription Drug Monitoring Program',
    description: 'Query state PDMP before prescribing controlled substances.',
    provider: 'State PDMP',
    icon: '🔍',
    enabled: false,
    category: 'pharmacy',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'formulary',
    name: 'Real-Time Formulary',
    description: 'Patient-specific insurance formulary and copay information.',
    provider: 'Surescripts',
    icon: '📋',
    enabled: false,
    category: 'pharmacy',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'e_prior_auth',
    name: 'Electronic Prior Authorization',
    description: 'Automated prior authorization submission within the prescribing workflow.',
    provider: 'CoverMyMeds',
    icon: '📄',
    enabled: false,
    category: 'pharmacy',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'medication_history',
    name: 'Medication History Import',
    description: 'Import patient medication history from PBMs and health exchanges.',
    provider: 'Surescripts',
    icon: '📜',
    enabled: false,
    category: 'pharmacy',
    requiresOAuth: false,
    configurable: true,
  },

  // ── Lab ─────────────────────────────────────────────────────────────────────
  {
    key: 'lab_systems',
    name: 'Lab Systems',
    description: 'Connect with Quest Diagnostics and LabCorp for automated result delivery.',
    provider: 'Quest Diagnostics',
    icon: '🧪',
    enabled: true,
    category: 'lab',
    requiresOAuth: false,
    configurable: true,
  },

  // ── Billing ─────────────────────────────────────────────────────────────────
  {
    key: 'insurance_clearinghouse',
    name: 'Insurance Clearinghouse',
    description: 'Real-time eligibility verification and claims submission.',
    provider: 'Availity',
    icon: '🏦',
    enabled: false,
    category: 'billing',
    requiresOAuth: false,
    configurable: true,
  },
  {
    key: 'stripe_payments',
    name: 'Stripe Payments',
    description: 'Stripe payment processing for patient invoices and subscription billing.',
    provider: 'Stripe',
    icon: '💳',
    enabled: true,
    category: 'billing',
    requiresOAuth: false,
    configurable: true,
  },

  // ── EHR ─────────────────────────────────────────────────────────────────────
  {
    key: 'ehr_interoperability',
    name: 'EHR Interoperability',
    description: 'HL7 FHIR integration for health information exchange.',
    provider: 'FHIR R4',
    icon: '🔗',
    enabled: false,
    category: 'ehr',
    requiresOAuth: false,
    configurable: true,
  },
];

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);

  // Provider registries — maps integration key → provider instance
  private readonly calendarProviders: Map<string, CalendarProvider>;
  private readonly smsProviders: Map<string, SmsProvider>;
  private readonly videoProviders: Map<string, VideoProvider>;

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationAuditLog)
    private readonly auditLogRepository: Repository<IntegrationAuditLog>,
    private readonly configService: ConfigService,
  ) {
    // Build provider registries
    const mockCal = new MockCalendarProvider();
    const googleCal = new GoogleCalendarProvider();
    const outlookCal = new OutlookCalendarProvider();
    this.calendarProviders = new Map<string, CalendarProvider>([
      ['google_calendar', googleCal],
      ['outlook_calendar', outlookCal],
      ['mock', mockCal],
    ]);

    const mockSms = new MockSmsProvider();
    const twilioSms = new TwilioSmsProvider();
    const ringcentral = new RingCentralProvider();
    this.smsProviders = new Map<string, SmsProvider>([
      ['twilio_sms', twilioSms],
      ['ringcentral', ringcentral],
      ['mock', mockSms],
    ]);

    const mockVideo = new MockVideoProvider();
    const zoom = new ZoomProvider();
    const teams = new MsTeamsProvider();
    const meet = new GoogleMeetProvider();
    this.videoProviders = new Map<string, VideoProvider>([
      ['zoom', zoom],
      ['ms_teams', teams],
      ['google_meet', meet],
      ['mock', mockVideo],
    ]);
  }

  private getCalendarProvider(key: string): CalendarProvider {
    return this.calendarProviders.get(key) ?? this.calendarProviders.get('mock')!;
  }

  private getSmsProvider(key: string): SmsProvider {
    return this.smsProviders.get(key) ?? this.smsProviders.get('mock')!;
  }

  private getVideoProvider(key: string): VideoProvider {
    return this.videoProviders.get(key) ?? this.videoProviders.get('mock')!;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults('00000000-0000-0000-0000-000000000000');
  }

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
          credentials: {},
          status: 'disconnected' as IntegrationStatus,
        });
        await this.integrationRepository.save(created);
        this.logger.log(`Created default integration ${def.key} for tenant ${tenantId}`);
      } else {
        // Update metadata fields for existing rows (preserve enabled, config, credentials, status)
        let changed = false;
        if (existing.name !== def.name) { existing.name = def.name; changed = true; }
        if (existing.description !== def.description) { existing.description = def.description; changed = true; }
        if (existing.provider !== def.provider) { existing.provider = def.provider; changed = true; }
        if (existing.icon !== def.icon) { existing.icon = def.icon; changed = true; }
        if (existing.category !== def.category) { existing.category = def.category; changed = true; }
        if (existing.requiresOAuth !== def.requiresOAuth) { existing.requiresOAuth = def.requiresOAuth; changed = true; }
        if (existing.configurable !== def.configurable) { existing.configurable = def.configurable; changed = true; }
        if (changed) {
          await this.integrationRepository.save(existing);
        }
      }
    }
  }

  async findAll(tenantId: string): Promise<Integration[]> {
    await this.ensureDefaults(tenantId);
    const integrations = await this.integrationRepository.find({
      where: { tenantId },
      order: { category: 'ASC', name: 'ASC' },
    });
    // Never expose credentials to the frontend
    return integrations.map((i) => this.stripCredentials(i));
  }

  async findOne(tenantId: string, key: string): Promise<Integration> {
    await this.ensureDefaults(tenantId);
    const integration = await this.integrationRepository.findOne({
      where: { tenantId, key },
    });
    if (!integration) {
      throw new NotFoundException(`Integration "${key}" not found`);
    }
    // Never expose credentials
    return this.stripCredentials(integration);
  }

  private stripCredentials(integration: Integration): Integration {
    const { credentials, ...rest } = integration;
    return { ...rest, credentials: null };
  }

  async findOneWithCredentials(tenantId: string, key: string): Promise<Integration> {
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
    performedBy?: string,
  ): Promise<Integration> {
    const integration = await this.findOneWithCredentials(tenantId, key);
    const previousStatus = integration.status;

    if (typeof dto.enabled === 'boolean') {
      integration.enabled = dto.enabled;
    }
    if (dto.provider !== undefined) {
      integration.provider = dto.provider;
    }

    // Split incoming config values into visible config vs encrypted credentials
    if (dto.config !== undefined) {
      const { config, credentials } = splitConfigFields(key, dto.config);
      integration.config = { ...(integration.config || {}), ...config };
      if (Object.keys(credentials).length > 0) {
        integration.credentials = { ...(integration.credentials || {}), ...credentials };
      }
    }

    const saved = await this.integrationRepository.save(integration);
    this.logger.log(`Integration ${key} updated for tenant ${tenantId}: enabled=${saved.enabled}`);

    await this.audit(tenantId, key, 'update', performedBy, `Updated integration`, previousStatus, saved.status);

    // Never expose credentials
    return this.stripCredentials(saved);
  }

  async isEnabled(tenantId: string, key: string): Promise<boolean> {
    try {
      const integration = await this.findOne(tenantId, key);
      return integration.enabled;
    } catch {
      return false;
    }
  }

  // ── Test Connection ──────────────────────────────────────────────────────
  async testConnection(
    tenantId: string,
    key: string,
  ): Promise<{ success: boolean; message: string }> {
    const integration = await this.findOneWithCredentials(tenantId, key);
    const credentials = integration.credentials || {};
    const config = integration.config || {};

    // Merge config and credentials for provider calls (providers read from both)
    const allCreds = { ...config, ...credentials };

    try {
      let result: { success: boolean; message: string };

      const schema = INTEGRATION_CONFIG_SCHEMAS[key];
      if (!schema) {
        return { success: false, message: `No test available for integration "${key}"` };
      }

      switch (schema.category) {
        case 'calendar':
          result = await this.getCalendarProvider(key).testConnection(allCreds);
          break;
        case 'communication':
          result = await this.getSmsProvider(key).testConnection(allCreds);
          break;
        case 'video':
          result = await this.getVideoProvider(key).testConnection(allCreds);
          break;
        default:
          // For non-provider integrations, do a basic credential check
          result = this.testGenericConnection(key, allCreds);
          break;
      }

      // Update status based on result
      const previousStatus = integration.status;
      if (result.success) {
        integration.status = 'connected' as IntegrationStatus;
        integration.lastConnectedAt = new Date();
        integration.errorMessage = null;
      } else {
        integration.status = 'error' as IntegrationStatus;
        integration.errorMessage = result.message;
      }
      await this.integrationRepository.save(integration);
      await this.audit(tenantId, key, 'test_connection', undefined, result.message, previousStatus, integration.status);

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      integration.status = 'error' as IntegrationStatus;
      integration.errorMessage = msg;
      await this.integrationRepository.save(integration);
      await this.audit(tenantId, key, 'test_connection', undefined, msg, integration.status, 'error');
      return { success: false, message: msg };
    }
  }

  private testGenericConnection(key: string, creds: Record<string, unknown>): { success: boolean; message: string } {
    // For integrations without a dedicated provider, check that required fields are present
    const schema = INTEGRATION_CONFIG_SCHEMAS[key];
    if (!schema) {
      return { success: false, message: 'No schema defined' };
    }

    const requiredFields = schema.fields.filter((f) => f.required && f.isCredential);
    const missing = requiredFields.filter((f) => !creds[f.key]);

    if (missing.length > 0) {
      return {
        success: false,
        message: `Missing required fields: ${missing.map((f) => f.label).join(', ')}`,
      };
    }

    return { success: true, message: `${key} configuration looks valid` };
  }

  // ── OAuth ────────────────────────────────────────────────────────────────
  async getOAuthUrl(
    tenantId: string,
    key: string,
    redirectUri: string,
  ): Promise<{ authUrl: string }> {
    const integration = await this.findOneWithCredentials(tenantId, key);
    const credentials = integration.credentials || {};
    const config = integration.config || {};
    const allCreds = { ...config, ...credentials };

    const state = Buffer.from(JSON.stringify({ tenantId, key, redirectUri })).toString('base64url');

    const schema = INTEGRATION_CONFIG_SCHEMAS[key];
    if (!schema || !schema.requiresOAuth) {
      throw new NotFoundException(`Integration "${key}" does not use OAuth`);
    }

    let authUrl: string;
    switch (schema.category) {
      case 'calendar':
        authUrl = this.getCalendarProvider(key).getAuthUrl(redirectUri, state);
        break;
      case 'video':
        authUrl = this.getVideoProvider(key).getAuthUrl?.(redirectUri, state) ?? '';
        break;
      default:
        throw new NotFoundException(`OAuth not supported for category "${schema.category}"`);
    }

    integration.status = 'pending' as IntegrationStatus;
    await this.integrationRepository.save(integration);
    await this.audit(tenantId, key, 'oauth_initiated', undefined, 'OAuth flow started', null, 'pending');

    return { authUrl };
  }

  async handleOAuthCallback(
    tenantId: string,
    key: string,
    code: string,
    redirectUri: string,
  ): Promise<{ success: boolean; message: string }> {
    const integration = await this.findOneWithCredentials(tenantId, key);
    const credentials = integration.credentials || {};
    const config = integration.config || {};
    const allCreds = { ...config, ...credentials };

    const schema = INTEGRATION_CONFIG_SCHEMAS[key];
    if (!schema || !schema.requiresOAuth) {
      return { success: false, message: 'This integration does not use OAuth' };
    }

    try {
      let tokens: Record<string, unknown>;
      switch (schema.category) {
        case 'calendar':
          tokens = await this.getCalendarProvider(key).exchangeCode(code, redirectUri);
          break;
        case 'video':
          tokens = await this.getVideoProvider(key).exchangeCode?.(code, redirectUri) ?? {};
          break;
        default:
          return { success: false, message: 'OAuth not supported for this category' };
      }

      // Store tokens in credentials
      integration.credentials = { ...integration.credentials, ...tokens };
      integration.status = 'connected' as IntegrationStatus;
      integration.lastConnectedAt = new Date();
      integration.errorMessage = null;
      await this.integrationRepository.save(integration);
      await this.audit(tenantId, key, 'oauth_completed', undefined, 'OAuth tokens stored', 'pending', 'connected');

      return { success: true, message: `${integration.name} connected successfully` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      integration.status = 'error' as IntegrationStatus;
      integration.errorMessage = msg;
      await this.integrationRepository.save(integration);
      await this.audit(tenantId, key, 'oauth_failed', undefined, msg, 'pending', 'error');
      return { success: false, message: msg };
    }
  }

  // ── Config Schema ────────────────────────────────────────────────────────
  getConfigSchema(key: string): IntegrationConfigSchema | null {
    return INTEGRATION_CONFIG_SCHEMAS[key] ?? null;
  }

  async getAllConfigSchemas(): Promise<IntegrationConfigSchema[]> {
    return Object.values(INTEGRATION_CONFIG_SCHEMAS);
  }

  // ── Audit Log ────────────────────────────────────────────────────────────
  private async audit(
    tenantId: string,
    integrationKey: string,
    action: string,
    performedBy: string | undefined,
    detail: string | null,
    previousStatus: string | null,
    newStatus: string | null,
  ): Promise<void> {
    try {
      const log = this.auditLogRepository.create({
        tenantId,
        integrationKey,
        action,
        performedBy: performedBy ?? null,
        detail,
        previousStatus,
        newStatus,
      });
      await this.auditLogRepository.save(log);
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${err}`);
    }
  }

  async getAuditLogs(
    tenantId: string,
    integrationKey?: string,
    limit = 50,
  ): Promise<IntegrationAuditLog[]> {
    const where: Record<string, unknown> = { tenantId };
    if (integrationKey) {
      where.integrationKey = integrationKey;
    }
    return this.auditLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ── Provider Accessors (for other modules to use) ──────────────────────────
  getCalendarProviderFor(key: string): CalendarProvider {
    return this.getCalendarProvider(key);
  }

  getSmsProviderFor(key: string): SmsProvider {
    return this.getSmsProvider(key);
  }

  getVideoProviderFor(key: string): VideoProvider {
    return this.getVideoProvider(key);
  }

  async getIntegrationCredentials(tenantId: string, key: string): Promise<Record<string, unknown> | null> {
    const integration = await this.findOneWithCredentials(tenantId, key);
    if (!integration.enabled) return null;
    const config = integration.config || {};
    const credentials = integration.credentials || {};
    return { ...config, ...credentials };
  }
}
