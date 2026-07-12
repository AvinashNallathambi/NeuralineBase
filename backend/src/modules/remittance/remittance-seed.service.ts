import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarcCode } from './entities/carc-code.entity';
import { RarcCode } from './entities/rarc-code.entity';

/**
 * Seeds the CARC and RARC code master tables on first boot.
 * Codes are publicly available from the Washington Publishing Company (WPC).
 * https://www.wpc-edi.com/reference/codes/
 */
@Injectable()
export class RemittanceSeedService {
  private readonly logger = new Logger(RemittanceSeedService.name);

  constructor(
    @InjectRepository(CarcCode)
    private readonly carcRepository: Repository<CarcCode>,
    @InjectRepository(RarcCode)
    private readonly rarcRepository: Repository<RarcCode>,
  ) {}

  async onModuleInit() {
    await this.seedCarcCodes();
    await this.seedRarcCodes();
  }

  private async seedCarcCodes() {
    const count = await this.carcRepository.count();
    if (count > 0) {
      this.logger.log(`CARC codes already seeded (${count}), skipping`);
      return;
    }
    this.logger.log('Seeding CARC codes...');
    const codes = this.getCarcData();
    await this.carcRepository
      .createQueryBuilder()
      .insert()
      .into(CarcCode)
      .values(codes)
      .orIgnore()
      .execute();
    this.logger.log(`CARC codes seeded: ${codes.length}`);
  }

  private async seedRarcCodes() {
    const count = await this.rarcRepository.count();
    if (count > 0) {
      this.logger.log(`RARC codes already seeded (${count}), skipping`);
      return;
    }
    this.logger.log('Seeding RARC codes...');
    const codes = this.getRarcData();
    await this.rarcRepository
      .createQueryBuilder()
      .insert()
      .into(RarcCode)
      .values(codes)
      .orIgnore()
      .execute();
    this.logger.log(`RARC codes seeded: ${codes.length}`);
  }

  private getCarcData(): Partial<CarcCode>[] {
    // Top and common CARC codes (full list has 253+)
    // Group codes: CO=Contractual, OA=Other, PI=Payer-Initiated, PR=Patient Responsibility
    return [
      // Contractual Obligation (CO)
      { code: '16', groupCode: 'CO', description: 'Claim/service lacks information needed for adjudication', rootCauseCategory: 'missing_information' },
      { code: '18', groupCode: 'CO', description: 'Duplicate claim/service', rootCauseCategory: 'duplicate' },
      { code: '23', groupCode: 'CO', description: 'The impact of prior payer(s) adjudication including payments and/or adjustments', rootCauseCategory: 'coordination_of_benefits' },
      { code: '29', groupCode: 'CO', description: 'The time limit for filing has expired', rootCauseCategory: 'timely_filing' },
      { code: '45', groupCode: 'CO', description: 'Charge exceeds fee schedule/max allowable or contracted rate', rootCauseCategory: 'fee_schedule' },
      { code: '50', groupCode: 'CO', description: 'Non-covered services because not deemed a medical necessity', rootCauseCategory: 'medical_necessity' },
      { code: '55', groupCode: 'CO', description: 'Service is not covered by payer', rootCauseCategory: 'non_covered_service' },
      { code: '96', groupCode: 'CO', description: 'Non-covered charge(s)', rootCauseCategory: 'non_covered_service' },
      { code: '97', groupCode: 'CO', description: 'The benefit for this service is included in the payment for another service/procedure', rootCauseCategory: 'bundling' },
      { code: '100', groupCode: 'CO', description: 'Payment made to patient/insured/responsible party', rootCauseCategory: 'payment_to_patient' },
      { code: '119', groupCode: 'CO', description: 'Benefit maximum for this time period or occurrence has been reached', rootCauseCategory: 'benefit_maximum' },
      { code: '151', groupCode: 'CO', description: 'Payment adjusted because the payer deems the information submitted does not support this level of service', rootCauseCategory: 'medical_necessity' },
      { code: '197', groupCode: 'CO', description: 'Precertification/authorization/pre-treatment absent', rootCauseCategory: 'prior_authorization' },
      { code: '204', groupCode: 'CO', description: 'This service/equipment/drug is not covered under the patient\'s current benefit plan', rootCauseCategory: 'non_covered_service' },
      { code: '233', groupCode: 'CO', description: 'Service denied because criteria not met', rootCauseCategory: 'medical_necessity' },
      { code: '234', groupCode: 'CO', description: 'This procedure is not paid separately. Other providers are paid for this service', rootCauseCategory: 'bundling' },
      { code: '243', groupCode: 'CO', description: 'The frequency of this service exceeds the allowable limit', rootCauseCategory: 'frequency_limit' },
      // Other Adjustments (OA)
      { code: '23', groupCode: 'OA', description: 'The impact of prior payer(s) adjudication', rootCauseCategory: 'coordination_of_benefits' },
      { code: '109', groupCode: 'OA', description: 'Claim not covered by this payer; submit to other payer', rootCauseCategory: 'wrong_payer' },
      // Payer Initiated (PI)
      { code: '72', groupCode: 'PI', description: 'Duplicate of a claim previously processed', rootCauseCategory: 'duplicate' },
      { code: '142', groupCode: 'PI', description: 'Claim denied because the service was not authorized', rootCauseCategory: 'prior_authorization' },
      // Patient Responsibility (PR)
      { code: '1', groupCode: 'PR', description: 'Deductible amount', rootCauseCategory: 'deductible' },
      { code: '2', groupCode: 'PR', description: 'Coinsurance amount', rootCauseCategory: 'coinsurance' },
      { code: '3', groupCode: 'PR', description: 'Copayment amount', rootCauseCategory: 'copay' },
      { code: '44', groupCode: 'PR', description: 'Write-off (not covered)', rootCauseCategory: 'patient_responsibility' },
      { code: '48', groupCode: 'PR', description: 'Non-covered charges because patient is not a member', rootCauseCategory: 'patient_responsibility' },
      { code: '49', groupCode: 'PR', description: 'Routine examination or screening not covered', rootCauseCategory: 'patient_responsibility' },
      { code: '109', groupCode: 'PR', description: 'Claim not covered by this payer', rootCauseCategory: 'wrong_payer' },
      { code: '119', groupCode: 'PR', description: 'Benefit maximum reached', rootCauseCategory: 'benefit_maximum' },
      { code: '198', groupCode: 'PR', description: 'Precertification/authorization absent', rootCauseCategory: 'prior_authorization' },
      { code: '204', groupCode: 'PR', description: 'Not covered under current benefit plan', rootCauseCategory: 'non_covered_service' },
    ];
  }

