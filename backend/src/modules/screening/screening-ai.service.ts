import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ScreeningInstrument } from './entities/screening-instrument.entity';
import { ScreeningResult } from './entities/screening-result.entity';

export interface InstrumentRecommendation {
  recommendedInstruments: Array<{
    code: string;
    title: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  reasoning: string;
}

export interface ScoreInterpretation {
  plainLanguageSummary: string;
  clinicalImplications: string;
  recommendedNextSteps: string[];
  patientEducationPoints: string[];
}

export interface RiskStratification {
  overallRisk: 'low' | 'moderate' | 'high';
  riskFactors: string[];
  protectiveFactors: string[];
  recommendedActions: string[];
  followUpUrgency: 'routine' | 'within_2_weeks' | 'within_1_week' | 'immediate';
}

@Injectable()
export class ScreeningAiService {
  private readonly logger = new Logger(ScreeningAiService.name);

  constructor(private readonly aiService: AiService) {}

  async recommendInstruments(
    patientContext: {
      age: number;
      sex: string;
      chiefComplaint?: string;
      activeDiagnoses: string[];
      recentScreenings: Array<{ code: string; date: string; score: number | null }>;
    },
    availableInstruments: ScreeningInstrument[],
  ): Promise<InstrumentRecommendation> {
    try {
      const prompt = `You are a clinical decision support AI. Recommend which standardized screening instruments should be administered for this patient.

Patient context:
- Age: ${patientContext.age}
- Sex: ${patientContext.sex}
- Chief complaint: ${patientContext.chiefComplaint || 'Not specified'}
- Active diagnoses: ${JSON.stringify(patientContext.activeDiagnoses)}
- Recent screenings: ${JSON.stringify(patientContext.recentScreenings)}

Available instruments:
${JSON.stringify(availableInstruments.map((i) => ({ code: i.code, title: i.title, category: i.category, description: i.description })), null, 2)}

Recommend which instruments should be administered. Consider:
1. USPSTF screening recommendations for the patient's age and sex
2. MIPS quality measure requirements
3. The patient's active diagnoses and chief complaint
4. Whether screenings are due (annual, etc.)
5. Clinical best practices

Return JSON with: recommendedInstruments [{code, title, reason, priority}], reasoning (string)`;

      const result = await this.aiService.generateStructured<InstrumentRecommendation>(prompt, {
        model: process.env.AI_MODEL || 'mistral',
        temperature: 0.3,
      });

      return result || { recommendedInstruments: [], reasoning: 'AI recommendation unavailable' };
    } catch (error: any) {
      this.logger.error(`Instrument recommendation failed: ${error.message}`);
      return { recommendedInstruments: [], reasoning: 'AI recommendation failed' };
    }
  }

  async interpretScore(
    instrument: ScreeningInstrument,
    result: ScreeningResult,
    patientContext: { age: number; sex: string; activeDiagnoses: string[] },
  ): Promise<ScoreInterpretation> {
    try {
      const prompt = `You are a clinical decision support AI. Interpret this screening result for the provider.

Instrument: ${instrument.title} (${instrument.code})
Score: ${JSON.stringify(result.score)}
Answers: ${JSON.stringify(result.answers)}
Patient: Age ${patientContext.age}, Sex ${patientContext.sex}
Active diagnoses: ${JSON.stringify(patientContext.activeDiagnoses)}

Provide:
1. A plain-language summary of what the score means
2. Clinical implications for this patient
3. Recommended next steps (specific, actionable)
4. Patient education points the provider should discuss

Return JSON with: plainLanguageSummary (string), clinicalImplications (string), recommendedNextSteps (string[]), patientEducationPoints (string[])`;

      const result2 = await this.aiService.generateStructured<ScoreInterpretation>(prompt, {
        model: process.env.AI_MODEL || 'mistral',
        temperature: 0.3,
      });

      return result2 || {
        plainLanguageSummary: 'AI interpretation unavailable',
        clinicalImplications: 'Unable to assess',
        recommendedNextSteps: [],
        patientEducationPoints: [],
      };
    } catch (error: any) {
      this.logger.error(`Score interpretation failed: ${error.message}`);
      return {
        plainLanguageSummary: 'AI interpretation failed',
        clinicalImplications: 'Unable to assess',
        recommendedNextSteps: [],
        patientEducationPoints: [],
      };
    }
  }

  async stratifyRisk(
    patientId: string,
    screeningHistory: ScreeningResult[],
    patientContext: { age: number; sex: string; activeDiagnoses: string[]; medications: string[] },
  ): Promise<RiskStratification> {
    try {
      const prompt = `You are a clinical risk stratification AI. Analyze this patient's screening history and clinical context to determine their overall behavioral health risk.

Patient: Age ${patientContext.age}, Sex ${patientContext.sex}
Active diagnoses: ${JSON.stringify(patientContext.activeDiagnoses)}
Medications: ${JSON.stringify(patientContext.medications)}

Screening history (${screeningHistory.length} results):
${JSON.stringify(screeningHistory.map((r) => ({
  instrument: r.instrumentCode,
  date: r.completedAt,
  score: r.score?.totalScore,
  severity: r.score?.severity,
  category: r.score?.category,
  alerts: r.alerts.map((a: { severity: string; message: string }) => a.severity + ': ' + a.message),
})), null, 2)}

Analyze:
1. Overall risk level (low, moderate, high) based on screening trends
2. Risk factors (worsening scores, positive screens, alert history)
3. Protective factors (improving scores, treatment engagement)
4. Recommended actions
5. Follow-up urgency (routine, within 2 weeks, within 1 week, immediate)

Return JSON with: overallRisk (string), riskFactors (string[]), protectiveFactors (string[]), recommendedActions (string[]), followUpUrgency (string)`;

      const result = await this.aiService.generateStructured<RiskStratification>(prompt, {
        model: process.env.AI_MODEL || 'mistral',
        temperature: 0.3,
      });

      return result || {
        overallRisk: 'low',
        riskFactors: [],
        protectiveFactors: [],
        recommendedActions: [],
        followUpUrgency: 'routine',
      };
    } catch (error: any) {
      this.logger.error(`Risk stratification failed: ${error.message}`);
      return {
        overallRisk: 'low',
        riskFactors: [],
        protectiveFactors: [],
        recommendedActions: [],
        followUpUrgency: 'routine',
      };
    }
  }
}
