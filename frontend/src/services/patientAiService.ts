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

  // ── Medical & Family History AI Features ──

  async extractHistoryFromText(data: {
    freeText: string;
    patientAge?: number;
    patientGender?: string;
  }): Promise<{
    conditions: { description: string; code?: string; onsetDate?: string; notes?: string }[];
    allergies: { allergen: string; reaction?: string; severity?: string; onsetDate?: string }[];
    familyHistory: { relationship: string; condition: string; ageOfOnset?: number; isDeceased?: boolean; ageAtDeath?: number }[];
    surgeries: { procedure: string; date?: string; notes?: string }[];
    medications: { name: string; dosage?: string; frequency?: string }[];
    summary: string;
    confidence: string;
  }> {
    const response = await api.post(`${this.baseUrl}/extract-history`, data);
    return response.data;
  }

  async assessFamilyHistoryRisk(data: {
    familyHistory: { relationship: string; condition: string; ageOfOnset?: number; isDeceased?: boolean; ageAtDeath?: number }[];
    patientAge?: number;
    patientGender?: string;
    patientConditions?: string[];
  }): Promise<{
    overallRiskLevel: string;
    riskScore: number;
    identifiedRisks: {
      syndrome: string;
      riskLevel: string;
      reason: string;
      affectedRelatives: string[];
      recommendation: string;
    }[];
    recommendedScreenings: { screening: string; reason: string; recommendedAge: string; frequency: string }[];
    geneticCounselingRecommended: boolean;
    geneticCounselingReason: string;
    preventiveMeasures: string[];
    disclaimer: string;
  }> {
    const response = await api.post(`${this.baseUrl}/family-history-risk`, data);
    return response.data;
  }

  async generateHealthSummary(data: {
    conditions: { description: string; clinicalStatus?: string; onsetDate?: string; isChronic?: boolean }[];
    allergies: { allergen: string; reaction?: string; severity?: string }[];
    familyHistory: { relationship: string; condition: string }[];
    medications?: { name: string; dosage?: string }[];
    patientAge?: number;
    patientGender?: string;
  }): Promise<{
    summary: string;
    bodySystems: { system: string; conditions: string[]; recommendations: string[] }[];
    keyTakeaways: string[];
    riskFactors: string[];
    recommendedActions: string[];
    disclaimer: string;
  }> {
    const response = await api.post(`${this.baseUrl}/health-summary`, data);
    return response.data;
  }

  async suggestScreenings(data: {
    conditions: { description: string; isChronic?: boolean }[];
    familyHistory: { relationship: string; condition: string; ageOfOnset?: number }[];
    patientAge: number;
    patientGender: string;
    medications?: string[];
  }): Promise<{
    recommendedScreenings: {
      screening: string;
      reason: string;
      urgency: string;
      recommendedFrequency: string;
      guidelineSource: string;
      relatedTo: string;
    }[];
    overdueScreenings: { screening: string; reason: string; lastRecommended: string }[];
    lifestyleRecommendations: string[];
    disclaimer: string;
  }> {
    const response = await api.post(`${this.baseUrl}/suggest-screenings`, data);
    return response.data;
  }
}

export const patientAiService = new PatientAiService();
export default patientAiService;
