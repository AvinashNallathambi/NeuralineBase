/**
 * Patients API client — pure functions, no platform dependencies.
 */
import type { AxiosInstance } from 'axios';
import type { Patient } from '../types';

export interface PatientQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PatientListResponse {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
}

export class PatientsApi {
  constructor(private http: AxiosInstance) {}

  list(query?: PatientQuery): Promise<PatientListResponse> {
    return this.http.get('/patients', { params: query }).then((r) => r.data);
  }

  getById(id: string): Promise<Patient> {
    return this.http.get(`/patients/${id}`).then((r) => r.data);
  }

  create(data: Partial<Patient>): Promise<Patient> {
    return this.http.post('/patients', data).then((r) => r.data);
  }

  update(id: string, data: Partial<Patient>): Promise<Patient> {
    return this.http.patch(`/patients/${id}`, data).then((r) => r.data);
  }

  delete(id: string): Promise<void> {
    return this.http.delete(`/patients/${id}`).then((r) => r.data);
  }
}
