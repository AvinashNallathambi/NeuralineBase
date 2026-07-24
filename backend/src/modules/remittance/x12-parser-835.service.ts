import { Injectable, Logger, BadRequestException } from '@nestjs/common';

/**
 * X12 835 (ERA) Parser.
 * Parses ASC X12N 835 Health Care Claim Payment/Advice files into structured data.
 *
 * Key segments parsed:
 *   ISA/GS — Envelope headers
 *   BPR — Beginning Segment for Payment (EFT/check info)
 *   TRN — Trace/Reference Number
 *   N1 — Payer/payee identification
 *   CLP — Claim Payment Information (one per claim)
 *   CAS — Claim Adjustment Segment (CARC/RARC)
 *   NM1 — Name (patient, insured)
 *   SVD — Service Line Adjudication Information
 *   DTM — Date references
 */

export interface Parsed835Adjustment {
  groupCode: string; // CAS01: CO, OA, PI, PR
  carcCode: string; // CAS02: reason code
  amount: number; // CAS03: monetary amount
  quantity?: number; // CAS04: quantity
  rarcCode?: string; // CAS07: remark code
}

export interface Parsed835ServiceLine {
  cptCode: string; // SVD02
  serviceIdQualifier: string; // SVD01 (usually HC)
  modifiers: string[]; // SVD03-06
  units: number; // SVD07
  billedAmount: number; // SVD05
  paidAmount: number; // SVD04
  adjustments: Parsed835Adjustment[];
  serviceDate?: Date;
}

export interface Parsed835Claim {
  payerClaimId: string; // CLP01
  claimStatusCode: string; // CLP02
  billedAmount: number; // CLP03
  paidAmount: number; // CLP04
  patientResponsibilityAmount: number; // CLP05
  adjustedAmount: number; // CLP06
  facilityType: string; // CLP07
  claimFrequency: string; // CLP08
  patientName?: string; // NM1 (IL)
  insuredName?: string; // NM1 (QC)
  serviceDate?: Date; // DTM (034 or 036)
  serviceLines: Parsed835ServiceLine[];
  claimAdjustments: Parsed835Adjustment[]; // claim-level CAS
}

export interface Parsed835 {
  traceNumber: string; // TRN02
  remittanceDate: Date; // BPR16 or DTM
  payerName: string; // N1 (PR)
  payerIdentifier?: string; // N1 (PR) NM108/NM109
  payeeName: string; // N1 (PE)
  paymentMethod: string; // BPR04 (ACH, CHK)
  paymentReference?: string; // BPR17 or check number
  totalPaymentAmount: number; // BPR02
  claims: Parsed835Claim[];
  rawSegments: string[];
}

@Injectable()
export class X12Parser835 {
  private readonly logger = new Logger(X12Parser835.name);

  /**
   * Parse a raw X12 835 file into structured data.
   * Handles both element separators (typically *) and segment terminators (typically ~).
   */
  parse(rawContent: string): Parsed835 {
    if (!rawContent || rawContent.trim().length === 0) {
      throw new BadRequestException('Empty 835 file content');
    }

    // Detect element separator from ISA segment (char at position 3)
    const isaStart = rawContent.indexOf('ISA');
    if (isaStart === -1) {
      throw new BadRequestException('Invalid X12 file: ISA segment not found');
    }

    const elementSeparator = rawContent[isaStart + 3];
    // Segment terminator is typically ~ but can be other chars
    const segmentTerminator = this.detectSegmentTerminator(rawContent);

    this.logger.debug(`Parsing 835 [elementSep="${elementSeparator}", segTerm="${segmentTerminator}"]`);

    // Split into segments
    const segments = rawContent
      .split(segmentTerminator)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s.split(elementSeparator));

    const result: Parsed835 = {
      traceNumber: '',
      remittanceDate: new Date(),
      payerName: '',
      payeeName: '',
      paymentMethod: '',
      totalPaymentAmount: 0,
      claims: [],
      rawSegments: rawContent.split(segmentTerminator).map((s) => s.trim()).filter((s) => s.length > 0),
    };

    let currentClaim: Parsed835Claim | null = null;
    let currentServiceLine: Parsed835ServiceLine | null = null;

