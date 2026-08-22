import { api } from './api';

export type ImmunizationStatus = 'completed' | 'entered-in-error' | 'not-done';
export type ImmunizationSource = 'administered' | 'historical' | 'registry' | 'patient_reported';

export interface Immunization {
  id: string;
  tenantId: string;
  patientId: string;
  vaccineName: string;
  cvxCode: string | null;
  cptCode: string | null;
  ndcCode: string | null;
  manufacturer: string | null;
  lotNumber: string | null;
  expirationDate: string | null;
  administeredDate: string;
  doseNumber: number | null;
  doseAmount: string | null;
  doseUnit: string | null;
  route: string | null;
  site: string | null;
  status: ImmunizationStatus;
  source: ImmunizationSource;
  encounterId: string | null;
  providerId: string | null;
  providerName: string | null;
  facilityName: string | null;
  visDate: string | null;
  vfcEligibility: string | null;
  fundingSource: string | null;
  reactionNotes: string | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateImmunizationData {
  patientId: string;
  vaccineName: string;
  cvxCode?: string;
  cptCode?: string;
  ndcCode?: string;
  manufacturer?: string;
  lotNumber?: string;
  expirationDate?: string;
  administeredDate: string;
  doseNumber?: number;
  doseAmount?: string;
  doseUnit?: string;
  route?: string;
  site?: string;
  status?: ImmunizationStatus;
  source?: ImmunizationSource;
  encounterId?: string;
  providerId?: string;
  providerName?: string;
  facilityName?: string;
  visDate?: string;
  vfcEligibility?: string;
  fundingSource?: string;
  reactionNotes?: string;
  notes?: string;
}

export type UpdateImmunizationData = Partial<CreateImmunizationData>;

export const immunizationService = {
  findByPatient: (patientId: string) =>
    api.get<Immunization[]>(`/immunizations/patient/${patientId}`).then((r) => r.data),

  findOne: (id: string) =>
    api.get<Immunization>(`/immunizations/${id}`).then((r) => r.data),

  create: (data: CreateImmunizationData) =>
    api.post<Immunization>('/immunizations', data).then((r) => r.data),

  update: (id: string, data: UpdateImmunizationData) =>
    api.patch<Immunization>(`/immunizations/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/immunizations/${id}`).then((r) => r.data),

  // ── Patient Portal ──
  portalGetMyImmunizations: () =>
    api.get<Immunization[]>('/patients/portal/immunizations').then((r) => r.data),

  // ── AI Features ──
  forecast: (data: {
    patientAgeMonths: number;
    patientSex?: string;
    immunizationHistory: Array<{ vaccineName: string; cvxCode?: string; date: string; doseNumber?: number }>;
    gestationalAgeWeeks?: number;
    conditions?: Array<{ condition: string; icd10Code?: string }>;
    allergies?: string[];
  }) => api.post('/ai/immunization-forecast', data).then((r) => r.data),

  checkContraindication: (data: {
    vaccineName: string;
    cvxCode?: string;
    patientAgeMonths: number;
    patientSex?: string;
    conditions?: Array<{ condition: string; icd10Code?: string }>;
    allergies?: string[];
    currentMedications?: Array<{ name: string }>;
    priorReactions?: string[];
    immunizationHistory?: Array<{ vaccineName: string; date: string }>;
  }) => api.post('/ai/immunization-contraindication', data).then((r) => r.data),

  getEducation: (data: {
    vaccineName: string;
    patientAgeMonths: number;
    patientSex?: string;
    language?: string;
    readingLevel?: string;
  }) => api.post('/ai/vaccine-education', data).then((r) => r.data),

  // ── AI: Travel Vaccines ──
  getTravelVaccines: (data: {
    destinations: string[];
    departureDate: string;
    returnDate?: string;
    patientAgeMonths: number;
    patientSex?: string;
    immunizationHistory?: Array<{ vaccineName: string; date: string }>;
    conditions?: Array<{ condition: string; icd10Code?: string }>;
    allergies?: string[];
    pregnancy?: boolean;
  }) => api.post('/ai/travel-vaccines', data).then((r) => r.data),

  // ── Vaccine Inventory ──
  getInventory: () =>
    api.get('/immunizations/inventory').then((r) => r.data),

  getExpiringInventory: (days?: number) =>
    api.get(`/immunizations/inventory/expiring${days ? `?days=${days}` : ''}`).then((r) => r.data),

  getLowStockInventory: (threshold?: number) =>
    api.get(`/immunizations/inventory/low-stock${threshold ? `?threshold=${threshold}` : ''}`).then((r) => r.data),

  createInventory: (data: any) =>
    api.post('/immunizations/inventory', data).then((r) => r.data),

  updateInventory: (id: string, data: any) =>
    api.patch(`/immunizations/inventory/${id}`, data).then((r) => r.data),

  adjustInventory: (id: string, adjustment: number, reason?: string) =>
    api.post(`/immunizations/inventory/${id}/adjust`, { adjustment, reason }).then((r) => r.data),

  removeInventory: (id: string) =>
    api.delete(`/immunizations/inventory/${id}`).then((r) => r.data),
};
