import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { ReportsService } from './reports.service';
import { ReportQueryDto, NaturalLanguageReportDto } from './dto/report-query.dto';

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

@Injectable()
export class ReportAiService {
  private readonly logger = new Logger(ReportAiService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly reportsService: ReportsService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── AI Narrative Insights ──────────────────────────────────────────────────
  async generateInsights(tenantId: string, query: ReportQueryDto, tab: string): Promise<NarrativeInsight> {
    // Gather the data for the requested tab
    let data: any;
    switch (tab) {
      case 'revenue':
        data = await this.reportsService.getRevenueReport(tenantId, query);
        break;
      case 'appointments':
        data = await this.reportsService.getAppointmentsReport(tenantId, query);
        break;
      case 'clinical':
        data = await this.reportsService.getClinicalReport(tenantId, query);
        break;
      case 'provider':
        data = await this.reportsService.getProviderPerformanceReport(tenantId, query);
        break;
      case 'rcm':
        data = await this.reportsService.getRcmReport(tenantId, query);
        break;
      default:
        data = await this.reportsService.getExecutiveDashboard(tenantId, query);
    }

    const prompt = `You are a healthcare revenue cycle and practice management analyst.
Analyze the following ${tab} report data and generate actionable insights.

Report Data (JSON):
${JSON.stringify(data, null, 2)}

Generate a response with:
1. A 2-3 sentence executive summary
2. 3-5 key bullet points highlighting notable findings, anomalies, or trends (each with a severity: info/warning/critical)
3. 2-4 recommended actions the practice should take

Respond as JSON with this exact structure:
{
  "summary": "string",
  "bullets": [{"text": "string", "severity": "info|warning|critical"}],
  "recommendedActions": ["string"]
}`;

    try {
      const result = await this.aiService.generateStructured<NarrativeInsight>(prompt, {
        temperature: 0.3,
        maxTokens: 800,
      });
      return { ...result, tab };
    } catch (err: any) {
      this.logger.error(`AI insights failed: ${err.message}`);
      // Fallback: rule-based insights
      return this.generateRuleBasedInsights(data, tab);
    }
  }

  private generateRuleBasedInsights(data: any, tab: string): NarrativeInsight {
    const bullets: Array<{ text: string; severity?: 'info' | 'warning' | 'critical' }> = [];
    const actions: string[] = [];

    if (tab === 'revenue' && data.kpis) {
      const k = data.kpis;
      if (k.collectionsRate < 90) {
        bullets.push({ text: `Collections rate is ${k.collectionsRate}% — below the 90% industry benchmark`, severity: 'warning' });
        actions.push('Review denied claims and follow up on outstanding A/R');
      }
      if (k.outstandingBalance > k.totalRevenue * 0.1) {
        bullets.push({ text: `Outstanding balance ($${k.outstandingBalance.toLocaleString()}) is high relative to total revenue`, severity: 'warning' });
        actions.push('Prioritize collections on oldest outstanding claims first');
      }
      bullets.push({ text: `Total revenue: $${k.totalRevenue.toLocaleString()} from ${k.totalClaims} claims`, severity: 'info' });
    }

    if (tab === 'appointments' && data.kpis) {
      const k = data.kpis;
      if (k.noShowRate > 8) {
        bullets.push({ text: `No-show rate is ${k.noShowRate}% — above the 8% industry average`, severity: 'warning' });
        actions.push('Implement automated appointment reminders and consider no-show prediction AI');
      }
      if (k.completionRate > 90) {
        bullets.push({ text: `Completion rate of ${k.completionRate}% is excellent`, severity: 'info' });
      }
    }

    if (tab === 'rcm' && data.kpis) {
      const k = data.kpis;
      if (k.denialRate > 5) {
        bullets.push({ text: `Denial rate is ${k.denialRate}% — above the 5% target threshold`, severity: 'critical' });
        actions.push('Analyze top denial reasons and implement front-end eligibility verification');
      }
      if (k.over90Days > 0) {
        bullets.push({ text: `$${k.over90Days.toLocaleString()} in A/R is over 90 days — at risk of write-off`, severity: 'critical' });
        actions.push('Escalate collections on 90+ day balances immediately');
      }
    }

    if (bullets.length === 0) {
      bullets.push({ text: 'Data analyzed — no critical anomalies detected in the selected period', severity: 'info' });
    }
    if (actions.length === 0) {
      actions.push('Continue monitoring key metrics regularly');
    }

    return {
      tab,
      summary: `Analysis of ${tab} data for the selected period. ${bullets.length} key findings identified.`,
      bullets,
      recommendedActions: actions,
    };
  }

  // ─── Natural-Language Report Builder ────────────────────────────────────────
  async naturalLanguageReport(
    tenantId: string,
    dto: NaturalLanguageReportDto,
  ): Promise<NaturalLanguageReport> {
    // Step 1: AI interprets the question and determines what data to fetch
    const interpretPrompt = `You are a healthcare data analyst assistant. A user asks:
"${dto.question}"

Available data domains in our EMR:
- revenue: claim financials (billed, paid, denied amounts), by payer, by month
- appointments: appointment counts, no-shows, by provider, by type, by day
- clinical: encounters, diagnoses, prescriptions, lab orders
- providers: provider performance, productivity, revenue per provider
- rcm: A/R aging, denials by reason/payer, denial codes, claim status

Respond as JSON:
{
  "interpretation": "plain-English description of what the user is asking",
  "domain": "revenue|appointments|clinical|providers|rcm",
  "sqlEquivalent": "pseudo-SQL describing the query concept"
}`;

    let interpretation: { interpretation: string; domain: string; sqlEquivalent: string };
    try {
      interpretation = await this.aiService.generateStructured(interpretPrompt, { temperature: 0.2, maxTokens: 300 });
    } catch (err: any) {
      this.logger.error(`NL interpretation failed: ${err.message}`);
      interpretation = {
        interpretation: dto.question,
        domain: 'revenue',
        sqlEquivalent: 'SELECT * FROM encounter_claims',
      };
    }

    // Step 2: Fetch the relevant data
    const query: ReportQueryDto = {
      dateRange: dto.dateRange,
      startDate: dto.startDate,
      endDate: dto.endDate,
    };

    let rawData: any;
    switch (interpretation.domain) {
      case 'appointments':
        rawData = await this.reportsService.getAppointmentsReport(tenantId, query);
        break;
      case 'clinical':
        rawData = await this.reportsService.getClinicalReport(tenantId, query);
        break;
      case 'providers':
        rawData = await this.reportsService.getProviderPerformanceReport(tenantId, query);
        break;
      case 'rcm':
        rawData = await this.reportsService.getRcmReport(tenantId, query);
        break;
      case 'revenue':
      default:
        rawData = await this.reportsService.getRevenueReport(tenantId, query);
    }

    // Step 3: AI generates commentary answering the question using the data
    const commentaryPrompt = `A healthcare practice user asked: "${dto.question}"

Here is the relevant ${interpretation.domain} data:
${JSON.stringify(rawData, null, 2)}

Write a clear, concise answer to the user's question using this data. Include specific numbers, percentages, and names. If the data doesn't fully answer the question, note what's missing. Keep it under 300 words.`;

    let aiCommentary: string;
    try {
      aiCommentary = await this.aiService.generate(commentaryPrompt, { temperature: 0.4, maxTokens: 500 });
    } catch (err: any) {
      this.logger.error(`NL commentary failed: ${err.message}`);
      aiCommentary = `Based on the ${interpretation.domain} data, here are the key findings: ${JSON.stringify(rawData.kpis || rawData, null, 2)}`;
    }

    // Step 4: Flatten data for tabular display
    const { columns, data } = this.flattenForNl(rawData, interpretation.domain);

    return {
      question: dto.question,
      interpretation: interpretation.interpretation,
      sqlEquivalent: interpretation.sqlEquivalent,
      data,
      columns,
      aiCommentary,
    };
  }

  private flattenForNl(rawData: any, domain: string): { columns: string[]; data: Array<Record<string, any>> } {
    // Try to find the most relevant array in the data
    const arrayFields = Object.entries(rawData).filter(([, v]) => Array.isArray(v) && v.length > 0);
    if (arrayFields.length > 0) {
      const [key, arr] = arrayFields[0] as [string, any[]];
      if (arr.length > 0 && typeof arr[0] === 'object') {
        const columns = Object.keys(arr[0]);
        return { columns, data: arr };
      }
    }
    // Fallback: flatten KPIs
    if (rawData.kpis) {
      const columns = Object.keys(rawData.kpis);
      return { columns, data: [rawData.kpis] };
    }
    return { columns: ['data'], data: [{ data: JSON.stringify(rawData) }] };
  }

  // ─── No-Show Risk Prediction ────────────────────────────────────────────────
  async predictNoShowRisk(tenantId: string, days: number = 7): Promise<NoShowRiskAssessment[]> {
    // Get upcoming appointments
    const appts = await this.dataSource.query(
      `SELECT a.id, a.patient_id, a.start_time, a.appointment_type, a.is_telehealth,
         p.first_name || ' ' || p.last_name as patient_name,
         p.date_of_birth
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id::text
       WHERE a.tenant_id = $1
         AND a.start_time BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
         AND a.status NOT IN ('cancelled','completed','no_show','no-show')
         AND a.deleted_at IS NULL
       ORDER BY a.start_time ASC LIMIT 100`,
      [tenantId],
    );

    if (appts.length === 0) return [];

    // Get patient no-show history
    const patientIds = appts.map((a: any) => a.patient_id).filter(Boolean);
    let historyMap: Record<string, { total: number; noShows: number }> = {};
    if (patientIds.length > 0) {
      const history = await this.dataSource.query(
        `SELECT patient_id,
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status IN ('no_show','no-show')) as no_shows
         FROM appointments
         WHERE tenant_id = $1 AND patient_id = ANY($2::text[])
           AND start_time < NOW() AND deleted_at IS NULL
         GROUP BY patient_id`,
        [tenantId, patientIds],
      );
      historyMap = Object.fromEntries(history.map((h: any) => [h.patient_id, { total: parseInt(h.total, 10), noShows: parseInt(h.no_shows, 10) }]));
    }

    // Rule-based risk scoring (can be enhanced with ML model later)
    const assessments: NoShowRiskAssessment[] = appts.map((appt: any) => {
      const factors: string[] = [];
      let score = 10; // base risk

      // Factor 1: Patient no-show history
      const hist = historyMap[appt.patient_id];
      if (hist && hist.total > 0) {
        const patientNoShowRate = hist.noShows / hist.total;
        score += patientNoShowRate * 40;
        if (patientNoShowRate > 0.2) factors.push(`${(patientNoShowRate * 100).toFixed(0)}% prior no-show rate (${hist.noShows}/${hist.total})`);
      } else if (!hist) {
        score += 5;
        factors.push('New patient — no appointment history');
      }

      // Factor 2: Days until appointment (longer lead time = higher no-show risk)
      const daysUntil = Math.ceil((new Date(appt.start_time).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntil > 14) {
        score += 15;
        factors.push(`Appointment is ${daysUntil} days out (long lead time)`);
      } else if (daysUntil > 7) {
        score += 8;
        factors.push(`Appointment is ${daysUntil} days out`);
      }

      // Factor 3: Day of week (Friday afternoons have higher no-show rates)
      const dow = new Date(appt.start_time).getDay();
      const hour = new Date(appt.start_time).getHours();
      if (dow === 5 && hour >= 14) {
        score += 10;
        factors.push('Friday afternoon slot (historically higher no-show)');
      }

      // Factor 4: Telehealth has different no-show patterns
      if (appt.is_telehealth) {
        score += 5;
        factors.push('Telehealth appointment');
      }

      // Factor 5: Early morning appointments
      if (hour < 9) {
        score += 8;
        factors.push('Early morning appointment');
      }

      score = Math.min(100, Math.round(score));
      const riskLevel = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

      return {
        patientId: appt.patient_id,
        patientName: appt.patient_name || 'Unknown',
        appointmentId: appt.id,
        appointmentDate: appt.start_time,
        riskScore: score,
        riskLevel: riskLevel as 'low' | 'medium' | 'high',
        factors,
      };
    });

    // Sort by risk score descending
    return assessments.sort((a, b) => b.riskScore - a.riskScore);
  }

  // ─── Denial Risk Prediction ─────────────────────────────────────────────────
  async predictDenialRisk(tenantId: string): Promise<DenialRiskAssessment[]> {
    // Get claims that are ready to bill or draft (not yet submitted)
    const claims = await this.dataSource.query(
      `SELECT ec.id, ec.total_billed, ec.status, ec.service_date,
         p.first_name || ' ' || p.last_name as patient_name,
         ip.name as payer_name
       FROM encounter_claims ec
       LEFT JOIN patients p ON ec.patient_id = p.id
       LEFT JOIN insurance_payers ip ON ec.insurance_payer_id = ip.id
       WHERE ec.tenant_id = $1
         AND ec.status IN ('draft','ready_to_bill')
         AND ec.deleted_at IS NULL
       ORDER BY ec.total_billed DESC LIMIT 50`,
      [tenantId],
    );

    if (claims.length === 0) return [];

    // Get historical denial patterns by payer
    const payerDenialRates = await this.dataSource.query(
      `SELECT ip.name as payer,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE ec.status = 'denied') as denied
       FROM encounter_claims ec
       LEFT JOIN insurance_payers ip ON ec.insurance_payer_id = ip.id
       WHERE ec.tenant_id = $1 AND ec.deleted_at IS NULL AND ec.status IS NOT NULL
       GROUP BY ip.name`,
      [tenantId],
    );
    const payerMap: Record<string, { total: number; denied: number }> = Object.fromEntries(
      payerDenialRates.map((r: any) => [r.payer, { total: parseInt(r.total, 10), denied: parseInt(r.denied, 10) }]),
    );

    // Get top denial root causes for context
    const topDenialCauses = await this.dataSource.query(
      `SELECT root_cause_category, COUNT(*) as cnt
       FROM denial_records
       WHERE tenant_id = $1
       GROUP BY root_cause_category ORDER BY cnt DESC LIMIT 5`,
      [tenantId],
    );
    const commonCauses = topDenialCauses.map((r: any) => r.root_cause_category?.replace(/_/g, ' ')).filter(Boolean);

    const assessments: DenialRiskAssessment[] = claims.map((claim: any) => {
      const factors: string[] = [];
      const actions: string[] = [];
      let score = 5;

      // Factor 1: Payer historical denial rate
      const payerStats = payerMap[claim.payer_name];
      if (payerStats && payerStats.total > 5) {
        const payerDenialRate = payerStats.denied / payerStats.total;
        score += payerDenialRate * 50;
        if (payerDenialRate > 0.15) {
          factors.push(`${claim.payer_name} has a ${(payerDenialRate * 100).toFixed(0)}% historical denial rate`);
          actions.push(`Verify ${claim.payer_name} eligibility and prior authorization requirements`);
        }
      }

      // Factor 2: High-value claims are more likely to be scrutinized
      if (claim.total_billed > 2000) {
        score += 15;
        factors.push(`High-value claim ($${parseFloat(claim.total_billed).toLocaleString()}) — likely to be reviewed`);
        actions.push('Ensure documentation supports medical necessity for all procedures');
      }

      // Factor 3: Claim aging (older service dates = timely filing risk)
      const daysSinceService = Math.floor((Date.now() - new Date(claim.service_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceService > 90) {
        score += 20;
        factors.push(`Service date is ${daysSinceService} days ago — timely filing risk`);
        actions.push('Submit immediately — approaching timely filing deadline');
      } else if (daysSinceService > 60) {
        score += 10;
        factors.push(`Service date is ${daysSinceService} days ago`);
      }

      // Factor 4: Draft status (not yet reviewed)
      if (claim.status === 'draft') {
        score += 10;
        factors.push('Claim is still in draft — may have missing information');
        actions.push('Review claim for completeness before submission');
      }

      // Factor 5: Common denial causes in the practice
      if (commonCauses.length > 0 && score < 30) {
        factors.push(`Practice commonly sees denials for: ${commonCauses.slice(0, 3).join(', ')}`);
      }

      score = Math.min(100, Math.round(score));
      const riskLevel = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

      if (actions.length === 0) {
        actions.push('Standard pre-submission review recommended');
      }

      return {
        claimId: claim.id,
        patientName: claim.patient_name || 'Unknown',
        payer: claim.payer_name || 'Unknown',
        riskScore: score,
        riskLevel: riskLevel as 'low' | 'medium' | 'high',
        factors,
        suggestedActions: actions,
      };
    });

    return assessments.sort((a, b) => b.riskScore - a.riskScore);
  }

  // ─── Revenue Leakage AI Report ──────────────────────────────────────────────
  async getRevenueLeakageReport(tenantId: string): Promise<RevenueLeakageReport> {
    const categories: RevenueLeakageReport['categories'] = [];

    // 1. Coverage gaps — patients with upcoming appointments but no active insurance
    const coverageGaps = await this.dataSource.query(
      `SELECT a.id as appointment_id, a.start_time,
         p.id as patient_id, p.first_name || ' ' || p.last_name as patient_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id::text
       WHERE a.tenant_id = $1
         AND a.start_time BETWEEN NOW() AND NOW() + INTERVAL '14 days'
         AND a.status NOT IN ('cancelled','completed')
         AND a.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM patient_insurances pi
           WHERE pi.patient_id = p.id AND pi.tenant_id = $1
             AND pi.status = 'active' AND pi.deleted_at IS NULL
             AND (pi.expiration_date IS NULL OR pi.expiration_date > NOW())
         )
       ORDER BY a.start_time ASC LIMIT 20`,
      [tenantId],
    );

    if (coverageGaps.length > 0) {
      categories.push({
        category: 'Coverage Gaps (Upcoming Appointments)',
        estimatedRecovery: coverageGaps.length * 250, // estimated avg per visit
        count: coverageGaps.length,
        details: coverageGaps.map((g: any) => ({
          patient: g.patient_name,
          appointmentDate: g.start_time,
          issue: 'No active insurance on file',
        })),
      });
    }

    // 2. Secondary claim opportunities — paid primary claims with remaining balance
    const secondaryOps = await this.dataSource.query(
      `SELECT ec.id, ec.total_billed, ec.total_paid, ec.patient_id,
         p.first_name || ' ' || p.last_name as patient_name,
         ip.name as payer_name,
         (ec.total_billed - COALESCE(ec.total_paid, 0) - COALESCE(ec.patient_responsibility, 0)) as remaining
       FROM encounter_claims ec
       LEFT JOIN patients p ON ec.patient_id = p.id
       LEFT JOIN insurance_payers ip ON ec.insurance_payer_id = ip.id
       WHERE ec.tenant_id = $1
         AND ec.status = 'paid'
         AND ec.deleted_at IS NULL
         AND (ec.total_billed - COALESCE(ec.total_paid, 0) - COALESCE(ec.patient_responsibility, 0)) > 50
       ORDER BY remaining DESC LIMIT 20`,
      [tenantId],
    );

    if (secondaryOps.length > 0) {
      const totalRemaining = secondaryOps.reduce((s: number, r: any) => s + parseFloat(r.remaining), 0);
      categories.push({
        category: 'Secondary Claim Opportunities',
        estimatedRecovery: totalRemaining * 0.6, // estimated 60% recoverable from secondary
        count: secondaryOps.length,
        details: secondaryOps.map((r: any) => ({
          patient: r.patient_name,
          payer: r.payer_name,
          remainingBalance: parseFloat(r.remaining),
        })),
      });
    }

    // 3. Underpayments detected but not yet recovered
    const underpayments = await this.dataSource.query(
      `SELECT id, billed_amount, expected_amount, actual_paid_amount, variance_amount, patient_name
       FROM underpayment_records
       WHERE tenant_id = $1 AND status IN ('detected','investigating','disputed')
       ORDER BY variance_amount DESC LIMIT 20`,
      [tenantId],
    );

    if (underpayments.length > 0) {
      const totalVariance = underpayments.reduce((s: number, r: any) => s + parseFloat(r.variance_amount), 0);
      categories.push({
        category: 'Underpayments (Not Yet Recovered)',
        estimatedRecovery: totalVariance,
        count: underpayments.length,
        details: underpayments.map((r: any) => ({
          patient: r.patient_name,
          variance: parseFloat(r.variance_amount),
          status: 'detected',
        })),
      });
    }

    // 4. Denials at risk (approaching filing deadline)
    const denialsAtRisk = await this.dataSource.query(
      `SELECT id, denied_amount, filing_deadline,
         (SELECT p.first_name || ' ' || p.last_name FROM patients p WHERE p.id = d.patient_id) as patient_name
       FROM denial_records d
       WHERE tenant_id = $1 AND status IN ('new','in_progress')
         AND filing_deadline IS NOT NULL
         AND filing_deadline BETWEEN NOW() AND NOW() + INTERVAL '30 days'
       ORDER BY filing_deadline ASC LIMIT 20`,
      [tenantId],
    );

    if (denialsAtRisk.length > 0) {
      const totalAtRisk = denialsAtRisk.reduce((s: number, r: any) => s + parseFloat(r.denied_amount), 0);
      categories.push({
        category: 'Denials Approaching Filing Deadline',
        estimatedRecovery: totalAtRisk * 0.5,
        count: denialsAtRisk.length,
        details: denialsAtRisk.map((r: any) => ({
          patient: r.patient_name,
          deniedAmount: parseFloat(r.denied_amount),
          filingDeadline: r.filing_deadline,
        })),
      });
    }

    // 5. Outstanding A/R over 90 days
    const oldAR = await this.dataSource.query(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(total_billed - COALESCE(total_paid, 0)), 0) as amt
       FROM encounter_claims
       WHERE tenant_id = $1 AND status NOT IN ('paid','cancelled') AND deleted_at IS NULL
         AND service_date < NOW() - INTERVAL '90 days'
         AND total_billed > COALESCE(total_paid, 0)`,
      [tenantId],
    );

    if (parseInt(oldAR[0]?.cnt || '0', 10) > 0) {
      categories.push({
        category: 'A/R Over 90 Days',
        estimatedRecovery: parseFloat(oldAR[0].amt) * 0.3, // 30% recovery estimate
        count: parseInt(oldAR[0].cnt, 10),
        details: [{ totalOutstanding: parseFloat(oldAR[0].amt), claimsCount: parseInt(oldAR[0].cnt, 10) }],
      });
    }

    const totalEstimatedRecovery = categories.reduce((s, c) => s + c.estimatedRecovery, 0);

    // Generate AI summary
    let aiSummary: string;
    try {
      const summaryPrompt = `You are a healthcare revenue cycle expert. Analyze this revenue leakage report and write a concise executive summary with prioritized actions.

Revenue Leakage Categories:
${JSON.stringify(categories.map((c) => ({ category: c.category, estimatedRecovery: c.estimatedRecovery, count: c.count })), null, 2)}

Total Estimated Recovery: $${totalEstimatedRecovery.toLocaleString()}

Write a 3-4 sentence summary highlighting the biggest opportunities and 3-5 prioritized actions. Be specific with dollar amounts.`;

      aiSummary = await this.aiService.generate(summaryPrompt, { temperature: 0.4, maxTokens: 400 });
    } catch (err: any) {
      this.logger.error(`AI leakage summary failed: ${err.message}`);
      aiSummary = `Revenue leakage analysis identified ${categories.length} categories with an estimated $${totalEstimatedRecovery.toLocaleString()} in recoverable revenue. Prioritize: ${categories.map((c) => c.category).join(', ')}.`;
    }

    // Build prioritized actions
    const prioritizedActions = categories
      .sort((a, b) => b.estimatedRecovery - a.estimatedRecovery)
      .map((c) => ({
        action: `Address ${c.category}: ${c.count} items, estimated $${c.estimatedRecovery.toLocaleString()} recoverable`,
        estimatedImpact: c.estimatedRecovery,
        priority: c.estimatedRecovery > totalEstimatedRecovery * 0.3 ? 'high' as const : 'medium' as const,
      }));

    return {
      totalEstimatedRecovery: Math.round(totalEstimatedRecovery),
      categories,
      aiSummary,
      prioritizedActions,
    };
  }

  // ─── Anomaly Detection ──────────────────────────────────────────────────────
  async detectAnomalies(tenantId: string): Promise<Array<{ metric: string; value: number; baseline: number; deviation: number; severity: 'warning' | 'critical' }>> {
    // Compare last 7 days vs prior 30-day baseline
    const metrics = await this.dataSource.query(
      `WITH recent AS (
         SELECT
           COUNT(*) FILTER (WHERE status = 'denied') as recent_denials,
           COUNT(*) as recent_claims
         FROM encounter_claims
         WHERE tenant_id = $1 AND service_date >= NOW() - INTERVAL '7 days' AND deleted_at IS NULL
       ),
       baseline AS (
         SELECT
           COUNT(*) FILTER (WHERE status = 'denied') / 4.0 as baseline_denials,
           COUNT(*) / 4.0 as baseline_claims
         FROM encounter_claims
         WHERE tenant_id = $1 AND service_date BETWEEN NOW() - INTERVAL '37 days' AND NOW() - INTERVAL '7 days'
           AND deleted_at IS NULL
       )
       SELECT
         recent.recent_denials, baseline.baseline_denials,
         recent.recent_claims, baseline.baseline_claims
       FROM recent, baseline`,
      [tenantId],
    );

    const anomalies: Array<{ metric: string; value: number; baseline: number; deviation: number; severity: 'warning' | 'critical' }> = [];
    const m = metrics[0] || {};

    const recentDenials = parseInt(m.recent_denials || '0', 10);
    const baselineDenials = parseFloat(m.baseline_denials || '0');
    if (baselineDenials > 0) {
      const dev = ((recentDenials - baselineDenials) / baselineDenials) * 100;
      if (Math.abs(dev) > 20) {
        anomalies.push({
          metric: 'Weekly Denial Count',
          value: recentDenials,
          baseline: Math.round(baselineDenials),
          deviation: Math.round(dev),
          severity: dev > 50 ? 'critical' : 'warning',
        });
      }
    }

    // No-show anomaly
    const noShowMetrics = await this.dataSource.query(
      `WITH recent AS (
         SELECT COUNT(*) FILTER (WHERE status IN ('no_show','no-show')) as recent_ns,
                COUNT(*) as recent_total
         FROM appointments
         WHERE tenant_id = $1 AND start_time >= NOW() - INTERVAL '7 days' AND deleted_at IS NULL
       ),
       baseline AS (
         SELECT COUNT(*) FILTER (WHERE status IN ('no_show','no-show')) / 4.0 as baseline_ns,
                COUNT(*) / 4.0 as baseline_total
         FROM appointments
         WHERE tenant_id = $1 AND start_time BETWEEN NOW() - INTERVAL '37 days' AND NOW() - INTERVAL '7 days'
           AND deleted_at IS NULL
       )
       SELECT recent.recent_ns, baseline.baseline_ns, recent.recent_total, baseline.baseline_total
      FROM recent, baseline`,
      [tenantId],
    );

    const ns = noShowMetrics[0] || {};
    const recentNsRate = parseInt(ns.recent_total || '0', 10) > 0
      ? (parseInt(ns.recent_ns || '0', 10) / parseInt(ns.recent_total || '0', 10)) * 100
      : 0;
    const baselineNsRate = parseFloat(ns.baseline_total || '0') > 0
      ? (parseFloat(ns.baseline_ns || '0') / parseFloat(ns.baseline_total || '0')) * 100
      : 0;

    if (baselineNsRate > 0) {
      const dev = ((recentNsRate - baselineNsRate) / baselineNsRate) * 100;
      if (Math.abs(dev) > 25) {
        anomalies.push({
          metric: 'No-Show Rate',
          value: Math.round(recentNsRate * 10) / 10,
          baseline: Math.round(baselineNsRate * 10) / 10,
          deviation: Math.round(dev),
          severity: dev > 50 ? 'critical' : 'warning',
        });
      }
    }

    return anomalies;
  }
}
