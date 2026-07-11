import { api } from './api';

export interface Integration {
  id: string;
  key: string;
  name: string;
  description: string;
  provider: string;
  enabled: boolean;
  icon: string;
  config?: Record<string, unknown>;
}

export interface UpdateIntegrationDto {
  enabled?: boolean;
  provider?: string;
  config?: Record<string, unknown>;
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
}

export const integrationService = new IntegrationService();
