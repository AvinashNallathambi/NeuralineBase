import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabPanel } from './entities/lab-panel.entity';
import { ReferenceRange } from './entities/reference-range.entity';

@Injectable()
export class LabSeedService {
  private readonly logger = new Logger(LabSeedService.name);

  constructor(
    @InjectRepository(LabPanel)
    private readonly panelRepository: Repository<LabPanel>,
    @InjectRepository(ReferenceRange)
    private readonly referenceRangeRepository: Repository<ReferenceRange>,
  ) {}

  async onModuleInit() {
    await this.seedPanels();
    await this.seedReferenceRanges();
  }

  private async seedPanels() {
    const count = await this.panelRepository.count();
    if (count > 0) {
      this.logger.log(`Lab panels already seeded (${count}), skipping`);
      return;
    }
    this.logger.log('Seeding lab panels...');

    // Use a shared tenantId placeholder; panels with NULL tenantId are global
    // We'll insert with NULL tenantId so they're available to all tenants
    const panels = this.getPanelData();
    await this.panelRepository
      .createQueryBuilder()
      .insert()
      .into(LabPanel)
      .values(panels)
      .orIgnore()
      .execute();

    this.logger.log(`Lab panels seeded: ${panels.length}`);
  }

  private async seedReferenceRanges() {
    const count = await this.referenceRangeRepository.count();
    if (count > 0) {
      this.logger.log(`Reference ranges already seeded (${count}), skipping`);
      return;
    }
    this.logger.log('Seeding reference ranges...');

    const ranges = this.getReferenceRangeData();
    await this.referenceRangeRepository
      .createQueryBuilder()
      .insert()
      .into(ReferenceRange)
      .values(ranges)
      .orIgnore()
      .execute();

    this.logger.log(`Reference ranges seeded: ${ranges.length}`);
  }

