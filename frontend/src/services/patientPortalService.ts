import { api } from './api';
import type { PatientDashboard } from './patientAuthService';

class PatientPortalService {
  private baseUrl = '/patients/portal';

  async getDashboard(): Promise<PatientDashboard> {
    const response = await api.get(`${this.baseUrl}/dashboard`);
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

  async getImagingResults(status?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const response = await api.get(`${this.baseUrl}/imaging?${params.toString()}`);
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

  async scanInsuranceCard(
    frontImage: File,
    backImage?: File,
  ): Promise<{
    extractedData: any;
    confidence: Record<string, number>;
    matchedPayerId?: string;
  }> {
    const formData = new FormData();
    formData.append('frontImage', frontImage);
    if (backImage) formData.append('backImage', backImage);
    const response = await api.post(`${this.baseUrl}/insurance/card-scan`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async requestInsuranceUpdate(data: {
    extractedData: any;
    confidence: Record<string, number>;
    matchedPayerId?: string;
    notes?: string;
  }): Promise<{ status: string; message: string }> {
    const response = await api.post(`${this.baseUrl}/insurance/request-update`, data);
    return response.data;
  }

  async getTelemedicineToken(sessionId: string): Promise<{
    token: string;
    roomUrl: string;
    roomId: string;
  }> {
    const response = await api.get(`/patients/portal/telemedicine/sessions/${sessionId}/token`);
    return response.data;
  }

  /**
   * Find or create a telemedicine session for one of the patient's
   * appointments. The backend validates that the appointment belongs
   * to the logged-in patient and is a telehealth visit.
   */
  async findOrCreateTelemedicineSession(appointmentId: string): Promise<any> {
    const response = await api.post(
      `/patients/portal/telemedicine/sessions/for-appointment/${appointmentId}`,
    );
    return response.data;
  }

  /**
   * Get details of the patient's telemedicine session.
   */
  async getTelemedicineSession(sessionId: string): Promise<any> {
    const response = await api.get(`/patients/portal/telemedicine/sessions/${sessionId}`);
    return response.data;
  }

  // ── Care Plans ──

  async getCarePlans(): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/care-plans`);
    return response.data;
  }

  async getCarePlan(id: string): Promise<any> {
    const response = await api.get(`${this.baseUrl}/care-plans/${id}`);
    return response.data;
  }

  async getCarePlanTasks(planId: string): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/care-plans/${planId}/tasks`);
    return response.data;
  }

  async reportTaskValue(taskId: string, reportedValue: string, patientNotes?: string): Promise<any> {
    const response = await api.post(`${this.baseUrl}/care-plans/tasks/${taskId}/report`, {
      reportedValue,
      patientNotes,
    });
    return response.data;
  }

  async completeTask(taskId: string, reportedValue?: string, patientNotes?: string): Promise<any> {
    const response = await api.post(`${this.baseUrl}/care-plans/tasks/${taskId}/complete`, {
      reportedValue,
      patientNotes,
    });
    return response.data;
  }

  // ── Medical History (Problem List) ──

  async getMedicalHistory(): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/medical-history`);
    return response.data;
  }

  async addMedicalHistory(data: {
    code?: string;
    codeSystem?: string;
    description: string;
    onsetDate?: string;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`${this.baseUrl}/medical-history`, data);
    return response.data;
  }

  async removeMedicalHistory(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/medical-history/${id}`);
  }

  // ── Allergies ──

  async getAllergies(): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/allergies`);
    return response.data;
  }

  async addAllergy(data: {
    allergen: string;
    reaction?: string;
    severity?: string;
    onsetDate?: string;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`${this.baseUrl}/allergies`, data);
    return response.data;
  }

  async removeAllergy(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/allergies/${id}`);
  }

  // ── Family History ──

  async getFamilyHistory(): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/family-history`);
    return response.data;
  }

  async addFamilyHistory(data: {
    relationship: string;
    memberName?: string;
    condition: string;
    code?: string;
    codeSystem?: string;
    ageOfOnset?: number;
    isDeceased?: boolean;
    ageAtDeath?: number;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`${this.baseUrl}/family-history`, data);
    return response.data;
  }

  async removeFamilyHistory(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/family-history/${id}`);
  }

  // ── Surgical History ──

  async getSurgicalHistory(): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/surgical-history`);
    return response.data;
  }

  async addSurgicalHistory(data: {
    procedure: string;
    procedureDate?: string;
    surgeon?: string;
    facility?: string;
    bodySite?: string;
    outcome?: string;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`${this.baseUrl}/surgical-history`, data);
    return response.data;
  }

  async removeSurgicalHistory(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/surgical-history/${id}`);
  }

  // ── Social History ──

  async getSocialHistory(category?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    const response = await api.get(`${this.baseUrl}/social-history?${params.toString()}`);
    return response.data;
  }

  async addSocialHistory(data: {
    category: string;
    status?: string;
    detail?: string;
    frequency?: string;
    amount?: string;
    durationYears?: number;
    quitDate?: string;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`${this.baseUrl}/social-history`, data);
    return response.data;
  }

  async removeSocialHistory(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/social-history/${id}`);
  }

  // ── NSA / Good Faith Estimates ────────────────────────────────────
  async getGfeEstimates(): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/gfe-estimates`);
    return response.data;
  }

  async getGfeEstimate(id: string): Promise<any> {
    const response = await api.get(`${this.baseUrl}/gfe-estimates/${id}`);
    return response.data;
  }

  async acknowledgeGfe(id: string): Promise<any> {
    const response = await api.post(`${this.baseUrl}/gfe-estimates/${id}/acknowledge`, {});
    return response.data;
  }
}

export const patientPortalService = new PatientPortalService();
export default patientPortalService;
