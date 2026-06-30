import axios from 'axios';
import { Superbill } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Get token from sessionStorage
const getAuthHeader = () => {
  const token = sessionStorage.getItem('neuraline_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

class SuperbillService {
  private baseUrl = `${API_BASE_URL}/superbills`;

  async findAll(params?: { patientId?: string; providerId?: string; status?: string }): Promise<Superbill[]> {
    const query = new URLSearchParams();
    if (params?.patientId) query.append('patientId', params.patientId);
    if (params?.providerId) query.append('providerId', params.providerId);
    if (params?.status) query.append('status', params.status);

    const response = await axios.get(`${this.baseUrl}?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async findOne(id: string): Promise<Superbill> {
    const response = await axios.get(`${this.baseUrl}/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async create(data: Partial<Superbill>): Promise<Superbill> {
    const response = await axios.post(this.baseUrl, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async update(id: string, data: Partial<Superbill>): Promise<Superbill> {
    const response = await axios.patch(`${this.baseUrl}/${id}`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/${id}`, {
      headers: getAuthHeader(),
    });
  }

  async submitForProcessing(id: string): Promise<Superbill> {
    const response = await axios.post(`${this.baseUrl}/${id}/submit`, {}, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async calculateTotals(id: string): Promise<{
    totalAmount: number;
    patientResponsibility: number;
    insurancePayment: number;
  }> {
    const response = await axios.post(`${this.baseUrl}/${id}/calculate`, {}, {
      headers: getAuthHeader(),
    });
    return response.data;
  }
}

export const superbillService = new SuperbillService();
