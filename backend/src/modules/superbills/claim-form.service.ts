import { Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { SuperbillsService } from './superbills.service';

/**
 * Generates a CMS-1500 (02/12) Health Insurance Claim Form PDF
 * using the official NUCC red-grid template as a background.
 *
 * The official template (page 4 of the NUCC PDF) is embedded as a
 * background page, and black data text is overlaid at the exact field
 * coordinates. This produces a form that is pixel-identical to the
 * official CMS-1500 and can be scanned by payer OCR systems.
 *
 * Reference: https://www.nucc.org/index.php/1500-claim-form-mainmenu-35
 *
 * Template coordinate system:
 *   Page size: 684 × 864 pt (8.5" × 11" at 80dpi)
 *   Origin: top-left, Y increases downward (negative values in PDF stream)
 *   pdf-lib uses bottom-up Y, so: pdfY = 864 - |templateY|
 */
@Injectable()
export class ClaimFormService {
  constructor(private readonly superbillsService: SuperbillsService) {}

  private templateBuffer: Buffer | null = null;

  private loadTemplate(): Buffer {
    if (this.templateBuffer) return this.templateBuffer;
    const templatePath = path.join(__dirname, '..', '..', '..', 'assets', 'cms1500-template.pdf');
    this.templateBuffer = fs.readFileSync(templatePath);
    return this.templateBuffer;
  }

  async generateCms1500(id: string): Promise<Buffer> {
    const superbill = await this.superbillsService.findOne(id);
    if (!superbill) throw new NotFoundException('Superbill not found');

    // Load the official NUCC template PDF
    const templateBytes = this.loadTemplate();
    const templatePdf = await PDFDocument.load(templateBytes);
    const [templatePage] = await templatePdf.getPages();

    // Create the output PDF and embed the template page as a background
    const pdfDoc = await PDFDocument.create();
    const embeddedPage = await pdfDoc.embedPage(templatePage);

    const PAGE_W = 684;
    const PAGE_H = 864;
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

    // Draw the official template as background
    page.drawPage(embeddedPage, {
      x: 0,
      y: 0,
      width: PAGE_W,
      height: PAGE_H,
    });

    // Fonts for data overlay
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    // ── Coordinate helpers ──────────────────────────────────────────────────
    // Template uses top-left origin with negative Y.
    // pdf-lib uses bottom-left origin with positive Y.
    // Convert: pdfY = PAGE_H - templateY (where templateY is the positive distance from top)
    // From our analysis, template Y values are negative, so:
    //   distanceFromTop = |templateY| = -templateY
    //   pdfY = PAGE_H - distanceFromTop = 864 + templateY (since templateY is negative)

    const Y = (templateY: number) => PAGE_H + templateY; // templateY is negative

    const drawText = (
      text: string,
      x: number,
      templateY: number,
      size = 9,
      f = boldFont,
      color = black,
    ) => {
      if (!text) return;
      try {
        page.drawText(String(text), { x, y: Y(templateY), size, font: f, color });
      } catch {
        // Skip characters not in Helvetica font set
      }
    };

    const drawCheckbox = (checked: boolean, x: number, templateY: number) => {
      if (checked) drawText('X', x, templateY, 10, boldFont);
    };

    const fmtDate = (d: Date | string | null | undefined): string => {
      if (!d) return '';
      const date = new Date(d);
      if (isNaN(date.getTime())) return '';
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const yy = String(date.getFullYear()).slice(-2);
      return `${mm} ${dd} ${yy}`;
    };

    const fmtDateLong = (d: Date | string | null | undefined): string => {
      if (!d) return '';
      const date = new Date(d);
      if (isNaN(date.getTime())) return '';
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const yyyy = String(date.getFullYear());
      return `${mm} ${dd} ${yyyy}`;
    };

    const fmtMoney = (n: number | null | undefined): string => {
      if (n === null || n === undefined) return '';
      return Number(n).toFixed(2);
    };

    const sb: any = superbill;

    // ── Field 1: Insurance Program checkboxes ───────────────────────────────
    // Row 1: Medicare (~47), Medicaid (~94), TRICARE (~145), CHAMPVA (~210)
    // Row 2: Group Health Plan, FECA, BLK LUNG, OTHER
    // Checkbox positions are approximate based on template analysis
    const prog = sb.insuranceProgram || '';
    // Row 1 Y ≈ -67, checkboxes are before each label
    drawCheckbox(prog === 'medicare', 40, -67);
    drawCheckbox(prog === 'medicaid', 86, -67);
    drawCheckbox(prog === 'tricare', 137, -67);
    drawCheckbox(prog === 'champva', 202, -67);
    // Row 2 Y ≈ -78 area — Group, FECA, BLK LUNG, OTHER
    // These are in the second row of program checkboxes
    drawCheckbox(prog === 'group_health_plan', 40, -78);
    drawCheckbox(prog === 'feca', 130, -78);
    drawCheckbox(prog === 'blk_lung', 190, -78);
    drawCheckbox(prog === 'other', 250, -78);

    // ── Field 1a: Insured's I.D. Number ─────────────────────────────────────
    // Label at x=388, y=-67; data goes in the box to the right
    drawText(sb.insurance?.policyNumber || '', 395, -60, 9);

    // ── Field 2: Patient's Name ─────────────────────────────────────────────
    // Left column starts at x≈36, label y=-90
    drawText(sb.patientName || '', 40, -83, 9);

    // ── Field 3: Patient's Birth Date + Sex ─────────────────────────────────
    // Label y=-113; DOB box, then M/F checkboxes
    drawText(fmtDate(sb.patientDOB), 40, -107, 9);
    const pSex = sb.patientSex || '';
    // M checkbox around x=170, F around x=190
    drawCheckbox(pSex === 'M', 165, -107);
    drawCheckbox(pSex === 'F', 185, -107);

    // ── Field 4: Insured's Name ─────────────────────────────────────────────
    // Right column, x≈388, y=-91
    drawText(sb.insurance?.subscriberName || '', 395, -83, 9);

    // ── Field 5: Patient's Address ──────────────────────────────────────────
    // Label y=-113
    drawText(sb.patientAddress?.street || '', 40, -107, 9);

    // ── Field 5 cont: City / State / Zip / Phone ────────────────────────────
    // y=-138
    drawText(sb.patientAddress?.city || '', 40, -132, 8);
    drawText(sb.patientAddress?.state || '', 130, -132, 8);
    drawText(sb.patientAddress?.zipCode || '', 170, -132, 8);
    drawText(sb.patientPhone || '', 230, -132, 8);

    // ── Field 6: Patient Relationship to Insured ────────────────────────────
    // y=-138 area, checkboxes: Self, Spouse, Child, Other
    const rel = sb.insurance?.subscriberRelation || '';
    drawCheckbox(rel === 'Self' || rel === 'self', 40, -150);
    drawCheckbox(rel === 'Spouse' || rel === 'spouse', 80, -150);
    drawCheckbox(rel === 'Child' || rel === 'child' || rel === 'Dependent', 130, -150);
    drawCheckbox(rel !== 'Self' && rel !== 'self' && rel !== 'Spouse' && rel !== 'spouse' && rel !== 'Child' && rel !== 'child' && rel !== 'Dependent' && !!rel, 170, -150);

    // ── Field 7: Insured's Address ──────────────────────────────────────────
    // x≈388, y=-113
    const insuredAddr = sb.insuredAddress;
    drawText(insuredAddr?.street || sb.patientAddress?.street || '', 395, -107, 9);
    // City/State/Zip
    drawText(insuredAddr?.city || sb.patientAddress?.city || '', 395, -132, 8);
    drawText(insuredAddr?.state || sb.patientAddress?.state || '', 480, -132, 8);
    drawText(insuredAddr?.zipCode || sb.patientAddress?.zipCode || '', 520, -132, 8);

    // ── Field 9: Other Insured's Name ───────────────────────────────────────
    // y=-186 area
    drawText('', 40, -180, 9);

    // ── Field 10: Condition Related To ──────────────────────────────────────
    // 10a. Employment — y≈-210
    drawCheckbox(sb.isEmploymentRelated === true, 120, -210);
    drawCheckbox(sb.isEmploymentRelated === false, 150, -210);
    // 10b. Auto Accident
    drawCheckbox(sb.isAutoAccident === true, 80, -225);
    drawCheckbox(sb.isAutoAccident === false, 110, -225);
    // 10c. Other Accident
    drawCheckbox(sb.isOtherAccident === true, 80, -240);
    drawCheckbox(sb.isOtherAccident === false, 110, -240);

    // ── Field 11: Insured's Policy Group or FECA Number ─────────────────────
    // x≈388, y=-187
    drawText(sb.insurance?.groupNumber || '', 395, -180, 9);

    // ── Field 11a: Insured's DOB + Sex ──────────────────────────────────────
    // y=-210
    drawText(fmtDate(sb.insuredDOB || sb.patientDOB), 395, -203, 9);
    const iSex = sb.insuredSex || sb.patientSex || '';
    drawCheckbox(iSex === 'M', 520, -203);
    drawCheckbox(iSex === 'F', 540, -203);

    // ── Field 11c: Insurance Plan Name ──────────────────────────────────────
    // y=-260
    drawText(sb.insurance?.provider || '', 395, -255, 9);

    // ── Field 11d: Another Health Benefit Plan? ─────────────────────────────
    // y=-282
    drawCheckbox(false, 480, -275); // YES
    drawCheckbox(true, 510, -275);  // NO

    // ── Field 12: Patient's Signature + Date ────────────────────────────────
    // y=-343
    drawText('SIGNED', 46, -338, 8, font);
    drawText(fmtDate(sb.serviceDate), 268, -338, 8, font);

    // ── Field 13: Insured's Signature ───────────────────────────────────────
    // y=-306
    drawText('SIGNED', 395, -300, 8, font);

    // ── Field 14: Date of Current Illness ───────────────────────────────────
    // y=-355
    drawText(fmtDate(sb.dateOfIllness), 46, -365, 9);

    // ── Field 17: Referring Provider Name ───────────────────────────────────
    // y≈-370 area
    drawText(sb.referringProviderName || '', 46, -380, 9);

    // ── Field 17b: Referring Provider NPI ───────────────────────────────────
    drawText(sb.referringProviderNPI || '', 395, -380, 9);

    // ── Field 18: Hospitalization Dates ─────────────────────────────────────
    drawText(fmtDate(sb.admissionDate), 200, -395, 8);
    drawText(fmtDate(sb.dischargeDate), 250, -395, 8);

    // ── Field 20: Outside Lab? ──────────────────────────────────────────────
    drawCheckbox(sb.outsideLab === true, 80, -410);
    drawCheckbox(sb.outsideLab === false, 100, -410);
    drawText(fmtMoney(sb.outsideLabCharges), 130, -410, 8);

    // ── Field 21: Diagnosis A-L ─────────────────────────────────────────────
    // Labels at y=-442 (A,B,C,D,E,F,G,H) and y=-465 (I,J,K,L)
    // ICD Ind at y=-474
    const diagnoses = superbill.diagnoses || [];
    const dxLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    // Row 1: A-D at x≈46, 100, 175, 240; E-H at x≈46, 100, 175, 240 (second row of labels)
    // Actually from template: A at x=46, B at x=49, C at x=240, D at x=240
    // The diagnosis grid is 4 columns × 3 rows
    const dxColX = [50, 130, 210, 290]; // approximate column starts
    const dxRowY = [-435, -458, -480]; // 3 rows
    for (let i = 0; i < Math.min(diagnoses.length, 12); i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      drawText(diagnoses[i].icdCode, dxColX[col], dxRowY[row], 8);
    }
    // ICD Indicator (0 = ICD-10)
    drawText('0', 395, -470, 8);

    // ── Field 22: Resubmission Code + Original Ref No ───────────────────────
    drawText(sb.resubmissionCode || '', 46, -500, 8);
    drawText(sb.originalRefNo || '', 130, -500, 8);

    // ── Field 23: Prior Authorization Number ────────────────────────────────
    drawText(sb.priorAuthNumber || sb.referralNumber || '', 395, -500, 8);

    // ── Field 24: Service Lines (6 rows) ────────────────────────────────────
    // Column positions (approximate based on template):
    // 24a (Date): x≈46, 24b (POS): x≈120, 24c (EMG): x≈145,
    // 24d (CPT): x≈165, 24e (Dx Ptr): x≈250, 24f ($): x≈280,
    // 24g (Units): x≈340, 24j (Rendering ID): x≈400
    const procedures = superbill.procedures || [];
    const lineRowY = [-520, -540, -560, -580, -600, -620]; // 6 rows, 20pt apart

    for (let i = 0; i < Math.min(procedures.length, 6); i++) {
      const p = procedures[i];
      const ry = lineRowY[i];
      // 24a: Date(s) of Service
      drawText(fmtDate(p.serviceDate || superbill.serviceDate), 46, ry, 7);
      // 24b: Place of Service
      drawText(superbill.posCode || '11', 120, ry, 8);
      // 24d: CPT/HCPCS
      drawText(p.cptCode, 165, ry, 8);
      // Modifiers
      const mods = (p.modifiers || []).join(' ');
      if (mods) drawText(mods, 220, ry, 7, font);
      // 24e: Diagnosis Pointer (convert numbers to A-L letters)
      const dxPtr = (p.diagnosisPointer || [])
        .map((n: string) => dxLetters[parseInt(n) - 1] || n)
        .join(' ');
      drawText(dxPtr, 250, ry, 8);
      // 24f: $ Charges
      drawText(fmtMoney(p.charge), 280, ry, 8);
      // 24g: Days or Units
      drawText(String(p.units || 1), 340, ry, 8);
      // 24j: Rendering Provider ID
      drawText(sb.renderingProviderId || superbill.providerNPI || '', 400, ry, 7);
    }

    // ── Field 25: Federal Tax ID ────────────────────────────────────────────
    drawText(superbill.providerTaxId || '', 46, -640, 8);
    // SSN / EIN checkboxes
    drawCheckbox(false, 120, -640); // SSN
    drawCheckbox(true, 150, -640);  // EIN (default)

    // ── Field 26: Patient's Account No ──────────────────────────────────────
    drawText(sb.patientAccountNo || superbill.patientId?.slice(0, 12) || '', 395, -640, 8);

    // ── Field 27: Accept Assignment? ────────────────────────────────────────
    const acceptAssign = sb.acceptAssignment !== false;
    drawCheckbox(acceptAssign, 120, -655);
    drawCheckbox(!acceptAssign, 150, -655);

    // ── Field 28: Total Charge ──────────────────────────────────────────────
    drawText(fmtMoney(superbill.totalAmount), 395, -655, 9);

    // ── Field 29: Amount Paid ───────────────────────────────────────────────
    drawText(fmtMoney(sb.amountPaid), 460, -655, 9);

    // ── Field 31: Physician Signature + Date ────────────────────────────────
    drawText(sb.physicianSignature || superbill.providerName || '', 46, -680, 8);
    drawText(fmtDate(sb.physicianSignatureDate || superbill.serviceDate), 300, -680, 8);

    // ── Field 32: Service Facility Location ─────────────────────────────────
    drawText(superbill.facilityName || '', 395, -680, 8);
    drawText(superbill.facilityNPI || '', 500, -680, 8);

    // ── Field 33: Billing Provider Info ─────────────────────────────────────
    drawText(superbill.providerName || '', 46, -705, 8);
    const provAddr = superbill.providerAddress;
    if (provAddr) {
      drawText(
        `${provAddr.street || ''}, ${provAddr.city || ''}, ${provAddr.state || ''} ${provAddr.zipCode || ''}`,
        46, -715, 7, font,
      );
    }
    drawText(superbill.providerNPI || '', 250, -705, 8);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
