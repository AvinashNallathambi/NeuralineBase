import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ScreeningInstrument,
  InstrumentCategory,
} from './entities/screening-instrument.entity';
import {
  ScreeningResult,
  ScreeningResultStatus,
  QuestionAnswer,
  ScoreResult,
  ScreeningAlert,
} from './entities/screening-result.entity';
import {
  CreateCustomInstrumentDto,
  UpdateInstrumentDto,
  StartScreeningDto,
  SubmitAnswersDto,
} from './dto/screening.dto';
import { PREDEFINED_INSTRUMENTS, PredefinedInstrument } from './instruments/instrument-registry';

@Injectable()
export class ScreeningService {
  private readonly logger = new Logger(ScreeningService.name);

  constructor(
    @InjectRepository(ScreeningInstrument)
    private readonly instrumentRepo: Repository<ScreeningInstrument>,
    @InjectRepository(ScreeningResult)
    private readonly resultRepo: Repository<ScreeningResult>,
  ) {}

  // ── Instrument Seeding ────────────────────────────────────────────

  async seedPredefinedInstruments(tenantId: string): Promise<number> {
    let count = 0;
    for (const def of PREDEFINED_INSTRUMENTS) {
      const existing = await this.instrumentRepo.findOne({
        where: { tenantId, code: def.code },
      });
      if (!existing) {
        const instrument = this.instrumentRepo.create({
          tenantId,
          code: def.code,
          title: def.title,
          description: def.description,
          category: def.category,
          isPredefined: true,
          isLocked: true,
          loincCode: def.loincCode || null,
          version: def.version,
          questions: def.questions,
          scoringRules: def.scoringRules,
          administrationRules: def.administrationRules,
          estimatedMinutes: def.estimatedMinutes,
          isActive: true,
        });
        await this.instrumentRepo.save(instrument);
        count++;
      }
    }
    this.logger.log(`Seeded ${count} predefined screening instruments for tenant ${tenantId}`);
    return count;
  }

  // ── Instrument CRUD ───────────────────────────────────────────────

  async listInstruments(tenantId: string, category?: InstrumentCategory): Promise<ScreeningInstrument[]> {
    const where: any = { tenantId, isActive: true };
    if (category) where.category = category;
    return this.instrumentRepo.find({ where, order: { title: 'ASC' } });
  }

  async getInstrument(tenantId: string, id: string): Promise<ScreeningInstrument> {
    const inst = await this.instrumentRepo.findOne({ where: { tenantId, id } });
    if (!inst) throw new NotFoundException(`Instrument ${id} not found`);
    return inst;
  }

  async getInstrumentByCode(tenantId: string, code: string): Promise<ScreeningInstrument> {
    const inst = await this.instrumentRepo.findOne({ where: { tenantId, code } });
    if (!inst) throw new NotFoundException(`Instrument ${code} not found`);
    return inst;
  }

  async createCustomInstrument(tenantId: string, dto: CreateCustomInstrumentDto, createdBy: string): Promise<ScreeningInstrument> {
    const inst = this.instrumentRepo.create({
      tenantId,
      code: dto.code,
      title: dto.title,
      description: dto.description || null,
      category: dto.category,
      isPredefined: false,
      isLocked: false,
      loincCode: null,
      version: '1.0',
      questions: dto.questions,
      scoringRules: dto.scoringRules || null,
      administrationRules: dto.administrationRules || null,
      estimatedMinutes: dto.estimatedMinutes || 5,
      isActive: true,
      createdBy,
    });
    return this.instrumentRepo.save(inst);
  }

  async updateInstrument(tenantId: string, id: string, dto: UpdateInstrumentDto): Promise<ScreeningInstrument> {
    const inst = await this.getInstrument(tenantId, id);
    if (inst.isLocked) {
      // Can only update administration rules and active status on locked instruments
      if (dto.administrationRules !== undefined) inst.administrationRules = dto.administrationRules;
      if (dto.isActive !== undefined) inst.isActive = dto.isActive;
    } else {
      Object.assign(inst, dto);
    }
    return this.instrumentRepo.save(inst);
  }

  // ── Screening Administration ──────────────────────────────────────