  private getRarcData(): Partial<RarcCode>[] {
    // Common RARC codes (full list has 918+)
    return [
      // Supplemental RARCs
      { code: 'N280', codeType: 'supplemental', description: 'Missing/Incomplete/Invalid Primary Identifier', rootCauseCategory: 'missing_information' },
      { code: 'N386', codeType: 'supplemental', description: 'This decision was based on a Local Coverage Determination (LCD) or National Coverage Determination (NCD)', rootCauseCategory: 'medical_necessity' },
      { code: 'N5', codeType: 'supplemental', description: 'Payment adjusted because this service was not pre-authorized', rootCauseCategory: 'prior_authorization' },
      { code: 'N56', codeType: 'supplemental', description: 'Procedure requires a modifier', rootCauseCategory: 'coding_error' },
      { code: 'N130', codeType: 'supplemental', description: 'Services are not covered when performed in this place of service', rootCauseCategory: 'non_covered_service' },
      { code: 'MA130', codeType: 'supplemental', description: 'Your claim contains errors and was returned', rootCauseCategory: 'missing_information' },
      { code: 'M50', codeType: 'supplemental', description: 'Missing/Incomplete/Invalid Revenue Code(s)', rootCauseCategory: 'coding_error' },
      { code: 'M76', codeType: 'supplemental', description: 'Missing/Incomplete/Invalid modifier', rootCauseCategory: 'coding_error' },
      { code: 'M51', codeType: 'supplemental', description: 'Missing/Incomplete/Invalid procedure code(s)', rootCauseCategory: 'coding_error' },
      { code: 'M127', codeType: 'supplemental', description: 'Missing patient medical record', rootCauseCategory: 'missing_information' },
      { code: 'N657', codeType: 'supplemental', description: 'Service was not pre-authorized', rootCauseCategory: 'prior_authorization' },
      { code: 'N418', codeType: 'supplemental', description: 'Claim was not paid as this is a pre-determination', rootCauseCategory: 'predetermination' },
      { code: 'N522', codeType: 'supplemental', description: 'Duplicate of a claim previously processed', rootCauseCategory: 'duplicate' },
      { code: 'N362', codeType: 'supplemental', description: 'The number of Days or Units of Service exceeds our acceptable maximum', rootCauseCategory: 'frequency_limit' },
      { code: 'N59', codeType: 'supplemental', description: 'Payment adjusted based on Multiple Procedure Guideline', rootCauseCategory: 'bundling' },
      { code: 'N69', codeType: 'supplemental', description: 'Service not covered by this payer', rootCauseCategory: 'non_covered_service' },
      { code: 'N130', codeType: 'supplemental', description: 'Not covered in this place of service', rootCauseCategory: 'non_covered_service' },
      // Informational RARCs (Alerts)
      { code: 'N1', codeType: 'informational', description: 'Additional information may be needed', rootCauseCategory: 'missing_information' },
      { code: 'N2', codeType: 'informational', description: 'This allowance is based on a methodology authorized by CMS', rootCauseCategory: 'fee_schedule' },
      { code: 'N3', codeType: 'informational', description: 'Benefits are not available for this service', rootCauseCategory: 'non_covered_service' },
      { code: 'N4', codeType: 'informational', description: 'Claim information not submitted', rootCauseCategory: 'missing_information' },
      { code: 'N89', codeType: 'informational', description: 'Payment adjusted based on a prior payer', rootCauseCategory: 'coordination_of_benefits' },
      { code: 'N95', codeType: 'informational', description: 'This service was not pre-authorized', rootCauseCategory: 'prior_authorization' },
      { code: 'N98', codeType: 'informational', description: 'Patient was not a member at the time of service', rootCauseCategory: 'patient_responsibility' },
      { code: 'N99', codeType: 'informational', description: 'Service was not pre-authorized', rootCauseCategory: 'prior_authorization' },
      { code: 'N100', codeType: 'informational', description: 'Payment adjusted based on a prior payer', rootCauseCategory: 'coordination_of_benefits' },
      { code: 'MA01', codeType: 'informational', description: 'If you do not agree with the determination, you may appeal', rootCauseCategory: 'appeal' },
      { code: 'MA02', codeType: 'informational', description: 'Alert: This is a duplicate claim', rootCauseCategory: 'duplicate' },
      { code: 'MA04', codeType: 'informational', description: 'Secondary payment cannot be considered without primary payment', rootCauseCategory: 'coordination_of_benefits' },
      { code: 'MA07', codeType: 'informational', description: 'The claim information has been forwarded to a supplemental insurer', rootCauseCategory: 'coordination_of_benefits' },
      { code: 'MA08', codeType: 'informational', description: 'Claim was not paid as this is a pre-determination', rootCauseCategory: 'predetermination' },
      { code: 'MA18', codeType: 'informational', description: 'The claim information is also being forwarded to the patient', rootCauseCategory: 'patient_responsibility' },
      { code: 'MA32', codeType: 'informational', description: 'Please resubmit this claim using the correct procedure code', rootCauseCategory: 'coding_error' },
      { code: 'MA39', codeType: 'informational', description: 'Missing/Incorrect Referring Provider Number', rootCauseCategory: 'missing_information' },
      { code: 'MA42', codeType: 'informational', description: 'Missing/Incomplete/Invalid Place of Service', rootCauseCategory: 'missing_information' },
      { code: 'MA54', codeType: 'informational', description: 'Service not covered by this payer', rootCauseCategory: 'non_covered_service' },
      { code: 'MA61', codeType: 'informational', description: 'Missing/Incomplete/Invalid Patient Payment Amount', rootCauseCategory: 'missing_information' },
      { code: 'MA62', codeType: 'informational', description: 'Missing/Incomplete/Invalid Patient Relationship to Insured', rootCauseCategory: 'missing_information' },
      { code: 'MA63', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Address', rootCauseCategory: 'missing_information' },
      { code: 'MA64', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Name', rootCauseCategory: 'missing_information' },
      { code: 'MA65', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Date of Birth', rootCauseCategory: 'missing_information' },
      { code: 'MA66', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Gender', rootCauseCategory: 'missing_information' },
      { code: 'MA67', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Phone Number', rootCauseCategory: 'missing_information' },
      { code: 'MA68', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Policy Number', rootCauseCategory: 'missing_information' },
      { code: 'MA69', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Group Number', rootCauseCategory: 'missing_information' },
      { code: 'MA70', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Group Name', rootCauseCategory: 'missing_information' },
      { code: 'MA71', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Name', rootCauseCategory: 'missing_information' },
      { code: 'MA72', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Type', rootCauseCategory: 'missing_information' },
      { code: 'MA73', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Effective Date', rootCauseCategory: 'missing_information' },
      { code: 'MA74', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Termination Date', rootCauseCategory: 'missing_information' },
      { code: 'MA75', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Coverage', rootCauseCategory: 'missing_information' },
      { code: 'MA76', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Deductible', rootCauseCategory: 'missing_information' },
      { code: 'MA77', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Coinsurance', rootCauseCategory: 'missing_information' },
      { code: 'MA78', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Copay', rootCauseCategory: 'missing_information' },
      { code: 'MA79', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Out-of-Pocket Maximum', rootCauseCategory: 'missing_information' },
      { code: 'MA80', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Lifetime Maximum', rootCauseCategory: 'missing_information' },
      { code: 'MA81', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Pre-Authorization', rootCauseCategory: 'missing_information' },
      { code: 'MA82', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Referral', rootCauseCategory: 'missing_information' },
      { code: 'MA83', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Network', rootCauseCategory: 'missing_information' },
      { code: 'MA84', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Provider', rootCauseCategory: 'missing_information' },
      { code: 'MA85', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Facility', rootCauseCategory: 'missing_information' },
      { code: 'MA86', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Service', rootCauseCategory: 'missing_information' },
      { code: 'MA87', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Supply', rootCauseCategory: 'missing_information' },
      { code: 'MA88', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Equipment', rootCauseCategory: 'missing_information' },
      { code: 'MA89', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Medication', rootCauseCategory: 'missing_information' },
      { code: 'MA90', codeType: 'informational', description: 'Missing/Incomplete/Invalid Insured\'s Plan Test', rootCauseCategory: 'missing_information' },
    ];
  }
}
