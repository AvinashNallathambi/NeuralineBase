import axios from 'axios';
import type { ProviderAvailability, ProviderAvailabilityOverride } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api/v1';

export interface CreateProviderAvailabilityDto {
  providerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
  appointmentTypes?: string[];
  locationId?: string;
  maxAppointments?: number;
  bufferMinutes?: number;
  notes?: string;
  isRecurring?: boolean;
  effectiveDate?: string;
  expiryDate?: string;
}

export interface UpdateProviderAvailabilityDto {
  providerId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  isAvailable?: boolean;
  appointmentTypes?: string[];
  locationId?: string;
  maxAppointments?: number;
  bufferMinutes?: number;
  notes?: string;
  isRecurring?: boolean;
  effectiveDate?: string;
  expiryDate?: string;
}

export interface CreateGroupAppointmentDto {
  providerId: string;
  appointmentType: string;
  startTime: string;
  endTime: string;
  patientIds: string[];
  maxParticipants: number;
  location?: string;
  notes?: string;
  isTelehealth?: boolean;
}

export interface UpdateGroupAppointmentDto {
  addPatientIds?: string[];
  removePatientIds?: string[];
  status?: string;
  notes?: string;
}

class ProviderAvailabilityService {
  private getHeaders() {
    const token = sessionStorage.getItem('neuraline_token');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  // ── Provider Availability Methods ─────────────────────────────────────────

  async findAllAvailability(): Promise<ProviderAvailability[]> {
    const response = await axios.get(
      `${API_BASE}/appointments/availability`,
      this.getHeaders(),
    );
    return response.data;
  }

  async findAllOverrides(): Promise<ProviderAvailabilityOverride[]> {
    const response = await axios.get(
      `${API_BASE}/appointments/availability-overrides`,
      this.getHeaders(),
    );
    return response.data;
  }

  async createAvailability(dto: CreateProviderAvailabilityDto): Promise<ProviderAvailability> {
    const response = await axios.post(
      `${API_BASE}/appointments/availability`,
      dto,
      this.getHeaders(),
    );
    return response.data;
  }

  async findAvailabilityByProvider(providerId: string): Promise<ProviderAvailability[]> {
    const response = await axios.get(
      `${API_BASE}/appointments/availability/${providerId}`,
      this.getHeaders(),
    );
    return response.data;
  }

  async getAvailableSlots(
    providerId: string,
    date: Date,
    appointmentType?: string,
  ): Promise<{ start: string; end: string }[]> {
    const params = new URLSearchParams({
      date: date.toISOString(),
    });
    if (appointmentType) {
      params.append('appointmentType', appointmentType);
    }

    const response = await axios.get(
      `${API_BASE}/appointments/availability/${providerId}/slots?${params.toString()}`,
      this.getHeaders(),
    );
    return response.data;
  }

  async updateAvailability(id: string, dto: UpdateProviderAvailabilityDto): Promise<ProviderAvailability> {
    const response = await axios.patch(
      `${API_BASE}/appointments/availability/${id}`,
      dto,
      this.getHeaders(),
    );
    return response.data;
  }

  async deleteAvailability(id: string): Promise<void> {
    await axios.delete(
      `${API_BASE}/appointments/availability/${id}`,
      this.getHeaders(),
    );
  }

  // ── Group Appointment Methods ──────────────────────────────────────────────

  async createGroupAppointment(dto: CreateGroupAppointmentDto): Promise<any> {
    const response = await axios.post(
      `${API_BASE}/appointments/group`,
      dto,
      this.getHeaders(),
    );
    return response.data;
  }

  async updateGroupAppointment(id: string, dto: UpdateGroupAppointmentDto): Promise<any> {
    const response = await axios.patch(
      `${API_BASE}/appointments/group/${id}`,
      dto,
      this.getHeaders(),
    );
    return response.data;
  }

  async findGroupAppointments(groupId: string): Promise<any[]> {
    const response = await axios.get(
      `${API_BASE}/appointments/group/${groupId}`,
      this.getHeaders(),
    );
    return response.data;
  }

  async markGroupAttendance(
    appointmentId: string,
    patientId: string,
    attended: boolean,
    notes?: string,
  ): Promise<any> {
    const response = await axios.patch(
      `${API_BASE}/appointments/group/${appointmentId}/attendance`,
      { patientId, attended, notes },
      this.getHeaders(),
    );
    return response.data;
  }
}

export const providerAvailabilityService = new ProviderAvailabilityService();