  async startScreening(tenantId: string, dto: StartScreeningDto, userId: string, userName: string): Promise<ScreeningResult> {
    const instrument = await this.getInstrument(tenantId, dto.instrumentId);
    const result = this.resultRepo.create({
      tenantId,
      instrumentId: instrument.id,
      instrumentCode: instrument.code,
      instrumentTitle: instrument.title,
      patientId: dto.patientId,
      patientName: dto.patientName,
      encounterId: dto.encounterId || null,
      status: ScreeningResultStatus.IN_PROGRESS,
      answers: [],
      score: null,
      alerts: [],
      administeredBy: dto.administrationContext === 'pre_visit_portal' ? 'patient_self' : 'staff_administered',
      administeredByUserId: userId,
      administeredByName: userName,
      administrationContext: dto.administrationContext || null,
      startedAt: new Date(),
      completedAt: null,
    });
    return this.resultRepo.save(result);
  }

  async saveProgress(tenantId: string, resultId: string, answers: Array<{ questionId: string; answerValue: string }>): Promise<ScreeningResult> {
    const result = await this.getResult(tenantId, resultId);
    result.answers = this.mapAnswers(result, answers);
    return this.resultRepo.save(result);
  }

  async submitScreening(tenantId: string, resultId: string, dto: SubmitAnswersDto): Promise<ScreeningResult> {
    const result = await this.getResult(tenantId, resultId);
    const instrument = await this.getInstrument(tenantId, result.instrumentId);

    // Map answers with scores
    result.answers = this.mapAnswers(result, dto.answers);

    // Auto-score
    result.score = this.calculateScore(instrument, result.answers);

    // Check alerts
    result.alerts = this.checkAlerts(instrument, result.answers, result.score);

    result.status = ScreeningResultStatus.COMPLETED;
    result.completedAt = new Date();
    result.durationSeconds = Math.round((result.completedAt.getTime() - result.startedAt.getTime()) / 1000);
    result.notes = dto.notes || null;

    return this.resultRepo.save(result);
  }

  async discontinueScreening(tenantId: string, resultId: string): Promise<ScreeningResult> {
    const result = await this.getResult(tenantId, resultId);
    result.status = ScreeningResultStatus.DISCONTINUED;
    return this.resultRepo.save(result);
  }

  // ── Result Retrieval ──────────────────────────────────────────────

  async getResult(tenantId: string, id: string): Promise<ScreeningResult> {
    const result = await this.resultRepo.findOne({ where: { tenantId, id } });
    if (!result) throw new NotFoundException(`Screening result ${id} not found`);
    return result;
  }

  async getResultsByPatient(tenantId: string, patientId: string, instrumentCode?: string): Promise<ScreeningResult[]> {
    const where: any = { tenantId, patientId, status: ScreeningResultStatus.COMPLETED };
    if (instrumentCode) where.instrumentCode = instrumentCode;
    return this.resultRepo.find({ where, order: { completedAt: 'DESC' } });
  }

  async getResultsByInstrument(tenantId: string, instrumentId: string): Promise<ScreeningResult[]> {
    return this.resultRepo.find({
      where: { tenantId, instrumentId, status: ScreeningResultStatus.COMPLETED },
      order: { completedAt: 'DESC' },
    });
  }

  async getScoreTrend(tenantId: string, patientId: string, instrumentCode: string): Promise<ScreeningResult[]> {
    return this.resultRepo.find({
      where: { tenantId, patientId, instrumentCode, status: ScreeningResultStatus.COMPLETED },
      order: { completedAt: 'ASC' },
    });
  }

  // ── Dashboard ─────────────────────────────────────────────────────

