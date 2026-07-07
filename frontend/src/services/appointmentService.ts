import { api } from './api';

export interface Appointment {
  id: string;
  tenantId: string;
  patientId: string;
  patientName?: string;
  providerId: string;
  providerName?: string;
  appointmentType: string;
  status: string;
  startTime: string;
  endTime: string;
  reasonForVisit?: string;
  notes?: string;
  location?: any;
  isTelehealth: boolean;
  remindersEnabled: boolean;
  durationMinutes?: number;
  createdAt: string;
  updatedAt: string;
  patient?: any;
}

export interface CreateAppointmentDto {
  patientId?: string;
  providerId: string;
  appointmentType: string;
  startTime: Date;
  endTime: Date;
  reasonForVisit?: string;
  notes?: string;
  location?: any;
  isTelehealth?: boolean;
  durationMinutes?: number;
  remindersEnabled?: boolean;
}

export interface UpdateAppointmentDto {
  appointmentType?: string;
  status?: string;
  startTime?: Date;
  endTime?: Date;
  reasonForVisit?: string;
  notes?: string;
  location?: any;
  isTelehealth?: boolean;
  durationMinutes?: number;
  remindersEnabled?: boolean;
  patientId?: string;
  providerId?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  patientId?: string;
  providerId?: string;
  status?: string;
  appointmentType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginatedResult {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class AppointmentService {
  private baseUrl = '/appointments';

  async findAll(options: PaginationOptions): Promise<PaginatedResult> {
    const params = new URLSearchParams();
    params.append('page', options.page.toString());
    params.append('limit', options.limit.toString());

    if (options.patientId) params.append('patientId', options.patientId);
    if (options.providerId) params.append('providerId', options.providerId);
    if (options.status) params.append('status', options.status);
    if (options.appointmentType) params.append('appointmentType', options.appointmentType);
    if (options.startDate) params.append('startDate', options.startDate.toISOString());
    if (options.endDate) params.append('endDate', options.endDate.toISOString());

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async getTodayAppointments(providerId?: string): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (providerId) params.append('providerId', providerId);

    const response = await api.get(`${this.baseUrl}/today?${params.toString()}`);
    return response.data;
  }

  async getUpcomingAppointments(providerId: string, limit: number = 10): Promise<Appointment[]> {
    const response = await api.get(
      `${this.baseUrl}/upcoming/${providerId}?limit=${limit}`,
    );
    return response.data;
  }

  async getPatientAppointments(
    patientId: string,
    options?: { status?: string; limit?: number },
  ): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());

    const response = await api.get(
      `${this.baseUrl}/patient/${patientId}?${params.toString()}`,
    );
    return response.data;
  }

  async getProviderAppointments(
    providerId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await api.get(
      `${this.baseUrl}/provider/${providerId}?${params.toString()}`,
    );
    return response.data;
  }

  async getAppointmentsByDateRange(
    startDate: Date,
    endDate: Date,
    providerId?: string,
  ): Promise<Appointment[]> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    if (providerId) params.append('providerId', providerId);

    const response = await api.get(
      `${this.baseUrl}/date-range?${params.toString()}`,
    );
    return response.data;
  }

  async findOne(id: string): Promise<Appointment> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    const response = await api.post(this.baseUrl, dto);
    return response.data;
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    const response = await api.patch(`${this.baseUrl}/${id}`, dto);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }
}

export const appointmentService = new AppointmentService();