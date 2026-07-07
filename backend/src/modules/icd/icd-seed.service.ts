import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IcdCode } from './entities/icd-code.entity';

interface IcdEntry {
  code: string;
  description: string;
  category: string;
  chapter: number;
  chapterTitle: string;
  isBillable: boolean;
  isHeader: boolean;
}

@Injectable()
export class IcdSeedService {
  private readonly logger = new Logger(IcdSeedService.name);

  constructor(
    @InjectRepository(IcdCode)
    private readonly repository: Repository<IcdCode>,
  ) {}

  async onModuleInit() {
    const count = await this.repository.count();
    if (count > 0) {
      this.logger.log(`ICD-10 codes already seeded (${count}), skipping`);
      return;
    }
    this.logger.log('Seeding ICD-10 codes...');
    await this.seed();
    this.logger.log('ICD-10 codes seeded successfully');
  }

  async seed() {
    const codes = this.generateCodes();
    const batchSize = 500;
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      await this.repository
        .createQueryBuilder()
        .insert()
        .into(IcdCode)
        .values(batch)
        .orIgnore()
        .execute();
    }
    try {
      await this.repository.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_icd_codes_code ON icd_codes(code)`);
      await this.repository.query(`CREATE INDEX IF NOT EXISTS idx_icd_codes_cat ON icd_codes(category)`);
      await this.repository.query(`CREATE INDEX IF NOT EXISTS idx_icd_codes_billable ON icd_codes(is_billable)`);
      await this.repository.query(`CREATE INDEX IF NOT EXISTS idx_icd_codes_chapter ON icd_codes(chapter)`);
    } catch { }

    await this.repository.query(
      `ALTER TABLE icd_codes ADD COLUMN IF NOT EXISTS search_vector tsvector`,
    );
    await this.repository.query(
      `UPDATE icd_codes SET search_vector = to_tsvector('english',
        coalesce(code, '') || ' ' || coalesce(description, '') || ' ' ||
        coalesce(category, '') || ' ' || coalesce(chapter_title, '')
      )`,
    );
    this.logger.log(`Search vectors updated for ${codes.length} codes`);
  }

  async refresh() {
    const count = await this.repository.count();
    this.logger.log(`Refreshing ICD-10 dataset (current: ${count})`);
    await this.repository.query('TRUNCATE TABLE icd_codes RESTART IDENTITY CASCADE');
    await this.seed();
    return count;
  }

  private readonly chapters: Array<{ num: number; title: string; ranges: Array<{ start: string; end: string }> }> = [
    { num: 1, title: 'Certain infectious and parasitic diseases', ranges: [{ start: 'A00', end: 'B99' }] },
    { num: 2, title: 'Neoplasms', ranges: [{ start: 'C00', end: 'D49' }] },
    { num: 3, title: 'Diseases of the blood and blood-forming organs', ranges: [{ start: 'D50', end: 'D89' }] },
    { num: 4, title: 'Endocrine, nutritional and metabolic diseases', ranges: [{ start: 'E00', end: 'E89' }] },
    { num: 5, title: 'Mental, behavioral and neurodevelopmental disorders', ranges: [{ start: 'F01', end: 'F99' }] },
    { num: 6, title: 'Diseases of the nervous system', ranges: [{ start: 'G00', end: 'G99' }] },
    { num: 7, title: 'Diseases of the eye and adnexa', ranges: [{ start: 'H00', end: 'H59' }] },
    { num: 8, title: 'Diseases of the ear and mastoid process', ranges: [{ start: 'H60', end: 'H95' }] },
    { num: 9, title: 'Diseases of the circulatory system', ranges: [{ start: 'I00', end: 'I99' }] },
    { num: 10, title: 'Diseases of the respiratory system', ranges: [{ start: 'J00', end: 'J99' }] },
    { num: 11, title: 'Diseases of the digestive system', ranges: [{ start: 'K00', end: 'K95' }] },
    { num: 12, title: 'Diseases of the skin and subcutaneous tissue', ranges: [{ start: 'L00', end: 'L99' }] },
    { num: 13, title: 'Diseases of the musculoskeletal system and connective tissue', ranges: [{ start: 'M00', end: 'M99' }] },
    { num: 14, title: 'Diseases of the genitourinary system', ranges: [{ start: 'N00', end: 'N99' }] },
    { num: 15, title: 'Pregnancy, childbirth and the puerperium', ranges: [{ start: 'O00', end: 'O9A' }] },
    { num: 16, title: 'Certain conditions originating in the perinatal period', ranges: [{ start: 'P00', end: 'P96' }] },
    { num: 17, title: 'Congenital malformations', ranges: [{ start: 'Q00', end: 'Q99' }] },
    { num: 18, title: 'Symptoms, signs and abnormal clinical findings', ranges: [{ start: 'R00', end: 'R99' }] },
    { num: 19, title: 'Injury, poisoning and certain other consequences of external causes', ranges: [{ start: 'S00', end: 'T88' }] },
    { num: 20, title: 'External causes of morbidity', ranges: [{ start: 'V00', end: 'Y99' }] },
    { num: 21, title: 'Factors influencing health status and contact with health services', ranges: [{ start: 'Z00', end: 'Z99' }] },
  ];

  private generateCodes(): IcdEntry[] {
    const entries: IcdEntry[] = [];
    for (const chapter of this.chapters) {
      for (const range of chapter.ranges) {
        this.generateRange(range.start, range.end, chapter.num, chapter.title, entries);
      }
    }
    return entries;
  }

  private generateRange(
    start: string,
    end: string,
    chapter: number,
    chapterTitle: string,
    entries: IcdEntry[],
  ) {
    const categoryStart = start.substring(0, 3);
    const categoryEnd = end.substring(0, 3);
    const startNum = parseInt(start.substring(1, 3), 10);
    const endNum = parseInt(end.substring(1, 3), 10);

    for (let n = startNum; n <= endNum; n++) {
      for (const suffix of [undefined, '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
        const letter = start.charAt(0);
        const cat = `${letter}${String(n).padStart(2, '0')}`;
        if (cat < categoryStart || cat > categoryEnd) continue;

        const description = this.getDescription(cat, suffix, chapter);
        if (!description) continue;

        const code = suffix ? `${cat}.${suffix}` : cat;
        entries.push({
          code,
          description,
          category: cat,
          chapter,
          chapterTitle,
          isBillable: !!suffix,
          isHeader: !suffix,
        });

        if (suffix !== undefined && /^\d$/.test(suffix)) {
          for (const sub of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
            const subCode = `${cat}.${suffix}${sub}`;
            const subDesc = this.getDescription(cat, `${suffix}${sub}`, chapter);
            if (subDesc) {
              entries.push({
                code: subCode,
                description: subDesc,
                category: cat,
                chapter,
                chapterTitle,
                isBillable: true,
                isHeader: false,
              });
            }
          }
        }
      }
    }
  }

  private getDescription(category: string, suffix: string | undefined, chapter: number): string | null {
    const key = suffix ? `${category}.${suffix}` : category;
    if (descriptions[key]) return descriptions[key];
    if (suffix && descriptions[`${category}.${suffix[0]}`]) return descriptions[`${category}.${suffix[0]}`];
    if (suffix && suffix.length >= 2 && descriptions[`${category}.${suffix.substring(0, 2)}`]) return descriptions[`${category}.${suffix.substring(0, 2)}`];
    if (suffix && descriptions[category]) return `${descriptions[category]}, unspecified`;
    return null;
  }
}

const descriptions: Record<string, string> = {
  'E08': 'Diabetes mellitus due to underlying condition',
  'E08.0': 'Diabetes mellitus due to underlying condition with hyperosmolarity',
  'E08.00': 'Diabetes mellitus due to underlying condition with hyperosmolarity without nonketotic hyperglycemic-hyperosmolar coma',
  'E08.01': 'Diabetes mellitus due to underlying condition with hyperosmolarity with coma',
  'E08.1': 'Diabetes mellitus due to underlying condition with ketoacidosis',
  'E08.10': 'Diabetes mellitus due to underlying condition with ketoacidosis without coma',
  'E08.11': 'Diabetes mellitus due to underlying condition with ketoacidosis with coma',
  'E08.2': 'Diabetes mellitus due to underlying condition with kidney complications',
  'E08.21': 'Diabetes mellitus due to underlying condition with diabetic nephropathy',
  'E08.22': 'Diabetes mellitus due to underlying condition with diabetic chronic kidney disease',
  'E08.29': 'Diabetes mellitus due to underlying condition with other diabetic kidney complication',
  'E08.3': 'Diabetes mellitus due to underlying condition with ophthalmic complications',
  'E08.31': 'Diabetes mellitus due to underlying condition with unspecified diabetic retinopathy',
  'E08.311': 'Diabetes mellitus due to underlying condition with unspecified diabetic retinopathy with macular edema',
  'E08.319': 'Diabetes mellitus due to underlying condition with unspecified diabetic retinopathy without macular edema',
  'E08.32': 'Diabetes mellitus due to underlying condition with mild nonproliferative diabetic retinopathy',
  'E08.321': 'Diabetes mellitus due to underlying condition with mild nonproliferative diabetic retinopathy with macular edema',
  'E08.329': 'Diabetes mellitus due to underlying condition with mild nonproliferative diabetic retinopathy without macular edema',
  'E08.33': 'Diabetes mellitus due to underlying condition with moderate nonproliferative diabetic retinopathy',
  'E08.331': 'Diabetes mellitus due to underlying condition with moderate nonproliferative diabetic retinopathy with macular edema',
  'E08.339': 'Diabetes mellitus due to underlying condition with moderate nonproliferative diabetic retinopathy without macular edema',
  'E08.34': 'Diabetes mellitus due to underlying condition with severe nonproliferative diabetic retinopathy',
  'E08.341': 'Diabetes mellitus due to underlying condition with severe nonproliferative diabetic retinopathy with macular edema',
  'E08.349': 'Diabetes mellitus due to underlying condition with severe nonproliferative diabetic retinopathy without macular edema',
  'E08.35': 'Diabetes mellitus due to underlying condition with proliferative diabetic retinopathy',
  'E08.351': 'Diabetes mellitus due to underlying condition with proliferative diabetic retinopathy with macular edema',
  'E08.359': 'Diabetes mellitus due to underlying condition with proliferative diabetic retinopathy without macular edema',
  'E08.36': 'Diabetes mellitus due to underlying condition with diabetic cataract',
  'E08.37': 'Diabetes mellitus due to underlying condition with diabetic macular edema',
  'E08.39': 'Diabetes mellitus due to underlying condition with other diabetic ophthalmic complication',
  'E08.4': 'Diabetes mellitus due to underlying condition with neurological complications',
  'E08.40': 'Diabetes mellitus due to underlying condition with diabetic neuropathy, unspecified',
  'E08.41': 'Diabetes mellitus due to underlying condition with diabetic mononeuropathy',
  'E08.42': 'Diabetes mellitus due to underlying condition with diabetic polyneuropathy',
  'E08.43': 'Diabetes mellitus due to underlying condition with diabetic autonomic neuropathy',
  'E08.44': 'Diabetes mellitus due to underlying condition with diabetic amyotrophy',
  'E08.49': 'Diabetes mellitus due to underlying condition with other diabetic neurological complication',
  'E08.5': 'Diabetes mellitus due to underlying condition with circulatory complications',
  'E08.51': 'Diabetes mellitus due to underlying condition with diabetic peripheral angiopathy without gangrene',
  'E08.52': 'Diabetes mellitus due to underlying condition with diabetic peripheral angiopathy with gangrene',
  'E08.59': 'Diabetes mellitus due to underlying condition with other circulatory complications',
  'E08.6': 'Diabetes mellitus due to underlying condition with other complications',
  'E08.61': 'Diabetes mellitus due to underlying condition with diabetic arthropathy',
  'E08.610': 'Diabetes mellitus due to underlying condition with diabetic neuropathic arthropathy',
  'E08.618': 'Diabetes mellitus due to underlying condition with other diabetic arthropathy',
  'E08.62': 'Diabetes mellitus due to underlying condition with skin complications',
  'E08.620': 'Diabetes mellitus due to underlying condition with diabetic dermatitis',
  'E08.621': 'Diabetes mellitus due to underlying condition with foot ulcer',
  'E08.622': 'Diabetes mellitus due to underlying condition with other skin ulcer',
  'E08.628': 'Diabetes mellitus due to underlying condition with other skin complications',
  'E08.63': 'Diabetes mellitus due to underlying condition with oral complications',
  'E08.630': 'Diabetes mellitus due to underlying condition with periodontal disease',
  'E08.638': 'Diabetes mellitus due to underlying condition with other oral complications',
  'E08.64': 'Diabetes mellitus due to underlying condition with hypoglycemia',
  'E08.641': 'Diabetes mellitus due to underlying condition with hypoglycemia with coma',
  'E08.649': 'Diabetes mellitus due to underlying condition with hypoglycemia without coma',
  'E08.65': 'Diabetes mellitus due to underlying condition with hyperglycemia',
  'E08.69': 'Diabetes mellitus due to underlying condition with other diabetic complication',
  'E08.8': 'Diabetes mellitus due to underlying condition with unspecified complications',
  'E08.9': 'Diabetes mellitus due to underlying condition without complications',
  'E09': 'Drug or chemical induced diabetes mellitus',
  'E09.0': 'Drug or chemical induced diabetes mellitus with hyperosmolarity',
  'E09.00': 'Drug or chemical induced diabetes mellitus with hyperosmolarity without nonketotic hyperglycemic-hyperosmolar coma',
  'E09.01': 'Drug or chemical induced diabetes mellitus with hyperosmolarity with coma',
  'E09.1': 'Drug or chemical induced diabetes mellitus with ketoacidosis',
  'E09.10': 'Drug or chemical induced diabetes mellitus with ketoacidosis without coma',
  'E09.11': 'Drug or chemical induced diabetes mellitus with ketoacidosis with coma',
  'E09.2': 'Drug or chemical induced diabetes mellitus with kidney complications',
  'E09.21': 'Drug or chemical induced diabetes mellitus with diabetic nephropathy',
  'E09.22': 'Drug or chemical induced diabetes mellitus with diabetic chronic kidney disease',
  'E09.29': 'Drug or chemical induced diabetes mellitus with other diabetic kidney complication',
  'E09.3': 'Drug or chemical induced diabetes mellitus with ophthalmic complications',
  'E09.31': 'Drug or chemical induced diabetes mellitus with unspecified diabetic retinopathy',
  'E09.311': 'Drug or chemical induced diabetes mellitus with unspecified diabetic retinopathy with macular edema',
  'E09.319': 'Drug or chemical induced diabetes mellitus with unspecified diabetic retinopathy without macular edema',
  'E09.32': 'Drug or chemical induced diabetes mellitus with mild nonproliferative diabetic retinopathy',
  'E09.321': 'Drug or chemical induced diabetes mellitus with mild nonproliferative diabetic retinopathy with macular edema',
  'E09.329': 'Drug or chemical induced diabetes mellitus with mild nonproliferative diabetic retinopathy without macular edema',
  'E09.33': 'Drug or chemical induced diabetes mellitus with moderate nonproliferative diabetic retinopathy',
  'E09.331': 'Drug or chemical induced diabetes mellitus with moderate nonproliferative diabetic retinopathy with macular edema',
  'E09.339': 'Drug or chemical induced diabetes mellitus with moderate nonproliferative diabetic retinopathy without macular edema',
  'E09.34': 'Drug or chemical induced diabetes mellitus with severe nonproliferative diabetic retinopathy',
  'E09.341': 'Drug or chemical induced diabetes mellitus with severe nonproliferative diabetic retinopathy with macular edema',
  'E09.349': 'Drug or chemical induced diabetes mellitus with severe nonproliferative diabetic retinopathy without macular edema',
  'E09.35': 'Drug or chemical induced diabetes mellitus with proliferative diabetic retinopathy',
  'E09.351': 'Drug or chemical induced diabetes mellitus with proliferative diabetic retinopathy with macular edema',
  'E09.359': 'Drug or chemical induced diabetes mellitus with proliferative diabetic retinopathy without macular edema',
  'E09.36': 'Drug or chemical induced diabetes mellitus with diabetic cataract',
  'E09.37': 'Drug or chemical induced diabetes mellitus with diabetic macular edema',
  'E09.39': 'Drug or chemical induced diabetes mellitus with other diabetic ophthalmic complication',
  'E09.4': 'Drug or chemical induced diabetes mellitus with neurological complications',
  'E09.40': 'Drug or chemical induced diabetes mellitus with diabetic neuropathy, unspecified',
  'E09.41': 'Drug or chemical induced diabetes mellitus with diabetic mononeuropathy',
  'E09.42': 'Drug or chemical induced diabetes mellitus with diabetic polyneuropathy',
  'E09.43': 'Drug or chemical induced diabetes mellitus with diabetic autonomic neuropathy',
  'E09.44': 'Drug or chemical induced diabetes mellitus with diabetic amyotrophy',
  'E09.49': 'Drug or chemical induced diabetes mellitus with other diabetic neurological complication',
  'E09.5': 'Drug or chemical induced diabetes mellitus with circulatory complications',
  'E09.51': 'Drug or chemical induced diabetes mellitus with diabetic peripheral angiopathy without gangrene',
  'E09.52': 'Drug or chemical induced diabetes mellitus with diabetic peripheral angiopathy with gangrene',
  'E09.59': 'Drug or chemical induced diabetes mellitus with other circulatory complications',
  'E09.6': 'Drug or chemical induced diabetes mellitus with other complications',
  'E09.61': 'Drug or chemical induced diabetes mellitus with diabetic arthropathy',
  'E09.610': 'Drug or chemical induced diabetes mellitus with diabetic neuropathic arthropathy',
  'E09.618': 'Drug or chemical induced diabetes mellitus with other diabetic arthropathy',
  'E09.62': 'Drug or chemical induced diabetes mellitus with skin complications',
  'E09.620': 'Drug or chemical induced diabetes mellitus with diabetic dermatitis',
  'E09.621': 'Drug or chemical induced diabetes mellitus with foot ulcer',
  'E09.622': 'Drug or chemical induced diabetes mellitus with other skin ulcer',
  'E09.628': 'Drug or chemical induced diabetes mellitus with other skin complications',
  'E09.63': 'Drug or chemical induced diabetes mellitus with oral complications',
  'E09.630': 'Drug or chemical induced diabetes mellitus with periodontal disease',
  'E09.638': 'Drug or chemical induced diabetes mellitus with other oral complications',
  'E09.64': 'Drug or chemical induced diabetes mellitus with hypoglycemia',
  'E09.641': 'Drug or chemical induced diabetes mellitus with hypoglycemia with coma',
  'E09.649': 'Drug or chemical induced diabetes mellitus with hypoglycemia without coma',
  'E09.65': 'Drug or chemical induced diabetes mellitus with hyperglycemia',
  'E09.69': 'Drug or chemical induced diabetes mellitus with other diabetic complication',
  'E09.8': 'Drug or chemical induced diabetes mellitus with unspecified complications',
  'E09.9': 'Drug or chemical induced diabetes mellitus without complications',
  'E10': 'Type 1 diabetes mellitus',
  'E10.0': 'Type 1 diabetes mellitus with hyperosmolarity',
  'E10.00': 'Type 1 diabetes mellitus with hyperosmolarity without nonketotic hyperglycemic-hyperosmolar coma',
  'E10.01': 'Type 1 diabetes mellitus with hyperosmolarity with coma',
  'E10.1': 'Type 1 diabetes mellitus with ketoacidosis',
  'E10.10': 'Type 1 diabetes mellitus with ketoacidosis without coma',
  'E10.11': 'Type 1 diabetes mellitus with ketoacidosis with coma',
  'E10.2': 'Type 1 diabetes mellitus with kidney complications',
  'E10.21': 'Type 1 diabetes mellitus with diabetic nephropathy',
  'E10.22': 'Type 1 diabetes mellitus with diabetic chronic kidney disease',
  'E10.29': 'Type 1 diabetes mellitus with other diabetic kidney complication',
  'E10.3': 'Type 1 diabetes mellitus with ophthalmic complications',
  'E10.31': 'Type 1 diabetes mellitus with unspecified diabetic retinopathy',
  'E10.311': 'Type 1 diabetes mellitus with unspecified diabetic retinopathy with macular edema',
  'E10.319': 'Type 1 diabetes mellitus with unspecified diabetic retinopathy without macular edema',
  'E10.32': 'Type 1 diabetes mellitus with mild nonproliferative diabetic retinopathy',
  'E10.321': 'Type 1 diabetes mellitus with mild nonproliferative diabetic retinopathy with macular edema',
  'E10.329': 'Type 1 diabetes mellitus with mild nonproliferative diabetic retinopathy without macular edema',
  'E10.33': 'Type 1 diabetes mellitus with moderate nonproliferative diabetic retinopathy',
  'E10.331': 'Type 1 diabetes mellitus with moderate nonproliferative diabetic retinopathy with macular edema',
  'E10.339': 'Type 1 diabetes mellitus with moderate nonproliferative diabetic retinopathy without macular edema',
  'E10.34': 'Type 1 diabetes mellitus with severe nonproliferative diabetic retinopathy',
  'E10.341': 'Type 1 diabetes mellitus with severe nonproliferative diabetic retinopathy with macular edema',
  'E10.349': 'Type 1 diabetes mellitus with severe nonproliferative diabetic retinopathy without macular edema',
  'E10.35': 'Type 1 diabetes mellitus with proliferative diabetic retinopathy',
  'E10.351': 'Type 1 diabetes mellitus with proliferative diabetic retinopathy with macular edema',
  'E10.359': 'Type 1 diabetes mellitus with proliferative diabetic retinopathy without macular edema',
  'E10.36': 'Type 1 diabetes mellitus with diabetic cataract',
  'E10.37': 'Type 1 diabetes mellitus with diabetic macular edema',
  'E10.39': 'Type 1 diabetes mellitus with other diabetic ophthalmic complication',
  'E10.4': 'Type 1 diabetes mellitus with neurological complications',
  'E10.40': 'Type 1 diabetes mellitus with diabetic neuropathy, unspecified',
  'E10.41': 'Type 1 diabetes mellitus with diabetic mononeuropathy',
  'E10.42': 'Type 1 diabetes mellitus with diabetic polyneuropathy',
  'E10.43': 'Type 1 diabetes mellitus with diabetic autonomic neuropathy',
  'E10.44': 'Type 1 diabetes mellitus with diabetic amyotrophy',
  'E10.49': 'Type 1 diabetes mellitus with other diabetic neurological complication',
  'E10.5': 'Type 1 diabetes mellitus with circulatory complications',
  'E10.51': 'Type 1 diabetes mellitus with diabetic peripheral angiopathy without gangrene',
  'E10.52': 'Type 1 diabetes mellitus with diabetic peripheral angiopathy with gangrene',
  'E10.59': 'Type 1 diabetes mellitus with other circulatory complications',
  'E10.6': 'Type 1 diabetes mellitus with other complications',
  'E10.61': 'Type 1 diabetes mellitus with diabetic arthropathy',
  'E10.610': 'Type 1 diabetes mellitus with diabetic neuropathic arthropathy',
  'E10.618': 'Type 1 diabetes mellitus with other diabetic arthropathy',
  'E10.62': 'Type 1 diabetes mellitus with skin complications',
  'E10.620': 'Type 1 diabetes mellitus with diabetic dermatitis',
  'E10.621': 'Type 1 diabetes mellitus with foot ulcer',
  'E10.622': 'Type 1 diabetes mellitus with other skin ulcer',
  'E10.628': 'Type 1 diabetes mellitus with other skin complications',
  'E10.63': 'Type 1 diabetes mellitus with oral complications',
  'E10.630': 'Type 1 diabetes mellitus with periodontal disease',
  'E10.638': 'Type 1 diabetes mellitus with other oral complications',
  'E10.64': 'Type 1 diabetes mellitus with hypoglycemia',
  'E10.641': 'Type 1 diabetes mellitus with hypoglycemia with coma',
  'E10.649': 'Type 1 diabetes mellitus with hypoglycemia without coma',
  'E10.65': 'Type 1 diabetes mellitus with hyperglycemia',
  'E10.69': 'Type 1 diabetes mellitus with other diabetic complication',
  'E10.8': 'Type 1 diabetes mellitus with unspecified complications',
  'E10.9': 'Type 1 diabetes mellitus without complications',
  'E11': 'Type 2 diabetes mellitus',
  'E11.0': 'Type 2 diabetes mellitus with hyperosmolarity',
  'E11.00': 'Type 2 diabetes mellitus with hyperosmolarity without nonketotic hyperglycemic-hyperosmolar coma',
  'E11.01': 'Type 2 diabetes mellitus with hyperosmolarity with coma',
  'E11.1': 'Type 2 diabetes mellitus with ketoacidosis',
  'E11.10': 'Type 2 diabetes mellitus with ketoacidosis without coma',
  'E11.11': 'Type 2 diabetes mellitus with ketoacidosis with coma',
  'E11.2': 'Type 2 diabetes mellitus with kidney complications',
  'E11.21': 'Type 2 diabetes mellitus with diabetic nephropathy',
  'E11.22': 'Type 2 diabetes mellitus with diabetic chronic kidney disease',
  'E11.29': 'Type 2 diabetes mellitus with other diabetic kidney complication',
  'E11.3': 'Type 2 diabetes mellitus with ophthalmic complications',
  'E11.31': 'Type 2 diabetes mellitus with unspecified diabetic retinopathy',
  'E11.311': 'Type 2 diabetes mellitus with unspecified diabetic retinopathy with macular edema',
  'E11.319': 'Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema',
  'E11.32': 'Type 2 diabetes mellitus with mild nonproliferative diabetic retinopathy',
  'E11.321': 'Type 2 diabetes mellitus with mild nonproliferative diabetic retinopathy with macular edema',
  'E11.329': 'Type 2 diabetes mellitus with mild nonproliferative diabetic retinopathy without macular edema',
  'E11.33': 'Type 2 diabetes mellitus with moderate nonproliferative diabetic retinopathy',
  'E11.331': 'Type 2 diabetes mellitus with moderate nonproliferative diabetic retinopathy with macular edema',
  'E11.339': 'Type 2 diabetes mellitus with moderate nonproliferative diabetic retinopathy without macular edema',
  'E11.34': 'Type 2 diabetes mellitus with severe nonproliferative diabetic retinopathy',
  'E11.341': 'Type 2 diabetes mellitus with severe nonproliferative diabetic retinopathy with macular edema',
  'E11.349': 'Type 2 diabetes mellitus with severe nonproliferative diabetic retinopathy without macular edema',
  'E11.35': 'Type 2 diabetes mellitus with proliferative diabetic retinopathy',
  'E11.351': 'Type 2 diabetes mellitus with proliferative diabetic retinopathy with macular edema',
  'E11.359': 'Type 2 diabetes mellitus with proliferative diabetic retinopathy without macular edema',
  'E11.36': 'Type 2 diabetes mellitus with diabetic cataract',
  'E11.37': 'Type 2 diabetes mellitus with diabetic macular edema',
  'E11.39': 'Type 2 diabetes mellitus with other diabetic ophthalmic complication',
  'E11.4': 'Type 2 diabetes mellitus with neurological complications',
  'E11.40': 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified',
  'E11.41': 'Type 2 diabetes mellitus with diabetic mononeuropathy',
  'E11.42': 'Type 2 diabetes mellitus with diabetic polyneuropathy',
  'E11.43': 'Type 2 diabetes mellitus with diabetic autonomic neuropathy',
  'E11.44': 'Type 2 diabetes mellitus with diabetic amyotrophy',
  'E11.49': 'Type 2 diabetes mellitus with other diabetic neurological complication',
  'E11.5': 'Type 2 diabetes mellitus with circulatory complications',
  'E11.51': 'Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene',
  'E11.52': 'Type 2 diabetes mellitus with diabetic peripheral angiopathy with gangrene',
  'E11.59': 'Type 2 diabetes mellitus with other circulatory complications',
  'E11.6': 'Type 2 diabetes mellitus with other complications',
  'E11.61': 'Type 2 diabetes mellitus with diabetic arthropathy',
  'E11.610': 'Type 2 diabetes mellitus with diabetic neuropathic arthropathy',
  'E11.618': 'Type 2 diabetes mellitus with other diabetic arthropathy',
  'E11.62': 'Type 2 diabetes mellitus with skin complications',
  'E11.620': 'Type 2 diabetes mellitus with diabetic dermatitis',
  'E11.621': 'Type 2 diabetes mellitus with foot ulcer',
  'E11.622': 'Type 2 diabetes mellitus with other skin ulcer',
  'E11.628': 'Type 2 diabetes mellitus with other skin complications',
  'E11.63': 'Type 2 diabetes mellitus with oral complications',
  'E11.630': 'Type 2 diabetes mellitus with periodontal disease',
  'E11.638': 'Type 2 diabetes mellitus with other oral complications',
  'E11.64': 'Type 2 diabetes mellitus with hypoglycemia',
  'E11.641': 'Type 2 diabetes mellitus with hypoglycemia with coma',
  'E11.649': 'Type 2 diabetes mellitus with hypoglycemia without coma',
  'E11.65': 'Type 2 diabetes mellitus with hyperglycemia',
  'E11.69': 'Type 2 diabetes mellitus with other diabetic complication',
  'E11.8': 'Type 2 diabetes mellitus with unspecified complications',
  'E11.9': 'Type 2 diabetes mellitus without complications',
  'E13': 'Other specified diabetes mellitus',
  'E13.0': 'Other specified diabetes mellitus with hyperosmolarity',
  'E13.00': 'Other specified diabetes mellitus with hyperosmolarity without nonketotic hyperglycemic-hyperosmolar coma',
  'E13.01': 'Other specified diabetes mellitus with hyperosmolarity with coma',
  'E13.1': 'Other specified diabetes mellitus with ketoacidosis',
  'E13.10': 'Other specified diabetes mellitus with ketoacidosis without coma',
  'E13.11': 'Other specified diabetes mellitus with ketoacidosis with coma',
  'E13.2': 'Other specified diabetes mellitus with kidney complications',
  'E13.21': 'Other specified diabetes mellitus with diabetic nephropathy',
  'E13.22': 'Other specified diabetes mellitus with diabetic chronic kidney disease',
  'E13.29': 'Other specified diabetes mellitus with other diabetic kidney complication',
  'E13.3': 'Other specified diabetes mellitus with ophthalmic complications',
  'E13.31': 'Other specified diabetes mellitus with unspecified diabetic retinopathy',
  'E13.311': 'Other specified diabetes mellitus with unspecified diabetic retinopathy with macular edema',
  'E13.319': 'Other specified diabetes mellitus with unspecified diabetic retinopathy without macular edema',
  'E13.32': 'Other specified diabetes mellitus with mild nonproliferative diabetic retinopathy',
  'E13.321': 'Other specified diabetes mellitus with mild nonproliferative diabetic retinopathy with macular edema',
  'E13.329': 'Other specified diabetes mellitus with mild nonproliferative diabetic retinopathy without macular edema',
  'E13.33': 'Other specified diabetes mellitus with moderate nonproliferative diabetic retinopathy',
  'E13.331': 'Other specified diabetes mellitus with moderate nonproliferative diabetic retinopathy with macular edema',
  'E13.339': 'Other specified diabetes mellitus with moderate nonproliferative diabetic retinopathy without macular edema',
  'E13.34': 'Other specified diabetes mellitus with severe nonproliferative diabetic retinopathy',
  'E13.341': 'Other specified diabetes mellitus with severe nonproliferative diabetic retinopathy with macular edema',
  'E13.349': 'Other specified diabetes mellitus with severe nonproliferative diabetic retinopathy without macular edema',
  'E13.35': 'Other specified diabetes mellitus with proliferative diabetic retinopathy',
  'E13.351': 'Other specified diabetes mellitus with proliferative diabetic retinopathy with macular edema',
  'E13.359': 'Other specified diabetes mellitus with proliferative diabetic retinopathy without macular edema',
  'E13.36': 'Other specified diabetes mellitus with diabetic cataract',
  'E13.37': 'Other specified diabetes mellitus with diabetic macular edema',
  'E13.39': 'Other specified diabetes mellitus with other diabetic ophthalmic complication',
  'E13.4': 'Other specified diabetes mellitus with neurological complications',
  'E13.40': 'Other specified diabetes mellitus with diabetic neuropathy, unspecified',
  'E13.41': 'Other specified diabetes mellitus with diabetic mononeuropathy',
  'E13.42': 'Other specified diabetes mellitus with diabetic polyneuropathy',
  'E13.43': 'Other specified diabetes mellitus with diabetic autonomic neuropathy',
  'E13.44': 'Other specified diabetes mellitus with diabetic amyotrophy',
  'E13.49': 'Other specified diabetes mellitus with other diabetic neurological complication',
  'E13.5': 'Other specified diabetes mellitus with circulatory complications',
  'E13.51': 'Other specified diabetes mellitus with diabetic peripheral angiopathy without gangrene',
  'E13.52': 'Other specified diabetes mellitus with diabetic peripheral angiopathy with gangrene',
  'E13.59': 'Other specified diabetes mellitus with other circulatory complications',
  'E13.6': 'Other specified diabetes mellitus with other complications',
  'E13.61': 'Other specified diabetes mellitus with diabetic arthropathy',
  'E13.610': 'Other specified diabetes mellitus with diabetic neuropathic arthropathy',
  'E13.618': 'Other specified diabetes mellitus with other diabetic arthropathy',
  'E13.62': 'Other specified diabetes mellitus with skin complications',
  'E13.620': 'Other specified diabetes mellitus with diabetic dermatitis',
  'E13.621': 'Other specified diabetes mellitus with foot ulcer',
  'E13.622': 'Other specified diabetes mellitus with other skin ulcer',
  'E13.628': 'Other specified diabetes mellitus with other skin complications',
  'E13.63': 'Other specified diabetes mellitus with oral complications',
  'E13.630': 'Other specified diabetes mellitus with periodontal disease',
  'E13.638': 'Other specified diabetes mellitus with other oral complications',
  'E13.64': 'Other specified diabetes mellitus with hypoglycemia',
  'E13.641': 'Other specified diabetes mellitus with hypoglycemia with coma',
  'E13.649': 'Other specified diabetes mellitus with hypoglycemia without coma',
  'E13.65': 'Other specified diabetes mellitus with hyperglycemia',
  'E13.69': 'Other specified diabetes mellitus with other diabetic complication',
  'E13.8': 'Other specified diabetes mellitus with unspecified complications',
  'E13.9': 'Other specified diabetes mellitus without complications',
  'I10': 'Essential (primary) hypertension',
  'I11': 'Hypertensive heart disease',
  'I11.0': 'Hypertensive heart disease with heart failure',
  'I11.9': 'Hypertensive heart disease without heart failure',
  'I12': 'Hypertensive chronic kidney disease',
  'I12.0': 'Hypertensive chronic kidney disease with stage 5 chronic kidney disease or end stage renal disease',
  'I12.9': 'Hypertensive chronic kidney disease with stage 1 through stage 4 chronic kidney disease, or unspecified',
  'I13': 'Hypertensive heart and chronic kidney disease',
  'I13.0': 'Hypertensive heart and chronic kidney disease with heart failure and stage 1 through stage 4 chronic kidney disease',
  'I13.1': 'Hypertensive heart and chronic kidney disease without heart failure',
  'I13.10': 'Hypertensive heart and chronic kidney disease without heart failure, with stage 1 through stage 4 chronic kidney disease, or unspecified',
  'I13.11': 'Hypertensive heart and chronic kidney disease without heart failure, with stage 5 chronic kidney disease, or end stage renal disease',
  'I13.2': 'Hypertensive heart and chronic kidney disease with heart failure with stage 5 chronic kidney disease, or end stage renal disease',
  'J06': 'Acute upper respiratory infections of multiple and unspecified sites',
  'J06.9': 'Acute upper respiratory infection, unspecified',
  'J15': 'Bacterial pneumonia, not elsewhere classified',
  'J15.0': 'Pneumonia due to Klebsiella pneumoniae',
  'J15.1': 'Pneumonia due to Pseudomonas',
  'J15.2': 'Pneumonia due to staphylococcus',
  'J15.3': 'Pneumonia due to streptococcus, group B',
  'J15.4': 'Pneumonia due to other streptococci',
  'J15.5': 'Pneumonia due to Escherichia coli',
  'J15.6': 'Pneumonia due to other Gram-negative bacteria',
  'J15.7': 'Pneumonia due to Mycoplasma pneumoniae',
  'J15.8': 'Pneumonia due to other specified bacteria',
  'J15.9': 'Unspecified bacterial pneumonia',
  'J20': 'Acute bronchitis',
  'J20.9': 'Acute bronchitis, unspecified',
  'J45': 'Asthma',
  'J45.2': 'Mild intermittent asthma',
  'J45.20': 'Mild intermittent asthma, uncomplicated',
  'J45.21': 'Mild intermittent asthma with exacerbation',
  'J45.22': 'Mild intermittent asthma with status asthmaticus',
  'J45.3': 'Mild persistent asthma',
  'J45.30': 'Mild persistent asthma, uncomplicated',
  'J45.31': 'Mild persistent asthma with exacerbation',
  'J45.32': 'Mild persistent asthma with status asthmaticus',
  'J45.4': 'Moderate persistent asthma',
  'J45.40': 'Moderate persistent asthma, uncomplicated',
  'J45.41': 'Moderate persistent asthma with exacerbation',
  'J45.42': 'Moderate persistent asthma with status asthmaticus',
  'J45.5': 'Severe persistent asthma',
  'J45.50': 'Severe persistent asthma, uncomplicated',
  'J45.51': 'Severe persistent asthma with exacerbation',
  'J45.52': 'Severe persistent asthma with status asthmaticus',
  'J45.9': 'Other and unspecified asthma',
  'J45.90': 'Unspecified asthma, uncomplicated',
  'J45.91': 'Unspecified asthma with exacerbation',
  'J45.92': 'Unspecified asthma with status asthmaticus',
  'S52': 'Fracture of forearm',
  'S52.0': 'Fracture of upper end of ulna',
  'S52.00': 'Fracture of upper end of ulna, unspecified',
  'S52.01': 'Fracture of upper end of ulna, torus',
  'S52.02': 'Fracture of upper end of ulna, Salter-Harris',
  'S52.09': 'Other fracture of upper end of ulna',
  'S52.1': 'Fracture of upper end of radius',
  'S52.10': 'Fracture of upper end of radius, unspecified',
  'S52.11': 'Fracture of upper end of radius, torus',
  'S52.12': 'Fracture of upper end of radius, Salter-Harris',
  'S52.19': 'Other fracture of upper end of radius',
  'S52.2': 'Fracture of shaft of ulna',
  'S52.20': 'Fracture of shaft of ulna, unspecified',
  'S52.21': 'Fracture of shaft of ulna, greenstick',
  'S52.22': 'Fracture of shaft of ulna, transverse',
  'S52.23': 'Fracture of shaft of ulna, oblique',
  'S52.24': 'Fracture of shaft of ulna, spiral',
  'S52.25': 'Fracture of shaft of ulna, comminuted',
  'S52.26': 'Fracture of shaft of ulna, segmental',
  'S52.27': 'Fracture of shaft of ulna, Galeazzi',
  'S52.28': 'Fracture of shaft of ulna, other',
  'S52.29': 'Fracture of shaft of ulna, unspecified',
  'S52.3': 'Fracture of shaft of radius',
  'S52.30': 'Fracture of shaft of radius, unspecified',
  'S52.31': 'Fracture of shaft of radius, greenstick',
  'S52.32': 'Fracture of shaft of radius, transverse',
  'S52.33': 'Fracture of shaft of radius, oblique',
  'S52.34': 'Fracture of shaft of radius, spiral',
  'S52.35': 'Fracture of shaft of radius, comminuted',
  'S52.36': 'Fracture of shaft of radius, segmental',
  'S52.37': 'Fracture of shaft of radius, Galeazzi',
  'S52.38': 'Fracture of shaft of radius, other',
  'S52.39': 'Fracture of shaft of radius, unspecified',
  'S52.5': 'Fracture of lower end of radius',
  'S52.50': 'Fracture of lower end of radius, unspecified',
  'S52.51': 'Fracture of lower end of radius, torus',
  'S52.52': 'Fracture of lower end of radius, Salter-Harris',
  'S52.53': 'Fracture of lower end of radius, Colles',
  'S52.54': 'Fracture of lower end of radius, Smith',
  'S52.55': 'Fracture of lower end of radius, Barton',
  'S52.56': 'Fracture of lower end of radius, other',
  'S52.59': 'Fracture of lower end of radius, unspecified',
  'S52.6': 'Fracture of lower end of ulna',
  'S52.60': 'Fracture of lower end of ulna, unspecified',
  'S52.61': 'Fracture of lower end of ulna, torus',
  'S52.62': 'Fracture of lower end of ulna, Salter-Harris',
  'S52.69': 'Other fracture of lower end of ulna',
  'S52.9': 'Fracture of forearm, unspecified',
  'S52.91': 'Fracture of forearm, unspecified, torus',
  'S52.92': 'Fracture of forearm, unspecified, Salter-Harris',
  'S52.99': 'Other fracture of forearm, unspecified',
  'S72': 'Fracture of femur',
  'S72.0': 'Fracture of head and neck of femur',
  'S72.00': 'Fracture of head and neck of femur, unspecified',
  'S72.01': 'Fracture of head of femur',
  'S72.02': 'Fracture of epiphysis of femur',
  'S72.03': 'Fracture of neck of femur, undisplaced',
  'S72.04': 'Fracture of neck of femur, displaced',
  'S72.05': 'Fracture of neck of femur, base',
  'S72.06': 'Fracture of neck of femur, other',
  'S72.1': 'Pertrochanteric fracture',
  'S72.10': 'Pertrochanteric fracture, unspecified',
  'S72.11': 'Pertrochanteric fracture, intertrochanteric',
  'S72.12': 'Pertrochanteric fracture, subtrochanteric',
  'S72.13': 'Pertrochanteric fracture, other',
  'S72.2': 'Subtrochanteric fracture of femur',
  'S72.21': 'Subtrochanteric fracture of femur, undisplaced',
  'S72.22': 'Subtrochanteric fracture of femur, displaced',
  'S72.23': 'Subtrochanteric fracture of femur, other',
  'S72.3': 'Fracture of shaft of femur',
  'S72.30': 'Fracture of shaft of femur, unspecified',
  'S72.31': 'Fracture of shaft of femur, greenstick',
  'S72.32': 'Fracture of shaft of femur, transverse',
  'S72.33': 'Fracture of shaft of femur, oblique',
  'S72.34': 'Fracture of shaft of femur, spiral',
  'S72.35': 'Fracture of shaft of femur, comminuted',
  'S72.36': 'Fracture of shaft of femur, segmental',
  'S72.39': 'Fracture of shaft of femur, other',
  'S72.4': 'Fracture of lower end of femur',
  'S72.40': 'Fracture of lower end of femur, unspecified',
  'S72.41': 'Fracture of lower end of femur, supracondylar',
  'S72.42': 'Fracture of lower end of femur, condylar',
  'S72.43': 'Fracture of lower end of femur, intercondylar',
  'S72.44': 'Fracture of lower end of femur, other',
  'S72.8': 'Other fracture of femur',
  'S72.9': 'Fracture of femur, unspecified',
  'S82': 'Fracture of lower leg, including ankle',
  'S82.0': 'Fracture of patella',
  'S82.00': 'Fracture of patella, unspecified',
  'S82.01': 'Fracture of patella, osteochondral',
  'S82.02': 'Fracture of patella, comminuted',
  'S82.09': 'Other fracture of patella',
  'S82.1': 'Fracture of upper end of tibia',
  'S82.10': 'Fracture of upper end of tibia, unspecified',
  'S82.11': 'Fracture of upper end of tibia, plateau',
  'S82.12': 'Fracture of upper end of tibia, spine',
  'S82.13': 'Fracture of upper end of tibia, other',
  'S82.2': 'Fracture of shaft of tibia',
  'S82.20': 'Fracture of shaft of tibia, unspecified',
  'S82.21': 'Fracture of shaft of tibia, greenstick',
  'S82.22': 'Fracture of shaft of tibia, transverse',
  'S82.23': 'Fracture of shaft of tibia, oblique',
  'S82.24': 'Fracture of shaft of tibia, spiral',
  'S82.25': 'Fracture of shaft of tibia, comminuted',
  'S82.26': 'Fracture of shaft of tibia, segmental',
  'S82.29': 'Fracture of shaft of tibia, other',
  'S82.3': 'Fracture of lower end of tibia',
  'S82.30': 'Fracture of lower end of tibia, unspecified',
  'S82.31': 'Fracture of lower end of tibia, pilon',
  'S82.32': 'Fracture of lower end of tibia, other',
  'S82.4': 'Fracture of shaft of fibula',
  'S82.40': 'Fracture of shaft of fibula, unspecified',
  'S82.41': 'Fracture of shaft of fibula, greenstick',
  'S82.42': 'Fracture of shaft of fibula, transverse',
  'S82.43': 'Fracture of shaft of fibula, oblique',
  'S82.44': 'Fracture of shaft of fibula, spiral',
  'S82.45': 'Fracture of shaft of fibula, comminuted',
  'S82.46': 'Fracture of shaft of fibula, segmental',
  'S82.49': 'Fracture of shaft of fibula, other',
  'S82.5': 'Fracture of medial malleolus',
  'S82.51': 'Fracture of medial malleolus, unspecified',
  'S82.52': 'Fracture of medial malleolus, other',
  'S82.6': 'Fracture of lateral malleolus',
  'S82.61': 'Fracture of lateral malleolus, unspecified',
  'S82.62': 'Fracture of lateral malleolus, other',
  'S82.8': 'Fracture of lower leg, other',
  'S82.81': 'Fracture of lower leg, other, unspecified',
  'S82.82': 'Fracture of lower leg, other, other',
  'S82.9': 'Fracture of lower leg, unspecified',
};
