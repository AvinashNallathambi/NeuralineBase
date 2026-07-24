import { BadRequestException } from '@nestjs/common';
import { X12Parser835 } from './x12-parser-835.service';

/**
 * Unit tests for X12Parser835 — the ASC X12N 835 (ERA) parser.
 *
 * These tests are pure (no DB, no NestJS DI) and verify the parser correctly
 * extracts ISA/BPR/TRN/N1/CLP/CAS/NM1/DTM/SVD/SVC/SE segments from a raw 835
 * file into the structured Parsed835 shape used by RemittanceService.importEra.
 *
 * The sample 835 fixture below is a minimal but realistic ERA containing:
 *   - One paid claim (CLP status 1) with one service line and a CO-45 adjustment
 *   - One denied claim (CLP status 4) with a CO-16 claim-level adjustment + RARC M76
 */
describe('X12Parser835', () => {
  let parser: X12Parser835;

  // Minimal but realistic 835 fixture. Element separator is '*' and segment
  // terminator is '~'. Two claims: one paid (with CO-45 fee schedule reduction)
  // and one denied (CO-16 missing information, RARC M76).
  const SAMPLE_835 = [
    'ISA*00*          *00*          *ZZ*PAYER         *ZZ*PROVIDER      *240701*1230*^*00501*000000001*0*P*:',
    'GS*HP*PAYER*PROVIDER*20240701*1230*1*X*005010X221A1',
    'ST*835*0001',
    // BPR16 = payment date (CCYYMMDD), BPR17 = check/EFT trace
    'BPR*I*1500.00*C*ACH*CCP*01*999999992*DA*1234567890*PROVIDER BANK***123456***20240715*EFTREF001',
    'TRN*1*TRACE123456*999999992',
    'N1*PR*BLUE CROSS BLUE SHIELD*XV*BCBS123',
    'N1*PE*NEURALINE HEALTH CLINIC*XX*1234567893',
    'REF*TJ*1234567890',
    'LX*1',
    'TS3*1234567893*12*20240715*1*2500.00**2500.00',
    'CLP*CLAIM001*1*1200.00*900.00*0*150.00*12*1',
    'NM1*QC*1*DOE*JANE****MI*PT0001',
    'NM1*IL*1*DOE*JANE****MI*PT0001',
    'DTM*037*20240620',
    'CAS*CO*45*300.00',
    'SVC*HC:99213:25*1200.00*900.00*1',
    'DTM*037*20240620',
    'SVD*HC*99213*900.00*1*25',
    'CAS*CO*45*300.00',
    'SE*20*0001',
  ].join('~');

  beforeEach(() => {
    parser = new X12Parser835();
  });

  describe('parse()', () => {
    it('parses a complete 835 file into structured data', () => {
      const result = parser.parse(SAMPLE_835);

      // Envelope / payment header
      expect(result.traceNumber).toBe('TRACE123456');
      expect(result.payerName).toBe('BLUE CROSS BLUE SHIELD');
      expect(result.payerIdentifier).toBe('BCBS123');
      expect(result.payeeName).toBe('NEURALINE HEALTH CLINIC');
      expect(result.paymentMethod).toBe('ACH');
      expect(result.totalPaymentAmount).toBe(1500.0);
      expect(result.paymentReference).toBe('EFTREF001');
      expect(result.claims).toHaveLength(1);
    });

    it('parses the remittance date from BPR16 (CCYYMMDD)', () => {
      const result = parser.parse(SAMPLE_835);
      // BPR16 = 20240715
      expect(result.remittanceDate).toBeInstanceOf(Date);
      expect(result.remittanceDate.getFullYear()).toBe(2024);
      expect(result.remittanceDate.getMonth()).toBe(6); // July (0-indexed)
      expect(result.remittanceDate.getDate()).toBe(15);
    });

    it('parses CLP claim-level fields correctly', () => {
      const result = parser.parse(SAMPLE_835);
      const claim = result.claims[0];

      expect(claim.payerClaimId).toBe('CLAIM001');
      expect(claim.claimStatusCode).toBe('1'); // processed as primary
      expect(claim.billedAmount).toBe(1200.0);
      expect(claim.paidAmount).toBe(900.0);
      expect(claim.patientResponsibilityAmount).toBe(0);
      expect(claim.adjustedAmount).toBe(150.0);
      expect(claim.facilityType).toBe('12');
      expect(claim.claimFrequency).toBe('1');
    });

    it('parses NM1 patient and insured names', () => {
      const result = parser.parse(SAMPLE_835);
      const claim = result.claims[0];

      expect(claim.patientName).toBe('DOE JANE');
      expect(claim.insuredName).toBe('DOE JANE');
    });

    it('parses DTM service date (qualifier 037)', () => {
      const result = parser.parse(SAMPLE_835);
      const claim = result.claims[0];

      expect(claim.serviceDate).toBeInstanceOf(Date);
      expect(claim.serviceDate!.getFullYear()).toBe(2024);
      expect(claim.serviceDate!.getMonth()).toBe(5); // June (0-indexed)
      expect(claim.serviceDate!.getDate()).toBe(20);
    });

    it('parses claim-level CAS adjustments (CARC + amount)', () => {
      const result = parser.parse(SAMPLE_835);
      const claim = result.claims[0];

      // One claim-level CAS (CO-45 for $300) appears before the SVC/SVD
      expect(claim.claimAdjustments).toHaveLength(1);
      expect(claim.claimAdjustments[0].groupCode).toBe('CO');
      expect(claim.claimAdjustments[0].carcCode).toBe('45');
      expect(claim.claimAdjustments[0].amount).toBe(300.0);
    });

    it('parses SVC+SVD service line with CPT, billed, paid, units, and modifiers', () => {
      const result = parser.parse(SAMPLE_835);
      const claim = result.claims[0];

      // SVC creates the service line (standard 835 order: SVC before SVD)
      expect(claim.serviceLines).toHaveLength(1);
      const line = claim.serviceLines[0];
      expect(line.cptCode).toBe('99213');
      expect(line.serviceIdQualifier).toBe('HC');
      expect(line.paidAmount).toBe(900.0); // from SVD
      expect(line.billedAmount).toBe(1200.0); // from SVC02
      expect(line.units).toBe(1);
      expect(line.modifiers).toContain('25'); // from SVC composite ID
    });

    it('parses service-line CAS adjustments', () => {
      const result = parser.parse(SAMPLE_835);
      const line = result.claims[0].serviceLines[0];

      expect(line.adjustments).toHaveLength(1);
      expect(line.adjustments[0].groupCode).toBe('CO');
      expect(line.adjustments[0].carcCode).toBe('45');
      expect(line.adjustments[0].amount).toBe(300.0);
    });

    it('parses RARC code from CAS07 when present', () => {
      const denied835 = [
        'ISA*00*          *00*          *ZZ*PAYER         *ZZ*PROVIDER      *240701*1230*^*00501*000000002*0*P*:',
        'GS*HP*PAYER*PROVIDER*20240701*1230*2*X*005010X221A1',
        'ST*835*0002',
        'BPR*I*0.00*C*NON*NN*01*999999992*DA*1234567890*PROVIDER BANK**123456*20240715',
        'TRN*1*TRACE789*999999992',
        'N1*PR*AETNA*XV*AETNA1',
        'N1*PE*NEURALINE HEALTH CLINIC*XX*1234567893',
        'CLP*CLAIM002*4*500.00*0*0*500.00*12*1',
        'NM1*QC*1*SMITH*JOHN****MI*PT0002',
        'DTM*037*20240622',
        'CAS*CO*16*500.00****M76',
        'SE*10*0002',
      ].join('~');

      const result = parser.parse(denied835);
      const claim = result.claims[0];

      expect(claim.claimStatusCode).toBe('4'); // denied
      expect(claim.claimAdjustments).toHaveLength(1);
      const adj = claim.claimAdjustments[0];
      expect(adj.groupCode).toBe('CO');
      expect(adj.carcCode).toBe('16');
      expect(adj.amount).toBe(500.0);
      expect(adj.rarcCode).toBe('M76');
    });

    it('handles multiple claims in a single 835', () => {
      const multiClaim835 = [
        'ISA*00*          *00*          *ZZ*PAYER         *ZZ*PROVIDER      *240701*1230*^*00501*000000003*0*P*:',
        'GS*HP*PAYER*PROVIDER*20240701*1230*3*X*005010X221A1',
        'ST*835*0003',
        'BPR*I*2000.00*C*ACH*CCP*01*999999992*DA*1234567890*PROVIDER BANK**123456*20240715',
        'TRN*1*TRACE3*999999992',
        'N1*PR*UNITED HEALTHCARE*XV*UHC1',
        'N1*PE*NEURALINE HEALTH CLINIC*XX*1234567893',
        'CLP*CLAIM003*1*1000.00*800.00*0*200.00*12*1',
        'NM1*QC*1*JONES*ALICE****MI*PT0003',
        'DTM*037*20240625',
        'SVC*HC:99214*1000.00*800.00*1',
        'SVD*HC*99214*800.00*1',
        'CLP*CLAIM004*1*1200.00*1200.00*0*0*12*1',
        'NM1*QC*1*BROWN*BOB****MI*PT0004',
        'DTM*037*20240626',
        'SVC*HC:99213*1200.00*1200.00*1',
        'SVD*HC*99213*1200.00*1',
        'SE*15*0003',
      ].join('~');

      const result = parser.parse(multiClaim835);

      expect(result.claims).toHaveLength(2);
      expect(result.claims[0].payerClaimId).toBe('CLAIM003');
      expect(result.claims[0].paidAmount).toBe(800.0);
      expect(result.claims[1].payerClaimId).toBe('CLAIM004');
      expect(result.claims[1].paidAmount).toBe(1200.0);
    });

    it('throws BadRequestException on empty content', () => {
      expect(() => parser.parse('')).toThrow(BadRequestException);
      expect(() => parser.parse('   ')).toThrow(BadRequestException);
    });

    it('throws BadRequestException when ISA segment is missing', () => {
      expect(() => parser.parse('BPR*I*100.00*C*ACH~CLP*CLAIM*1*100*100*0*0*12*1~')).toThrow(
        BadRequestException,
      );
    });

    it('preserves raw segments in rawSegments', () => {
      const result = parser.parse(SAMPLE_835);
      expect(result.rawSegments.length).toBeGreaterThan(0);
      // First segment should be the ISA
      expect(result.rawSegments[0]).toContain('ISA');
    });
  });
});
