import { api } from './api';

export interface EncounterVitals {
  bloodPressure?: string;
  heartRate?: string;
  temperature?: string;
  temperatureRoute?: string;
  weight?: string;
  weightUnit?: string;
  height?: string;
  heightUnit?: string;
  bmi?: string;
  oxygenSaturation?: string;
  respiratoryRate?: string;
  painScore?: number;
  painLocation?: string;
  bloodGlucose?: string;
  bloodGlucoseContext?: string;
  headCircumference?: string;
  waistCircumference?: string;
  intraocularPressureLeft?: string;
  intraocularPressureRight?: string;
  recordedDate?: string;
  recordedBy?: string;
}

export interface EncounterDiagnosis {
  code: string;
  description: string;
  isPrimary: boolean;
  type?: 'chronic' | 'acute' | 'rule_out';
  status?: 'active' | 'resolved' | 'ruled_out';
  onsetDate?: string;
  resolvedDate?: string;
  notes?: string;
}

export interface EncounterMedication {
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
  duration?: string;
  refills?: number;
  instructions?: string;
  isNew?: boolean;
}

export interface EncounterProcedure {
  name: string;
  cptCode?: string;
  description: string;
  status?: string;
}

export interface EncounterReferral {
  specialty: string;
  provider?: string;
  reason: string;
  urgency?: string;
}

export interface EncounterTreatmentPlan {
  medications?: EncounterMedication[];
  procedures?: EncounterProcedure[];
  followUp?: string;
  followUpDate?: string;
  followUpProviderId?: string;
  followUpProviderName?: string;
  referrals?: EncounterReferral[];
  goals?: string[];
  interventions?: string[];
  homeInstructions?: string;
  patientEducation?: string[];
  restrictions?: string;
  recallReminder?: string;
}

export interface EncounterAllergy {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  type?: 'drug' | 'food' | 'environmental' | 'other';
  onsetDate?: string;
  notes?: string;
}

export interface EncounterOrders {
  labs?: Array<{
    name: string;
    loincCode?: string;
    status: 'ordered' | 'collected' | 'resulted' | 'cancelled';
    priority?: 'routine' | 'stat' | 'asap';
    orderedDate: string;
    notes?: string;
  }>;
  imaging?: Array<{
    name: string;
    modality?: string;
    bodyPart?: string;
    status: 'ordered' | 'scheduled' | 'completed' | 'cancelled';
    priority?: 'routine' | 'stat' | 'asap';
    orderedDate: string;
    notes?: string;
  }>;
  referrals?: Array<{
    specialty: string;
    provider?: string;
    reason: string;
    urgency?: 'routine' | 'urgent' | 'emergent';
    status: 'pending' | 'sent' | 'scheduled' | 'completed' | 'cancelled';
    notes?: string;
  }>;
  procedures?: Array<{
    name: string;
    cptCode?: string;
    description: string;
    status: 'ordered' | 'scheduled' | 'completed' | 'cancelled';
    scheduledDate?: string;
    notes?: string;
  }>;
}

export interface EncounterAttachment {
  fileName: string;
  fileType: string;
  url: string;
  description?: string;
  category?: 'lab_result' | 'imaging' | 'consent' | 'referral' | 'other';
  uploadedAt: string;
  uploadedBy?: string;
}

export interface EncounterAuditEntry {
  action: string;
  performedBy: string;
  performedAt: string;
  note?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface Encounter {
  id: string;
  tenantId: string;
  patientId: string;
  providerId: string;
  appointmentId?: string;
  departmentId?: string;
  location?: string;
  room?: string;
  type: 'office_visit' | 'telehealth' | 'hospital' | 'emergency' | 'home_health' | 'nursing_facility';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  priority?: string;
  visitCategory?: string;
  visitReason?: string;
  chiefComplaint?: string;
  arrivalTime?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  soapNote: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  vitals: EncounterVitals;
  diagnoses: EncounterDiagnosis[];
  treatmentPlan: EncounterTreatmentPlan;
  allergies?: EncounterAllergy[];
  orders?: EncounterOrders;
  attachments?: EncounterAttachment[];
  clinicalNotes?: string;
  notes?: string;
  signedAt?: string;
  signedBy?: string;
  lockedAt?: string;
  lockedBy?: string;
  isLocked?: boolean;
  auditTrail?: EncounterAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEncounters {
  data: Encounter[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class EncounterService {
  private readonly baseUrl = '/clinical/encounters';

  async findAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    patientId?: string;
    providerId?: string;
    startDateFrom?: string;
    startDateTo?: string;
  }): Promise<PaginatedEncounters> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.type) query.append('type', params.type);
    if (params?.patientId) query.append('patientId', params.patientId);
    if (params?.providerId) query.append('providerId', params.providerId);
    if (params?.startDateFrom) query.append('startDateFrom', params.startDateFrom);
    if (params?.startDateTo) query.append('startDateTo', params.startDateTo);

    const response = await api.get(`${this.baseUrl}?${query.toString()}`);
    return response.data;
  }

  async findOne(id: string): Promise<Encounter> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(data: Partial<Encounter>): Promise<Encounter> {
    const response = await api.post(this.baseUrl, data);
    return response.data;
  }

  async update(id: string, data: Partial<Encounter>): Promise<Encounter> {
    const response = await api.patch(`${this.baseUrl}/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async transitionStatus(id: string, status: string): Promise<Encounter> {
    const response = await api.post(`${this.baseUrl}/${id}/transition`, { status });
    return response.data;
  }

  async findByPatient(patientId: string): Promise<Encounter[]> {
    const response = await api.get(`${this.baseUrl}/patient/${patientId}`);
    return response.data;
  }

  async sign(id: string): Promise<Encounter> {
    const response = await api.post(`${this.baseUrl}/${id}/sign`);
    return response.data;
  }

  async lock(id: string): Promise<Encounter> {
    const response = await api.post(`${this.baseUrl}/${id}/lock`);
    return response.data;
  }

  async reopen(id: string, reason: string): Promise<Encounter> {
    const response = await api.post(`${this.baseUrl}/${id}/reopen`, { reason });
    return response.data;
  }
}

export const encounterService = new EncounterService();
