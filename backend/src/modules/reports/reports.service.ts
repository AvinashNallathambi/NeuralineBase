import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReportQueryDto, ReportDateRange } from './dto/report-query.dto';

// Shared month names for chart labels
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DateRange {
  start: Date;
  end: Date;
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

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ─── Date Range Helper ──────────────────────────────────────────────────────
  getDateRange(query: ReportQueryDto): DateRange {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (query.dateRange === ReportDateRange.CUSTOM && query.startDate && query.endDate) {
      return { start: new Date(query.startDate), end: new Date(query.endDate) };
    }

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    switch (query.dateRange) {
      case ReportDateRange.LAST_7_DAYS:
        start.setDate(start.getDate() - 7);
        break;
      case ReportDateRange.LAST_90_DAYS:
        start.setDate(start.getDate() - 90);
        break;
      case ReportDateRange.THIS_MONTH:
        start.setDate(1);
        break;
      case ReportDateRange.THIS_QUARTER:
        start.setMonth(Math.floor(start.getMonth() / 3) * 3);
        start.setDate(1);
        break;
      case ReportDateRange.THIS_YEAR:
        start.setMonth(0);
        start.setDate(1);
        break;
      case ReportDateRange.LAST_YEAR:
        start.setFullYear(start.getFullYear() - 1);
        start.setMonth(0);
        start.setDate(1);
        end.setFullYear(end.getFullYear() - 1);
        end.setMonth(11);
        end.setDate(31);
        break;
      case ReportDateRange.LAST_30_DAYS:
      default:
        start.setDate(start.getDate() - 30);
        break;
    }

    return { start, end };
  }

  private providerFilter(query: ReportQueryDto): string {
    return query.providerId ? `AND provider_id = :providerId` : '';
  }

  // ─── Revenue Report ─────────────────────────────────────────────────────────
  async getRevenueReport(tenantId: string, query: ReportQueryDto): Promise<RevenueReport> {
    const { start, end } = this.getDateRange(query);

    // KPIs from encounter_claims
    const kpiRows = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(total_billed), 0) as total_revenue,
         COALESCE(SUM(total_paid), 0) as total_collections,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN total_billed ELSE 0 END), 0) as paid_amount,
         COUNT(*) FILTER (WHERE status = 'paid') as paid_claims,
         COUNT(*) FILTER (WHERE status = 'denied') as denied_claims,
         COUNT(*) as total_claims,
         COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled','denied') THEN total_billed - COALESCE(total_paid, 0) ELSE 0 END), 0) as outstanding
       FROM encounter_claims
       WHERE tenant_id = $1 AND service_date BETWEEN $2 AND $3
         AND deleted_at IS NULL`,
      [tenantId, start, end],
    );

    const kpiData = kpiRows[0] || {};
    const totalRevenue = parseFloat(kpiData.total_revenue || '0');
    const totalCollections = parseFloat(kpiData.total_collections || '0');
    const totalClaims = parseInt(kpiData.total_claims || '0', 10);
    const paidClaims = parseInt(kpiData.paid_claims || '0', 10);

    // Revenue by month
    const monthlyRows = await this.dataSource.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', service_date), 'YYYY-MM') as month,
         COALESCE(SUM(total_billed), 0) as revenue,
         COALESCE(SUM(total_paid), 0) as collections
       FROM encounter_claims
       WHERE tenant_id = $1 AND service_date BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY DATE_TRUNC('month', service_date)
       ORDER BY month`,
      [tenantId, start, end],
    );

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueByMonth = monthlyRows.map((r: any) => {
      const d = new Date(r.month + '-01');
      return { name: monthNames[d.getMonth()], revenue: parseFloat(r.revenue), collections: parseFloat(r.collections) };
    });

    // Revenue by payer
    const payerRows = await this.dataSource.query(
      `SELECT
         COALESCE(ip.name, 'Unknown') as payer_name,
         COALESCE(SUM(ec.total_billed), 0) as total
       FROM encounter_claims ec
       LEFT JOIN insurance_payers ip ON ec.insurance_payer_id = ip.id
       WHERE ec.tenant_id = $1 AND ec.service_date BETWEEN $2 AND $3 AND ec.deleted_at IS NULL
       GROUP BY ip.name
       ORDER BY total DESC
       LIMIT 10`,
      [tenantId, start, end],
    );

    const revenueByPayer = payerRows
      .map((r: any) => ({ name: r.payer_name, value: parseFloat(r.total) }))
      .filter((r: any) => r.value > 0);

    // Payment method breakdown from payments
    const paymentRows = await this.dataSource.query(
      `SELECT
         COALESCE(method::text, 'unknown') as method,
         COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 AND status = 'succeeded'
       GROUP BY method::text
       ORDER BY total DESC`,
      [tenantId, start, end],
    );

    const methodLabels: Record<string, string> = { card: 'Card', ach: 'ACH', cash: 'Cash', check: 'Check', other: 'Other' };
    const paymentMethodBreakdown = paymentRows.map((r: any) => ({
      name: methodLabels[r.method] || r.method,
      value: parseFloat(r.total),
    }));

    // Claim status breakdown
    const statusRows = await this.dataSource.query(
      `SELECT status, COUNT(*) as cnt, COALESCE(SUM(total_billed), 0) as amt
       FROM encounter_claims
       WHERE tenant_id = $1 AND service_date BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY status ORDER BY amt DESC`,
      [tenantId, start, end],
    );

    const claimStatusBreakdown = statusRows.map((r: any) => ({
      status: r.status,
      count: parseInt(r.cnt, 10),
      amount: parseFloat(r.amt),
    }));

    const outstandingBalance = parseFloat(kpiData.outstanding || '0');
    const collectionsRate = totalRevenue > 0 ? (totalCollections / totalRevenue) * 100 : 0;
    const avgPerVisit = paidClaims > 0 ? totalCollections / paidClaims : 0;

    return {
      kpis: {
        totalRevenue,
        totalCollections,
        collectionsRate: Math.round(collectionsRate * 10) / 10,
        avgPerVisit: Math.round(avgPerVisit),
        outstandingBalance: Math.round(outstandingBalance),
        totalClaims,
        paidClaims,
        deniedClaims: parseInt(kpiData.denied_claims || '0', 10),
      },
      revenueByMonth,
      revenueByPayer,
      paymentMethodBreakdown,
      claimStatusBreakdown,
    };
  }

  // ─── Appointments Report ────────────────────────────────────────────────────
  async getAppointmentsReport(tenantId: string, query: ReportQueryDto): Promise<AppointmentsReport> {
    const { start, end } = this.getDateRange(query);
    const providerFilter = query.providerId ? `AND provider_id = :providerId` : '';
    const params: any[] = [tenantId, start, end];
    if (query.providerId) params.push(query.providerId);

    // KPIs
    const kpiRows = await this.dataSource.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'no_show' OR status = 'no-show') as no_shows,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
         COUNT(*) FILTER (WHERE is_telehealth = true) as telehealth
       FROM appointments
       WHERE tenant_id = $1 AND start_time BETWEEN $2 AND $3 AND deleted_at IS NULL
         ${providerFilter}`,
      params,
    );

    const kpiData = kpiRows[0] || {};
    const total = parseInt(kpiData.total || '0', 10);
    const completed = parseInt(kpiData.completed || '0', 10);
    const noShows = parseInt(kpiData.no_shows || '0', 10);
    const cancelled = parseInt(kpiData.cancelled || '0', 10);
    const telehealthCount = parseInt(kpiData.telehealth || '0', 10);

    // Appointments by day of week
    const dayRows = await this.dataSource.query(
      `SELECT
         EXTRACT(DOW FROM start_time) as dow,
         COUNT(*) as appts,
         COUNT(*) FILTER (WHERE status = 'no_show' OR status = 'no-show') as no_shows
       FROM appointments
       WHERE tenant_id = $1 AND start_time BETWEEN $2 AND $3 AND deleted_at IS NULL
         ${providerFilter}
       GROUP BY dow ORDER BY dow`,
      params,
    );

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const appointmentsByDay = dayRows.map((r: any) => ({
      name: dayNames[parseInt(r.dow, 10)],
      appointments: parseInt(r.appts, 10),
      noShows: parseInt(r.no_shows, 10),
    }));

    // Appointment type distribution
    const typeRows = await this.dataSource.query(
      `SELECT
         COALESCE(appointment_type::text, 'Unknown') as type,
         COUNT(*) as cnt
       FROM appointments
       WHERE tenant_id = $1 AND start_time BETWEEN $2 AND $3 AND deleted_at IS NULL
         ${providerFilter}
       GROUP BY appointment_type::text ORDER BY cnt DESC LIMIT 10`,
      params,
    );

    const appointmentTypeDistribution = typeRows.map((r: any) => ({ name: r.type, value: parseInt(r.cnt, 10) }));

    // No-show trend by month
    const noShowRows = await this.dataSource.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', start_time), 'YYYY-MM') as month,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'no_show' OR status = 'no-show') as no_shows
       FROM appointments
       WHERE tenant_id = $1 AND start_time BETWEEN $2 AND $3 AND deleted_at IS NULL
         ${providerFilter}
       GROUP BY DATE_TRUNC('month', start_time) ORDER BY month`,
      params,
    );

    const noShowTrend = noShowRows.map((r: any) => {
      const d = new Date(r.month + '-01');
      const total = parseInt(r.total, 10);
      const ns = parseInt(r.no_shows, 10);
      return { name: monthNames[d.getMonth()], rate: total > 0 ? Math.round((ns / total) * 1000) / 10 : 0 };
    });

    // Utilization by provider (appointments / available slots approximation)
    const utilRows = await this.dataSource.query(
      `SELECT
         COALESCE(provider_name, 'Unknown') as name,
         COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) as appts,
         COUNT(DISTINCT DATE(start_time)) as work_days
       FROM appointments
       WHERE tenant_id = $1 AND start_time BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY provider_name ORDER BY appts DESC LIMIT 10`,
      [tenantId, start, end],
    );

    const utilizationByProvider = utilRows.map((r: any) => {
      const appts = parseInt(r.appts, 10);
      const workDays = parseInt(r.work_days, 10);
      // Approximate utilization: appts per work day / 20 (assumed max) * 100
      const util = workDays > 0 ? Math.min(100, Math.round((appts / (workDays * 20)) * 100)) : 0;
      return { name: r.name, utilization: util };
    });

    return {
      kpis: {
        totalAppointments: total,
        completed,
        noShows,
        cancelled,
        completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        noShowRate: total > 0 ? Math.round((noShows / total) * 1000) / 10 : 0,
        telehealthCount,
      },
      appointmentsByDay,
      appointmentTypeDistribution,
      noShowTrend,
      utilizationByProvider,
    };
  }

  // ─── Clinical Report ────────────────────────────────────────────────────────
  async getClinicalReport(tenantId: string, query: ReportQueryDto): Promise<ClinicalReport> {
    const { start, end } = this.getDateRange(query);

    // Encounter KPIs
    const encKpis = await this.dataSource.query(
      `SELECT
         COUNT(*) as total,
         COALESCE(AVG(duration_minutes), 0) as avg_duration,
         COUNT(*) FILTER (WHERE type = 'telehealth') as telehealth
       FROM encounters
       WHERE tenant_id = $1 AND start_time BETWEEN $2 AND $3 AND deleted_at IS NULL`,
      [tenantId, start, end],
    );

    const encData = encKpis[0] || {};

    // Prescriptions count
    const rxRows = await this.dataSource.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', prescribed_date), 'YYYY-MM') as month,
         COUNT(*) as cnt
       FROM prescriptions
       WHERE tenant_id = $1 AND prescribed_date BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY DATE_TRUNC('month', prescribed_date) ORDER BY month`,
      [tenantId, start, end],
    );

    const prescriptionTrends = rxRows.map((r: any) => {
      const d = new Date(r.month + '-01');
      return { name: monthNames[d.getMonth()], prescriptions: parseInt(r.cnt, 10) };
    });

    const totalRx = prescriptionTrends.reduce((s: number, r: { prescriptions: number }) => s + r.prescriptions, 0);

    // Lab orders
    const labRows = await this.dataSource.query(
      `SELECT
         COALESCE(status::text, 'unknown') as status,
         COUNT(*) as cnt
       FROM lab_orders
       WHERE tenant_id = $1 AND ordered_date BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY status::text ORDER BY cnt DESC`,
      [tenantId, start, end],
    );

    const labOrdersByStatus = labRows.map((r: any) => ({ name: r.status, value: parseInt(r.cnt, 10) }));
    const totalLabs = labOrdersByStatus.reduce((s: number, r: { value: number }) => s + r.value, 0);

    // Top diagnoses from patient_problems
    const dxRows = await this.dataSource.query(
      `SELECT
         code || ' - ' || description as dx,
         COUNT(*) as cnt
       FROM patient_problems
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 AND deleted_at IS NULL
         AND clinical_status = 'active'
       GROUP BY code, description ORDER BY cnt DESC LIMIT 10`,
      [tenantId, start, end],
    );

    const topDiagnoses = dxRows.map((r: any) => ({ name: r.dx, count: parseInt(r.cnt, 10) }));
    const uniqueDx = await this.dataSource.query(
      `SELECT COUNT(DISTINCT code) as cnt FROM patient_problems
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 AND deleted_at IS NULL AND clinical_status = 'active'`,
      [tenantId, start, end],
    );

    // Encounters by type
    const encTypeRows = await this.dataSource.query(
      `SELECT
         COALESCE(type::text, 'office_visit') as type,
         COUNT(*) as cnt
       FROM encounters
       WHERE tenant_id = $1 AND start_time BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY type::text ORDER BY cnt DESC`,
      [tenantId, start, end],
    );

    const typeLabels: Record<string, string> = {
      office_visit: 'Office Visit', telehealth: 'Telehealth', hospital: 'Hospital',
      emergency: 'Emergency', home_health: 'Home Health', nursing_facility: 'Nursing Facility',
    };
    const encountersByType = encTypeRows.map((r: any) => ({
      name: typeLabels[r.type] || r.type,
      value: parseInt(r.cnt, 10),
    }));

    return {
      kpis: {
        totalEncounters: parseInt(encData.total || '0', 10),
        avgEncounterDuration: Math.round(parseFloat(encData.avg_duration || '0')),
        prescriptionsWritten: totalRx,
        labOrders: totalLabs,
        uniqueDiagnoses: parseInt(uniqueDx[0]?.cnt || '0', 10),
        telehealthEncounters: parseInt(encData.telehealth || '0', 10),
      },
      topDiagnoses,
      encountersByType,
      prescriptionTrends,
      labOrdersByStatus,
    };
  }

  // ─── Provider Performance Report ────────────────────────────────────────────
  async getProviderPerformanceReport(tenantId: string, query: ReportQueryDto): Promise<ProviderPerformanceReport> {
    const { start, end } = this.getDateRange(query);

    const rows = await this.dataSource.query(
      `SELECT
         p.id as pid,
         p.first_name || ' ' || p.last_name as name,
         COALESCE(p.specialization, p.role, 'Unknown') as specialty,
         COUNT(DISTINCT e.patient_id) as patients_seen,
         COUNT(e.id) as encounters,
         COALESCE(SUM(ec.total_paid), 0) as revenue
       FROM providers p
       LEFT JOIN encounters e ON e.provider_id::text = p.id
         AND e.tenant_id = $1 AND e.start_time BETWEEN $2 AND $3 AND e.deleted_at IS NULL
       LEFT JOIN encounter_claims ec ON ec.provider_id = p.id
         AND ec.tenant_id = $1 AND ec.service_date BETWEEN $2 AND $3 AND ec.deleted_at IS NULL
       WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
       GROUP BY p.id, p.first_name, p.last_name, p.specialization, p.role
       ORDER BY revenue DESC, encounters DESC
       LIMIT 20`,
      [tenantId, start, end],
    );

    const providers = rows.map((r: any) => ({
      id: r.pid,
      name: r.name,
      specialty: r.specialty,
      patientsSeen: parseInt(r.patients_seen, 10),
      encounters: parseInt(r.encounters, 10),
      revenue: parseFloat(r.revenue),
      utilization: 0, // calculated below
    }));

    // Calculate utilization relative to max encounters
    const maxEnc = Math.max(...providers.map((p: any) => p.encounters), 1);
    providers.forEach((p: any) => {
      p.utilization = Math.round((p.encounters / maxEnc) * 100);
    });

    const productivity = providers.slice(0, 10).map((p: any) => ({
      name: p.name,
      patients: p.patientsSeen,
      encounters: p.encounters,
    }));

    return { providers, productivity };
  }

  // ─── RCM / Denials Report ───────────────────────────────────────────────────
  async getRcmReport(tenantId: string, query: ReportQueryDto): Promise<RcmReport> {
    const { start, end } = this.getDateRange(query);

    // RCM KPIs
    const rcmKpis = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(total_billed), 0) as total_billed,
         COALESCE(SUM(total_paid), 0) as total_paid,
         COALESCE(SUM(CASE WHEN status = 'denied' THEN total_billed ELSE 0 END), 0) as total_denied,
         COUNT(*) FILTER (WHERE status = 'denied') as denied_count,
         COUNT(*) as total_count,
         COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled') THEN total_billed - COALESCE(total_paid, 0) ELSE 0 END), 0) as outstanding
       FROM encounter_claims
       WHERE tenant_id = $1 AND service_date BETWEEN $2 AND $3 AND deleted_at IS NULL`,
      [tenantId, start, end],
    );

    const rcmData = rcmKpis[0] || {};
    const totalBilled = parseFloat(rcmData.total_billed || '0');
    const totalPaid = parseFloat(rcmData.total_paid || '0');
    const totalDenied = parseFloat(rcmData.total_denied || '0');
    const deniedCount = parseInt(rcmData.denied_count || '0', 10);
    const totalCount = parseInt(rcmData.total_count || '0', 10);
    const totalOutstanding = parseFloat(rcmData.outstanding || '0');
    const denialRate = totalCount > 0 ? (deniedCount / totalCount) * 100 : 0;

    // A/R Aging buckets
    const agingRows = await this.dataSource.query(
      `SELECT
         CASE
           WHEN EXTRACT(DAY FROM NOW() - service_date) <= 30 THEN '0-30'
           WHEN EXTRACT(DAY FROM NOW() - service_date) <= 60 THEN '31-60'
           WHEN EXTRACT(DAY FROM NOW() - service_date) <= 90 THEN '61-90'
           ELSE '90+'
         END as bucket,
         COUNT(*) as cnt,
         COALESCE(SUM(total_billed - COALESCE(total_paid, 0)), 0) as amt
       FROM encounter_claims
       WHERE tenant_id = $1 AND status NOT IN ('paid','cancelled') AND deleted_at IS NULL
         AND total_billed > COALESCE(total_paid, 0)
       GROUP BY bucket ORDER BY bucket`,
      [tenantId],
    );

    const arAging = ['0-30', '31-60', '61-90', '90+'].map((bucket) => {
      const found = agingRows.find((r: any) => r.bucket === bucket);
      return {
        bucket,
        amount: found ? parseFloat(found.amt) : 0,
        count: found ? parseInt(found.cnt, 10) : 0,
      };
    });

    const over90Days = arAging.find((a) => a.bucket === '90+')?.amount || 0;

    // Denials by root cause category
    const denialReasonRows = await this.dataSource.query(
      `SELECT
         COALESCE(root_cause_category::text, 'other') as reason,
         COUNT(*) as cnt,
         COALESCE(SUM(denied_amount), 0) as amt
       FROM denial_records
       WHERE tenant_id = $1 AND denial_date BETWEEN $2 AND $3
       GROUP BY root_cause_category::text ORDER BY amt DESC LIMIT 10`,
      [tenantId, start, end],
    );

    const denialsByReason = denialReasonRows.map((r: any) => ({
      reason: r.reason.replace(/_/g, ' '),
      count: parseInt(r.cnt, 10),
      amount: parseFloat(r.amt),
    }));

    // Denials by payer
    const denialPayerRows = await this.dataSource.query(
      `SELECT
         COALESCE(ip.name, 'Unknown') as payer,
         COUNT(*) as cnt,
         COALESCE(SUM(dr.denied_amount), 0) as amt
       FROM denial_records dr
       LEFT JOIN insurance_payers ip ON dr.payer_id = ip.id
       WHERE dr.tenant_id = $1 AND dr.denial_date BETWEEN $2 AND $3
       GROUP BY ip.name ORDER BY amt DESC LIMIT 10`,
      [tenantId, start, end],
    );

    const denialsByPayer = denialPayerRows.map((r: any) => ({
      payer: r.payer,
      count: parseInt(r.cnt, 10),
      amount: parseFloat(r.amt),
    }));

    // Claims by status
    const claimsStatusRows = await this.dataSource.query(
      `SELECT status, COUNT(*) as cnt, COALESCE(SUM(total_billed), 0) as amt
       FROM encounter_claims
       WHERE tenant_id = $1 AND service_date BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY status ORDER BY amt DESC`,
      [tenantId, start, end],
    );

    const claimsByStatus = claimsStatusRows.map((r: any) => ({
      status: r.status,
      count: parseInt(r.cnt, 10),
      amount: parseFloat(r.amt),
    }));

    // Top denial codes from claim_adjustments joined with carc_codes
    const denialCodeRows = await this.dataSource.query(
      `SELECT
         ca.carc_code as code,
         COALESCE(cc.description, ca.carc_description, ca.carc_code) as description,
         COUNT(*) as cnt,
         COALESCE(SUM(ABS(ca.adjustment_amount)), 0) as amt
       FROM claim_adjustments ca
       LEFT JOIN carc_codes cc ON ca.carc_code = cc.code
       JOIN remittance_claims rc ON ca.remittance_claim_id = rc.id
       WHERE rc.tenant_id = $1 AND ca.created_at BETWEEN $2 AND $3
         AND ca.group_code IN ('CO','OA','PI')
       GROUP BY ca.carc_code, cc.description, ca.carc_description
       ORDER BY cnt DESC LIMIT 10`,
      [tenantId, start, end],
    );

    const topDenialCodes = denialCodeRows.map((r: any) => ({
      code: r.code,
      description: r.description,
      count: parseInt(r.cnt, 10),
      amount: parseFloat(r.amt),
    }));

    // Average days in A/R (from submission to paid)
    const avgDaysRow = await this.dataSource.query(
      `SELECT COALESCE(AVG(EXTRACT(DAY FROM NOW() - COALESCE(submission_date, service_date))), 0) as avg_days
       FROM encounter_claims
       WHERE tenant_id = $1 AND status NOT IN ('paid','cancelled') AND deleted_at IS NULL
         AND service_date BETWEEN $2 AND $3`,
      [tenantId, start, end],
    );

    return {
      kpis: {
        totalBilled,
        totalPaid,
        totalDenied,
        denialRate: Math.round(denialRate * 10) / 10,
        avgDaysInAR: Math.round(parseFloat(avgDaysRow[0]?.avg_days || '0')),
        totalOutstanding: Math.round(totalOutstanding),
        over90Days: Math.round(over90Days),
      },
      arAging,
      denialsByReason,
      denialsByPayer,
      claimsByStatus,
      topDenialCodes,
    };
  }

  // ─── Executive Dashboard (combined summary) ─────────────────────────────────
  async getExecutiveDashboard(tenantId: string, query: ReportQueryDto) {
    const [revenue, appointments, clinical, providers, rcm] = await Promise.all([
      this.getRevenueReport(tenantId, query),
      this.getAppointmentsReport(tenantId, query),
      this.getClinicalReport(tenantId, query),
      this.getProviderPerformanceReport(tenantId, query),
      this.getRcmReport(tenantId, query),
    ]);

    return { revenue, appointments, clinical, providers, rcm };
  }

  // ─── Patient Flag Distribution Report ───────────────────────────────────────
  async getPatientFlagReport(tenantId: string, query: ReportQueryDto) {
    const { start, end } = this.getDateRange(query);

    const bySeverity = await this.dataSource.query(
      `SELECT severity, COUNT(*) as cnt
       FROM patient_flags
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY severity ORDER BY cnt DESC`,
      [tenantId, start, end],
    );

    const byCategory = await this.dataSource.query(
      `SELECT category, COUNT(*) as cnt
       FROM patient_flags
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY category ORDER BY cnt DESC`,
      [tenantId, start, end],
    );

    const byType = await this.dataSource.query(
      `SELECT type, COUNT(*) as cnt, MAX(created_at) as last_seen
       FROM patient_flags
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 AND deleted_at IS NULL
       GROUP BY type ORDER BY cnt DESC LIMIT 15`,
      [tenantId, start, end],
    );

    const resolutionStats = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
         COUNT(*) FILTER (WHERE status = 'active') as active,
         COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/86400) FILTER (WHERE status = 'resolved'), 0) as avg_resolution_days
       FROM patient_flags
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 AND deleted_at IS NULL`,
      [tenantId, start, end],
    );

    return {
      bySeverity: bySeverity.map((r: any) => ({ name: r.severity, value: parseInt(r.cnt, 10) })),
      byCategory: byCategory.map((r: any) => ({ name: r.category, value: parseInt(r.cnt, 10) })),
      byType: byType.map((r: any) => ({ type: r.type, count: parseInt(r.cnt, 10), lastSeen: r.last_seen })),
      resolution: {
        resolved: parseInt(resolutionStats[0]?.resolved || '0', 10),
        active: parseInt(resolutionStats[0]?.active || '0', 10),
        avgResolutionDays: Math.round(parseFloat(resolutionStats[0]?.avg_resolution_days || '0')),
      },
    };
  }

}
