import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentationSession } from './entities/documentation-session.entity';
import { DenialRecord, DenialWorklistStatus } from '../denials/entities/denial-record.entity';
import { UnderpaymentRecord, UnderpaymentStatus } from '../underpayments/entities/underpayment-record.entity';

@Injectable()
export class DocumentationRevenueService {
  constructor(
    @InjectRepository(DocumentationSession)
    private readonly sessionRepository: Repository<DocumentationSession>,
    @InjectRepository(DenialRecord)
    private readonly denialRepository: Repository<DenialRecord>,
    @InjectRepository(UnderpaymentRecord)
    private readonly underpaymentRepository: Repository<UnderpaymentRecord>,
  ) {}

  async payerRisk(tenantId: string, payerName: string): Promise<{
    payerName: string;
    denialCount: number;
    unresolvedDeniedAmount: number;
    underpaymentCount: number;
    underpaymentAmount: number;
    topRootCauses: Array<{ rootCause: string; count: number }>;
    documentationPrompts: string[];
  }> {
    const denials = await this.denialRepository.find({ where: { tenantId, payerName } });
    const underpayments = await this.underpaymentRepository.find({ where: { tenantId, payerName } });
    const rootCauses = new Map<string, number>();
    for (const denial of denials) {
      rootCauses.set(denial.rootCauseCategory, (rootCauses.get(denial.rootCauseCategory) || 0) + 1);
    }
    const topRootCauses = [...rootCauses.entries()]
      .map(([rootCause, count]) => ({ rootCause, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const prompts = topRootCauses.map(({ rootCause }) => this.promptForRootCause(rootCause));
    return {
      payerName,
      denialCount: denials.length,
      unresolvedDeniedAmount: denials
        .filter((denial) => ![DenialWorklistStatus.RESOLVED, DenialWorklistStatus.WRITTEN_OFF].includes(denial.status))
        .reduce((total, denial) => total + denial.deniedAmount, 0),
      underpaymentCount: underpayments.filter((record) => ![UnderpaymentStatus.RECOVERED, UnderpaymentStatus.FALSE_POSITIVE, UnderpaymentStatus.WRITTEN_OFF].includes(record.status)).length,
      underpaymentAmount: underpayments
        .filter((record) => ![UnderpaymentStatus.RECOVERED, UnderpaymentStatus.FALSE_POSITIVE, UnderpaymentStatus.WRITTEN_OFF].includes(record.status))
        .reduce((total, record) => total + record.varianceAmount, 0),
      topRootCauses,
      documentationPrompts: prompts,
    };
  }

  async appealEvidence(tenantId: string, sessionId: string, denialId: string): Promise<{
    sessionId: string;
    denialId: string;
    evidence: { note: DocumentationSession['soapNote']; denialReason: string; serviceDate: Date | null; filingDeadline: Date | null };
  }> {
    const [session, denial] = await Promise.all([
      this.sessionRepository.findOne({ where: { id: sessionId, tenantId } }),
      this.denialRepository.findOne({ where: { id: denialId, tenantId } }),
    ]);
    if (!session) throw new NotFoundException(`Documentation session ${sessionId} not found`);
    if (!denial) throw new NotFoundException(`Denial ${denialId} not found`);
    return {
      sessionId,
      denialId,
      evidence: {
        note: session.soapNote,
        denialReason: denial.denialReasonText || denial.carcDescription || denial.carcCode,
        serviceDate: denial.serviceDate,
        filingDeadline: denial.filingDeadline,
      },
    };
  }

  private promptForRootCause(rootCause: string): string {
    const prompts: Record<string, string> = {
      prior_authorization: 'Confirm authorization number, dates, and medical-necessity rationale are documented if clinically applicable.',
      medical_necessity: 'Document the clinical indication, relevant findings, and prior treatment response if clinically applicable.',
      coding_error: 'Review diagnosis specificity, procedure rationale, modifiers, and consistency between the note and selected codes.',
      missing_information: 'Confirm required clinical details, test results, and supporting documentation are present before claim submission.',
      timely_filing: 'Verify that billing handoff occurs promptly and all required documentation is complete before the payer deadline.',
      coordination_of_benefits: 'Confirm current coverage order and payer information before claim submission.',
    };
    return prompts[rootCause] || 'Review payer-specific documentation requirements and confirm the signed note supports the selected services.';
  }
}
