import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CptCode, CptCategory } from './entities/cpt-code.entity';

interface CptEntry {
  code: string;
  description: string;
  category: CptCategory;
  defaultCharge?: number;
  workRvu?: number;
}

@Injectable()
export class CptSeedService {
  private readonly logger = new Logger(CptSeedService.name);

  constructor(
    @InjectRepository(CptCode)
    private readonly repository: Repository<CptCode>,
  ) {}

  async onModuleInit() {
    const count = await this.repository.count();
    if (count > 0) {
      this.logger.log(`CPT codes already seeded (${count}), skipping`);
      return;
    }
    this.logger.log('Seeding CPT/HCPCS codes...');
    await this.seed();
    this.logger.log('CPT/HCPCS codes seeded successfully');
  }

  async seed() {
    const codes = this.getCommonCodes();
    const batchSize = 100;
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      await this.repository
        .createQueryBuilder()
        .insert()
        .into(CptCode)
        .values(batch)
        .orIgnore()
        .execute();
    }
  }

  private getCommonCodes(): CptEntry[] {
    return [
      // ─── Evaluation & Management ───
      { code: '99202', description: 'Office visit, new patient, straightforward', category: CptCategory.EM, defaultCharge: 120, workRvu: 0.93 },
      { code: '99203', description: 'Office visit, new patient, low complexity', category: CptCategory.EM, defaultCharge: 175, workRvu: 1.60 },
      { code: '99204', description: 'Office visit, new patient, moderate complexity', category: CptCategory.EM, defaultCharge: 250, workRvu: 2.60 },
      { code: '99205', description: 'Office visit, new patient, high complexity', category: CptCategory.EM, defaultCharge: 320, workRvu: 3.50 },
      { code: '99211', description: 'Office visit, established patient, may not require physician', category: CptCategory.EM, defaultCharge: 55, workRvu: 0.18 },
      { code: '99212', description: 'Office visit, established patient, straightforward', category: CptCategory.EM, defaultCharge: 75, workRvu: 0.70 },
      { code: '99213', description: 'Office visit, established patient, low complexity', category: CptCategory.EM, defaultCharge: 115, workRvu: 1.30 },
      { code: '99214', description: 'Office visit, established patient, moderate complexity', category: CptCategory.EM, defaultCharge: 175, workRvu: 1.92 },
      { code: '99215', description: 'Office visit, established patient, high complexity', category: CptCategory.EM, defaultCharge: 240, workRvu: 2.80 },
      { code: '99221', description: 'Initial hospital care, new/established patient, low complexity', category: CptCategory.EM, defaultCharge: 220, workRvu: 1.87 },
      { code: '99222', description: 'Initial hospital care, moderate complexity', category: CptCategory.EM, defaultCharge: 300, workRvu: 2.40 },
      { code: '99223', description: 'Initial hospital care, high complexity', category: CptCategory.EM, defaultCharge: 380, workRvu: 3.26 },
      { code: '99231', description: 'Subsequent hospital care, low complexity', category: CptCategory.EM, defaultCharge: 110, workRvu: 0.96 },
      { code: '99232', description: 'Subsequent hospital care, moderate complexity', category: CptCategory.EM, defaultCharge: 165, workRvu: 1.47 },
      { code: '99233', description: 'Subsequent hospital care, high complexity', category: CptCategory.EM, defaultCharge: 230, workRvu: 2.14 },
      { code: '99238', description: 'Hospital discharge management, 30 minutes or less', category: CptCategory.EM, defaultCharge: 145, workRvu: 1.28 },
      { code: '99239', description: 'Hospital discharge management, more than 30 minutes', category: CptCategory.EM, defaultCharge: 200, workRvu: 1.90 },
      { code: '99291', description: 'Critical care, first 30-74 minutes', category: CptCategory.EM, defaultCharge: 500, workRvu: 4.50 },
      { code: '99292', description: 'Critical care, each additional 30 minutes', category: CptCategory.EM, defaultCharge: 250, workRvu: 2.25 },
      { code: '99385', description: 'Preventive visit, new patient, 18-39 years', category: CptCategory.EM, defaultCharge: 280, workRvu: 2.43 },
      { code: '99386', description: 'Preventive visit, new patient, 40-64 years', category: CptCategory.EM, defaultCharge: 320, workRvu: 2.73 },
      { code: '99395', description: 'Preventive visit, established patient, 18-39 years', category: CptCategory.EM, defaultCharge: 195, workRvu: 1.73 },
      { code: '99396', description: 'Preventive visit, established patient, 40-64 years', category: CptCategory.EM, defaultCharge: 230, workRvu: 2.03 },
      { code: '99401', description: 'Preventive counseling, 15 minutes', category: CptCategory.EM, defaultCharge: 45, workRvu: 0.50 },
      { code: '99402', description: 'Preventive counseling, 30 minutes', category: CptCategory.EM, defaultCharge: 80, workRvu: 1.00 },
      { code: '99421', description: 'Online digital E/M, 5-10 minutes, 7-day period', category: CptCategory.EM, defaultCharge: 30, workRvu: 0.25 },
      { code: '99422', description: 'Online digital E/M, 11-20 minutes, 7-day period', category: CptCategory.EM, defaultCharge: 55, workRvu: 0.50 },
      { code: '99423', description: 'Online digital E/M, 21+ minutes, 7-day period', category: CptCategory.EM, defaultCharge: 85, workRvu: 0.75 },
      { code: 'G2012', description: 'Brief online assessment, 5-10 minutes', category: CptCategory.EM, defaultCharge: 30 },
      { code: 'G2010', description: 'Remote evaluation of recorded video/images', category: CptCategory.EM, defaultCharge: 35 },

      // ─── Preventive / Immunization ───
      { code: '90471', description: 'Immunization administration, 1 vaccine', category: CptCategory.MEDICINE, defaultCharge: 35 },
      { code: '90472', description: 'Immunization administration, each additional vaccine', category: CptCategory.MEDICINE, defaultCharge: 25 },
      { code: '90480', description: 'Immunization administration, counseling, first component', category: CptCategory.MEDICINE, defaultCharge: 45 },
      { code: '90686', description: 'Influenza vaccine, quadrivalent, preservative-free', category: CptCategory.MEDICINE, defaultCharge: 40 },
      { code: '90633', description: 'Hepatitis A vaccine, adult, 2 dose schedule', category: CptCategory.MEDICINE, defaultCharge: 85 },
      { code: '90714', description: 'Tetanus/diphtheria toxoid, preservative-free', category: CptCategory.MEDICINE, defaultCharge: 45 },
      { code: '90715', description: 'Tetanus, diphtheria, acellular pertussis (Tdap)', category: CptCategory.MEDICINE, defaultCharge: 55 },
      { code: '90670', description: 'Pneumococcal conjugate vaccine, 13-valent', category: CptCategory.MEDICINE, defaultCharge: 220 },
      { code: '90732', description: 'Pneumococcal polysaccharide vaccine, 23-valent', category: CptCategory.MEDICINE, defaultCharge: 95 },
      { code: '90716', description: 'Varicella vaccine, live, 2 dose schedule', category: CptCategory.MEDICINE, defaultCharge: 130 },
      { code: '90736', description: 'Zoster vaccine, recombinant, adjuvanted', category: CptCategory.MEDICINE, defaultCharge: 200 },

      // ─── Laboratory ───
      { code: '80048', description: 'Basic metabolic panel (BMP)', category: CptCategory.LAB, defaultCharge: 45 },
      { code: '80053', description: 'Comprehensive metabolic panel (CMP)', category: CptCategory.LAB, defaultCharge: 65 },
      { code: '85025', description: 'Complete blood count (CBC) with differential', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '85027', description: 'Complete blood count (CBC) without differential', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '83036', description: 'Hemoglobin A1c', category: CptCategory.LAB, defaultCharge: 55 },
      { code: '84443', description: 'Thyroid stimulating hormone (TSH)', category: CptCategory.LAB, defaultCharge: 50 },
      { code: '83735', description: 'Magnesium, serum', category: CptCategory.LAB, defaultCharge: 30 },
      { code: '84165', description: 'Phosphorus, serum', category: CptCategory.LAB, defaultCharge: 30 },
      { code: '82947', description: 'Glucose, blood, quantitative', category: CptCategory.LAB, defaultCharge: 20 },
      { code: '82950', description: 'Glucose, post 2-hour dose', category: CptCategory.LAB, defaultCharge: 30 },
      { code: '82962', description: 'Glucose, blood, qualitative, reagent strip', category: CptCategory.LAB, defaultCharge: 15 },
      { code: '83540', description: 'Iron, serum', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '84450', description: 'Transaminase (ALT/SGPT)', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '84460', description: 'Transaminase (AST/SGOT)', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '82040', description: 'Albumin, serum', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '82247', description: 'Bilirubin, total', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '82248', description: 'Bilirubin, direct', category: CptCategory.LAB, defaultCharge: 30 },
      { code: '84075', description: 'Creatine kinase (CK), total', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '82565', description: 'Creatinine, serum', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '84520', description: 'Urea nitrogen, serum (BUN)', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '84132', description: 'Potassium, serum', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '82310', description: 'Calcium, serum', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '82435', description: 'Chloride, serum', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '83721', description: 'Lipoprotein, direct LDL', category: CptCategory.LAB, defaultCharge: 45 },
      { code: '83718', description: 'Lipoprotein, HDL', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '84478', description: 'Triglycerides', category: CptCategory.LAB, defaultCharge: 30 },
      { code: '82465', description: 'Cholesterol, total', category: CptCategory.LAB, defaultCharge: 30 },
      { code: '86140', description: 'C-reactive protein, serum', category: CptCategory.LAB, defaultCharge: 40 },
      { code: '83550', description: 'Iron binding capacity', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '85008', description: 'Blood smear, peripheral, manual', category: CptCategory.LAB, defaultCharge: 45 },
      { code: '85610', description: 'Prothrombin time (PT)', category: CptCategory.LAB, defaultCharge: 30 },
      { code: '85730', description: 'Thromboplastin time, partial (PTT)', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '85390', description: 'Fibrinogen, clotting activity', category: CptCategory.LAB, defaultCharge: 45 },
      { code: '81002', description: 'Urinalysis, non-automated, without microscopy', category: CptCategory.LAB, defaultCharge: 20 },
      { code: '81003', description: 'Urinalysis, automated, without microscopy', category: CptCategory.LAB, defaultCharge: 20 },
      { code: '81001', description: 'Urinalysis, with microscopy', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '82040', description: 'Microalbumin, urine, quantitative', category: CptCategory.LAB, defaultCharge: 40 },
      { code: '82570', description: 'Creatinine, urine', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '84550', description: 'Uric acid, urine', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '81050', description: 'Urine volume, 24-hour', category: CptCategory.LAB, defaultCharge: 25 },
      { code: '83001', description: 'Vitamin D, 25-OH', category: CptCategory.LAB, defaultCharge: 80 },
      { code: '82607', description: 'Vitamin B-12, serum', category: CptCategory.LAB, defaultCharge: 75 },
      { code: '82746', description: 'Folate, serum', category: CptCategory.LAB, defaultCharge: 65 },
      { code: '83516', description: 'Insulin, serum or plasma', category: CptCategory.LAB, defaultCharge: 70 },
      { code: '83520', description: 'Insulin-like growth factor (IGF-1)', category: CptCategory.LAB, defaultCharge: 95 },
      { code: '83605', description: 'Lactate, plasma', category: CptCategory.LAB, defaultCharge: 40 },
      { code: '83610', description: 'Lactate dehydrogenase (LDH), serum', category: CptCategory.LAB, defaultCharge: 35 },
      { code: '83880', description: 'Myoglobin, serum', category: CptCategory.LAB, defaultCharge: 60 },
      { code: '83540', description: 'Iron, serum', category: CptCategory.LAB, defaultCharge: 35 },

      // ─── Pathology / Cytology ───
      { code: '88141', description: 'Cervical/vaginal cytopath, manual screening with physician review', category: CptCategory.PATHOLOGY, defaultCharge: 65 },
      { code: '88142', description: 'Cervical/vaginal cytopath, manual screening under physician supervision', category: CptCategory.PATHOLOGY, defaultCharge: 55 },
      { code: '88150', description: 'Cervical/vaginal cytopath, manual screening with physician review', category: CptCategory.PATHOLOGY, defaultCharge: 70 },
      { code: '88175', description: 'Cervical/vaginal cytopath, automated with manual review', category: CptCategory.PATHOLOGY, defaultCharge: 75 },
      { code: '85018', description: 'Blood count, manual differential WBC', category: CptCategory.PATHOLOGY, defaultCharge: 30 },

      // ─── Radiology ───
      { code: '71045', description: 'X-ray chest, single view', category: CptCategory.RADIOLOGY, defaultCharge: 65 },
      { code: '71046', description: 'X-ray chest, 2 views', category: CptCategory.RADIOLOGY, defaultCharge: 85 },
      { code: '71020', description: 'X-ray chest, 3+ views', category: CptCategory.RADIOLOGY, defaultCharge: 110 },
      { code: '72040', description: 'X-ray spine, cervical, 3 views', category: CptCategory.RADIOLOGY, defaultCharge: 130 },
      { code: '72050', description: 'X-ray spine, cervical, 6 views', category: CptCategory.RADIOLOGY, defaultCharge: 175 },
      { code: '72080', description: 'X-ray spine, thoracic, minimum 2 views', category: CptCategory.RADIOLOGY, defaultCharge: 130 },
      { code: '72100', description: 'X-ray spine, lumbosacral, 2 views', category: CptCategory.RADIOLOGY, defaultCharge: 130 },
      { code: '72110', description: 'X-ray spine, lumbosacral, 3+ views', category: CptCategory.RADIOLOGY, defaultCharge: 175 },
      { code: '72114', description: 'X-ray spine, lumbosacral, complete with bending', category: CptCategory.RADIOLOGY, defaultCharge: 220 },
      { code: '72148', description: 'MRI lumbar spine, without contrast', category: CptCategory.RADIOLOGY, defaultCharge: 850 },
      { code: '72149', description: 'MRI lumbar spine, with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 1100 },
      { code: '72158', description: 'MRI lumbar spine, without/with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 1300 },
      { code: '72141', description: 'MRI cervical spine, without contrast', category: CptCategory.RADIOLOGY, defaultCharge: 850 },
      { code: '72156', description: 'MRI cervical spine, without/with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 1300 },
      { code: '70551', description: 'MRI brain, without contrast', category: CptCategory.RADIOLOGY, defaultCharge: 950 },
      { code: '70552', description: 'MRI brain, with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 1200 },
      { code: '70553', description: 'MRI brain, without/with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 1400 },
      { code: '70450', description: 'CT head/brain, without contrast', category: CptCategory.RADIOLOGY, defaultCharge: 450 },
      { code: '70460', description: 'CT head/brain, with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 650 },
      { code: '70470', description: 'CT head/brain, without/with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 800 },
      { code: '74176', description: 'CT abdomen and pelvis, without contrast', category: CptCategory.RADIOLOGY, defaultCharge: 750 },
      { code: '74177', description: 'CT abdomen and pelvis, with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 950 },
      { code: '74178', description: 'CT abdomen and pelvis, without/with contrast', category: CptCategory.RADIOLOGY, defaultCharge: 1100 },
      { code: '76700', description: 'Ultrasound abdominal, complete', category: CptCategory.RADIOLOGY, defaultCharge: 350 },
      { code: '76705', description: 'Ultrasound abdominal, limited', category: CptCategory.RADIOLOGY, defaultCharge: 220 },
      { code: '76856', description: 'Ultrasound pelvic, complete', category: CptCategory.RADIOLOGY, defaultCharge: 350 },
      { code: '76857', description: 'Ultrasound pelvic, limited', category: CptCategory.RADIOLOGY, defaultCharge: 220 },
      { code: '76830', description: 'Ultrasound transvaginal, complete', category: CptCategory.RADIOLOGY, defaultCharge: 300 },
      { code: '76604', description: 'Ultrasound breast, complete', category: CptCategory.RADIOLOGY, defaultCharge: 280 },
      { code: '77067', description: 'Screening mammography, bilateral', category: CptCategory.RADIOLOGY, defaultCharge: 250 },
      { code: '77065', description: 'Diagnostic mammography, unilateral', category: CptCategory.RADIOLOGY, defaultCharge: 220 },
      { code: '77066', description: 'Diagnostic mammography, bilateral', category: CptCategory.RADIOLOGY, defaultCharge: 280 },
      { code: '78990', description: 'Radiopharmaceutical therapy, intra-arterial', category: CptCategory.RADIOLOGY, defaultCharge: 1500 },

      // ─── Surgery / Procedures ───
      { code: '10060', description: 'Incision and drainage of abscess, simple', category: CptCategory.SURGERY, defaultCharge: 200 },
      { code: '10061', description: 'Incision and drainage of abscess, complex', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '10140', description: 'Incision and drainage, hematoma/seroma', category: CptCategory.SURGERY, defaultCharge: 250 },
      { code: '11000', description: 'Debridement, skin, 10 sq cm or less', category: CptCategory.SURGERY, defaultCharge: 150 },
      { code: '11001', description: 'Debridement, skin, each additional 10 sq cm', category: CptCategory.SURGERY, defaultCharge: 75 },
      { code: '11102', description: 'Tangential biopsy, skin, single lesion', category: CptCategory.SURGERY, defaultCharge: 175 },
      { code: '11104', description: 'Punch biopsy, skin, single lesion', category: CptCategory.SURGERY, defaultCharge: 195 },
      { code: '11300', description: 'Shaving, epidermal/dermal lesion, 0.5 cm or less', category: CptCategory.SURGERY, defaultCharge: 150 },
      { code: '11400', description: 'Excision, benign lesion, 0.5 cm or less', category: CptCategory.SURGERY, defaultCharge: 220 },
      { code: '11401', description: 'Excision, benign lesion, 0.6-1.0 cm', category: CptCategory.SURGERY, defaultCharge: 275 },
      { code: '11402', description: 'Excision, benign lesion, 1.1-2.0 cm', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '11600', description: 'Excision, malignant lesion, 0.5 cm or less', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '11601', description: 'Excision, malignant lesion, 0.6-1.0 cm', category: CptCategory.SURGERY, defaultCharge: 450 },
      { code: '11602', description: 'Excision, malignant lesion, 1.1-2.0 cm', category: CptCategory.SURGERY, defaultCharge: 550 },
      { code: '11900', description: 'Intralesional injection, up to 7 lesions', category: CptCategory.SURGERY, defaultCharge: 175 },
      { code: '12001', description: 'Simple wound repair, 2.5 cm or less', category: CptCategory.SURGERY, defaultCharge: 200 },
      { code: '12002', description: 'Simple wound repair, 2.6-7.5 cm', category: CptCategory.SURGERY, defaultCharge: 275 },
      { code: '12011', description: 'Simple wound repair, face/neck, 2.5 cm or less', category: CptCategory.SURGERY, defaultCharge: 250 },
      { code: '12013', description: 'Simple wound repair, face/neck, 2.6-7.5 cm', category: CptCategory.SURGERY, defaultCharge: 325 },
      { code: '13131', description: 'Complex wound repair, face/neck, 1.1-2.5 cm', category: CptCategory.SURGERY, defaultCharge: 450 },
      { code: '13132', description: 'Complex wound repair, face/neck, 2.6-7.5 cm', category: CptCategory.SURGERY, defaultCharge: 550 },
      { code: '17110', description: 'Destruction, benign lesion, up to 14', category: CptCategory.SURGERY, defaultCharge: 175 },
      { code: '17000', description: 'Destruction, premalignant lesion, first', category: CptCategory.SURGERY, defaultCharge: 195 },
      { code: '17003', description: 'Destruction, premalignant lesion, 2nd-14th', category: CptCategory.SURGERY, defaultCharge: 85 },
      { code: '17250', description: 'Chemical cauterization, granulation tissue', category: CptCategory.SURGERY, defaultCharge: 150 },
      { code: '19000', description: 'Puncture aspiration, cyst, breast', category: CptCategory.SURGERY, defaultCharge: 250 },
      { code: '21550', description: 'Biopsy, soft tissue, chest wall', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '23065', description: 'Biopsy, soft tissue, shoulder', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '24065', description: 'Biopsy, soft tissue, upper arm/elbow', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '25065', description: 'Biopsy, soft tissue, forearm/wrist', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '27040', description: 'Biopsy, soft tissue, pelvis/hip', category: CptCategory.SURGERY, defaultCharge: 400 },
      { code: '27613', description: 'Biopsy, soft tissue, leg/knee', category: CptCategory.SURGERY, defaultCharge: 400 },
      { code: '44900', description: 'Biopsy, soft tissue, abdomen', category: CptCategory.SURGERY, defaultCharge: 400 },
      { code: '45378', description: 'Colonoscopy, diagnostic, with or without biopsy', category: CptCategory.SURGERY, defaultCharge: 1200 },
      { code: '45380', description: 'Colonoscopy with biopsy, single/multiple', category: CptCategory.SURGERY, defaultCharge: 1400 },
      { code: '45384', description: 'Colonoscopy with lesion removal, hot biopsy', category: CptCategory.SURGERY, defaultCharge: 1600 },
      { code: '45385', description: 'Colonoscopy with snare lesion removal', category: CptCategory.SURGERY, defaultCharge: 1800 },
      { code: '43239', description: 'Upper GI endoscopy with biopsy', category: CptCategory.SURGERY, defaultCharge: 1100 },
      { code: '43235', description: 'Upper GI endoscopy, diagnostic', category: CptCategory.SURGERY, defaultCharge: 950 },
      { code: '43270', description: 'Upper GI endoscopy with lesion removal', category: CptCategory.SURGERY, defaultCharge: 1300 },
      { code: '45330', description: 'Proctosigmoidoscopy, diagnostic', category: CptCategory.SURGERY, defaultCharge: 450 },
      { code: '45331', description: 'Proctosigmoidoscopy with biopsy', category: CptCategory.SURGERY, defaultCharge: 550 },
      { code: '56605', description: 'Biopsy, vulva, each separate lesion', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '57100', description: 'Biopsy, vaginal mucosa', category: CptCategory.SURGERY, defaultCharge: 300 },
      { code: '58100', description: 'Endometrial biopsy', category: CptCategory.SURGERY, defaultCharge: 350 },
      { code: '52200', description: 'Cystourethroscopy, diagnostic', category: CptCategory.SURGERY, defaultCharge: 650 },
      { code: '52224', description: 'Cystourethroscopy with biopsy', category: CptCategory.SURGERY, defaultCharge: 850 },
      { code: '52310', description: 'Cystourethroscopy with removal of foreign body', category: CptCategory.SURGERY, defaultCharge: 950 },
      { code: '53670', description: 'Mechanical urethral dilation', category: CptCategory.SURGERY, defaultCharge: 450 },
      { code: '53675', description: 'Urethral dilation with sound', category: CptCategory.SURGERY, defaultCharge: 500 },
      { code: '55100', description: 'Biopsy, prostate, needle', category: CptCategory.SURGERY, defaultCharge: 550 },
      { code: '55700', description: 'Biopsy, prostate, transrectal', category: CptCategory.SURGERY, defaultCharge: 650 },

      // ─── Medicine / Other ───
      { code: '90832', description: 'Psychotherapy, 30 minutes', category: CptCategory.MEDICINE, defaultCharge: 95 },
      { code: '90834', description: 'Psychotherapy, 45 minutes', category: CptCategory.MEDICINE, defaultCharge: 130 },
      { code: '90837', description: 'Psychotherapy, 60 minutes', category: CptCategory.MEDICINE, defaultCharge: 165 },
      { code: '90833', description: 'Psychotherapy, add-on, 30 minutes', category: CptCategory.MEDICINE, defaultCharge: 75 },
      { code: '90836', description: 'Psychotherapy, add-on, 45 minutes', category: CptCategory.MEDICINE, defaultCharge: 95 },
      { code: '90839', description: 'Psychotherapy for crisis, first 60 minutes', category: CptCategory.MEDICINE, defaultCharge: 215 },
      { code: '90840', description: 'Psychotherapy for crisis, each additional 30 min', category: CptCategory.MEDICINE, defaultCharge: 110 },
      { code: '90791', description: 'Psych diagnostic evaluation, no medical services', category: CptCategory.MEDICINE, defaultCharge: 175 },
      { code: '90792', description: 'Psych diagnostic eval with medical services', category: CptCategory.MEDICINE, defaultCharge: 250 },
      { code: '97110', description: 'Therapeutic exercise, each 15 min', category: CptCategory.MEDICINE, defaultCharge: 45 },
      { code: '97140', description: 'Manual therapy, each 15 min', category: CptCategory.MEDICINE, defaultCharge: 50 },
      { code: '97010', description: 'Hot/cold therapy, initial', category: CptCategory.MEDICINE, defaultCharge: 25 },
      { code: '97014', description: 'Electrical stimulation, unattended', category: CptCategory.MEDICINE, defaultCharge: 30 },
      { code: '97035', description: 'Ultrasound therapy, each 15 min', category: CptCategory.MEDICINE, defaultCharge: 35 },
      { code: '97124', description: 'Massage therapy, each 15 min', category: CptCategory.MEDICINE, defaultCharge: 35 },
      { code: '98940', description: 'Chiropractic manipulation, 1-2 regions', category: CptCategory.MEDICINE, defaultCharge: 55 },
      { code: '98941', description: 'Chiropractic manipulation, 3-4 regions', category: CptCategory.MEDICINE, defaultCharge: 65 },
      { code: '98942', description: 'Chiropractic manipulation, 5+ regions', category: CptCategory.MEDICINE, defaultCharge: 75 },
      { code: '94010', description: 'Spirometry, complete', category: CptCategory.MEDICINE, defaultCharge: 95 },
      { code: '94060', description: 'Spirometry, before/after bronchodilator', category: CptCategory.MEDICINE, defaultCharge: 145 },
      { code: '94640', description: 'Nebulizer treatment, pressurized/inhaler', category: CptCategory.MEDICINE, defaultCharge: 65 },
      { code: '94760', description: 'Pulse oximetry, noninvasive', category: CptCategory.MEDICINE, defaultCharge: 25 },
      { code: '95004', description: 'Allergy test, percutaneous, each test', category: CptCategory.MEDICINE, defaultCharge: 20 },
      { code: '95024', description: 'Allergy test, intradermal, each test', category: CptCategory.MEDICINE, defaultCharge: 30 },
      { code: '95028', description: 'Allergy test, intradermal with reading', category: CptCategory.MEDICINE, defaultCharge: 35 },
      { code: '95115', description: 'Allergy injection, single dose', category: CptCategory.MEDICINE, defaultCharge: 30 },
      { code: '95117', description: 'Allergy injection, multiple doses', category: CptCategory.MEDICINE, defaultCharge: 45 },
      { code: '96372', description: 'Therapeutic/prophylactic injection, subcutaneous/intramuscular', category: CptCategory.MEDICINE, defaultCharge: 45 },
      { code: '96365', description: 'IV infusion, hydration, initial 1 hour', category: CptCategory.MEDICINE, defaultCharge: 95 },
      { code: '96366', description: 'IV infusion, hydration, each additional hour', category: CptCategory.MEDICINE, defaultCharge: 45 },
      { code: '96373', description: 'Insulin pump therapy, initial', category: CptCategory.MEDICINE, defaultCharge: 75 },
      { code: '99441', description: 'Telephone E/M, 5-10 minutes', category: CptCategory.MEDICINE, defaultCharge: 45 },
      { code: '99442', description: 'Telephone E/M, 11-20 minutes', category: CptCategory.MEDICINE, defaultCharge: 75 },
      { code: '99443', description: 'Telephone E/M, 21-30 minutes', category: CptCategory.MEDICINE, defaultCharge: 110 },
      { code: '99455', description: 'Work related/medical disability exam, no psycho', category: CptCategory.MEDICINE, defaultCharge: 195 },
      { code: '99456', description: 'Work related/medical disability exam, with psycho', category: CptCategory.MEDICINE, defaultCharge: 250 },
      { code: '99499', description: 'Unlisted E/M service', category: CptCategory.MEDICINE, defaultCharge: 100 },

      // ─── Anesthesia ───
      { code: '00100', description: 'Anesthesia for procedures on head/neck, not otherwise specified', category: CptCategory.ANESTHESIA, defaultCharge: 500 },
      { code: '00300', description: 'Anesthesia for procedures on neck, not otherwise specified', category: CptCategory.ANESTHESIA, defaultCharge: 550 },
      { code: '00400', description: 'Anesthesia for procedures on integumentary system', category: CptCategory.ANESTHESIA, defaultCharge: 450 },
      { code: '00500', description: 'Anesthesia for procedures on heart/pericardium', category: CptCategory.ANESTHESIA, defaultCharge: 1200 },
      { code: '00730', description: 'Anesthesia for upper abdominal procedures', category: CptCategory.ANESTHESIA, defaultCharge: 850 },
      { code: '00830', description: 'Anesthesia for lower abdominal procedures', category: CptCategory.ANESTHESIA, defaultCharge: 750 },
      { code: '00910', description: 'Anesthesia for procedures on pelvis/hip', category: CptCategory.ANESTHESIA, defaultCharge: 700 },
      { code: '00920', description: 'Anesthesia for procedures on male/female genitalia', category: CptCategory.ANESTHESIA, defaultCharge: 650 },
      { code: '01100', description: 'Anesthesia for procedures on knee/joint', category: CptCategory.ANESTHESIA, defaultCharge: 600 },
      { code: '01200', description: 'Anesthesia for procedures on ankle/foot', category: CptCategory.ANESTHESIA, defaultCharge: 550 },
      { code: '01400', description: 'Anesthesia for procedures on upper leg', category: CptCategory.ANESTHESIA, defaultCharge: 600 },
      { code: '01610', description: 'Anesthesia for shoulder/axilla procedures', category: CptCategory.ANESTHESIA, defaultCharge: 650 },
      { code: '01810', description: 'Anesthesia for arm/elbow procedures', category: CptCategory.ANESTHESIA, defaultCharge: 550 },
      { code: '01920', description: 'Anesthesia for intrathoracic procedures', category: CptCategory.ANESTHESIA, defaultCharge: 1100 },
      { code: '01922', description: 'Anesthesia for neuroradiologic procedures', category: CptCategory.ANESTHESIA, defaultCharge: 950 },
      { code: '01930', description: 'Anesthesia for spine/spinal cord procedures', category: CptCategory.ANESTHESIA, defaultCharge: 1000 },
      { code: '01935', description: 'Anesthesia for vascular interventional procedures', category: CptCategory.ANESTHESIA, defaultCharge: 850 },

      // ─── HCPCS Level II ───
      { code: 'A0429', description: 'Ambulance service, BLS, emergency transport', category: CptCategory.HCPCS, defaultCharge: 650 },
      { code: 'A0433', description: 'Ambulance service, ALS, emergency transport', category: CptCategory.HCPCS, defaultCharge: 850 },
      { code: 'A0425', description: 'Ambulance service, BLS, non-emergency, fixed', category: CptCategory.HCPCS, defaultCharge: 350 },
      { code: 'G0008', description: 'Administration of influenza virus vaccine', category: CptCategory.HCPCS, defaultCharge: 25 },
      { code: 'G0009', description: 'Administration of pneumococcal vaccine', category: CptCategory.HCPCS, defaultCharge: 25 },
      { code: 'G0010', description: 'Administration of hepatitis B vaccine', category: CptCategory.HCPCS, defaultCharge: 25 },
      { code: 'J0696', description: 'Cefazolin sodium, 500 mg injection', category: CptCategory.HCPCS, defaultCharge: 12 },
      { code: 'J1100', description: 'Dexamethasone sodium phosphate, 1 mg injection', category: CptCategory.HCPCS, defaultCharge: 3 },
      { code: 'J1885', description: 'Ketorolac tromethamine, 15 mg injection', category: CptCategory.HCPCS, defaultCharge: 3 },
      { code: 'J2001', description: 'Lidocaine HCl, 50 mg injection', category: CptCategory.HCPCS, defaultCharge: 5 },
      { code: 'J2175', description: 'Ondansetron HCl, 1 mg injection', category: CptCategory.HCPCS, defaultCharge: 5 },
      { code: 'J2554', description: 'Promethazine HCl, 50 mg injection', category: CptCategory.HCPCS, defaultCharge: 5 },
      { code: 'J2778', description: 'Methylprednisolone acetate, 40 mg injection', category: CptCategory.HCPCS, defaultCharge: 25 },
      { code: 'J3301', description: 'Triamcinolone acetonide, 10 mg injection', category: CptCategory.HCPCS, defaultCharge: 12 },
      { code: 'J3490', description: 'Unclassified drugs, injection', category: CptCategory.HCPCS, defaultCharge: 50 },
      { code: 'J7121', description: 'Dextrose 5% in water, 500 mL infusion', category: CptCategory.HCPCS, defaultCharge: 25 },
      { code: 'Q9967', description: 'Iohexol contrast, 240 mg/mL per mL', category: CptCategory.HCPCS, defaultCharge: 35 },
      { code: 'Q9968', description: 'Iohexol contrast, 300 mg/mL per mL', category: CptCategory.HCPCS, defaultCharge: 45 },
    ];
  }
}
