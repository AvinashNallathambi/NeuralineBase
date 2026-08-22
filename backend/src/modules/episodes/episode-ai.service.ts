import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { Episode, EpisodeType } from './entities/episode.entity';

interface EncounterSummary {
  id: string;
  date: string;
  type: string;
  primaryDiagnosis?: { code: string; description: string };
  providerName?: string;
  cptCodes: string[];
}

interface AutoDetectionResult {
  shouldCreateEpisode: boolean;
  confidence: number;
  suggestedTitle: string;
  suggestedType: EpisodeType;
  suggestedConditions: Array<{ code: string; description: string; isPrimary: boolean }>;
  encounterIds: string[];
  reasoning: string;
}

interface CostPredictionResult {
  predictedTotalCost: number;
  confidence: number;
  costBreakdown: { encounters: number; labs: number; imaging: number; medications: number };
  factors: string[];
}

interface PathwayDeviationResult {
  deviations: Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string; recommendedAction: string }>;
  overallRiskScore: number;
}

interface EpisodeSummaryResult {
  summary: string;
  keyEvents: string[];
  outcomes: string;
  recommendations: string[];
}

@Injectable()
export class EpisodeAiService {
  private readonly logger = new Logger(EpisodeAiService.name);

  constructor(private readonly aiService: AiService) {}

  async autoDetectEpisode(
    tenantId: string,
    patientId: string,
    encounters: EncounterSummary[],
  ): Promise<AutoDetectionResult> {
    try {
      const prompt = `You are a clinical informatics AI analyzing patient encounters to detect whether an Episode of Care should be created.

Patient ID: ${patientId}
Recent encounters (${encounters.length}):
${JSON.stringify(encounters.slice(0, 20), null, 2)}

Analyze these encounters and determine:
1. Should an episode of care be created? (true if there are 2+ encounters for the same condition within 6 months, or a chronic condition that needs longitudinal tracking)
2. Confidence score (0-100)
3. Suggested episode title (e.g., "Type 2 Diabetes Management", "Pregnancy - First Trimester")
4. Suggested episode type (acute, chronic, episodic, perinatal, surgical, behavioral, preventive)
5. Suggested conditions (ICD-10 codes with descriptions)
6. Which encounter IDs should be linked
7. Reasoning

Return JSON with: shouldCreateEpisode (boolean), confidence (number), suggestedTitle (string), suggestedType (string), suggestedConditions [{code, description, isPrimary}], encounterIds (string[]), reasoning (string)`;

      const result = await this.aiService.generateStructured<AutoDetectionResult>(prompt, {
        model: process.env.AI_MODEL || 'mistral',
        temperature: 0.3,
      });

      return result || {
        shouldCreateEpisode: false,
        confidence: 0,
        suggestedTitle: '',
        suggestedType: EpisodeType.ACUTE,
        suggestedConditions: [],
        encounterIds: [],
        reasoning: 'AI analysis unavailable',
      };
    } catch (error: any) {
      this.logger.error(`Auto-detect episode failed: ${error.message}`);
      return {
        shouldCreateEpisode: false,
        confidence: 0,
        suggestedTitle: '',
        suggestedType: EpisodeType.ACUTE,
        suggestedConditions: [],
        encounterIds: [],
        reasoning: 'AI analysis failed',
      };
    }
  }

