import { api } from './api';
import type {
  ClinicalTemplate,
  CreateClinicalTemplateDto,
  UpdateClinicalTemplateDto,
  ClinicalTemplateStatus,
} from '../types';

export interface PaginatedClinicalTemplates {
  data: ClinicalTemplate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class ClinicalTemplateService {
  private readonly baseUrl = '/clinical/templates';

  async findAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    specialty?: string;
    visitType?: string;
    department?: string;
    isFavorite?: boolean;
    recentlyUsed?: boolean;
    status?: ClinicalTemplateStatus;
    sort?: string;
  }): Promise<PaginatedClinicalTemplates> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.specialty) query.append('specialty', params.specialty);
    if (params?.visitType) query.append('visitType', params.visitType);
    if (params?.department) query.append('department', params.department);
    if (params?.isFavorite !== undefined) query.append('isFavorite', String(params.isFavorite));
    if (params?.recentlyUsed !== undefined) query.append('recentlyUsed', String(params.recentlyUsed));
    if (params?.status) query.append('status', params.status);
    if (params?.sort) query.append('sort', params.sort);

    const response = await api.get(`${this.baseUrl}?${query.toString()}`);
    return response.data;
  }

  async findOne(id: string): Promise<ClinicalTemplate> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(dto: CreateClinicalTemplateDto): Promise<ClinicalTemplate> {
    const response = await api.post(this.baseUrl, dto);
    return response.data;
  }

  async update(id: string, dto: UpdateClinicalTemplateDto): Promise<ClinicalTemplate> {
    const response = await api.patch(`${this.baseUrl}/${id}`, dto);
    return response.data;
  }

  async duplicate(id: string): Promise<ClinicalTemplate> {
    const response = await api.post(`${this.baseUrl}/${id}/duplicate`);
    return response.data;
  }

  async archive(id: string): Promise<ClinicalTemplate> {
    const response = await api.post(`${this.baseUrl}/${id}/archive`);
    return response.data;
  }

  async setDefault(id: string): Promise<ClinicalTemplate> {
    const response = await api.post(`${this.baseUrl}/${id}/default`);
    return response.data;
  }

  async toggleFavorite(id: string): Promise<ClinicalTemplate> {
    const response = await api.post(`${this.baseUrl}/${id}/favorite`);
    return response.data;
  }

  async apply(id: string): Promise<{ template: ClinicalTemplate }> {
    const response = await api.post(`${this.baseUrl}/${id}/apply`);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async findSpecialties(): Promise<string[]> {
    const response = await api.get(`${this.baseUrl}/specialties`);
    return response.data?.data ?? [];
  }

  async findVisitTypes(): Promise<string[]> {
    const response = await api.get(`${this.baseUrl}/visit-types`);
    return response.data?.data ?? [];
  }

  async findDepartments(): Promise<string[]> {
    const response = await api.get(`${this.baseUrl}/departments`);
    return response.data?.data ?? [];
  }
}

export const clinicalTemplateService = new ClinicalTemplateService();
