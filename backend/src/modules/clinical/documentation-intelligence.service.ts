import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { DocumentationSession } from './entities/documentation-session.entity';
import { DocumentationPreference } from './entities/documentation-preference.entity';
import { DocumentationEvidence } from './entities/documentation-evidence.entity';
import { Encounter } from './entities/encounter.entity';

@Injectable()
export class DocumentationIntelligenceService {
  constructor(
    @InjectRepository(DocumentationSession)
    private readonly sessionRepository: Repository<DocumentationSession>,
    @InjectRepository(DocumentationPreference)
    private readonly preferenceRepository: Repository<DocumentationPreference>,
    @InjectRepository(DocumentationEvidence)
    private readonly evidenceRepository: Repository<DocumentationEvidence>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    private readonly aiService: AiService,
  ) {}

  async getPreference(tenantId: string, providerId: string): Promise<DocumentationPreference | null> {
    return this.preferenceRepository.findOne({ where: { tenantId, providerId } });
  }

  async savePreference(
    tenantId: string,
    actor: { id: string; role: string },
    providerId: string,
    input: Partial<DocumentationPreference>,
  ): Promise<DocumentationPreference> {
    if (providerId !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenException('Only administrators can update another provider’s documentation preferences.');
    }
    const preference = (await this.getPreference(tenantId, providerId)) || this.preferenceRepository.create({ tenantId, providerId });
    preference.preferredLanguage = input.preferredLanguage || preference.preferredLanguage || 'en';
    preference.noteStyle = input.noteStyle || preference.noteStyle || 'concise';
    preference.requiredSections = input.requiredSections || preference.requiredSections || [];
    preference.doNotInfer = input.doNotInfer || preference.doNotInfer || [];
    preference.customInstructions = input.customInstructions ?? preference.customInstructions ?? null;
    return this.preferenceRepository.save(preference);
  }

  async buildEvidence(tenantId: string, sessionId: string): Promise<DocumentationEvidence[]> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException(`Documentation session ${sessionId} not found`);
    await this.evidenceRepository.delete({ sessionId });

    const utterances = session.transcriptUtterances || [];
    const evidence = Object.entries(session.soapNote || {})
      .filter(([, noteText]) => Boolean(noteText?.trim()))
      .map(([noteSection, noteText]) => {
        const match = this.findBestMatch(noteText, utterances, session.transcript || '');
        return this.evidenceRepository.create({
          sessionId,
          tenantId,
          noteSection: noteSection as DocumentationEvidence['noteSection'],
          noteText,
          speakerLabel: match.speaker || null,
          transcriptStartMs: match.start ?? null,
          transcriptEndMs: match.end ?? null,
          sourceText: match.text,
          matchScore: match.score,
        });
      });
    return evidence.length ? this.evidenceRepository.save(evidence) : [];
  }

  async getEvidence(tenantId: string, sessionId: string): Promise<DocumentationEvidence[]> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException(`Documentation session ${sessionId} not found`);
    return this.evidenceRepository.find({ where: { tenantId, sessionId }, order: { noteSection: 'ASC' } });
  }

  async qualityCheck(tenantId: string, sessionId: string): Promise<{ score: number; findings: Array<{ severity: string; section: string; message: string }> }> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException(`Documentation session ${sessionId} not found`);
    const preference = await this.getPreference(tenantId, session.providerId);
    const findings: Array<{ severity: string; section: string; message: string }> = [];
    const note = session.soapNote || {};
    for (const section of ['subjective', 'objective', 'assessment', 'plan'] as const) {
      if (!note[section]?.trim()) findings.push({ severity: 'warning', section, message: `${section[0].toUpperCase()}${section.slice(1)} is empty.` });
    }
    for (const section of preference?.requiredSections || []) {
      if (!(note as Record<string, string | undefined>)[section]?.trim()) {
        findings.push({ severity: 'warning', section, message: `Provider preference requires ${section}.` });
      }
    }
    if (!session.transcript?.trim()) findings.push({ severity: 'critical', section: 'transcript', message: 'No supporting transcript is available.' });
    return { score: Math.max(0, 100 - findings.filter((f) => f.severity === 'critical').length * 40 - findings.filter((f) => f.severity === 'warning').length * 10), findings };
  }

  async prepareChart(tenantId: string, patientId: string, providerId: string): Promise<{ summary: string; encounters: Array<{ id: string; startTime: Date; chiefComplaint: string | null }> }> {
    const encounters = await this.encounterRepository.find({
      where: { tenantId, patientId },
      order: { startTime: 'DESC' },
      take: 5,
    });
    const context = encounters.map((encounter) => ({
      date: encounter.startTime.toISOString().slice(0, 10),
      chiefComplaint: encounter.chiefComplaint,
      assessment: encounter.soapNote?.assessment,
      plan: encounter.soapNote?.plan,
      diagnoses: encounter.diagnoses.map((diagnosis) => diagnosis.description),
    }));
    const preference = await this.getPreference(tenantId, providerId);
    const result = await this.aiService.generateStructured<{ summary: string }>(
      `Create a concise pre-visit chart preparation summary using only the supplied encounter context. Do not infer facts. Highlight open follow-up items only if explicitly documented. Provider language preference: ${preference?.preferredLanguage || 'en'}.\n\nContext: ${JSON.stringify(context)}\n\nReturn only JSON with a summary string.`,
      { temperature: 0, maxTokens: 800 },
    );
    return {
      summary: result.summary || '',
      encounters: encounters.map((encounter) => ({ id: encounter.id, startTime: encounter.startTime, chiefComplaint: encounter.chiefComplaint })),
    };
  }

  private findBestMatch(
    noteText: string,
    utterances: DocumentationSession['transcriptUtterances'],
    transcript: string,
  ): { text: string; speaker?: string; start?: number; end?: number; score: number } {
    const noteWords = new Set(noteText.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    const candidates = utterances.length ? utterances : [{ text: transcript, speaker: undefined, start: undefined, end: undefined }];
    const best = candidates
      .map((utterance) => {
        const words = utterance.text.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
        const matched = words.filter((word) => noteWords.has(word)).length;
        return { ...utterance, score: noteWords.size ? matched / noteWords.size : 0 };
      })
      .sort((a, b) => b.score - a.score)[0];
    return { text: best?.text || transcript, speaker: best?.speaker, start: best?.start, end: best?.end, score: best?.score || 0 };
  }
}
