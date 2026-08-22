import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Episode, EpisodeStatus, EpisodeType, EpisodeCondition, EpisodeCareTeamMember } from './entities/episode.entity';
import {
  CreateEpisodeDto,
  UpdateEpisodeDto,
  AssessOutcomeDto,
} from './dto/episode.dto';
import { EpisodeAiService } from './episode-ai.service';

@Injectable()
export class EpisodesService {
  private readonly logger = new Logger(EpisodesService.name);

  constructor(
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,
    private readonly aiService: EpisodeAiService,
  ) {}

  async create(tenantId: string, dto: CreateEpisodeDto, createdBy: string): Promise<Episode> {
    const episode = this.episodeRepository.create({
      tenantId,
      patientId: dto.patientId,
      patientName: dto.patientName,
      title: dto.title,
      description: dto.description || null,
      episodeType: dto.episodeType,
      status: dto.status || EpisodeStatus.ACTIVE,
      conditions: dto.conditions || [],
      careTeam: dto.careTeam || [],
      managingProviderId: dto.managingProviderId || null,
      managingProviderName: dto.managingProviderName || null,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      encounterIds: dto.encounterIds || [],
      carePlanIds: dto.carePlanIds || [],
      tags: dto.tags || [],
      notes: dto.notes || null,
      timeline: [],
    });
    const saved = await this.episodeRepository.save(episode);
    this.logger.log(`Episode created: ${saved.id} for patient ${dto.patientId} by ${createdBy}`);
    return saved;
  }

  async findByPatient(tenantId: string, patientId: string, includeInactive = false): Promise<Episode[]> {
    const where: any = { tenantId, patientId };
    if (!includeInactive) {
      where.status = Not(In([EpisodeStatus.CANCELLED, EpisodeStatus.ENTERED_IN_ERROR]));
    }
    return this.episodeRepository.find({
      where,
      order: { startDate: 'DESC' },
    });
  }

  async findAll(tenantId: string, status?: EpisodeStatus): Promise<Episode[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.episodeRepository.find({
      where,
      order: { startDate: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Episode> {
    const episode = await this.episodeRepository.findOne({ where: { tenantId, id } });
    if (!episode) throw new NotFoundException(`Episode ${id} not found`);
    return episode;
  }

  async update(tenantId: string, id: string, dto: UpdateEpisodeDto): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    Object.assign(episode, {
      ...dto,
      startDate: dto.endDate ? new Date(dto.endDate) : episode.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : episode.endDate,
    });
    return this.episodeRepository.save(episode);
  }

  async close(tenantId: string, id: string, outcome: AssessOutcomeDto): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    episode.status = EpisodeStatus.FINISHED;
    episode.endDate = new Date();
    episode.outcome = {
      clinicalOutcome: outcome.clinicalOutcome as any,
      patientSatisfaction: outcome.patientSatisfaction || null,
      qualityMeasureCompliance: outcome.qualityMeasureCompliance || null,
      notes: outcome.notes || '',
      assessedAt: new Date().toISOString(),
      assessedBy: outcome.assessedBy,
    };
    return this.episodeRepository.save(episode);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const episode = await this.findOne(tenantId, id);
    episode.status = EpisodeStatus.CANCELLED;
    await this.episodeRepository.save(episode);
    await this.episodeRepository.softDelete(id);
  }

  // ── Encounter Linking ─────────────────────────────────────────────

  async linkEncounter(tenantId: string, id: string, encounterId: string): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    if (!episode.encounterIds.includes(encounterId)) {
      episode.encounterIds = [...episode.encounterIds, encounterId];
      await this.rebuildTimeline(episode);
    }
    return this.episodeRepository.save(episode);
  }

  async unlinkEncounter(tenantId: string, id: string, encounterId: string): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    episode.encounterIds = episode.encounterIds.filter((eid) => eid !== encounterId);
    await this.rebuildTimeline(episode);
    return this.episodeRepository.save(episode);
  }