  async getDashboard(tenantId: string): Promise<{
    totalScreenings: number;
    completedScreenings: number;
    inProgressScreenings: number;
    byInstrument: Array<{ code: string; title: string; count: number; positiveRate: number }>;
    criticalAlerts: number;
    recentResults: ScreeningResult[];
  }> {
    const results = await this.resultRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 100 });
    const completed = results.filter((r) => r.status === ScreeningResultStatus.COMPLETED);
    const inProgress = results.filter((r) => r.status === ScreeningResultStatus.IN_PROGRESS);
    const criticalAlerts = results.filter((r) => r.alerts.some((a) => a.severity === 'critical')).length;

    // Group by instrument
    const byInstrumentMap = new Map<string, { code: string; title: string; count: number; positiveCount: number }>();
    for (const r of completed) {
      const key = r.instrumentCode;
      if (!byInstrumentMap.has(key)) {
        byInstrumentMap.set(key, { code: r.instrumentCode, title: r.instrumentTitle, count: 0, positiveCount: 0 });
      }
      const entry = byInstrumentMap.get(key)!;
      entry.count++;
      // Count "positive" as moderate or worse
      if (r.score?.severity && ['moderate', 'moderately_severe', 'severe', 'high'].includes(r.score.severity)) {
        entry.positiveCount++;
      }
    }

    return {
      totalScreenings: results.length,
      completedScreenings: completed.length,
      inProgressScreenings: inProgress.length,
      byInstrument: Array.from(byInstrumentMap.values()).map((e) => ({
        code: e.code,
        title: e.title,
        count: e.count,
        positiveRate: e.count > 0 ? Math.round((e.positiveCount / e.count) * 100) : 0,
      })),
      criticalAlerts,
      recentResults: results.slice(0, 10),
    };
  }

  // ── Scoring Engine ────────────────────────────────────────────────

  private mapAnswers(result: ScreeningResult, rawAnswers: Array<{ questionId: string; answerValue: string }>): QuestionAnswer[] {
    const instrument = { questions: [] as any[] };
    // We need the instrument questions to map scores — but we don't have the instrument here.
    // Instead, we'll store the raw answers and compute scores during submit.
    // For now, just map to QuestionAnswer format with what we have.
    return rawAnswers.map((a) => ({
      questionId: a.questionId,
      questionText: '', // Will be filled during scoring
      answerValue: a.answerValue,
    }));
  }

  private calculateScore(instrument: ScreeningInstrument, answers: QuestionAnswer[]): ScoreResult | null {
    if (!instrument.scoringRules) return null;
    const rules = instrument.scoringRules;

    // Enrich answers with question text and scores
    const enrichedAnswers = answers.map((a) => {
      const question = instrument.questions.find((q) => q.id === a.questionId);
      const option = question?.options?.find((o) => o.value === a.answerValue);
      return {
        ...a,
        questionText: question?.text || '',
        answerLabel: option?.label || a.answerValue,
        score: option?.score ?? (question?.type === 'number' ? parseFloat(a.answerValue) || 0 : 0),
        loincCode: question?.loincCode,
        loincAnswerCode: option?.loincAnswerCode,
      };
    });
    // Update the answers in place with enriched data
    answers.length = 0;
    answers.push(...enrichedAnswers);

    if (rules.type === 'sum') {
      const totalScore = enrichedAnswers.reduce((sum, a) => sum + (a.score || 0), 0);

      // Find matching range
      if (rules.ranges) {
        for (const range of rules.ranges) {
          if (totalScore >= range.min && totalScore <= range.max) {
            return {
              totalScore,
              category: range.label,
              severity: range.severity,
              interpretation: range.label,
              recommendation: range.recommendation,
              color: range.color,
            };
          }
        }
      }
      return { totalScore, interpretation: 'Score calculated', color: '#1890ff' };
    }

    if (rules.type === 'categorical') {
      // For categorical scoring (e.g., C-SSRS), evaluate categories
      if (rules.categories) {
        for (const cat of rules.categories) {
          if (this.evaluateCategoryCondition(cat.condition, enrichedAnswers)) {
            return {
              totalScore: null,
              category: cat.label,
              severity: cat.severity as any,
              interpretation: cat.label,
              recommendation: cat.recommendation,
              color: cat.severity === 'high' ? '#ff4d4f' : cat.severity === 'moderate' ? '#fa8c16' : '#52c41a',
            };
          }
        }
      }
      return { totalScore: null, interpretation: 'Unable to categorize', color: '#1890ff' };
    }

    if (rules.type === 'custom') {
      // Custom scoring (e.g., MDQ)
      // MDQ: positive if 7+ of Q1-Q13 = Yes AND co-occurrence = Yes AND problem >= Moderate
      if (instrument.code === 'MDQ') {
        const symptomYesCount = enrichedAnswers.filter((a) =>
          a.questionId.startsWith('mdq-') &&
          !a.questionId.includes('co-occur') &&
          !a.questionId.includes('problem') &&
          a.answerValue === 'yes',
        ).length;
        const coOccur = enrichedAnswers.find((a) => a.questionId === 'mdq-co-occur')?.answerValue === 'yes';
        const problemScore = enrichedAnswers.find((a) => a.questionId === 'mdq-problem')?.score || 0;

        const isPositive = symptomYesCount >= 7 && coOccur && problemScore >= 2;
        const range = rules.ranges?.[isPositive ? 1 : 0];
        return {
          totalScore: isPositive ? 1 : 0,
          category: range?.label,
          severity: range?.severity as any,
          interpretation: range?.label || (isPositive ? 'Positive screen' : 'Negative screen'),
          recommendation: range?.recommendation,
          color: range?.color,
        };
      }

      // Generic custom: just sum
      const totalScore = enrichedAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
      if (rules.ranges) {
        for (const range of rules.ranges) {
          if (totalScore >= range.min && totalScore <= range.max) {
            return {
              totalScore,
              category: range.label,
              severity: range.severity,
              interpretation: range.label,
              recommendation: range.recommendation,
              color: range.color,
            };
          }
        }
      }
      return { totalScore, interpretation: 'Custom score calculated', color: '#1890ff' };
    }

    return null;
  }

  private evaluateCategoryCondition(condition: string, answers: QuestionAnswer[]): boolean {
    // Simple condition evaluation for categorical scoring
    // Handles patterns like "All questions answered No", "Q1 = Yes", "Any core question = Yes"
    const lower = condition.toLowerCase();

    if (lower.includes('all') && lower.includes('no')) {
      return answers.every((a) => a.answerValue === 'no' || a.answerValue === '0');
    }
    if (lower.includes('any') && lower.includes('yes')) {
      return answers.some((a) => a.answerValue === 'yes' || a.answerValue === '1');
    }
    // Check for specific question patterns like "Q1 = Yes"
    const qMatch = lower.match(/q(\d+)\s*=\s*"?(yes|no)"?/);
    if (qMatch) {
      const qNum = parseInt(qMatch[1]);
      const expected = qMatch[2];
      const answer = answers[qNum - 1];
      return answer?.answerValue === expected;
    }
    // Check for specific value patterns like "housing == temporary"
    const valueMatch = lower.match(/(\w+)\s*==\s*"(\w+)"/);
    if (valueMatch) {
      const field = valueMatch[1];
      const expected = valueMatch[2];
      return answers.some((a) =>
        a.questionId.toLowerCase().includes(field) && a.answerValue === expected,
      );
    }
    return false;
  }

  // ── Alert Checking ────────────────────────────────────────────────

  private checkAlerts(instrument: ScreeningInstrument, answers: QuestionAnswer[], score: ScoreResult | null): ScreeningAlert[] {
    const alerts: ScreeningAlert[] = [];
    const rules = instrument.administrationRules;
    if (!rules?.alertThresholds) return alerts;

    const now = new Date().toISOString();

    for (const threshold of rules.alertThresholds) {
      const triggered = this.evaluateAlertCondition(threshold.condition, answers, score, instrument.code);
      if (triggered) {
        alerts.push({
          severity: threshold.severity,
          message: threshold.message,
          triggeredAt: now,
        });
      }
    }

    return alerts;
  }

  private evaluateAlertCondition(condition: string, answers: QuestionAnswer[], score: ScoreResult | null, instrumentCode: string): boolean {
    const lower = condition.toLowerCase().trim();

    // score >= N
    const scoreMatch = lower.match(/score\s*>=\s*(\d+)/);
    if (scoreMatch) {
      const threshold = parseInt(scoreMatch[1]);
      return (score?.totalScore ?? 0) >= threshold;
    }

    // score >= N (for custom scoring where totalScore is 0/1)
    const positiveMatch = lower.match(/positive_screen/);
    if (positiveMatch) {
      return score?.totalScore === 1;
    }

    // question_N >= N or question_N == "yes"
    const qScoreMatch = lower.match(/question_(\d+)\s*>=\s*(\d+)/);
    if (qScoreMatch) {
      const qNum = parseInt(qScoreMatch[1]);
      const threshold = parseInt(qScoreMatch[2]);
      const answer = answers[qNum - 1];
      return (answer?.score ?? 0) >= threshold;
    }

    const qYesMatch = lower.match(/q(\d+)\s*==\s*"?(yes|no)"?/);
    if (qYesMatch) {
      const qNum = parseInt(qYesMatch[1]);
      const expected = qYesMatch[2];
      const answer = answers[qNum - 1];
      return answer?.answerValue === expected;
    }

    // question_9 == "yes" or question_9 >= 1
    const q9Match = lower.match(/question_9\s*==\s*"yes"\s*or\s*question_9\s*>=\s*1/);
    if (q9Match) {
      const answer = answers[8]; // Q9 is 0-indexed as 8
      return answer?.answerValue !== '0' && answer?.answerValue !== undefined;
    }

    // field == "value" (e.g., housing == "temporary")
    const fieldMatch = lower.match(/(\w+)\s*==\s*"(\w+)"/);
    if (fieldMatch) {
      const field = fieldMatch[1];
      const expected = fieldMatch[2];
      return answers.some((a) =>
        a.questionId.toLowerCase().includes(field) && a.answerValue === expected,
      );
    }

    return false;
  }
}
