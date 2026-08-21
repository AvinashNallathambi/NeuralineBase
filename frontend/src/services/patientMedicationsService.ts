import { api } from './api';

export type PatientMedicationSource =
  | 'prescribed'
  | 'patient_reported'
  | 'otc'
  | 'supplement'
  | 'external';

export type PatientMedicationStatus =
  | 'active'
  | 'on_hold'
  | 'discontinued'
  | 'completed';

export type PatientMedicationTakingStatus =
  | 'taking'
  | 'not_taking'
  | 'as_needed'
  | 'unknown';

export interface PatientMedication {
  id: string;
  patientId: string;
  name: string;
  rxNormCode?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  source: PatientMedicationSource;
  status: PatientMedicationStatus;
  takingStatus: PatientMedicationTakingStatus;
  startDate?: string | null;
  endDate?: string | null;
  prescriptionId?: string | null;
  encounterId?: string | null;
  prescriberName?: string | null;
  indication?: string | null;
  instructions?: string | null;
  notes?: string | null;
  discontinuedReason?: string | null;
  recordedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePatientMedicationDto {
  name: string;
  rxNormCode?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  source?: PatientMedicationSource;
  status?: PatientMedicationStatus;
  takingStatus?: PatientMedicationTakingStatus;
  startDate?: string;
  endDate?: string;
  prescriberName?: string;
  indication?: string;
  instructions?: string;
  notes?: string;
}

export interface UpdatePatientMedicationDto extends Partial<CreatePatientMedicationDto> {}

export interface PatientMedicationQuery {
  status?: PatientMedicationStatus;
  source?: PatientMedicationSource;
}

class PatientMedicationsService {
  async list(patientId: string, query: PatientMedicationQuery = {}): Promise<PatientMedication[]> {
    const params = new URLSearchParams();
    if (query.status) params.append('status', query.status);
    if (query.source) params.append('source', query.source);
    const qs = params.toString();
    const response = await api.get(`/patients/${patientId}/medications${qs ? `?${qs}` : ''}`);
    return response.data;
  }

  async create(patientId: string, dto: CreatePatientMedicationDto): Promise<PatientMedication> {
    const response = await api.post(`/patients/${patientId}/medications`, dto);
    return response.data;
  }

  async update(
    patientId: string,
    medicationId: string,
    dto: UpdatePatientMedicationDto,
  ): Promise<PatientMedication> {
    const response = await api.patch(`/patients/${patientId}/medications/${medicationId}`, dto);
    return response.data;
  }

  async discontinue(
    patientId: string,
    medicationId: string,
    reason?: string,
  ): Promise<PatientMedication> {
    const response = await api.post(
      `/patients/${patientId}/medications/${medicationId}/discontinue`,
      { reason },
    );
    return response.data;
  }

  async delete(patientId: string, medicationId: string): Promise<void> {
    await api.delete(`/patients/${patientId}/medications/${medicationId}`);
  }
}

export const patientMedicationsService = new PatientMedicationsService();