  async linkCarePlan(tenantId: string, id: string, carePlanId: string): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    if (!episode.carePlanIds.includes(carePlanId)) {
      episode.carePlanIds = [...episode.carePlanIds, carePlanId];
    }
    return this.episodeRepository.save(episode);
  }

  async unlinkCarePlan(tenantId: string, id: string, carePlanId: string): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    episode.carePlanIds = episode.carePlanIds.filter((cpid) => cpid !== carePlanId);
    return this.episodeRepository.save(episode);
  }

  // ── Timeline Aggregation ──────────────────────────────────────────

  private async rebuildTimeline(episode: Episode): Promise<void> {
    // Timeline entries are built from encounter IDs.
    // In a full implementation, this would query encounters, labs, imaging, meds.
    // For now, we create timeline entries from encounter IDs.
    const timeline = episode.encounterIds.map((encounterId) => ({
      date: new Date().toISOString(),
      type: 'encounter' as const,
      title: `Encounter ${encounterId.substring(0, 8)}`,
      description: '',
      encounterId,
    }));
    episode.timeline = timeline;
  }

  // ── Cost Calculation ──────────────────────────────────────────────

  async calculateCosts(tenantId: string, id: string): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    // In a full implementation, this would sum up encounter charges, lab costs, etc.
    // For now, we set a placeholder cost summary.
    const encounterCount = episode.encounterIds.length;
    const estimatedEncounterCost = encounterCount * 150; // average $150/visit
    episode.costSummary = {
      totalEncounterCost: estimatedEncounterCost,
      totalLabCost: 0,
      totalImagingCost: 0,
      totalMedicationCost: 0,
      totalCost: estimatedEncounterCost,
      estimatedCost: episode.aiInsights?.predictedTotalCost || null,
      costVariance: episode.aiInsights?.predictedTotalCost
        ? estimatedEncounterCost - episode.aiInsights.predictedTotalCost
        : null,
      lastCalculatedAt: new Date().toISOString(),
    };
    return this.episodeRepository.save(episode);
  }

  // ── AI Features ───────────────────────────────────────────────────

  async autoDetect(tenantId: string, patientId: string, encounters: any[]): Promise<any> {
    return this.aiService.autoDetectEpisode(tenantId, patientId, encounters);
  }

  async predictCost(tenantId: string, id: string): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    // Get historical episodes for the same patient with similar conditions
    const historical = await this.episodeRepository.find({
      where: { tenantId, patientId: episode.patientId, status: EpisodeStatus.FINISHED },
    });
    const prediction = await this.aiService.predictEpisodeCost(episode, historical);

    episode.aiInsights = {
      ...episode.aiInsights,
      predictedTotalCost: prediction.predictedTotalCost,
      generatedAt: new Date().toISOString(),
      autoDetected: episode.aiInsights?.autoDetected || false,
      detectionConfidence: episode.aiInsights?.detectionConfidence || 0,
      pathwayDeviations: episode.aiInsights?.pathwayDeviations || [],
      recommendedActions: episode.aiInsights?.recommendedActions || [],
      riskScore: episode.aiInsights?.riskScore || null,
    };

    // Update cost summary with prediction
    if (!episode.costSummary) {
      episode.costSummary = {
        totalEncounterCost: 0,
        totalLabCost: 0,
        totalImagingCost: 0,
        totalMedicationCost: 0,
        totalCost: 0,
        estimatedCost: prediction.predictedTotalCost,
        costVariance: null,
        lastCalculatedAt: new Date().toISOString(),
      };
    } else {
      episode.costSummary.estimatedCost = prediction.predictedTotalCost;
      episode.costSummary.costVariance = episode.costSummary.totalCost - prediction.predictedTotalCost;
    }

    return this.episodeRepository.save(episode);
  }

  async detectDeviations(tenantId: string, id: string): Promise<Episode> {
    const episode = await this.findOne(tenantId, id);
    const result = await this.aiService.detectPathwayDeviations(episode);

    episode.aiInsights = {
      ...episode.aiInsights,
      pathwayDeviations: result.deviations.map((d) => `${d.type}: ${d.description}`),
      recommendedActions: result.deviations.map((d) => d.recommendedAction),
      riskScore: result.overallRiskScore,
      generatedAt: new Date().toISOString(),
      autoDetected: episode.aiInsights?.autoDetected || false,
      detectionConfidence: episode.aiInsights?.detectionConfidence || 0,
      predictedTotalCost: episode.aiInsights?.predictedTotalCost || null,
    };

    return this.episodeRepository.save(episode);
  }

  async generateSummary(tenantId: string, id: string): Promise<{ summary: string; keyEvents: string[]; outcomes: string; recommendations: string[] }> {
    const episode = await this.findOne(tenantId, id);
    return this.aiService.generateEpisodeSummary(episode);
  }

  // ── Dashboard ─────────────────────────────────────────────────────

  async getDashboard(tenantId: string): Promise<{
    totalEpisodes: number;
    activeEpisodes: number;
    finishedEpisodes: number;
    byType: Record<string, number>;
    averageDurationDays: number;
    averageCost: number;
    highRiskEpisodes: number;
  }> {
    const episodes = await this.episodeRepository.find({ where: { tenantId } });
    const active = episodes.filter((e) => e.status === EpisodeStatus.ACTIVE);
    const finished = episodes.filter((e) => e.status === EpisodeStatus.FINISHED);
    const byType: Record<string, number> = {};
    for (const e of episodes) {
      byType[e.episodeType] = (byType[e.episodeType] || 0) + 1;
    }
    const durations = finished
      .filter((e) => e.endDate)
      .map((e) => (new Date(e.endDate!).getTime() - new Date(e.startDate).getTime()) / 86400000);
    const costs = episodes.filter((e) => e.costSummary).map((e) => e.costSummary!.totalCost);
    const highRisk = episodes.filter((e) => (e.aiInsights?.riskScore || 0) > 60);

    return {
      totalEpisodes: episodes.length,
      activeEpisodes: active.length,
      finishedEpisodes: finished.length,
      byType,
      averageDurationDays: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      averageCost: costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : 0,
      highRiskEpisodes: highRisk.length,
    };
  }
}
