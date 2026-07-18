import { api } from './api';
import type { PatientDashboard } from './patientAuthService';

export interface PortalProvider {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  specialty: string | null;
}

class PatientPortalService {
  private baseUrl = '/patients/portal';

  async getDashboard(): Promise<PatientDashboard> {
    const response = await api.get(`${this.baseUrl}/dashboard`);
    return response.data;
  }

  async getProviders(): Promise<PortalProvider[]> {
    const response = await api.get(`${this.baseUrl}/providers`);
    return response.data;
  }

  async getAppointments(status?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const response = await api.get(`${this.baseUrl}/appointments?${params.toString()}`);
    return response.data;
  }

  async getAvailableSlots(providerId: string, date: string, appointmentType?: string): Promise<any[]> {
    const params = new URLSearchParams();
    params.append('providerId', providerId);
    params.append('date', date);
    if (appointmentType) params.append('appointmentType', appointmentType);
    const response = await api.get(`${this.baseUrl}/appointments/available-slots?${params.toString()}`);
    return response.data;
  }

  async requestAppointment(data: {
    providerId: string;
    appointmentType: string;
    reasonForVisit: string;
    preferredDate: string;
    isTelehealth?: boolean;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`${this.baseUrl}/appointments/request`, data);
    return response.data;
  }

  async getPrescriptions(status?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const response = await api.get(`${this.baseUrl}/prescriptions?${params.toString()}`);
    return response.data;
  }

  async requestRefill(prescriptionId: string, data: { pharmacy?: string; notes?: string }): Promise<any> {
    const response = await api.post(`${this.baseUrl}/prescriptions/${prescriptionId}/refill`, data);
    return response.data;
  }

  async getLabResults(status?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const response = await api.get(`${this.baseUrl}/lab-results?${params.toString()}`);
    return response.data;
  }

  async getInvoices(status?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const response = await api.get(`${this.baseUrl}/invoices?${params.toString()}`);
    return response.data;
  }

  async payInvoice(invoiceId: string, data: { amount: number; paymentMethod: string; reference?: string }): Promise<any> {
    const response = await api.post(`${this.baseUrl}/invoices/${invoiceId}/pay`, data);
    return response.data;
  }

  async getEobs(): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/eobs`);
    return response.data;
  }

  async getInsurance(): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/insurance`);
    return response.data;
  }

  async getTelemedicineToken(sessionId: string): Promise<{ token: string; roomUrl: string; roomId: string }> {
    const response = await api.get(`/patients/portal/telemedicine/sessions/${sessionId}/token`);
    return response.data;
  }
}

export const patientPortalService = new PatientPortalService();
export default patientPortalService;
