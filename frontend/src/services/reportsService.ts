import { api } from './api';

export interface ReportQuery {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  providerId?: string;
  payerId?: string;
  department?: string;
}

export interface RevenueReport {
  kpis: {
    totalRevenue: number;
    totalCollections: number;
    collectionsRate: number;
    avgPerVisit: number;
    outstandingBalance: number;
    totalClaims: number;
    paidClaims: number;
    deniedClaims: number;
  };
  revenueByMonth: Array<{ name: string; revenue: number; collections: number }>;
  revenueByPayer: Array<{ name: string; value: number }>;
  paymentMethodBreakdown: Array<{ name: string; value: number }>;
  claimStatusBreakdown: Array<{ status: string; count: number; amount: number }>;
}

export interface AppointmentsReport {
  kpis: {
    totalAppointments: number;
    completed: number;
    noShows: number;
    cancelled: number;
    completionRate: number;
    noShowRate: number;
    telehealthCount: number;
  };
  appointmentsByDay: Array<{ name: string; appointments: number; noShows: number }>;
  appointmentTypeDistribution: Array<{ name: string; value: number }>;
  noShowTrend: Array<{ name: string; rate: number }>;
  utilizationByProvider: Array<{ name: string; utilization: number }>;
}

export interface ClinicalReport {
  kpis: {
    totalEncounters: number;
    avgEncounterDuration: number;
    prescriptionsWritten: number;
    labOrders: number;
    uniqueDiagnoses: number;
    telehealthEncounters: number;
  };
  topDiagnoses: Array<{ name: string; count: number }>;
  encountersByType: Array<{ name: string; value: number }>;
  prescriptionTrends: Array<{ name: string; prescriptions: number }>;
  labOrdersByStatus: Array<{ name: string; value: number }>;
}

export interface ProviderPerformanceReport {
  providers: Array<{
    id: string;
    name: string;
    specialty: string;
    patientsSeen: number;
    encounters: number;
    revenue: number;
    utilization: number;
  }>;
  productivity: Array<{ name: string; patients: number; encounters: number }>;
}

export interface RcmReport {
  kpis: {
    totalBilled: number;
    totalPaid: number;
    totalDenied: number;
    denialRate: number;
    avgDaysInAR: number;
    totalOutstanding: number;
    over90Days: number;
  };
  arAging: Array<{ bucket: string; amount: number; count: number }>;
  denialsByReason: Array<{ reason: string; count: number; amount: number }>;
  denialsByPayer: Array<{ payer: string; count: number; amount: number }>;
  claimsByStatus: Array<{ status: string; count: number; amount: number }>;
  topDenialCodes: Array<{ code: string; description: string; count: number; amount: number }>;
}

export interface ExecutiveDashboard {
  revenue: RevenueReport;
  appointments: AppointmentsReport;
  clinical: ClinicalReport;
  providers: ProviderPerformanceReport;
  rcm: RcmReport;
}

export interface NarrativeInsight {
  tab: string;
  summary: string;
  bullets: Array<{ text: string; severity?: 'info' | 'warning' | 'critical' }>;
  recommendedActions: string[];
}

export interface NaturalLanguageReport {
  question: string;
  interpretation: string;
  sqlEquivalent: string;
  data: Array<Record<string, any>>;
  columns: string[];
  aiCommentary: string;
}

export interface NoShowRiskAssessment {
  patientId: string;
  patientName: string;
  appointmentId: string;
  appointmentDate: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface DenialRiskAssessment {
  claimId: string;
  patientName: string;
  payer: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  suggestedActions: string[];
}

export interface RevenueLeakageReport {
  totalEstimatedRecovery: number;
  categories: Array<{
    category: string;
    estimatedRecovery: number;
    count: number;
    details: Array<Record<string, any>>;
  }>;
  aiSummary: string;
  prioritizedActions: Array<{ action: string; estimatedImpact: number; priority: 'high' | 'medium' | 'low' }>;
}

export interface Anomaly {
  metric: string;
  value: number;
  baseline: number;
  deviation: number;
  severity: 'warning' | 'critical';
}

class ReportsServiceClass {
  private basePath = '/reports';

  async getRevenueReport(query: ReportQuery): Promise<RevenueReport> {
    const { data } = await api.get(`${this.basePath}/revenue`, { params: query });
    return data;
  }

  async getAppointmentsReport(query: ReportQuery): Promise<AppointmentsReport> {
    const { data } = await api.get(`${this.basePath}/appointments`, { params: query });
    return data;
  }

  async getClinicalReport(query: ReportQuery): Promise<ClinicalReport> {
    const { data } = await api.get(`${this.basePath}/clinical`, { params: query });
    return data;
  }

  async getProviderPerformanceReport(query: ReportQuery): Promise<ProviderPerformanceReport> {
    const { data } = await api.get(`${this.basePath}/providers`, { params: query });
    return data;
  }

  async getRcmReport(query: ReportQuery): Promise<RcmReport> {
    const { data } = await api.get(`${this.basePath}/rcm`, { params: query });
    return data;
  }

  async getPatientFlagReport(query: ReportQuery): Promise<any> {
    const { data } = await api.get(`${this.basePath}/patient-flags`, { params: query });
    return data;
  }

  async getDashboard(query: ReportQuery): Promise<ExecutiveDashboard> {
    const { data } = await api.get(`${this.basePath}/dashboard`, { params: query });
    return data;
  }

  async exportReport(reportType: string, format: string, query: ReportQuery): Promise<Blob> {
    const { data } = await api.get(`${this.basePath}/export/${reportType}`, {
      params: { ...query, format },
      responseType: 'blob',
    });
    return data;
  }

  async getAiInsights(tab: string, query: ReportQuery): Promise<NarrativeInsight> {
    const { data } = await api.post(`${this.basePath}/ai/insights`, { tab, ...query });
    return data;
  }

  async askNaturalLanguage(question: string, query: ReportQuery): Promise<NaturalLanguageReport> {
    const { data } = await api.post(`${this.basePath}/ai/ask`, { question, ...query });
    return data;
  }

  async getNoShowRisk(days: number = 7): Promise<NoShowRiskAssessment[]> {
    const { data } = await api.get(`${this.basePath}/ai/no-show-risk`, { params: { days } });
    return data;
  }

  async getDenialRisk(): Promise<DenialRiskAssessment[]> {
    const { data } = await api.get(`${this.basePath}/ai/denial-risk`);
    return data;
  }

  async getRevenueLeakage(): Promise<RevenueLeakageReport> {
    const { data } = await api.get(`${this.basePath}/ai/revenue-leakage`);
    return data;
  }

  async getAnomalies(): Promise<Anomaly[]> {
    const { data } = await api.get(`${this.basePath}/ai/anomalies`);
    return data;
  }
}

export const reportsService = new ReportsServiceClass();
