import { api } from './api';
import type { PatientProblem } from './icdService';
import { encounterService, type EncounterVitals } from './encounterService';

export interface Patient {
  id: string;
  tenantId: string;
  mrn: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string | null;
  phone: string | null;
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } | null;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  } | null;
  bloodType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreatePatientDto {
  mrn?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email?: string;
  phone?: string;
  address?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  bloodType?: string;
  status?: string;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {}

export interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  gender?: string;
}

export interface PaginatedResult {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class PatientService {
  private baseUrl = '/patients';

  async findAll(options: PaginationOptions): Promise<PaginatedResult> {
    const params = new URLSearchParams();
    params.append('page', options.page.toString());
    params.append('limit', options.limit.toString());

    if (options.search) params.append('search', options.search);
    if (options.status) params.append('status', options.status);
    if (options.gender) params.append('gender', options.gender);

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async findOne(id: string): Promise<Patient> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    const response = await api.post(this.baseUrl, dto);
    return response.data;
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    const response = await api.patch(`${this.baseUrl}/${id}`, dto);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async getEncounters(patientId: string): Promise<unknown[]> {
    const response = await api.get(`${this.baseUrl}/${patientId}/encounters`);
    return response.data;
  }

  async getPrescriptions(patientId: string): Promise<unknown[]> {
    const response = await api.get(`${this.baseUrl}/${patientId}/prescriptions`);
    return response.data;
  }

  async findProblems(
    patientId: string,
    query?: { clinicalStatus?: string; isChronic?: string; search?: string },
  ): Promise<PatientProblem[]> {
    const params = new URLSearchParams();
    if (query?.clinicalStatus) params.append('clinicalStatus', query.clinicalStatus);
    if (query?.isChronic) params.append('isChronic', query.isChronic);
    if (query?.search) params.append('search', query.search);
    const response = await api.get(`${this.baseUrl}/${patientId}/problems?${params.toString()}`);
    return response.data;
  }

  async createProblem(
    patientId: string,
    data: Partial<PatientProblem>,
  ): Promise<PatientProblem> {
    const response = await api.post(`${this.baseUrl}/${patientId}/problems`, data);
    return response.data;
  }

  async updateProblem(
    patientId: string,
    problemId: string,
    data: Partial<PatientProblem>,
  ): Promise<PatientProblem> {
    const response = await api.patch(`${this.baseUrl}/${patientId}/problems/${problemId}`, data);
    return response.data;
  }

  async deleteProblem(patientId: string, problemId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${patientId}/problems/${problemId}`);
  }

  async getVitals(patientId: string): Promise<Array<EncounterVitals & { encounterId: string; encounterDate: string }>> {
    const encounters = await encounterService.findByPatient(patientId);
    return (encounters as any[])
      .filter((e) => e.vitals && Object.keys(e.vitals).length > 0)
      .map((e) => ({
        ...e.vitals,
        encounterId: e.id,
        encounterDate: e.startTime,
      }))
      .sort((a, b) => new Date(b.encounterDate).getTime() - new Date(a.encounterDate).getTime());
  }

  async uploadDocument(
    patientId: string,
    file: File,
    documentType: string,
    description?: string,
  ): Promise<{ id: string; fileName: string; documentType: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    if (description) formData.append('description', description);
    const response = await api.post(`${this.baseUrl}/${patientId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
}

export const patientService = new PatientService();