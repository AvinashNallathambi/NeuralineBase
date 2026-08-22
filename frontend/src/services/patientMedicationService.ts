import { api } from './api';

export type MedicationSource = 'prescription' | 'patient_reported' | 'pbm_history' | 'encounter';
export type TakingStatus = 'taking' | 'taking_differently' | 'not_taking' | 'unknown' | 'completed';
export type MedicationStatus = 'active' | 'inactive' | 'discontinued' | 'completed';

export interface PatientMedication {
  id: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  rxNormCode?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  duration?: string | null;
  instructions?: string | null;
  source: MedicationSource;
  takingStatus: TakingStatus;
  status: MedicationStatus;
  startDate?: string | null;
  stopDate?: string | null;
  takingNotes?: string | null;
  prescriptionId?: string | null;
  encounterId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  reportedBy?: string | null;
  pbmSource?: string | null;
  notes?: string | null;
  isReviewed: boolean;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientMedicationDto {
  patientId: string;
  patientName: string;
  medicationName: string;
  rxNormCode?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  instructions?: string;
  source?: MedicationSource;
  takingStatus?: TakingStatus;
  status?: MedicationStatus;
  startDate?: string;
  stopDate?: string;
  takingNotes?: string;
  prescriptionId?: string;
  encounterId?: string;
  providerId?: string;
  providerName?: string;
  reportedBy?: string;
  notes?: string;
}

export interface PaginatedPatientMedications {
  data: PatientMedication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class PatientMedicationService {
  private baseUrl = '/patient-medications';

  async findByPatient(patientId: string): Promise<PatientMedication[]> {
    const response = await api.get(`${this.baseUrl}/patient/${patientId}`);
    return response.data;
  }

  async findAll(params?: {
    page?: number;
    limit?: number;
    patientId?: string;
    status?: string;
    source?: string;
  }): Promise<PaginatedPatientMedications> {
    const paramsObj = new URLSearchParams();
    if (params?.page) paramsObj.append('page', params.page.toString());
    if (params?.limit) paramsObj.append('limit', params.limit.toString());
    if (params?.patientId) paramsObj.append('patientId', params.patientId);
    if (params?.status) paramsObj.append('status', params.status);
    if (params?.source) paramsObj.append('source', params.source);
    const response = await api.get(`${this.baseUrl}?${paramsObj.toString()}`);
    return response.data;
  }

  async findOne(id: string): Promise<PatientMedication> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(dto: CreatePatientMedicationDto): Promise<PatientMedication> {
    const response = await api.post(this.baseUrl, dto);
    return response.data;
  }

  async update(id: string, dto: Partial<CreatePatientMedicationDto>): Promise<PatientMedication> {
    const response = await api.patch(`${this.baseUrl}/${id}`, dto);
    return response.data;
  }

  async updateTakingStatus(
    id: string,
    takingStatus: TakingStatus,
    takingNotes?: string,
  ): Promise<PatientMedication> {
    const response = await api.patch(`${this.baseUrl}/${id}/taking-status`, {
      takingStatus,
      takingNotes,
    });
    return response.data;
  }

  async markReviewed(id: string): Promise<PatientMedication> {
    const response = await api.patch(`${this.baseUrl}/${id}/review`);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }
}

export const patientMedicationService = new PatientMedicationService();
