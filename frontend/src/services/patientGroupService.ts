import { api } from './api';

export type PatientGroupType = 'manual' | 'dynamic' | 'smart';
export type PatientGroupCategory =
  | 'chronic_disease'
  | 'preventive_care'
  | 'risk_stratification'
  | 'insurance'
  | 'demographic'
  | 'appointment'
  | 'billing'
  | 'care_management'
  | 'referral'
  | 'behavioral_health'
  | 'pediatric'
  | 'telehealth'
  | 'vip'
  | 'custom';

export type RuleFieldType =
  | 'age'
  | 'gender'
  | 'diagnosis'
  | 'insurance'
  | 'provider'
  | 'location'
  | 'last_visit'
  | 'next_appointment'
  | 'outstanding_balance'
  | 'risk_score'
  | 'lab_value'
  | 'medication'
  | 'allergy'
  | 'encounter_count'
  | 'status'
  | 'custom_field';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'between'
  | 'is_null'
  | 'is_not_null'
  | 'before'
  | 'after'
  | 'within_last'
  | 'within_next'
  | 'older_than_days';

export interface GroupRule {
  field: RuleFieldType;
  operator: RuleOperator;
  value?: string | number | boolean | Array<string | number>;
  valueTo?: string | number;
  unit?: 'days' | 'weeks' | 'months' | 'years';
}

export interface GroupRuleSet {
  combinator: 'AND' | 'OR';
  rules: GroupRule[];
}

