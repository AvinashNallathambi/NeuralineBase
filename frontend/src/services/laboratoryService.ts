import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api/v1';

// ── Types matching backend entities ──────────────────────────────────────────

export interface LabPanelTest {
  name: string;
  loincCode?: string;
  category?: string;
}

export interface LabPanel {
  id: string;
  name: string;
  code: string | null;
  loincCode: string | null;
  category: string | null;
  tests: LabPanelTest[];
  defaultPriority: string;
  fastingRequired: boolean;
  isActive: boolean;
  description: string | null;
}

export interface LabTestDto {
  name: string;
  loincCode?: string;
  cptCode?: string;
  category?: string;
  specimenType?: string;
  notes?: string;
}

export interface CreateLabOrderDto {
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  encounterId?: string;
  tests: LabTestDto[];
  status?: string;
  priority?: string;
  fastingRequired?: boolean;
  notes?: string;
  diagnosisCodes?: string[];
}

export interface LabOrderTest {
  id: string;
  name: string;
  loincCode: string | null;
  cptCode: string | null;
  category: string | null;
  status: string;
  result: string | null;
  unit: string | null;
  referenceRange: string | null;
  abnormalFlag: string | null;
  sortOrder: number;
}

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  encounterId: string | null;
  status: string;
  priority: string;
  fastingRequired: boolean;
  notes: string | null;
  diagnosisCodes: string[];
  labFacilityId: string | null;
  labFacilityName: string | null;
  tests: LabOrderTest[];
  specimens?: Specimen[];
  results?: LabResult[];
  statusHistory?: LabOrderStatusHistory[];
  orderedDate: string;
  collectedDate: string | null;
  completedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabResult {
  id: string;
  orderId: string;
  testId: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  flag: string | null;
  referenceRange: string | null;
  interpretation: string | null;
  resultStatus: string;
  resultedAt: string;
  resultedBy: string | null;
  isAcknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export interface Specimen {
  id: string;
  orderId: string;
  testId: string | null;
  specimenType: string;
  collectionMethod: string | null;
  volume: string | null;
  containerType: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  condition: string;
  rejectionReason: string | null;
  trackingNumber: string | null;
  createdAt: string;
}

export interface LabOrderStatusHistory {
  id: string;
  orderId: string;
  previousStatus: string | null;
  newStatus: string;
  changedBy: string | null;
  reason: string | null;
  createdAt: string;
}

export interface LabStats {
  pendingOrders: number;
  completedToday: number;
  abnormalResults: number;
  criticalUnacknowledged: number;
}

export interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization?: string;
  department?: string;
}

export interface ReferenceRange {
  id: string;
  loincCode: string;
  testName: string;
  gender: string;
  lowValue: number | null;
  highValue: number | null;
  unit: string;
  lowCritical: number | null;
  highCritical: number | null;
  ageMin: number | null;
  ageMax: number | null;
}

export interface ImagingOrder {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  modality: string;
  bodyPart: string;
  studyName: string;
  cptCode: string | null;
  status: string;
  priority: string;
  findings: string | null;
  impression: string | null;
  radiologyReportUrl: string | null;
  orderedDate: string;
  scheduledDate: string | null;
  completedDate: string | null;
  notes: string | null;
}

export interface CreateImagingOrderDto {
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  modality: string;
  bodyPart: string;
  studyName: string;
  cptCode?: string;
  status?: string;
  priority?: string;
  notes?: string;
  scheduledDate?: string;
}

export interface LabResultEntryDto {
  testId: string;
  value: string;
  numericValue?: number;
  unit?: string;
  flag?: string;
  referenceRange?: string;
  interpretation?: string;
  resultStatus?: string;
}

export interface SubmitLabResultsDto {
  results: LabResultEntryDto[];
  resultedBy?: string;
}

