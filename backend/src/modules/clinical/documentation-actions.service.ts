import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { DocumentationSession } from './entities/documentation-session.entity';
import {
  DocumentationSuggestion,
  DocumentationSuggestionKind,
  DocumentationSuggestionStatus,
} from './entities/documentation-suggestion.entity';

@Injectable()
export class DocumentationActionsService {
  constructor(
    @InjectRepository(DocumentationSession)
    private readonly sessionRepository: Repository<DocumentationSession>,
    @InjectRepository(DocumentationSuggestion)
    private readonly suggestionRepository: Repository<DocumentationSuggestion>,
    private readonly aiService: AiService,
  ) {}

  async generateDrafts(tenantId: string, sessionId: string): Promise<DocumentationSuggestion[]> {
    const session = await this.findSession(tenantId, sessionId);
    if (!Object.values(session.soapNote).some(Boolean)) {
      throw new BadRequestException('A reviewed SOAP note is required before generating action drafts.');
    }
    const result = await this.aiService.generateStructured<{
      orders?: Array<{ type: 'lab' | 'imaging' | 'referral' | 'procedure'; name: string; reason: string; priority?: 'routine' | 'stat' | 'asap' }>;
      diagnoses?: Array<{ code: string; description: string; rationale: string }>;
      procedures?: Array<{ code: string; description: string; rationale: string; modifiers?: string[] }>;
      cdiPrompts?: Array<{ message: string; section: string }>;
      priorAuthorization?: { recommended: boolean; rationale: string; requiredEvidence: string[] };
      afterVisitSummary?: { summary: string; followUp: string; warnings: string[] };
    }>(
      `Analyze the provider-reviewed SOAP note below. Return only draft suggestions, never assertions or executable orders. Do not create diagnoses, orders, or medications that are not supported by the note.\n\nSOAP: ${JSON.stringify(session.soapNote)}\n\nReturn JSON with optional orders, diagnoses, procedures, cdiPrompts, priorAuthorization, and afterVisitSummary.`,
      { temperature: 0, maxTokens: 2048 },
    );
    const draftRows: Array<{ kind: DocumentationSuggestionKind; payload: Record<string, unknown> }> = [];
    if (result.orders?.length) draftRows.push({ kind: DocumentationSuggestionKind.ORDER, payload: { orders: result.orders } });
    if (result.diagnoses?.length || result.procedures?.length) draftRows.push({ kind: DocumentationSuggestionKind.CODING, payload: { diagnoses: result.diagnoses || [], procedures: result.procedures || [] } });
    if (result.cdiPrompts?.length) draftRows.push({ kind: DocumentationSuggestionKind.CDI, payload: { prompts: result.cdiPrompts } });
    if (result.priorAuthorization) draftRows.push({ kind: DocumentationSuggestionKind.PRIOR_AUTH, payload: result.priorAuthorization });
    if (result.afterVisitSummary) draftRows.push({ kind: DocumentationSuggestionKind.AFTER_VISIT_SUMMARY, payload: result.afterVisitSummary });
    const rows = draftRows.map((draft) => this.suggestionRepository.create({
      sessionId,
      tenantId,
      kind: draft.kind,
      payload: draft.payload,
      evidenceText: session.transcript,
    }));
    return rows.length ? this.suggestionRepository.save(rows) : [];
  }

  async list(tenantId: string, sessionId: string): Promise<DocumentationSuggestion[]> {
    await this.findSession(tenantId, sessionId);
    return this.suggestionRepository.find({ where: { tenantId, sessionId }, order: { createdAt: 'DESC' } });
  }

  async review(
    tenantId: string,
    suggestionId: string,
    status: DocumentationSuggestionStatus,
    reviewerId: string,
  ): Promise<DocumentationSuggestion> {
    if (![DocumentationSuggestionStatus.ACCEPTED, DocumentationSuggestionStatus.DISMISSED].includes(status)) {
      throw new BadRequestException('Suggestions can only be accepted or dismissed.');
    }
    const suggestion = await this.suggestionRepository.findOne({ where: { id: suggestionId, tenantId } });
    if (!suggestion) throw new NotFoundException(`Documentation suggestion ${suggestionId} not found`);
    if (suggestion.status !== DocumentationSuggestionStatus.PENDING) {
      throw new BadRequestException('Suggestion has already been reviewed.');
    }
    suggestion.status = status;
    suggestion.reviewedBy = reviewerId;
    suggestion.reviewedAt = new Date();
    return this.suggestionRepository.save(suggestion);
  }

  private async findSession(tenantId: string, sessionId: string): Promise<DocumentationSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException(`Documentation session ${sessionId} not found`);
    return session;
  }
}
