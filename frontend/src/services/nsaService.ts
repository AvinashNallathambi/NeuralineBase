import { api } from './api';
import type {
  GoodFaithEstimate,
  NsaVarianceRecord,
  NsaIdrCase,
  NsaIdrDeadline,
  NsaComplianceDashboard,
  GfeStatus,
  GfeType,
  DeliveryMethod,
} from '../types';

const BASE = '/api/v1/nsa';

export const nsaService = {
  // ── GFE CRUD ──────────────────────────────────────────────────────
  async createGfe(data: {
    patientId: string;
    patientName: string;
    superbillId?: string;
    encounterId?: string;
    providerId?: string;
    providerName?: string;
    gfeType: GfeType;
    serviceDate: string;
    scheduledDate?: string;
    totalCharge: number;
    insuranceEstimate: number;
    patientEstimate: number;
    items: Array<{ service: string; cptCode: string; charge: number; insuranceEstimate: number; patientEstimate: number }>;
    disclaimers?: string[];
    complianceNotes?: string[];
    notes?: string;
  }): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe`, data);
    return response.data;
  },

  async generateGfeFromSuperbill(data: { superbillId: string; gfeType?: GfeType; patientNotes?: string }): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe/generate-from-superbill`, data);
    return response.data;
  },

  async listGfes(params?: { patientId?: string; status?: GfeStatus }): Promise<GoodFaithEstimate[]> {
    const response = await api.get(`${BASE}/gfe`, { params });
    return response.data;
  },

  async getGfe(id: string): Promise<GoodFaithEstimate> {
    const response = await api.get(`${BASE}/gfe/${id}`);
    return response.data;
  },

  async updateGfe(id: string, data: Partial<{
    totalCharge: number;
    insuranceEstimate: number;
    patientEstimate: number;
    items: Array<{ service: string; cptCode: string; charge: number; insuranceEstimate: number; patientEstimate: number }>;
    disclaimers: string[];
    complianceNotes: string[];
    notes: string;
  }>): Promise<GoodFaithEstimate> {
    const response = await api.patch(`${BASE}/gfe/${id}`, data);
    return response.data;
  },

  async createNewVersion(id: string, data: Partial<{
    totalCharge: number;
    insuranceEstimate: number;
    patientEstimate: number;
    items: Array<{ service: string; cptCode: string; charge: number; insuranceEstimate: number; patientEstimate: number }>;
  }>): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe/${id}/new-version`, data);
    return response.data;
  },

  // ── GFE Delivery Tracking ─────────────────────────────────────────
  async deliverGfe(id: string, data: { deliveryMethod: DeliveryMethod; deliveredBy?: string }): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe/${id}/deliver`, data);
    return response.data;
  },

  async acknowledgeGfe(id: string, data?: { acknowledgedBy?: string }): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe/${id}/acknowledge`, data || {});
    return response.data;
  },

  // ── Variance Detection ────────────────────────────────────────────
  async detectVariance(id: string, data: {
    finalBilledAmount: number;
    finalPaidAmount: number;
    actualLineItems?: Array<{ cptCode: string; actualAmount: number }>;
    claimId?: string;
    remittanceClaimId?: string;
  }): Promise<NsaVarianceRecord> {
    const response = await api.post(`${BASE}/gfe/${id}/variance`, data);
    return response.data;
  },

  async listVariances(gfeId?: string): Promise<NsaVarianceRecord[]> {
    const response = await api.get(`${BASE}/variance`, { params: { gfeId } });
    return response.data;
  },

  async resolveVariance(id: string, resolutionNotes: string): Promise<NsaVarianceRecord> {
    const response = await api.post(`${BASE}/variance/${id}/resolve`, { resolutionNotes });
    return response.data;
  },

  // ── Compliance Dashboard ──────────────────────────────────────────
  async getDashboard(): Promise<NsaComplianceDashboard> {
    const response = await api.get(`${BASE}/dashboard`);
    return response.data;
  },

  // ── P1: AI Features ───────────────────────────────────────────────
  async predictAccuracy(id: string): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe/${id}/predict-accuracy`, {});
    return response.data;
  },

  async reconcileGfe(id: string, data: {
    finalBilledAmount: number;
    finalPaidAmount: number;
    actualLineItems: Array<{ cptCode: string; actualAmount: number }>;
  }): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe/${id}/reconcile`, data);
    return response.data;
  },

  async generatePatientExplanation(id: string): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe/${id}/patient-explanation`, {});
    return response.data;
  },

  async predictDiagnosis(id: string, data: {
    patientHistory: { conditions: string[]; medications: string[]; recentEncounters: string[] };
    chiefComplaint: string;
    scheduledProcedure: string;
  }): Promise<GoodFaithEstimate> {
    const response = await api.post(`${BASE}/gfe/${id}/predict-diagnosis`, data);
    return response.data;
  },

  // ── P2: IDR Cases ─────────────────────────────────────────────────
  async createIdrCase(data: {
    patientId: string;
    patientName?: string;
    claimId?: string;
    gfeId?: string;
    varianceRecordId?: string;
    payerName?: string;
    billedAmount?: number;
    encounterNotes?: string;
    cptCodes?: string[];
  }): Promise<NsaIdrCase> {
    const response = await api.post(`${BASE}/idr`, data);
    return response.data;
  },

  async listIdrCases(status?: string): Promise<NsaIdrCase[]> {
    const response = await api.get(`${BASE}/idr`, { params: { status } });
    return response.data;
  },

  async getIdrCase(id: string): Promise<NsaIdrCase> {
    const response = await api.get(`${BASE}/idr/${id}`);
    return response.data;
  },

  async updateIdrCase(id: string, data: {
    status?: string;
    qpaAmount?: number;
    initialOffer?: number;
    finalOffer?: number;
    determinedAmount?: number;
    resolutionNotes?: string;
  }): Promise<NsaIdrCase> {
    const response = await api.patch(`${BASE}/idr/${id}`, data);
    return response.data;
  },

  async assessEligibility(id: string, data: {
    patientState: string;
    paidAmount: number;
    serviceType: string;
    isEmergency: boolean;
    isAirAmbulance: boolean;
    payerType: string;
  }): Promise<NsaIdrCase> {
    const response = await api.post(`${BASE}/idr/${id}/assess-eligibility`, data);
    return response.data;
  },

  async generateOffer(id: string, data?: { medianInNetworkRates?: Array<{ cptCode: string; medianRate: number }> }): Promise<NsaIdrCase> {
    const response = await api.post(`${BASE}/idr/${id}/generate-offer`, data || {});
    return response.data;
  },

  async routeJurisdiction(id: string, data: {
    patientState: string;
    payerType: string;
    serviceType: string;
    isEmergency: boolean;
  }): Promise<NsaIdrCase> {
    const response = await api.post(`${BASE}/idr/${id}/route-jurisdiction`, data);
    return response.data;
  },

  async generateAcuityLetter(id: string, data: { age?: number; sex?: string; conditions: string[] }): Promise<NsaIdrCase> {
    const response = await api.post(`${BASE}/idr/${id}/acuity-letter`, data);
    return response.data;
  },

  // ── P3: Win Probability + Deadlines ───────────────────────────────
  async predictWinProbability(id: string): Promise<NsaIdrCase> {
    const response = await api.post(`${BASE}/idr/${id}/win-probability`, {});
    return response.data;
  },

  async getDeadlines(idrCaseId: string): Promise<NsaIdrDeadline[]> {
    const response = await api.get(`${BASE}/idr/${idrCaseId}/deadlines`);
    return response.data;
  },

  async getAllDeadlines(): Promise<NsaIdrDeadline[]> {
    const response = await api.get(`${BASE}/deadlines`);
    return response.data;
  },

  async markDeadlineMet(id: string): Promise<NsaIdrDeadline> {
    const response = await api.post(`${BASE}/deadlines/${id}/met`, {});
    return response.data;
  },
};
