import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Get token from sessionStorage
const getAuthHeader = () => {
  const token = sessionStorage.getItem('neuraline_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface Appointment {
  id: string;
  tenantId: string;
  patientId: string;
  providerId: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  reason?: string;
  notes?: string;
  isTelehealth: boolean;
  meetingLink?: string;
  meetingRoomId?: string;
  remindersEnabled: boolean;
  reminderSent: boolean;
  location?: string;
  durationMinutes?: number;
  checkInTime?: string;
  startTimeActual?: string;
  endTimeActual?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  noShowReason?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateAppointmentDto {
  patientId: string;
  providerId: string;
  type: string;
  startTime: Date;
  endTime: Date;
  reason?: string;
  notes?: string;
  isTelehealth?: boolean;
  location?: string;
  durationMinutes?: number;
  remindersEnabled?: boolean;
}

export interface UpdateAppointmentDto {
  type?: string;
  status?: string;
  startTime?: Date;
  endTime?: Date;
  reason?: string;
  notes?: string;
  isTelehealth?: boolean;
  location?: string;
  durationMinutes?: number;
  remindersEnabled?: boolean;
  checkInTime?: Date;
  startTimeActual?: Date;
  endTimeActual?: Date;
  cancellationReason?: string;
  cancelledBy?: string;
  noShowReason?: string;
  meetingLink?: string;
  meetingRoomId?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  patientId?: string;
  providerId?: string;
  status?: string;
  type?: string;
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
  private baseUrl = `${API_BASE_URL}/appointments`;

  async findAll(options: PaginationOptions): Promise<PaginatedResult> {
    const params = new URLSearchParams();
    params.append('page', options.page.toString());
    params.append('limit', options.limit.toString());
    
    if (options.patientId) params.append('patientId', options.patientId);
    if (options.providerId) params.append('providerId', options.providerId);
    if (options.status) params.append('status', options.status);
    if (options.type) params.append('type', options.type);
    if (options.startDate) params.append('startDate', options.startDate.toISOString());
    if (options.endDate) params.append('endDate', options.endDate.toISOString());

    const response = await axios.get(`${this.baseUrl}?${params.toString()}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async getTodayAppointments(providerId?: string): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (providerId) params.append('providerId', providerId);

    const response = await axios.get(`${this.baseUrl}/today?${params.toString()}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async getUpcomingAppointments(providerId: string, limit: number = 10): Promise<Appointment[]> {
    const response = await axios.get(
      `${this.baseUrl}/upcoming/${providerId}?limit=${limit}`,
      {
        headers: getAuthHeader(),
      },
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

    const response = await axios.get(
      `${this.baseUrl}/patient/${patientId}?${params.toString()}`,
      {
        headers: getAuthHeader(),
      },
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

    const response = await axios.get(
      `${this.baseUrl}/provider/${providerId}?${params.toString()}`,
      {
        headers: getAuthHeader(),
      },
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

    const response = await axios.get(
      `${this.baseUrl}/date-range?${params.toString()}`,
      {
        headers: getAuthHeader(),
      },
    );
    return response.data;
  }

  async findOne(id: string): Promise<Appointment> {
    const response = await axios.get(`${this.baseUrl}/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    const response = await axios.post(this.baseUrl, dto, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    const response = await axios.put(`${this.baseUrl}/${id}`, dto, {
      headers: getAuthHeader(),
    });
    return response.data;
  }

  async delete(id: string): Promise<{ message: string }> {
    const response = await axios.delete(`${this.baseUrl}/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  }
}

export const appointmentService = new AppointmentService();