export interface CollectSpecimenDto {
  specimenType: string;
  collectionMethod?: string;
  volume?: string;
  containerType?: string;
  collectedBy?: string;
  condition?: string;
  rejectionReason?: string;
  trackingNumber?: string;
  testId?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

class LaboratoryService {
  private getHeaders() {
    const token = sessionStorage.getItem('neuraline_token');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getStats(): Promise<LabStats> {
    const response = await axios.get(`${API_BASE}/laboratory/stats`, this.getHeaders());
    return response.data;
  }

  // ── Panels ─────────────────────────────────────────────────────────────────

  async getPanels(): Promise<LabPanel[]> {
    const response = await axios.get(`${API_BASE}/laboratory/panels`, this.getHeaders());
    return response.data;
  }

  // ── Reference Ranges ───────────────────────────────────────────────────────

  async getReferenceRanges(loincCode?: string): Promise<ReferenceRange[]> {
    const params: Record<string, string> = {};
    if (loincCode) params.loincCode = loincCode;
    const response = await axios.get(`${API_BASE}/laboratory/reference-ranges`, {
      ...this.getHeaders(),
      params,
    });
    return response.data;
  }

  // ── Lab Orders ─────────────────────────────────────────────────────────────

  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
    search?: string;
  }): Promise<{ data: LabOrder[]; total: number; page: number; limit: number }> {
    const response = await axios.get(`${API_BASE}/laboratory/orders`, {
      ...this.getHeaders(),
      params,
    });
    return response.data;
  }

  async getOrder(id: string): Promise<LabOrder> {
    const response = await axios.get(`${API_BASE}/laboratory/orders/${id}`, this.getHeaders());
    return response.data;
  }

  async createOrder(dto: CreateLabOrderDto): Promise<LabOrder> {
    const response = await axios.post(`${API_BASE}/laboratory/orders`, dto, this.getHeaders());
    return response.data;
  }

  async updateOrderStatus(id: string, status: string, reason?: string): Promise<LabOrder> {
    const response = await axios.post(
      `${API_BASE}/laboratory/orders/${id}/status`,
      { status, reason },
      this.getHeaders(),
    );
    return response.data;
  }

  async cancelOrder(id: string, reason?: string): Promise<LabOrder> {
    const response = await axios.post(
      `${API_BASE}/laboratory/orders/${id}/cancel`,
      { reason },
      this.getHeaders(),
    );
    return response.data;
  }

  async getOrderStatusHistory(id: string): Promise<LabOrderStatusHistory[]> {
    const response = await axios.get(
      `${API_BASE}/laboratory/orders/${id}/status-history`,
      this.getHeaders(),
    );
    return response.data;
  }

  // ── Specimens ──────────────────────────────────────────────────────────────

  async getSpecimens(orderId: string): Promise<Specimen[]> {
    const response = await axios.get(
      `${API_BASE}/laboratory/orders/${orderId}/specimens`,
      this.getHeaders(),
    );
    return response.data;
  }

  async collectSpecimen(orderId: string, dto: CollectSpecimenDto): Promise<Specimen> {
    const response = await axios.post(
      `${API_BASE}/laboratory/orders/${orderId}/collect`,
      dto,
      this.getHeaders(),
    );
    return response.data;
  }

  // ── Results ────────────────────────────────────────────────────────────────

  async getResults(orderId: string): Promise<LabResult[]> {
    const response = await axios.get(
      `${API_BASE}/laboratory/orders/${orderId}/results`,
      this.getHeaders(),
    );
    return response.data;
  }

  async submitResults(orderId: string, dto: SubmitLabResultsDto): Promise<LabResult[]> {
    const response = await axios.post(
      `${API_BASE}/laboratory/orders/${orderId}/results`,
      dto,
      this.getHeaders(),
    );
    return response.data;
  }

  async getCriticalResults(): Promise<LabResult[]> {
    const response = await axios.get(`${API_BASE}/laboratory/results/critical`, this.getHeaders());
    return response.data;
  }

