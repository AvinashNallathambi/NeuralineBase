import { api } from './api';

class PatientAiService {
  private baseUrl = '/patients/portal/ai';

  async explainLabResult(data: {
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: string;
    patientAge?: number;
    patientGender?: string;
  }): Promise<{
    explanation: string;
    whatItMeans: string;
    isAbnormal: boolean;
    severity: string;
    recommendations: string[];
    followUp: string;
  }> {
    const response = await api.post(`${this.baseUrl}/explain-lab-result`, data);
    return response.data;
  }

  async assessSymptoms(data: {
    symptoms: string;
    duration?: string;
    severity?: string;
    patientAge?: number;
    patientGender?: string;
    knownConditions?: string[];
    currentMedications?: string[];
  }): Promise<{
    urgencyLevel: string;
    urgencyReason: string;
    possibleCauses: string[];
    selfCareAdvice: string[];
    recommendedAction: string;
    questionsToAskDoctor: string[];
    redFlagSymptoms: string[];
    disclaimer: string;
  }> {
    const response = await api.post(`${this.baseUrl}/assess-symptoms`, data);
    return response.data;
  }

  async checkInteractions(data: {
    medications: { name: string; dosage?: string; frequency?: string }[];
    newMedication?: { name: string; dosage?: string };
    patientAge?: number;
    patientGender?: string;
    knownConditions?: string[];
  }): Promise<{
    hasInteractions: boolean;
    interactions: {
      medications: string[];
      severity: string;
      description: string;
      recommendation: string;
    }[];
    warnings: string[];
    recommendations: string[];
  }> {
    const response = await api.post(`${this.baseUrl}/check-interactions`, data);
    return response.data;
  }

  async generateHealthEducation(data: {
    conditions?: string[];
    medications?: string[];
    recentLabs?: { testName: string; value: string; flag?: string }[];
    interests?: string[];
  }): Promise<{
    articles: {
      title: string;
      category: string;
      summary: string;
      content: string;
      readTime: string;
    }[];
  }> {
    const response = await api.post(`${this.baseUrl}/health-education`, data);
    return response.data;
  }

  async generateVisitQuestions(data: {
    conditions?: string[];
    medications?: string[];
    recentLabs?: { testName: string; value: string; flag?: string }[];
    upcomingAppointmentReason?: string;
  }): Promise<{
    questions: { question: string; category: string; priority: string }[];
    preparationTips: string[];
  }> {
    const response = await api.post(`${this.baseUrl}/visit-questions`, data);
    return response.data;
  }
}

export const patientAiService = new PatientAiService();
export default patientAiService;
