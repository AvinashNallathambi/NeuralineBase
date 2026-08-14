/**
 * Appointments API client — pure functions, no platform dependencies.
 */
import type { AxiosInstance } from 'axios';
import type { Appointment } from '../types';

export interface AppointmentQuery {
  page?: number;
  limit?: number;
  patientId?: string;
  providerId?: string;
  status?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AppointmentListResponse {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
}

export class AppointmentsApi {
  constructor(private http: AxiosInstance) {}

  list(query?: AppointmentQuery): Promise<AppointmentListResponse> {
    return this.http.get('/appointments', { params: query }).then((r) => r.data);
  }

  getById(id: string): Promise<Appointment> {
    return this.http.get(`/appointments/${id}`).then((r) => r.data);
  }

  create(data: Partial<Appointment>): Promise<Appointment> {
    return this.http.post('/appointments', data).then((r) => r.data);
  }

  update(id: string, data: Partial<Appointment>): Promise<Appointment> {
    return this.http.patch(`/appointments/${id}`, data).then((r) => r.data);
  }

  cancel(id: string): Promise<void> {
    return this.http.post(`/appointments/${id}/cancel`).then((r) => r.data);
  }
}
