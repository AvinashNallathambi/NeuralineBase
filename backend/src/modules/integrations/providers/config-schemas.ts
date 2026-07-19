// ─────────────────────────────────────────────────────────────────────────────
// Integration Config Schema — describes the configuration fields for each
// integration so the frontend can render dynamic forms.
// ─────────────────────────────────────────────────────────────────────────────

export type ConfigFieldType = 'text' | 'password' | 'textarea' | 'select' | 'boolean' | 'oauth' | 'phone' | 'url' | 'number';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string | boolean | number;
  /** Whether this field is stored in credentials (encrypted) vs config (visible) */
  isCredential?: boolean;
  /** Whether this field is shown in the config form */
  hidden?: boolean;
}

export interface IntegrationConfigSchema {
  key: string;
  category: string;
  fields: ConfigField[];
  /** Help documentation URL or text */
  helpText?: string;
  /** Whether this integration supports test-connection */
  testable: boolean;
  /** Whether this integration requires OAuth */
  requiresOAuth: boolean;
}

export const INTEGRATION_CONFIG_SCHEMAS: Record<string, IntegrationConfigSchema> = {
  // ── Calendar ──────────────────────────────────────────────────────────────
  google_calendar: {
    key: 'google_calendar',
    category: 'calendar',
    requiresOAuth: true,
    testable: true,
    helpText: 'Connect your Google Calendar for two-way appointment sync. Requires a Google Cloud project with Calendar API enabled.',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, isCredential: true, placeholder: 'xxxxx.apps.googleusercontent.com', helpText: 'From Google Cloud Console > APIs & Services > Credentials' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, isCredential: true, placeholder: 'GOCSPX-xxxxx' },
      { key: 'calendarId', label: 'Calendar ID', type: 'text', required: false, placeholder: 'primary', defaultValue: 'primary', helpText: 'Use "primary" for the user\'s primary calendar, or a specific calendar email' },
      { key: 'syncDirection', label: 'Sync Direction', type: 'select', required: false, options: [
        { label: 'Two-way', value: 'two_way' },
        { label: 'EMR → Calendar only', value: 'emr_to_calendar' },
        { label: 'Calendar → EMR only', value: 'calendar_to_emr' },
      ], defaultValue: 'two_way' },
      { key: 'autoCreateMeetLinks', label: 'Auto-create Google Meet links', type: 'boolean', defaultValue: true },
    ],
  },
  outlook_calendar: {
    key: 'outlook_calendar',
    category: 'calendar',
    requiresOAuth: true,
    testable: true,
    helpText: 'Connect your Outlook/Microsoft 365 Calendar via Microsoft Graph API. Requires Azure AD app registration.',
    fields: [
      { key: 'clientId', label: 'Application (Client) ID', type: 'text', required: true, isCredential: true, placeholder: 'Azure AD app client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, isCredential: true, placeholder: 'Azure AD client secret' },
      { key: 'tenantId', label: 'Directory (Tenant) ID', type: 'text', required: false, isCredential: true, placeholder: 'Azure AD tenant ID (or "common" for multi-tenant)' },
      { key: 'calendarId', label: 'Calendar ID', type: 'text', required: false, placeholder: 'primary', defaultValue: 'primary' },
      { key: 'syncDirection', label: 'Sync Direction', type: 'select', required: false, options: [
        { label: 'Two-way', value: 'two_way' },
        { label: 'EMR → Calendar only', value: 'emr_to_calendar' },
        { label: 'Calendar → EMR only', value: 'calendar_to_emr' },
      ], defaultValue: 'two_way' },
    ],
  },

  // ── Communication ──────────────────────────────────────────────────────────
  twilio_sms: {
    key: 'twilio_sms',
    category: 'communication',
    requiresOAuth: false,
    testable: true,
    helpText: 'Send SMS appointment reminders, patient notifications, and enable two-way texting via Twilio.',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', required: true, isCredential: true, placeholder: 'ACxxxxxxxxx' },
      { key: 'authToken', label: 'Auth Token', type: 'password', required: true, isCredential: true, placeholder: 'Twilio auth token' },
      { key: 'fromNumber', label: 'From Phone Number', type: 'phone', required: true, placeholder: '+12345678900', helpText: 'Your Twilio phone number in E.164 format' },
      { key: 'webhookUrl', label: 'Inbound Webhook URL', type: 'url', required: false, placeholder: 'https://your-domain.com/api/v1/integrations/twilio/webhook', helpText: 'URL for receiving inbound SMS replies' },
      { key: 'reminderHoursBefore', label: 'Reminder hours before appointment', type: 'number', defaultValue: 24, required: false },
      { key: 'enableTwoWay', label: 'Enable two-way texting', type: 'boolean', defaultValue: true },
    ],
  },
  ringcentral: {
    key: 'ringcentral',
    category: 'communication',
    requiresOAuth: true,
    testable: true,
    helpText: 'Voice calls, SMS, and fax via RingCentral. Requires a RingCentral app with SMS, Voice, and Fax scopes.',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, isCredential: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, isCredential: true },
      { key: 'fromNumber', label: 'From Phone Number', type: 'phone', required: true, placeholder: '+12345678900' },
      { key: 'environment', label: 'Environment', type: 'select', required: false, options: [
        { label: 'Production', value: 'production' },
        { label: 'Sandbox', value: 'sandbox' },
      ], defaultValue: 'production' },
      { key: 'enableVoice', label: 'Enable click-to-call', type: 'boolean', defaultValue: true },
      { key: 'enableFax', label: 'Enable fax', type: 'boolean', defaultValue: true },
      { key: 'enableSms', label: 'Enable SMS', type: 'boolean', defaultValue: true },
    ],
  },

  // ── Video ───────────────────────────────────────────────────────────────────
  zoom: {
    key: 'zoom',
    category: 'video',
    requiresOAuth: true,
    testable: true,
    helpText: 'Create Zoom meetings for telehealth appointments. Requires a Server-to-Server OAuth app in Zoom Marketplace.',
    fields: [
      { key: 'accountId', label: 'Account ID', type: 'text', required: true, isCredential: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, isCredential: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, isCredential: true },
      { key: 'waitingRoom', label: 'Enable waiting room', type: 'boolean', defaultValue: true },
      { key: 'joinBeforeHost', label: 'Allow join before host', type: 'boolean', defaultValue: false },
      { key: 'muteUponEntry', label: 'Mute participants upon entry', type: 'boolean', defaultValue: true },
      { key: 'enableRecording', label: 'Enable cloud recording', type: 'boolean', defaultValue: false },
    ],
  },
  ms_teams: {
    key: 'ms_teams',
    category: 'video',
    requiresOAuth: true,
    testable: true,
    helpText: 'Create Microsoft Teams meetings for telehealth. Requires Azure AD app with OnlineMeetings.ReadWrite permission.',
    fields: [
      { key: 'clientId', label: 'Application (Client) ID', type: 'text', required: true, isCredential: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, isCredential: true },
      { key: 'tenantId', label: 'Directory (Tenant) ID', type: 'text', required: false, isCredential: true, placeholder: 'Azure AD tenant ID' },
      { key: 'waitingRoom', label: 'Enable lobby (waiting room)', type: 'boolean', defaultValue: true },
    ],
  },
  google_meet: {
    key: 'google_meet',
    category: 'video',
    requiresOAuth: true,
    testable: true,
    helpText: 'Create Google Meet meetings. Uses the same Google OAuth as Google Calendar.',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, isCredential: true, placeholder: 'xxxxx.apps.googleusercontent.com' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, isCredential: true },
    ],
  },

  // ── Billing ─────────────────────────────────────────────────────────────────
  stripe_payments: {
    key: 'stripe_payments',
    category: 'billing',
    requiresOAuth: false,
    testable: true,
    helpText: 'Stripe payment processing for patient invoices and subscription billing. Configured via STRIPE_API_KEY env var.',
    fields: [
      { key: 'apiKey', label: 'Secret Key', type: 'password', required: true, isCredential: true, placeholder: 'sk_live_xxxxx or sk_test_xxxxx' },
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', required: false, placeholder: 'pk_live_xxxxx or pk_test_xxxxx' },
      { key: 'webhookSecret', label: 'Webhook Signing Secret', type: 'password', required: false, isCredential: true, placeholder: 'whsec_xxxxx' },
    ],
  },
  insurance_clearinghouse: {
    key: 'insurance_clearinghouse',
    category: 'billing',
    requiresOAuth: false,
    testable: true,
    helpText: 'Submit claims and verify eligibility via Availity, Change Healthcare, or Waystar.',
    fields: [
      { key: 'provider', label: 'Clearinghouse', type: 'select', required: true, options: [
        { label: 'Availity', value: 'availity' },
        { label: 'Change Healthcare', value: 'change_healthcare' },
        { label: 'Waystar', value: 'waystar' },
        { label: 'Office Ally', value: 'office_ally' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, isCredential: true },
      { key: 'submitterId', label: 'Submitter ID', type: 'text', required: true, placeholder: 'Your clearinghouse submitter ID' },
      { key: 'testMode', label: 'Test mode (sandbox)', type: 'boolean', defaultValue: true },
    ],
  },

  // ── Lab ─────────────────────────────────────────────────────────────────────
  lab_systems: {
    key: 'lab_systems',
    category: 'lab',
    requiresOAuth: false,
    testable: true,
    helpText: 'Connect with Quest Diagnostics or LabCorp for automated lab order submission and result delivery.',
    fields: [
      { key: 'provider', label: 'Lab Provider', type: 'select', required: true, options: [
        { label: 'Quest Diagnostics', value: 'quest' },
        { label: 'LabCorp', value: 'labcorp' },
        { label: 'BioReference', value: 'bioreference' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, isCredential: true },
      { key: 'clientId', label: 'Client/Facility ID', type: 'text', required: true, placeholder: 'Your lab facility ID' },
      { key: 'autoReceiveResults', label: 'Auto-receive results via webhook', type: 'boolean', defaultValue: true },
    ],
  },

  // ── Pharmacy ─────────────────────────────────────────────────────────────────
  pharmacy_network: {
    key: 'pharmacy_network',
    category: 'pharmacy',
    requiresOAuth: false,
    testable: true,
    helpText: 'E-prescribing pharmacy directory via Surescripts or NCPDP.',
    fields: [
      { key: 'provider', label: 'Network', type: 'select', required: true, options: [
        { label: 'Surescripts', value: 'surescripts' },
        { label: 'NCPDP', value: 'ncpdp' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, isCredential: true },
      { key: 'spi', label: 'SPI (Sender ID)', type: 'text', required: true, placeholder: 'Your Surescripts SPI' },
      { key: 'testMode', label: 'Test mode', type: 'boolean', defaultValue: true },
    ],
  },
  epcs: {
    key: 'epcs',
    category: 'pharmacy',
    requiresOAuth: false,
    testable: true,
    helpText: 'Electronic Prescribing of Controlled Substances. Requires DEA-compliant identity proofing and two-factor authentication.',
    fields: [
      { key: 'provider', label: 'EPCS Provider', type: 'select', required: true, options: [
        { label: 'Surescripts EPCS', value: 'surescripts' },
        { label: 'DoseSpot', value: 'dosespot' },
        { label: 'DrFirst', value: 'drfirst' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, isCredential: true },
      { key: 'deaNumber', label: 'Facility DEA Number', type: 'text', required: true },
      { key: 'twoFactorEnabled', label: 'Two-factor authentication enabled', type: 'boolean', defaultValue: true, helpText: 'Required for EPCS compliance' },
    ],
  },
  pdmp: {
    key: 'pdmp',
    category: 'pharmacy',
    requiresOAuth: false,
    testable: true,
    helpText: 'Query state Prescription Drug Monitoring Program before prescribing controlled substances.',
    fields: [
      { key: 'state', label: 'State', type: 'select', required: true, options: [
        { label: 'California (CURES)', value: 'CA' },
        { label: 'New York (PMP-AWARxE)', value: 'NY' },
        { label: 'Texas (TPMP)', value: 'TX' },
        { label: 'Florida (E-FORCSE)', value: 'FL' },
        { label: 'Other (PMP InterConnect)', value: 'OTHER' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, isCredential: true },
      { key: 'username', label: 'Username', type: 'text', required: true, isCredential: true },
      { key: 'password', label: 'Password', type: 'password', required: true, isCredential: true },
    ],
  },
  formulary: {
    key: 'formulary',
    category: 'pharmacy',
    requiresOAuth: false,
    testable: true,
    helpText: 'Real-time patient-specific formulary and copay information.',
    fields: [
      { key: 'provider', label: 'Formulary Source', type: 'select', required: true, options: [
        { label: 'Surescripts Real-Time Formulary', value: 'surescripts' },
        { label: 'FDB (First Databank)', value: 'fdb' },
        { label: 'Medi-Span', value: 'medispan' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, isCredential: true },
    ],
  },
  e_prior_auth: {
    key: 'e_prior_auth',
    category: 'pharmacy',
    requiresOAuth: false,
    testable: true,
    helpText: 'Electronic prior authorization submission within the prescribing workflow.',
    fields: [
      { key: 'provider', label: 'ePA Provider', type: 'select', required: true, options: [
        { label: 'CoverMyMeds', value: 'covermymeds' },
        { label: 'Surescripts ePA', value: 'surescripts' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, isCredential: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: false, isCredential: true },
    ],
  },
  medication_history: {
    key: 'medication_history',
    category: 'pharmacy',
    requiresOAuth: false,
    testable: true,
    helpText: 'Import patient medication history from PBMs and health exchanges.',
    fields: [
      { key: 'provider', label: 'Source', type: 'select', required: true, options: [
        { label: 'Surescripts Medication History', value: 'surescripts' },
        { label: 'CommonWell Health Alliance', value: 'commonwell' },
        { label: 'Carequality', value: 'carequality' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, isCredential: true },
    ],
  },

  // ── EHR ─────────────────────────────────────────────────────────────────────
  ehr_interoperability: {
    key: 'ehr_interoperability',
    category: 'ehr',
    requiresOAuth: false,
    testable: true,
    helpText: 'HL7 FHIR integration for health information exchange with external EHRs.',
    fields: [
      { key: 'fhirBaseUrl', label: 'FHIR Base URL', type: 'url', required: true, placeholder: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4' },
      { key: 'apiKey', label: 'API Key / Bearer Token', type: 'password', required: false, isCredential: true },
      { key: 'enableOutbound', label: 'Enable outbound FHIR push', type: 'boolean', defaultValue: false },
      { key: 'enableInbound', label: 'Enable inbound FHIR read', type: 'boolean', defaultValue: true },
    ],
  },

  // ── Clinical ─────────────────────────────────────────────────────────────────
  rxnorm: {
    key: 'rxnorm',
    category: 'clinical',
    requiresOAuth: false,
    testable: true,
    helpText: 'Search FDA-approved medications via NIH RxNorm REST API. No API key required.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'url', required: false, defaultValue: 'https://rxnav.nlm.nih.gov/REST' },
    ],
  },
  ai_prescribing: {
    key: 'ai_prescribing',
    category: 'ai',
    requiresOAuth: false,
    testable: true,
    helpText: 'LLM-powered drug interaction, allergy, and contraindication review. Uses local Ollama or OpenAI-compatible API.',
    fields: [
      { key: 'model', label: 'AI Model', type: 'text', required: false, placeholder: 'mistral, gpt-4, etc.' },
      { key: 'temperature', label: 'Temperature', type: 'number', required: false, defaultValue: 0.3 },
    ],
  },
  voice_prescribing: {
    key: 'voice_prescribing',
    category: 'ai',
    requiresOAuth: false,
    testable: true,
    helpText: 'Transcribe provider dictation into structured prescription fields using Whisper + LLM.',
    fields: [
      { key: 'whisperUrl', label: 'Whisper Service URL', type: 'url', required: false, defaultValue: 'http://localhost:8001' },
      { key: 'model', label: 'LLM Model', type: 'text', required: false, placeholder: 'mistral' },
    ],
  },

  // ── Patient Engagement ──────────────────────────────────────────────────────
  email_notifications: {
    key: 'email_notifications',
    category: 'patient_engagement',
    requiresOAuth: false,
    testable: true,
    helpText: 'Email delivery via Resend, SendGrid, or SMTP. Configure API key to enable.',
    fields: [
      { key: 'provider', label: 'Email Provider', type: 'select', required: true, options: [
        { label: 'Resend', value: 'resend' },
        { label: 'SendGrid', value: 'sendgrid' },
        { label: 'AWS SES', value: 'ses' },
        { label: 'SMTP', value: 'smtp' },
      ], defaultValue: 'resend' },
      { key: 'apiKey', label: 'API Key', type: 'password', required: false, isCredential: true, placeholder: 're_xxxxx or SG.xxxxx' },
      { key: 'fromEmail', label: 'From Email', type: 'text', required: true, placeholder: 'noreply@yourpractice.com' },
      { key: 'fromName', label: 'From Name', type: 'text', required: false, defaultValue: 'Neuraline EMR' },
    ],
  },
};

/**
 * Get config fields that should be displayed in the UI (not hidden, not credentials-only).
 */
export function getVisibleConfigFields(key: string): ConfigField[] {
  const schema = INTEGRATION_CONFIG_SCHEMAS[key];
  if (!schema) return [];
  return schema.fields.filter((f) => !f.hidden);
}

/**
 * Separate config fields into visible config vs encrypted credentials.
 */
export function splitConfigFields(
  key: string,
  allValues: Record<string, unknown>,
): { config: Record<string, unknown>; credentials: Record<string, unknown> } {
  const schema = INTEGRATION_CONFIG_SCHEMAS[key];
  if (!schema) return { config: allValues, credentials: {} };

  const config: Record<string, unknown> = {};
  const credentials: Record<string, unknown> = {};

  for (const field of schema.fields) {
    if (allValues[field.key] === undefined) continue;
    if (field.isCredential) {
      credentials[field.key] = allValues[field.key];
    } else {
      config[field.key] = allValues[field.key];
    }
  }

  return { config, credentials };
}