  async getPendingReviewResults(): Promise<LabResult[]> {
    const response = await axios.get(
      `${API_BASE}/laboratory/results/pending-review`,
      this.getHeaders(),
    );
    return response.data;
  }

  async acknowledgeResult(resultId: string, note?: string): Promise<LabResult> {
    const response = await axios.patch(
      `${API_BASE}/laboratory/results/${resultId}/acknowledge`,
      { note },
      this.getHeaders(),
    );
    return response.data;
  }

  // ── Patient History ────────────────────────────────────────────────────────

  async getPatientLabHistory(
    patientId: string,
    loincCode?: string,
  ): Promise<LabResult[]> {
    const params: Record<string, string> = {};
    if (loincCode) params.loincCode = loincCode;
    const response = await axios.get(
      `${API_BASE}/laboratory/patient/${patientId}/history`,
      { ...this.getHeaders(), params },
    );
    return response.data;
  }

  // ── Imaging Orders ─────────────────────────────────────────────────────────

  async getImagingOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
  }): Promise<{ data: ImagingOrder[]; total: number; page: number; limit: number }> {
    const response = await axios.get(`${API_BASE}/laboratory/imaging`, {
      ...this.getHeaders(),
      params,
    });
    return response.data;
  }

  async getImagingOrder(id: string): Promise<ImagingOrder> {
    const response = await axios.get(`${API_BASE}/laboratory/imaging/${id}`, this.getHeaders());
    return response.data;
  }

  async createImagingOrder(dto: CreateImagingOrderDto): Promise<ImagingOrder> {
    const response = await axios.post(`${API_BASE}/laboratory/imaging`, dto, this.getHeaders());
    return response.data;
  }

  async updateImagingOrder(
    id: string,
    dto: Partial<CreateImagingOrderDto>,
  ): Promise<ImagingOrder> {
    const response = await axios.patch(`${API_BASE}/laboratory/imaging/${id}`, dto, this.getHeaders());
    return response.data;
  }

  async submitImagingFindings(
    id: string,
    dto: { findings: string; impression?: string; radiologyReportUrl?: string },
  ): Promise<ImagingOrder> {
    const response = await axios.post(
      `${API_BASE}/laboratory/imaging/${id}/findings`,
      dto,
      this.getHeaders(),
    );
    return response.data;
  }

  // ── Providers ──────────────────────────────────────────────────────────────

  async getProviders(): Promise<Provider[]> {
    const response = await axios.get(`${API_BASE}/providers`, this.getHeaders());
    return response.data;
  }

  // ── AI Features ────────────────────────────────────────────────────────────

  async summarizeResults(orderId: string): Promise<ResultSummary> {
    const response = await axios.post(
      `${API_BASE}/laboratory/orders/${orderId}/summarize`,
      {},
      this.getHeaders(),
    );
    return response.data;
  }

  async triageAbnormalResults(): Promise<TriageScore[]> {
    const response = await axios.get(
      `${API_BASE}/laboratory/ai/triage`,
      this.getHeaders(),
    );
    return response.data;
  }

  async naturalLanguageQuery(
    query: string,
  ): Promise<NaturalLanguageQueryResult> {
    const response = await axios.post(
      `${API_BASE}/laboratory/ai/query`,
      { query },
      this.getHeaders(),
    );
    return response.data;
  }
}

export interface ResultSummary {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export interface TriageScore {
  resultId: string;
  testName: string;
  value: string;
  flag: string;
  triageScore: number;
  triageCategory: 'normal' | 'abnormal' | 'urgent' | 'critical';
  reasoning: string;
  suggestedAction: string;
}

export interface NaturalLanguageQueryResult {
  interpretation: string;
  matchedOrders: Array<{
    orderId: string;
    patientName: string;
    testName: string;
    value: string;
    flag: string;
    status: string;
  }>;
  summary: string;
}

export const laboratoryService = new LaboratoryService();
