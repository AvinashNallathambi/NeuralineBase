import { api } from './api';

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
}

export const patientService = new PatientService();