import { api } from './api';

export type IntegrationStatus = 'disconnected' | 'connected' | 'error' | 'pending';
export type IntegrationCategory =
  | 'clinical'
  | 'calendar'
  | 'communication'
  | 'video'
  | 'billing'
  | 'lab'
  | 'pharmacy'
  | 'ehr'
  | 'ai'
  | 'patient_engagement'
  | 'analytics';

export interface Integration {
  id: string;
  key: string;
  name: string;
  description: string;
  provider: string;
  enabled: boolean;
  icon: string;
  status: IntegrationStatus;
  category: IntegrationCategory | null;
  lastConnectedAt: string | null;
  errorMessage: string | null;
  config?: Record<string, unknown>;
  requiresOAuth: boolean;
  configurable: boolean;
}

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
  isCredential?: boolean;
  hidden?: boolean;
}

export interface IntegrationConfigSchema {
  key: string;
  category: string;
  fields: ConfigField[];
  helpText?: string;
  testable: boolean;
  requiresOAuth: boolean;
}

export interface UpdateIntegrationDto {
  enabled?: boolean;
  provider?: string;
  config?: Record<string, unknown>;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

export interface OAuthUrlResult {
  authUrl: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  integrationKey: string;
  action: string;
  performedBy: string | null;
  detail: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: string;
}

class IntegrationService {
  private baseUrl = '/integrations';

  async findAll(): Promise<Integration[]> {
    const response = await api.get(this.baseUrl);
    return response.data;
  }

  async findOne(key: string): Promise<Integration> {
    const response = await api.get(`${this.baseUrl}/${key}`);
    return response.data;
  }

  async update(key: string, dto: UpdateIntegrationDto): Promise<Integration> {
    const response = await api.put(`${this.baseUrl}/${key}`, dto);
    return response.data;
  }

  async testConnection(key: string): Promise<TestConnectionResult> {
    const response = await api.post(`${this.baseUrl}/${key}/test`);
    return response.data;
  }

  async getOAuthUrl(key: string, redirectUri?: string): Promise<OAuthUrlResult> {
    const response = await api.post(`${this.baseUrl}/${key}/oauth/url`, { redirectUri });
    return response.data;
  }

  async handleOAuthCallback(key: string, code: string, redirectUri?: string): Promise<TestConnectionResult> {
    const response = await api.post(`${this.baseUrl}/${key}/oauth/callback`, { code, redirectUri });
    return response.data;
  }

  async getConfigSchema(key: string): Promise<IntegrationConfigSchema> {
    const response = await api.get(`${this.baseUrl}/schemas/${key}`);
    return response.data;
  }

  async getAllConfigSchemas(): Promise<IntegrationConfigSchema[]> {
    const response = await api.get(`${this.baseUrl}/schemas`);
    return response.data;
  }

  async getAuditLogs(key?: string, limit?: number): Promise<AuditLogEntry[]> {
    const params = new URLSearchParams();
    if (key) params.append('key', key);
    if (limit) params.append('limit', String(limit));
    const response = await api.get(`${this.baseUrl}/audit-logs?${params.toString()}`);
    return response.data;
  }
}

export const integrationService = new IntegrationService();
