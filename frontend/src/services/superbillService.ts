import { api } from './api';
import { Superbill } from '../types';

class SuperbillService {
  private baseUrl = '/superbills';

  async findAll(params?: { patientId?: string; providerId?: string; status?: string }): Promise<Superbill[]> {
    const query = new URLSearchParams();
    if (params?.patientId) query.append('patientId', params.patientId);
    if (params?.providerId) query.append('providerId', params.providerId);
    if (params?.status) query.append('status', params.status);

    const response = await api.get(`${this.baseUrl}?${query.toString()}`);
    return response.data;
  }

  async findOne(id: string): Promise<Superbill> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(data: Partial<Superbill>): Promise<Superbill> {
    const response = await api.post(this.baseUrl, data);
    return response.data;
  }

  async update(id: string, data: Partial<Superbill>): Promise<Superbill> {
    const response = await api.patch(`${this.baseUrl}/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async submitForProcessing(id: string): Promise<Superbill> {
    const response = await api.post(`${this.baseUrl}/${id}/submit`, {});
    return response.data;
  }

  async calculateTotals(id: string): Promise<{
    totalAmount: number;
    patientResponsibility: number;
    insurancePayment: number;
  }> {
    const response = await api.post(`${this.baseUrl}/${id}/calculate`, {});
    return response.data;
  }
}

export const superbillService = new SuperbillService();
