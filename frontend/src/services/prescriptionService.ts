import { api } from './api';

export interface PrescriptionItem {
  id: string;
  medication: string;
  rxNormCode?: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  encounterId?: string;
  medications: PrescriptionItem[];
  status: 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';
  prescribedDate: string;
  pharmacy?: string;
  notes?: string;
}

export interface CreatePrescriptionDto {
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  encounterId?: string;
  medications: PrescriptionItem[];
  status?: 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';
  prescribedDate?: string;
  pharmacy?: string;
  notes?: string;
}

export interface UpdatePrescriptionDto extends Partial<CreatePrescriptionDto> {}

export interface PrescriptionPaginationOptions {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  patientId?: string;
}

export interface PaginatedPrescriptions {
  data: Prescription[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class PrescriptionService {
  private baseUrl = '/prescriptions';

  async findAll(options: PrescriptionPaginationOptions): Promise<PaginatedPrescriptions> {
    const params = new URLSearchParams();
    params.append('page', options.page.toString());
    params.append('limit', options.limit.toString());
    if (options.search) params.append('search', options.search);
    if (options.status) params.append('status', options.status);
    if (options.patientId) params.append('patientId', options.patientId);

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async findOne(id: string): Promise<Prescription> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(dto: CreatePrescriptionDto): Promise<Prescription> {
    const response = await api.post(this.baseUrl, dto);
    return response.data;
  }

  async update(id: string, dto: UpdatePrescriptionDto): Promise<Prescription> {
    const response = await api.patch(`${this.baseUrl}/${id}`, dto);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }
}

export const prescriptionService = new PrescriptionService();
