import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { DocumentationSession } from './entities/documentation-session.entity';
import {
  DocumentationSuggestion,
  DocumentationSuggestionKind,
  DocumentationSuggestionStatus,
} from './entities/documentation-suggestion.entity';
import { EncounterService } from './encounter.service';
import { DocumentationRevenueService } from './documentation-revenue.service';
import { PatientInsurance } from '../billing/entities/patient-insurance.entity';

@Injectable()
export class DocumentationActionsService {
  constructor(
    @InjectRepository(DocumentationSession)
    private readonly sessionRepository: Repository<DocumentationSession>,
    @InjectRepository(DocumentationSuggestion)
    private readonly suggestionRepository: Repository<DocumentationSuggestion>,
    @InjectRepository(PatientInsurance)
    private readonly patientInsuranceRepository: Repository<PatientInsurance>,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => EncounterService))
    private readonly encounterService: EncounterService,
    private readonly revenueService: DocumentationRevenueService,
  ) {}

  async generateDrafts(tenantId: string, sessionId: string): Promise<DocumentationSuggestion[]> {
    const session = await this.findSession(tenantId, sessionId);
    if (!Object.values(session.soapNote).some(Boolean)) {
      throw new BadRequestException('A reviewed SOAP note is required before generating action drafts.');
    }

    // Roadmap #4: Include chart context for coding suggestions
    let chartContext = '';
    if (session.encounterId) {
      try {
        const encounter = await this.encounterService.findOne(session.encounterId, tenantId);
        const parts: string[] = [];
        const activeDx = (encounter.diagnoses || []).filter((d: any) => d.status !== 'resolved' && d.status !== 'ruled_out');
        if (activeDx.length) parts.push(`Existing diagnoses: ${activeDx.map((d: any) => `${d.code} ${d.description}`).join('; ')}`);
        const meds = encounter.treatmentPlan?.medications;
        if (meds?.length) parts.push(`Current meds: ${meds.map((m: any) => `${m.name} ${m.dosage}`).join('; ')}`);
        const procs = encounter.treatmentPlan?.procedures;
        if (procs?.length) parts.push(`Existing procedures: ${procs.map((p: any) => `${p.cptCode || ''} ${p.name}`).join('; ')}`);
        const v = encounter.vitals;
        if (v?.bloodPressure) parts.push(`BP: ${v.bloodPressure}`);
        if (v?.heartRate) parts.push(`HR: ${v.heartRate}`);
        if (v?.temperature) parts.push(`Temp: ${v.temperature}`);
        if (parts.length) chartContext = `\n\nChart context for coding accuracy:\n${parts.join('\n')}`;
      } catch {
        // non-blocking
      }
    }

    // Roadmap #6: Include payer-aware documentation coaching context
    let payerContext = '';
    try {
      const insurances = await this.patientInsuranceRepository.find({
        where: { tenantId, patientId: session.patientId },
        relations: ['payer'],
      });
      const payerNames = [...new Set(insurances.map((i) => i.payer?.name).filter(Boolean))] as string[];
      if (payerNames.length) {
        const riskPrompts: string[] = [];
        for (const payerName of payerNames.slice(0, 3)) {
          try {
            const risk = await this.revenueService.payerRisk(tenantId, payerName);
            if (risk.documentationPrompts?.length) {
              riskPrompts.push(`${payerName} (${risk.denialCount} denials, $${risk.unresolvedDeniedAmount} unresolved): ${risk.documentationPrompts.join(' ')}`);
            }
          } catch {
            // non-blocking
          }
        }
        if (riskPrompts.length) {
          payerContext = `\n\nPayer documentation requirements (use for CDI prompts and coding guidance):\n${riskPrompts.join('\n')}`;
        }
      }
    } catch {
      // non-blocking
    }

    const result = await this.aiService.generateStructured<{
      orders?: Array<{ type: 'lab' | 'imaging' | 'referral' | 'procedure'; name: string; reason: string; priority?: 'routine' | 'stat' | 'asap' }>;
      diagnoses?: Array<{ code: string; description: string; rationale: string }>;
      procedures?: Array<{ code: string; description: string; rationale: string; modifiers?: string[] }>;
      cdiPrompts?: Array<{ message: string; section: string }>;
      priorAuthorization?: { recommended: boolean; rationale: string; requiredEvidence: string[] };
      afterVisitSummary?: { summary: string; followUp: string; warnings: string[] };
      payerCoaching?: Array<{ payerName: string; section: string; message: string; severity: 'info' | 'warning' | 'critical' }>;
    }>(
      `Analyze the provider-reviewed SOAP note below. Return only draft suggestions, never assertions or executable orders. Do not create diagnoses, orders, or medications that are not supported by the note. Use the chart context for coding accuracy and the payer context for documentation improvement prompts.\n\nSOAP: ${JSON.stringify(session.soapNote)}${chartContext}${payerContext}\n\nReturn JSON with this exact schema:\n{\n  "orders": [{"type": "lab|imaging|referral|procedure", "name": "specific order name", "reason": "clinical reason from note", "priority": "routine|stat|asap"}],\n  "diagnoses": [{"code": "ICD-10 code", "description": "diagnosis description", "rationale": "why this code fits the note"}],\n  "procedures": [{"code": "CPT code", "description": "procedure description", "rationale": "why this code fits"}],\n  "cdiPrompts": [{"message": "documentation improvement suggestion", "section": "subjective|objective|assessment|plan"}],\n  "priorAuthorization": {"recommended": true/false, "rationale": "reason", "requiredEvidence": ["evidence items"]},\n  "afterVisitSummary": {"summary": "patient-friendly summary", "followUp": "follow-up instructions", "warnings": ["warning items"]},\n  "payerCoaching": [{"payerName": "payer name", "section": "soap section", "message": "coaching message", "severity": "info|warning|critical"}]\n}\n\nOmit any key that has no relevant suggestions. Each array item MUST be an object (not a string).`,
      { temperature: 0, maxTokens: 2048 },
    );
    const draftRows: Array<{ kind: DocumentationSuggestionKind; payload: Record<string, unknown> }> = [];
    if (result.orders?.length) draftRows.push({ kind: DocumentationSuggestionKind.ORDER, payload: { orders: result.orders } });
    if (result.diagnoses?.length || result.procedures?.length) draftRows.push({ kind: DocumentationSuggestionKind.CODING, payload: { diagnoses: result.diagnoses || [], procedures: result.procedures || [] } });
    if (result.cdiPrompts?.length) draftRows.push({ kind: DocumentationSuggestionKind.CDI, payload: { prompts: result.cdiPrompts } });
    if (result.priorAuthorization) draftRows.push({ kind: DocumentationSuggestionKind.PRIOR_AUTH, payload: result.priorAuthorization });
    if (result.afterVisitSummary) draftRows.push({ kind: DocumentationSuggestionKind.AFTER_VISIT_SUMMARY, payload: result.afterVisitSummary });
    if (result.payerCoaching?.length) draftRows.push({ kind: DocumentationSuggestionKind.REVENUE_RISK, payload: { coaching: result.payerCoaching } });
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
