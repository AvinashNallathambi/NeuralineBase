import { api } from './api';

export interface Provider {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  npi: string | null;
  role: string | null;
  specialization: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

class ProviderService {
  private baseUrl = 'providers';

  async findAll(): Promise<Provider[]> {
    const response = await api.get<Provider[]>(this.baseUrl);
    return response.data;
  }

  async findOne(id: string): Promise<Provider> {
    const response = await api.get<Provider>(`${this.baseUrl}/${id}`);
    return response.data;
  }
}

export const providerService = new ProviderService();