export interface PatientGroup {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  type: PatientGroupType;
  category: PatientGroupCategory;
  color: string | null;
  icon: string | null;
  tags: string[] | null;
  rules: GroupRuleSet | null;
  memberIds: string[] | null;
  memberCount: number;
  status: string;
  isShared: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreatePatientGroupDto {
  name: string;
  description?: string;
  type: PatientGroupType;
  category?: PatientGroupCategory;
  color?: string;
  icon?: string;
  tags?: string[];
  rules?: GroupRuleSet;
  memberIds?: string[];
  isShared?: boolean;
}

export interface UpdatePatientGroupDto extends Partial<CreatePatientGroupDto> {
  status?: string;
}

export interface QueryPatientGroupDto {
  search?: string;
  type?: PatientGroupType;
  category?: PatientGroupCategory;
  status?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedGroupsResult {
  data: PatientGroup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GroupMemberSummary {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string | null;
  dateOfBirth: string;
  gender: string;
  email: string | null;
  phone: string | null;
  status: string;
  age: number;
  riskScore: number;
  lastVisitDate: string | null;
  outstandingBalance: number;
  insuranceProvider: string | null;
}

export interface PaginatedMembersResult {
  data: GroupMemberSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PopulationHealthStats {
  groupId: string;
  groupName: string;
  totalMembers: number;
  ageDistribution: Array<{ range: string; count: number }>;
  genderDistribution: Array<{ gender: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  insuranceDistribution: Array<{ payer: string; count: number }>;
  chronicConditionDistribution: Array<{ condition: string; count: number }>;
  riskDistribution: Array<{ level: string; count: number }>;
  appointmentComplianceRate: number;
  noShowRate: number;
  preventiveCareCompletionRate: number;
  careGaps: Array<{ gap: string; count: number }>;
  outstandingBalanceTotal: number;
  outstandingBalanceCount: number;
  averageAge: number;
}

export interface GroupAuditLog {
  id: string;
  tenantId: string;
  groupId: string;
  action: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SuggestedGroup {
  name: string;
  description: string;
  category: PatientGroupCategory;
  type: PatientGroupType;
  rules: GroupRuleSet;
  estimatedSize: number;
  rationale: string;
}

export interface NaturalLanguageSearchResult {
  interpretedQuery: string;
  rules: GroupRuleSet;
  matchedPatientIds: string[];
  matchedCount: number;
  explanation: string;
}

export interface RiskPrediction {
  patientId: string;
  patientName: string;
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  factors: string[];
  recommendedActions: string[];
}

export interface CareGapDetection {
  patientId: string;
  patientName: string;
  gaps: Array<{
    gap: string;
    severity: 'low' | 'medium' | 'high';
    recommendedAction: string;
  }>;
}

export interface NoShowPrediction {
  patientId: string;
  patientName: string;
  probability: number;
  factors: string[];
  recommendedIntervention: string;
}

export interface OutreachRecommendation {
  campaignType: string;
  targetGroupName: string;
  description: string;
  estimatedReach: number;
  channel: 'sms' | 'email' | 'phone' | 'portal';
  messageTemplate: string;
}

export interface BulkActionResult {
  action: string;
  groupId: string;
  affectedCount: number;
  status: string;
  message: string;
}

class PatientGroupService {
  private baseUrl = '/patient-groups';

  async findAll(options: QueryPatientGroupDto): Promise<PaginatedGroupsResult> {
    const params = new URLSearchParams();
    if (options.search) params.append('search', options.search);
    if (options.type) params.append('type', options.type);
    if (options.category) params.append('category', options.category);
    if (options.status) params.append('status', options.status);
    if (options.tag) params.append('tag', options.tag);
    params.append('page', (options.page || 1).toString());
    params.append('limit', (options.limit || 20).toString());
    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async findOne(id: string): Promise<PatientGroup> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(dto: CreatePatientGroupDto): Promise<PatientGroup> {
    const response = await api.post(this.baseUrl, dto);
    return response.data;
  }

  async update(id: string, dto: UpdatePatientGroupDto): Promise<PatientGroup> {
    const response = await api.patch(`${this.baseUrl}/${id}`, dto);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async archive(id: string): Promise<PatientGroup> {
    const response = await api.post(`${this.baseUrl}/${id}/archive`);
    return response.data;
  }

  async restore(id: string): Promise<PatientGroup> {
    const response = await api.post(`${this.baseUrl}/${id}/restore`);
    return response.data;
  }

  async duplicate(id: string): Promise<PatientGroup> {
    const response = await api.post(`${this.baseUrl}/${id}/duplicate`);
    return response.data;
  }

  async getMembers(
    id: string,
    options?: { page?: number; limit?: number; search?: string },
  ): Promise<PaginatedMembersResult> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    const response = await api.get(`${this.baseUrl}/${id}/members?${params.toString()}`);
    return response.data;
  }

  async addMembers(id: string, patientIds: string[]): Promise<PatientGroup> {
    const response = await api.post(`${this.baseUrl}/${id}/members`, { patientIds });
    return response.data;
  }

  async removeMembers(id: string, patientIds: string[]): Promise<PatientGroup> {
    const response = await api.delete(`${this.baseUrl}/${id}/members`, { data: { patientIds } });
    return response.data;
  }

  async refresh(id: string): Promise<PatientGroup> {
    const response = await api.post(`${this.baseUrl}/${id}/refresh`);
    return response.data;
  }

  async getPopulationHealth(id: string): Promise<PopulationHealthStats> {
    const response = await api.get(`${this.baseUrl}/${id}/population-health`);
    return response.data;
  }

  async getAuditLog(id: string, limit?: number): Promise<GroupAuditLog[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const response = await api.get(`${this.baseUrl}/${id}/audit?${params.toString()}`);
    return response.data;
  }

  async exportCsv(id: string): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/${id}/export`, { responseType: 'blob' });
    return response.data;
  }

  async bulkAction(id: string, action: string, payload?: Record<string, unknown>): Promise<BulkActionResult> {
    const response = await api.post(`${this.baseUrl}/${id}/bulk-action`, { action, payload });
    return response.data;
  }

  async getSuggestedGroups(): Promise<SuggestedGroup[]> {
    const response = await api.get(`${this.baseUrl}/ai/suggestions`);
    return response.data;
  }

  async naturalLanguageSearch(query: string): Promise<NaturalLanguageSearchResult> {
    const response = await api.post(`${this.baseUrl}/ai/natural-language-search`, { query });
    return response.data;
  }

  async predictRisk(patientIds: string[]): Promise<RiskPrediction[]> {
    const response = await api.post(`${this.baseUrl}/ai/risk-prediction`, { patientIds });
    return response.data;
  }

  async detectCareGaps(patientIds: string[]): Promise<CareGapDetection[]> {
    const response = await api.post(`${this.baseUrl}/ai/care-gaps`, { patientIds });
    return response.data;
  }

  async predictNoShow(patientIds: string[]): Promise<NoShowPrediction[]> {
    const response = await api.post(`${this.baseUrl}/ai/no-show-prediction`, { patientIds });
    return response.data;
  }

  async getOutreachRecommendations(): Promise<OutreachRecommendation[]> {
    const response = await api.get(`${this.baseUrl}/ai/outreach-recommendations`);
    return response.data;
  }
}

export const patientGroupService = new PatientGroupService();