  private getPanelData(): Partial<LabPanel>[] {
    return [
      {
        tenantId: null as any,
        name: 'Complete Blood Count (CBC)',
        code: '85025',
        loincCode: '58410-2',
        category: 'Hematology',
        tests: [
          { name: 'WBC', loincCode: '6690-2', category: 'Hematology' },
          { name: 'RBC', loincCode: '789-8', category: 'Hematology' },
          { name: 'Hemoglobin', loincCode: '718-7', category: 'Hematology' },
          { name: 'Hematocrit', loincCode: '4544-3', category: 'Hematology' },
          { name: 'MCV', loincCode: '787-2', category: 'Hematology' },
          { name: 'MCH', loincCode: '785-6', category: 'Hematology' },
          { name: 'MCHC', loincCode: '786-4', category: 'Hematology' },
          { name: 'Platelets', loincCode: '777-3', category: 'Hematology' },
        ],
        defaultPriority: 'routine',
        fastingRequired: false,
        isActive: true,
        description: 'Complete blood count with differential',
      },
      {
        tenantId: null as any,
        name: 'Basic Metabolic Panel (BMP)',
        code: '80048',
        loincCode: '24323-8',
        category: 'Chemistry',
        tests: [
          { name: 'Glucose', loincCode: '2339-0', category: 'Chemistry' },
          { name: 'BUN', loincCode: '3094-0', category: 'Chemistry' },
          { name: 'Creatinine', loincCode: '2160-0', category: 'Chemistry' },
          { name: 'Sodium', loincCode: '2951-2', category: 'Chemistry' },
          { name: 'Potassium', loincCode: '2823-3', category: 'Chemistry' },
          { name: 'Chloride', loincCode: '2075-0', category: 'Chemistry' },
          { name: 'CO2', loincCode: '2028-9', category: 'Chemistry' },
          { name: 'Calcium', loincCode: '17861-6', category: 'Chemistry' },
        ],
        defaultPriority: 'routine',
        fastingRequired: true,
        isActive: true,
        description: 'Basic metabolic panel (fasting 8 hours)',
      },
      {
        tenantId: null as any,
        name: 'Comprehensive Metabolic Panel (CMP)',
        code: '80053',
        loincCode: '24323-8',
        category: 'Chemistry',
        tests: [
          { name: 'Glucose', loincCode: '2339-0', category: 'Chemistry' },
          { name: 'BUN', loincCode: '3094-0', category: 'Chemistry' },
          { name: 'Creatinine', loincCode: '2160-0', category: 'Chemistry' },
          { name: 'Sodium', loincCode: '2951-2', category: 'Chemistry' },
          { name: 'Potassium', loincCode: '2823-3', category: 'Chemistry' },
          { name: 'Chloride', loincCode: '2075-0', category: 'Chemistry' },
          { name: 'CO2', loincCode: '2028-9', category: 'Chemistry' },
          { name: 'Calcium', loincCode: '17861-6', category: 'Chemistry' },
          { name: 'Total Protein', loincCode: '2885-2', category: 'Chemistry' },
          { name: 'Albumin', loincCode: '1751-7', category: 'Chemistry' },
          { name: 'Total Bilirubin', loincCode: '1975-2', category: 'Chemistry' },
          { name: 'ALP', loincCode: '6768-6', category: 'Chemistry' },
          { name: 'AST', loincCode: '1920-8', category: 'Chemistry' },
          { name: 'ALT', loincCode: '1742-6', category: 'Chemistry' },
        ],
        defaultPriority: 'routine',
        fastingRequired: true,
        isActive: true,
        description: 'Comprehensive metabolic panel (fasting 8 hours)',
      },
      {
        tenantId: null as any,
        name: 'Lipid Panel',
        code: '80061',
        loincCode: '24331-1',
        category: 'Chemistry',
        tests: [
          { name: 'Total Cholesterol', loincCode: '2093-3', category: 'Chemistry' },
          { name: 'HDL', loincCode: '2085-9', category: 'Chemistry' },
          { name: 'LDL', loincCode: '2089-1', category: 'Chemistry' },
          { name: 'Triglycerides', loincCode: '2571-8', category: 'Chemistry' },
        ],
        defaultPriority: 'routine',
        fastingRequired: true,
        isActive: true,
        description: 'Lipid panel (fasting 12 hours)',
      },
      {
        tenantId: null as any,
        name: 'Hemoglobin A1c',
        code: '83036',
        loincCode: '4548-4',
        category: 'Endocrine',
        tests: [{ name: 'HbA1c', loincCode: '4548-4', category: 'Endocrine' }],
        defaultPriority: 'routine',
        fastingRequired: false,
        isActive: true,
        description: 'Hemoglobin A1c - 3-month average blood glucose',
      },
      {
        tenantId: null as any,
        name: 'Thyroid Panel (TSH)',
        code: '84443',
        loincCode: '33728-7',
        category: 'Endocrine',
        tests: [
          { name: 'TSH', loincCode: '3019-0', category: 'Endocrine' },
          { name: 'Free T4', loincCode: '3024-0', category: 'Endocrine' },
          { name: 'Free T3', loincCode: '3051-3', category: 'Endocrine' },
        ],
        defaultPriority: 'routine',
        fastingRequired: false,
        isActive: true,
        description: 'Thyroid stimulating hormone with free T4/T3',
      },
      {
        tenantId: null as any,
        name: 'Urinalysis',
        code: '81001',
        loincCode: '24357-6',
        category: 'Urinalysis',
        tests: [
          { name: 'Color', loincCode: '5778-6', category: 'Urinalysis' },
          { name: 'Clarity', loincCode: '32167-9', category: 'Urinalysis' },
          { name: 'pH', loincCode: '2756-5', category: 'Urinalysis' },
          { name: 'Specific Gravity', loincCode: '2965-2', category: 'Urinalysis' },
          { name: 'Protein', loincCode: '5803-2', category: 'Urinalysis' },
          { name: 'Glucose', loincCode: '2350-7', category: 'Urinalysis' },
          { name: 'Ketones', loincCode: '33905-5', category: 'Urinalysis' },
          { name: 'Blood', loincCode: '725-2', category: 'Urinalysis' },
          { name: 'WBC', loincCode: '5821-4', category: 'Urinalysis' },
        ],
        defaultPriority: 'routine',
        fastingRequired: false,
        isActive: true,
        description: 'Urinalysis with microscopic examination',
      },
      {
        tenantId: null as any,
        name: 'Liver Function Tests',
        code: '80076',
        loincCode: '24325-3',
        category: 'Chemistry',
        tests: [
          { name: 'AST', loincCode: '1920-8', category: 'Chemistry' },
          { name: 'ALT', loincCode: '1742-6', category: 'Chemistry' },
          { name: 'ALP', loincCode: '6768-6', category: 'Chemistry' },
          { name: 'Total Bilirubin', loincCode: '1975-2', category: 'Chemistry' },
          { name: 'Direct Bilirubin', loincCode: '1968-7', category: 'Chemistry' },
          { name: 'Total Protein', loincCode: '2885-2', category: 'Chemistry' },
          { name: 'Albumin', loincCode: '1751-7', category: 'Chemistry' },
        ],
        defaultPriority: 'routine',
        fastingRequired: false,
        isActive: true,
        description: 'Liver function panel',
      },
      {
        tenantId: null as any,
        name: 'Coagulation Panel',
        code: '85610',
        loincCode: '3176-2',
        category: 'Coagulation',
        tests: [
          { name: 'PT', loincCode: '10989-0', category: 'Coagulation' },
          { name: 'INR', loincCode: '34714-6', category: 'Coagulation' },
          { name: 'PTT', loincCode: '14979-9', category: 'Coagulation' },
        ],
        defaultPriority: 'routine',
        fastingRequired: false,
        isActive: true,
        description: 'Prothrombin time, INR, and partial thromboplastin time',
      },
      {
        tenantId: null as any,
        name: 'Iron Studies',
        code: '83540',
        loincCode: '24322-0',
        category: 'Chemistry',
        tests: [
          { name: 'Serum Iron', loincCode: '2502-3', category: 'Chemistry' },
          { name: 'TIBC', loincCode: '2507-2', category: 'Chemistry' },
          { name: 'Ferritin', loincCode: '2276-4', category: 'Chemistry' },
          { name: 'Transferrin Saturation', loincCode: '2508-0', category: 'Chemistry' },
        ],
        defaultPriority: 'routine',
        fastingRequired: true,
        isActive: true,
        description: 'Iron panel for anemia workup (fasting 12 hours)',
      },
    ];
  }

