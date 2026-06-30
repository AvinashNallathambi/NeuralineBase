import axios from 'axios';
import type {
  WorkflowTemplate,
  WorkflowInstance,
  WorkflowStepConfig,
  CreateWorkflowTemplateDto,
  TransitionWorkflowDto,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const getAuthHeader = () => {
  const token = sessionStorage.getItem('neuraline_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class WorkflowService {
  private templatesUrl = `${API_BASE_URL}/workflow/templates`;
  private instancesUrl = `${API_BASE_URL}/workflow/instances`;

  // ── Templates ──────────────────────────────────────────────────────────────

  async createTemplate(dto: CreateWorkflowTemplateDto): Promise<WorkflowTemplate> {
    const response = await axios.post(this.templatesUrl, dto, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async findAllTemplates(options?: {
    page?: number;
    limit?: number;
    entityType?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<PaginatedResult<WorkflowTemplate>> {
    const params = new URLSearchParams();
    if (options) {
      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.entityType) params.append('entityType', options.entityType);
      if (options.isActive !== undefined) params.append('isActive', String(options.isActive));
      if (options.search) params.append('search', options.search);
    }
    const response = await axios.get(`${this.templatesUrl}?${params.toString()}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async findTemplateById(id: string): Promise<WorkflowTemplate> {
    const response = await axios.get(`${this.templatesUrl}/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async findActiveTemplateForEntity(entityType: string): Promise<{ data: WorkflowTemplate | null; message?: string }> {
    const response = await axios.get(`${this.templatesUrl}/entity/${entityType}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async updateTemplate(id: string, dto: Partial<CreateWorkflowTemplateDto>): Promise<WorkflowTemplate> {
    const response = await axios.patch(`${this.templatesUrl}/${id}`, dto, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async deleteTemplate(id: string): Promise<void> {
    await axios.delete(`${this.templatesUrl}/${id}`, {
      headers: getAuthHeader(),
    });
  }

  // ── Instances ──────────────────────────────────────────────────────────────

  async createInstance(dto: {
    entityType: string;
    entityId: string;
    currentStep: string;
    templateId: string;
    metadata?: Record<string, unknown>;
  }): Promise<WorkflowInstance> {
    const response = await axios.post(this.instancesUrl, dto, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async findInstanceByEntity(entityType: string, entityId: string): Promise<WorkflowInstance> {
    const response = await axios.get(`${this.instancesUrl}/entity/${entityType}/${entityId}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async findAllInstances(options?: {
    page?: number;
    limit?: number;
    entityType?: string;
    status?: string;
    currentStep?: string;
  }): Promise<PaginatedResult<WorkflowInstance>> {
    const params = new URLSearchParams();
    if (options) {
      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.entityType) params.append('entityType', options.entityType);
      if (options.status) params.append('status', options.status);
      if (options.currentStep) params.append('currentStep', options.currentStep);
    }
    const response = await axios.get(`${this.instancesUrl}?${params.toString()}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async getAvailableTransitions(entityType: string, entityId: string): Promise<WorkflowStepConfig[]> {
    const response = await axios.get(
      `${this.instancesUrl}/entity/${entityType}/${entityId}/transitions`,
      { headers: getAuthHeader() },
    );
    return response.data;
  }

  async transition(entityType: string, entityId: string, dto: TransitionWorkflowDto): Promise<WorkflowInstance> {
    const response = await axios.post(
      `${this.instancesUrl}/entity/${entityType}/${entityId}/transition`,
      dto,
      { headers: getAuthHeader() },
    );
    return response.data;
  }

  async completeWorkflow(entityType: string, entityId: string): Promise<WorkflowInstance> {
    const response = await axios.post(
      `${this.instancesUrl}/entity/${entityType}/${entityId}/complete`,
      {},
      { headers: getAuthHeader() },
    );
    return response.data;
  }

  async cancelWorkflow(entityType: string, entityId: string, reason?: string): Promise<WorkflowInstance> {
    const response = await axios.post(
      `${this.instancesUrl}/entity/${entityType}/${entityId}/cancel`,
      { reason },
      { headers: getAuthHeader() },
    );
    return response.data;
  }
}

export const workflowService = new WorkflowService();