    for (const seg of segments) {
      const tag = seg[0];

      switch (tag) {
        case 'BPR':
          // Beginning Segment for Payment
          result.totalPaymentAmount = this.parseAmount(seg[2]);
          result.paymentMethod = seg[4] || '';
          // BPR16 = payment date (CCYYMMDD)
          if (seg[16]) {
            result.remittanceDate = this.parseDate(seg[16]) || new Date();
          }
          // BPR17 = check/EFT trace
          if (seg[17]) {
            result.paymentReference = seg[17];
          }
          break;

        case 'TRN':
          // Trace/Reference Number — TRN02 is the trace number
          if (seg[2]) {
            result.traceNumber = seg[2];
          }
          break;

        case 'N1':
          // Name — N101 identifies entity (PR=payer, PE=payee)
          // N1*PR*NAME*ID_QUALIFIER*ID  →  seg[1]=PR, seg[2]=NAME, seg[3]=QUAL, seg[4]=ID
          if (seg[1] === 'PR' && seg[2]) {
            result.payerName = seg[2];
            // N103/N104 for payer identifier (qualifier + ID)
            if (seg[3] && seg[4]) {
              result.payerIdentifier = seg[4];
            }
          } else if (seg[1] === 'PE' && seg[2]) {
            result.payeeName = seg[2];
          }
          break;

        case 'CLP':
          // Claim Payment Information — starts a new claim
          if (currentServiceLine && currentClaim) {
            currentClaim.serviceLines.push(currentServiceLine);
            currentServiceLine = null;
          }
          if (currentClaim) {
            result.claims.push(currentClaim);
          }
          currentClaim = {
            payerClaimId: seg[1] || '',
            claimStatusCode: seg[2] || '',
            billedAmount: this.parseAmount(seg[3]),
            paidAmount: this.parseAmount(seg[4]),
            patientResponsibilityAmount: this.parseAmount(seg[5]),
            adjustedAmount: this.parseAmount(seg[6]),
            facilityType: seg[7] || '',
            claimFrequency: seg[8] || '',
            serviceLines: [],
            claimAdjustments: [],
          };
          break;

        case 'CAS':
          // Claim Adjustment Segment — CARC/RARC
          {
            const adjustment: Parsed835Adjustment = {
              groupCode: seg[1] || '',
              carcCode: seg[2] || '',
              amount: this.parseAmount(seg[3]),
              quantity: seg[4] ? this.parseAmount(seg[4]) : undefined,
              rarcCode: seg[7] || undefined,
            };
            if (currentServiceLine) {
              currentServiceLine.adjustments.push(adjustment);
            } else if (currentClaim) {
              currentClaim.claimAdjustments.push(adjustment);
            }
          }
          break;

        case 'NM1':
          // Name — NM101 identifies entity type
          // IL = Insured/Subscriber (patient), QC = Patient
          if (currentClaim) {
            if (seg[1] === 'IL' && seg[3]) {
              currentClaim.insuredName = `${seg[3]}${seg[4] ? ' ' + seg[4] : ''}`.trim();
            } else if (seg[1] === 'QC' && seg[3]) {
              currentClaim.patientName = `${seg[3]}${seg[4] ? ' ' + seg[4] : ''}`.trim();
            }
          }
          break;

        case 'DTM':
          // Date/Time Reference — DTM01=qualifier, DTM02=date
          if (currentClaim && seg[2]) {
            const date = this.parseDate(seg[2]);
            if (date) {
              // 034 = Statement From, 036 = Statement To, 037 = Service
              if (seg[1] === '037' || seg[1] === '034' || seg[1] === '036') {
                currentClaim.serviceDate = date;
              }
            }
          }
          break;

        case 'SVC':
          // Service Line Pricing — starts a new service line (X12 835 standard
          // order: SVC comes before SVD). Contains the submitted/billed amount.
          // SVC*HC:99213:25*1200.00*900.00*1
          //   seg[1] = composite procedure ID (SVC01): HC:99213:25
          //   seg[2] = submitted/billed amount (SVC02)
          //   seg[3] = allowed amount (SVC03)
          if (currentServiceLine && currentClaim) {
            currentClaim.serviceLines.push(currentServiceLine);
          }
          currentServiceLine = {
            serviceIdQualifier: 'HC',
            cptCode: '',
            paidAmount: 0,
            billedAmount: this.parseAmount(seg[2]),
            units: 1,
            modifiers: [],
            adjustments: [],
          };
          if (seg[1]) {
            const svcParts = seg[1].split(':');
            if (svcParts[0]) currentServiceLine.serviceIdQualifier = svcParts[0];
            if (svcParts[1]) currentServiceLine.cptCode = svcParts[1];
            // svcParts[2+] = modifiers
            currentServiceLine.modifiers = svcParts.slice(2).filter(Boolean);
          }
          break;

        case 'SVD':
          // Service Line Adjudication — provides paid amount, units, modifiers.
          // In standard 835 order, SVD comes after SVC (which created the line).
          // If SVD comes first (non-standard), it creates the line instead.
          if (!currentServiceLine) {
            currentServiceLine = {
              serviceIdQualifier: seg[1] || 'HC',
              cptCode: seg[2] || '',
              paidAmount: this.parseAmount(seg[3]),
              billedAmount: 0,
              units: this.parseAmount(seg[4]) || 1,
              modifiers: [seg[5], seg[6], seg[7], seg[8]].filter(Boolean) as string[],
              adjustments: [],
            };
          } else {
            // Update existing line (created by SVC) with adjudication data
            currentServiceLine.paidAmount = this.parseAmount(seg[3]);
            if (this.parseAmount(seg[4]) > 0) {
              currentServiceLine.units = this.parseAmount(seg[4]);
            }
            const svdMods = [seg[5], seg[6], seg[7], seg[8]].filter(Boolean) as string[];
            if (svdMods.length > 0 && currentServiceLine.modifiers.length === 0) {
              currentServiceLine.modifiers = svdMods;
            }
            if (seg[2] && !currentServiceLine.cptCode) {
              currentServiceLine.cptCode = seg[2];
            }
          }
          break;

        case 'LQ':
          // Industry Code — sometimes used for additional reason codes
          // LQ01 = code list qualifier, LQ02 = code
          break;

        case 'PLB':
          // Provider-Level Adjustment Balance — provider-level adjustments
          break;

        case 'SE':
          // Transaction Set Trailer — finalize last claim
          if (currentServiceLine && currentClaim) {
            currentClaim.serviceLines.push(currentServiceLine);
            currentServiceLine = null;
          }
          if (currentClaim) {
            result.claims.push(currentClaim);
            currentClaim = null;
          }
          break;
      }
    }