  private getReferenceRangeData(): Partial<ReferenceRange>[] {
    return [
      // Hematology
      { loincCode: '6690-2', testName: 'WBC', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 4.5, highValue: 11.0, unit: 'K/uL', criticalLow: 1.5, criticalHigh: 30.0, textRange: '4.5-11.0', source: 'Mayo Clinic' },
      { loincCode: '789-8', testName: 'RBC', gender: 'male', ageMinDays: 0, ageMaxDays: null, lowValue: 4.3, highValue: 5.9, unit: 'M/uL', criticalLow: 2.0, criticalHigh: 8.0, textRange: '4.3-5.9', source: 'Mayo Clinic' },
      { loincCode: '789-8', testName: 'RBC', gender: 'female', ageMinDays: 0, ageMaxDays: null, lowValue: 3.5, highValue: 5.5, unit: 'M/uL', criticalLow: 2.0, criticalHigh: 8.0, textRange: '3.5-5.5', source: 'Mayo Clinic' },
      { loincCode: '718-7', testName: 'Hemoglobin', gender: 'male', ageMinDays: 0, ageMaxDays: null, lowValue: 13.5, highValue: 17.5, unit: 'g/dL', criticalLow: 7.0, criticalHigh: 22.0, textRange: '13.5-17.5', source: 'Mayo Clinic' },
      { loincCode: '718-7', testName: 'Hemoglobin', gender: 'female', ageMinDays: 0, ageMaxDays: null, lowValue: 12.0, highValue: 15.5, unit: 'g/dL', criticalLow: 7.0, criticalHigh: 22.0, textRange: '12.0-15.5', source: 'Mayo Clinic' },
      { loincCode: '4544-3', testName: 'Hematocrit', gender: 'male', ageMinDays: 0, ageMaxDays: null, lowValue: 41.0, highValue: 53.0, unit: '%', criticalLow: 21.0, criticalHigh: 65.0, textRange: '41.0-53.0', source: 'Mayo Clinic' },
      { loincCode: '4544-3', testName: 'Hematocrit', gender: 'female', ageMinDays: 0, ageMaxDays: null, lowValue: 36.0, highValue: 46.0, unit: '%', criticalLow: 21.0, criticalHigh: 65.0, textRange: '36.0-46.0', source: 'Mayo Clinic' },
      { loincCode: '787-2', testName: 'MCV', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 80.0, highValue: 100.0, unit: 'fL', criticalLow: 60.0, criticalHigh: 120.0, textRange: '80-100', source: 'Mayo Clinic' },
      { loincCode: '777-3', testName: 'Platelets', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 150, highValue: 450, unit: 'K/uL', criticalLow: 50, criticalHigh: 1000, textRange: '150-450', source: 'Mayo Clinic' },

      // Chemistry
      { loincCode: '2339-0', testName: 'Glucose', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 70, highValue: 100, unit: 'mg/dL', criticalLow: 40, criticalHigh: 500, textRange: '70-100', source: 'Mayo Clinic' },
      { loincCode: '3094-0', testName: 'BUN', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 7, highValue: 20, unit: 'mg/dL', criticalLow: 3, criticalHigh: 100, textRange: '7-20', source: 'Mayo Clinic' },
      { loincCode: '2160-0', testName: 'Creatinine', gender: 'male', ageMinDays: 0, ageMaxDays: null, lowValue: 0.7, highValue: 1.3, unit: 'mg/dL', criticalLow: 0.2, criticalHigh: 5.0, textRange: '0.7-1.3', source: 'Mayo Clinic' },
      { loincCode: '2160-0', testName: 'Creatinine', gender: 'female', ageMinDays: 0, ageMaxDays: null, lowValue: 0.6, highValue: 1.1, unit: 'mg/dL', criticalLow: 0.2, criticalHigh: 5.0, textRange: '0.6-1.1', source: 'Mayo Clinic' },
      { loincCode: '2951-2', testName: 'Sodium', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 135, highValue: 145, unit: 'mmol/L', criticalLow: 120, criticalHigh: 160, textRange: '135-145', source: 'Mayo Clinic' },
      { loincCode: '2823-3', testName: 'Potassium', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 3.5, highValue: 5.0, unit: 'mmol/L', criticalLow: 2.5, criticalHigh: 6.5, textRange: '3.5-5.0', source: 'Mayo Clinic' },
      { loincCode: '2075-0', testName: 'Chloride', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 98, highValue: 107, unit: 'mmol/L', criticalLow: 80, criticalHigh: 120, textRange: '98-107', source: 'Mayo Clinic' },
      { loincCode: '2028-9', testName: 'CO2', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 22, highValue: 29, unit: 'mmol/L', criticalLow: 10, criticalHigh: 50, textRange: '22-29', source: 'Mayo Clinic' },
      { loincCode: '17861-6', testName: 'Calcium', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 8.6, highValue: 10.3, unit: 'mg/dL', criticalLow: 6.0, criticalHigh: 13.0, textRange: '8.6-10.3', source: 'Mayo Clinic' },
      { loincCode: '2885-2', testName: 'Total Protein', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 6.1, highValue: 8.1, unit: 'g/dL', criticalLow: 4.0, criticalHigh: 11.0, textRange: '6.1-8.1', source: 'Mayo Clinic' },
      { loincCode: '1751-7', testName: 'Albumin', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 3.5, highValue: 5.0, unit: 'g/dL', criticalLow: 2.0, criticalHigh: 6.0, textRange: '3.5-5.0', source: 'Mayo Clinic' },
      { loincCode: '1975-2', testName: 'Total Bilirubin', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 0.2, highValue: 1.2, unit: 'mg/dL', criticalLow: 0.1, criticalHigh: 20.0, textRange: '0.2-1.2', source: 'Mayo Clinic' },
      { loincCode: '6768-6', testName: 'ALP', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 44, highValue: 147, unit: 'IU/L', criticalLow: 20, criticalHigh: 500, textRange: '44-147', source: 'Mayo Clinic' },
      { loincCode: '1920-8', testName: 'AST', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 8, highValue: 48, unit: 'IU/L', criticalLow: 5, criticalHigh: 500, textRange: '8-48', source: 'Mayo Clinic' },
      { loincCode: '1742-6', testName: 'ALT', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 7, highValue: 55, unit: 'IU/L', criticalLow: 5, criticalHigh: 500, textRange: '7-55', source: 'Mayo Clinic' },

      // Lipids
      { loincCode: '2093-3', testName: 'Total Cholesterol', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 0, highValue: 200, unit: 'mg/dL', criticalLow: 0, criticalHigh: 500, textRange: '<200', source: 'AHA' },
      { loincCode: '2085-9', testName: 'HDL', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 40, highValue: 100, unit: 'mg/dL', criticalLow: 10, criticalHigh: 150, textRange: '>40', source: 'AHA' },
      { loincCode: '2089-1', testName: 'LDL', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 0, highValue: 130, unit: 'mg/dL', criticalLow: 0, criticalHigh: 500, textRange: '<130', source: 'AHA' },
      { loincCode: '2571-8', testName: 'Triglycerides', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 0, highValue: 150, unit: 'mg/dL', criticalLow: 0, criticalHigh: 1000, textRange: '<150', source: 'AHA' },

      // Endocrine
      { loincCode: '4548-4', testName: 'HbA1c', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 4.0, highValue: 5.6, unit: '%', criticalLow: 3.0, criticalHigh: 14.0, textRange: '4.0-5.6', source: 'ADA' },
      { loincCode: '3019-0', testName: 'TSH', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 0.4, highValue: 4.0, unit: 'mIU/L', criticalLow: 0.05, criticalHigh: 100, textRange: '0.4-4.0', source: 'AACE' },
      { loincCode: '3024-0', testName: 'Free T4', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 0.8, highValue: 1.8, unit: 'ng/dL', criticalLow: 0.1, criticalHigh: 8.0, textRange: '0.8-1.8', source: 'AACE' },
      { loincCode: '3051-3', testName: 'Free T3', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 2.3, highValue: 4.2, unit: 'pg/mL', criticalLow: 0.5, criticalHigh: 15.0, textRange: '2.3-4.2', source: 'AACE' },

      // Coagulation
      { loincCode: '10989-0', testName: 'PT', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 9.5, highValue: 13.5, unit: 'sec', criticalLow: 5.0, criticalHigh: 50.0, textRange: '9.5-13.5', source: 'Mayo Clinic' },
      { loincCode: '34714-6', testName: 'INR', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 0.8, highValue: 1.2, unit: '', criticalLow: 0.5, criticalHigh: 6.0, textRange: '0.8-1.2', source: 'Mayo Clinic' },
      { loincCode: '14979-9', testName: 'PTT', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 25, highValue: 35, unit: 'sec', criticalLow: 15, criticalHigh: 100, textRange: '25-35', source: 'Mayo Clinic' },

      // Iron Studies
      { loincCode: '2502-3', testName: 'Serum Iron', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 60, highValue: 170, unit: 'ug/dL', criticalLow: 10, criticalHigh: 500, textRange: '60-170', source: 'Mayo Clinic' },
      { loincCode: '2507-2', testName: 'TIBC', gender: 'all', ageMinDays: 0, ageMaxDays: null, lowValue: 250, highValue: 450, unit: 'ug/dL', criticalLow: 100, criticalHigh: 600, textRange: '250-450', source: 'Mayo Clinic' },
      { loincCode: '2276-4', testName: 'Ferritin', gender: 'male', ageMinDays: 0, ageMaxDays: null, lowValue: 24, highValue: 336, unit: 'ng/mL', criticalLow: 5, criticalHigh: 5000, textRange: '24-336', source: 'Mayo Clinic' },
      { loincCode: '2276-4', testName: 'Ferritin', gender: 'female', ageMinDays: 0, ageMaxDays: null, lowValue: 11, highValue: 307, unit: 'ng/mL', criticalLow: 5, criticalHigh: 5000, textRange: '11-307', source: 'Mayo Clinic' },
    ];
  }
}
