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

export type PrescriptionStatus =
  | 'draft'
  | 'active'
  | 'sent'
  | 'completed'
  | 'cancelled'
  | 'discontinued'
  | 'expired';

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  encounterId?: string;
  medications: PrescriptionItem[];
  status: PrescriptionStatus;
  prescribedDate: string;
  pharmacy?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePrescriptionDto {
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  encounterId?: string;
  medications: PrescriptionItem[];
  status?: PrescriptionStatus;
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

export type RefillStatus = 'pending' | 'approved' | 'denied' | 'completed';

export interface RefillRequest {
  id: string;
  prescriptionId: string;
  patientName: string;
  medication: string;
  dosage: string;
  status: RefillStatus;
  requestedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRefillDto {
  notes?: string;
}

export interface UpdateRefillDto {
  status: RefillStatus;
  notes?: string;
}

export interface UpdatePrescriptionStatusDto {
  status: PrescriptionStatus;
  reason?: string;
}

export interface StatusHistoryEntry {
  id: string;
  prescriptionId: string;
  previousStatus: string | null;
  newStatus: string;
  changedBy?: string | null;
  reason?: string | null;
  createdAt: string;
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

  async updateStatus(id: string, dto: UpdatePrescriptionStatusDto): Promise<Prescription> {
    const response = await api.post(`${this.baseUrl}/${id}/status`, dto);
    return response.data;
  }

  async getStatusHistory(id: string): Promise<StatusHistoryEntry[]> {
    const response = await api.get(`${this.baseUrl}/${id}/status-history`);
    return response.data;
  }

  async findAllRefills(): Promise<RefillRequest[]> {
    const response = await api.get(`${this.baseUrl}/refills`);
    return response.data;
  }

  async findRefills(prescriptionId: string): Promise<RefillRequest[]> {
    const response = await api.get(`${this.baseUrl}/${prescriptionId}/refills`);
    return response.data;
  }

  async createRefill(prescriptionId: string, dto: CreateRefillDto): Promise<RefillRequest> {
    const response = await api.post(`${this.baseUrl}/${prescriptionId}/refill`, dto);
    return response.data;
  }

  async updateRefill(
    prescriptionId: string,
    refillId: string,
    dto: UpdateRefillDto,
  ): Promise<RefillRequest> {
    const response = await api.patch(
      `${this.baseUrl}/${prescriptionId}/refills/${refillId}`,
      dto,
    );
    return response.data;
  }

  async deleteRefill(prescriptionId: string, refillId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${prescriptionId}/refills/${refillId}`);
  }
}

export const prescriptionService = new PrescriptionService();