    // Handle case where SE wasn't found
    if (currentServiceLine && currentClaim) {
      currentClaim.serviceLines.push(currentServiceLine);
    }
    if (currentClaim) {
      result.claims.push(currentClaim);
    }

    this.logger.log(`Parsed 835: ${result.claims.length} claims, trace=${result.traceNumber}, payer=${result.payerName}`);
    return result;
  }

  private detectSegmentTerminator(content: string): string {
    // Look at the ISA segment — the terminator is the last char before newline
    // Common terminators: ~, \n, |, #
    const isaEnd = content.indexOf('ISA');
    if (isaEnd === -1) return '~';

    // Find the end of the ISA segment (it's 106 chars in fixed-length, but may vary)
    // Look for the first occurrence of ~ or newline after ISA
    const afterIsa = content.slice(isaEnd);
    const tildeIdx = afterIsa.indexOf('~');
    const newlineIdx = afterIsa.indexOf('\n');

    if (tildeIdx !== -1 && (newlineIdx === -1 || tildeIdx < newlineIdx)) {
      return '~';
    }
    if (newlineIdx !== -1) {
      // Check if there's a trailing char before newline (like ~\n)
      const charBeforeNewline = content[isaEnd + newlineIdx - 1];
      if (charBeforeNewline && charBeforeNewline !== '\r' && charBeforeNewline !== elementSeparatorPlaceholder) {
        // Could be a custom terminator
        return charBeforeNewline;
      }
      return '\n';
    }
    return '~';
  }

  private parseAmount(value: string | undefined): number {
    if (!value) return 0;
    const num = parseFloat(value);
    return Number.isNaN(num) ? 0 : num;
  }

  private parseDate(value: string | undefined): Date | null {
    if (!value || value.length < 8) return null;
    // X12 dates are CCYYMMDD
    const year = parseInt(value.slice(0, 4), 10);
    const month = parseInt(value.slice(4, 6), 10) - 1;
    const day = parseInt(value.slice(6, 8), 10);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}

// Placeholder for element separator detection
const elementSeparatorPlaceholder = '*';