  async predictEpisodeCost(episode: Episode, historicalEpisodes: Episode[]): Promise<CostPredictionResult> {
    try {
      const prompt = `You are a healthcare cost prediction AI. Predict the total cost for this episode of care.

Current Episode:
- Title: ${episode.title}
- Type: ${episode.episodeType}
- Conditions: ${JSON.stringify(episode.conditions)}
- Start Date: ${episode.startDate}
- Status: ${episode.status}
- Encounters so far: ${episode.encounterIds.length}

Historical episodes for similar conditions:
${JSON.stringify(historicalEpisodes.slice(0, 10).map(e => ({
  title: e.title,
  type: e.episodeType,
  conditions: e.conditions,
  durationDays: e.endDate ? Math.round((new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / 86400000) : null,
  totalCost: e.costSummary?.totalCost,
  encounterCount: e.encounterIds.length,
})), null, 2)}

Predict:
1. Total predicted cost for this episode (USD)
2. Confidence (0-100)
3. Cost breakdown (encounters, labs, imaging, medications)
4. Key factors affecting the prediction

Return JSON with: predictedTotalCost (number), confidence (number), costBreakdown {encounters, labs, imaging, medications}, factors (string[])`;

      const result = await this.aiService.generateStructured<CostPredictionResult>(prompt, {
        model: process.env.AI_MODEL || 'mistral',
        temperature: 0.3,
      });

      return result || {
        predictedTotalCost: 0,
        confidence: 0,
        costBreakdown: { encounters: 0, labs: 0, imaging: 0, medications: 0 },
        factors: ['AI prediction unavailable'],
      };
    } catch (error: any) {
      this.logger.error(`Cost prediction failed: ${error.message}`);
      return {
        predictedTotalCost: 0,
        confidence: 0,
        costBreakdown: { encounters: 0, labs: 0, imaging: 0, medications: 0 },
        factors: ['AI prediction failed'],
      };
    }
  }

  async detectPathwayDeviations(episode: Episode): Promise<PathwayDeviationResult> {
    try {
      const prompt = `You are a clinical pathway monitoring AI. Analyze this episode of care for deviations from the expected clinical pathway.

Episode:
- Title: ${episode.title}
- Type: ${episode.episodeType}
- Conditions: ${JSON.stringify(episode.conditions)}
- Start Date: ${episode.startDate}
- Status: ${episode.status}
- Timeline (${episode.timeline.length} events):
${JSON.stringify(episode.timeline.slice(0, 30), null, 2)}

Check for:
1. Missing recommended services (e.g., CHF patient without BNP in 6 months, diabetic without HbA1c in 3 months)
2. Unexpected gaps in care (long periods without follow-up)
3. Escalation patterns (increasing frequency of visits may indicate deterioration)
4. Medication adherence issues
5. Lab monitoring gaps

Return JSON with: deviations [{type, severity, description, recommendedAction}], overallRiskScore (0-100)`;

      const result = await this.aiService.generateStructured<PathwayDeviationResult>(prompt, {
        model: process.env.AI_MODEL || 'mistral',
        temperature: 0.3,
      });

      return result || { deviations: [], overallRiskScore: 0 };
    } catch (error: any) {
      this.logger.error(`Pathway deviation detection failed: ${error.message}`);
      return { deviations: [], overallRiskScore: 0 };
    }
  }

  async generateEpisodeSummary(episode: Episode): Promise<EpisodeSummaryResult> {
    try {
      const prompt = `You are a clinical documentation AI. Generate a comprehensive episode summary suitable for a referral letter or transition of care.

Episode:
- Title: ${episode.title}
- Type: ${episode.episodeType}
- Conditions: ${JSON.stringify(episode.conditions)}
- Start Date: ${episode.startDate}
- End Date: ${episode.endDate || 'Active'}
- Status: ${episode.status}
- Care Team: ${JSON.stringify(episode.careTeam)}
- Timeline (${episode.timeline.length} events):
${JSON.stringify(episode.timeline, null, 2)}
- Cost Summary: ${JSON.stringify(episode.costSummary)}
- Outcome: ${JSON.stringify(episode.outcome)}

Generate:
1. A narrative summary (2-3 paragraphs) describing the episode, key clinical events, and current status
2. Key events as bullet points (most significant clinical milestones)
3. Outcomes assessment (clinical status, response to treatment)
4. Recommendations for ongoing care or follow-up

Return JSON with: summary (string), keyEvents (string[]), outcomes (string), recommendations (string[])`;

      const result = await this.aiService.generateStructured<EpisodeSummaryResult>(prompt, {
        model: process.env.AI_MODEL || 'mistral',
        temperature: 0.4,
      });

      return result || {
        summary: 'AI summary unavailable',
        keyEvents: [],
        outcomes: 'Unknown',
        recommendations: [],
      };
    } catch (error: any) {
      this.logger.error(`Episode summary generation failed: ${error.message}`);
      return {
        summary: 'AI summary generation failed',
        keyEvents: [],
        outcomes: 'Unknown',
        recommendations: [],
      };
    }
  }
}
