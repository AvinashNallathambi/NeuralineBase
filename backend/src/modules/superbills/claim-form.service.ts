import { Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SuperbillsService } from './superbills.service';

/**
 * Generates a CMS-1500 (02/12) Health Insurance Claim Form PDF
 * following the official NUCC layout.
 *
 * Reference: https://www.nucc.org/index.php/1500-claim-form-mainmenu-35
 * Official form: 1500_claim_form_2012_02.pdf
 *
 * The form is 8.5" × 11" (612 × 792 pt). The official form uses a red
 * dropout grid that OCR scanners filter out. We draw a light gray grid
 * for on-screen readability and print.
 */
@Injectable()
export class ClaimFormService {
  constructor(private readonly superbillsService: SuperbillsService) {}

  async generateCms1500(id: string): Promise<Buffer> {
    const superbill = await this.superbillsService.findOne(id);
    if (!superbill) throw new NotFoundException('Superbill not found');

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const smallFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    const gridColor = rgb(0.85, 0.85, 0.85); // light gray grid (simulating red dropout)

    // ── Layout constants ────────────────────────────────────────────────────
    const MARGIN = 18; // left/right margin
    const PAGE_W = 612;
    const PAGE_H = 792;
    const FORM_W = PAGE_W - MARGIN * 2; // 576
    const leftX = MARGIN;
    const midX = MARGIN + FORM_W / 2; // 306
    const rightX = MARGIN + FORM_W; // 594

    // Helpers
    const drawText = (text: string, x: number, y: number, size = 8, f = font, color = black) => {
      if (!text) return;
      page.drawText(String(text), { x, y, size, font: f, color });
    };

    const drawLabel = (text: string, x: number, y: number, size = 6) => {
      drawText(text, x, y, size, smallFont, rgb(0.4, 0.4, 0.4));
    };

    const drawValue = (text: string, x: number, y: number, size = 9) => {
      drawText(text, x, y, size, boldFont);
    };

    const drawCheckbox = (checked: boolean, x: number, y: number) => {
      drawText(checked ? 'X' : '', x, y, 9, boldFont);
    };

    const drawBox = (x: number, y: number, w: number, h: number) => {
      page.drawRectangle({ x, y, width: w, height: h, borderColor: gridColor, borderWidth: 0.5, color: rgb(1, 1, 1) });
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: gridColor });
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

    const fmtMoney = (n: number | null | undefined): string => {
      if (n === null || n === undefined) return '';
      return `$${Number(n).toFixed(2)}`;
    };

    // ── Header ──────────────────────────────────────────────────────────────
    let y = PAGE_H - 18;
    drawText('HEALTH INSURANCE CLAIM FORM', leftX, y - 8, 11, boldFont);
    drawText('APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12', leftX + 200, y - 8, 6, smallFont, rgb(0.4, 0.4, 0.4));
    drawText('OMB-0938-1197', rightX - 60, y - 8, 6, smallFont, rgb(0.4, 0.4, 0.4));
    y -= 16;

    // Top border line
    drawLine(leftX, y, rightX, y);
    y -= 2;

    // ── Field 1: Insurance Program (checkboxes) ─────────────────────────────
    const prog = (superbill as any).insuranceProgram || '';
    const progY = y - 8;
    const progColW = (FORM_W / 2 - 60) / 4;

    drawLabel('1. ', leftX, progY);
    const programs = [
      { key: 'medicare', label: 'MEDICARE', sub: '(Medicare #)' },
      { key: 'medicaid', label: 'MEDICAID', sub: '(Medicaid #)' },
      { key: 'tricare', label: 'TRICARE', sub: '(Member ID #)' },
      { key: 'champva', label: 'CHAMPVA', sub: '(Member ID #)' },
      { key: 'group_health_plan', label: 'GROUP HEALTH PLAN', sub: '(ID#)' },
      { key: 'feca', label: 'FECA', sub: '(ID#)' },
      { key: 'blk_lung', label: 'BLK LUNG', sub: '(ID#)' },
      { key: 'other', label: 'OTHER', sub: '(ID#)' },
    ];

    // Row 1: Medicare, Medicaid, TRICARE, CHAMPVA
    let progX = leftX + 18;
    for (let i = 0; i < 4; i++) {
      const p = programs[i];
      drawCheckbox(prog === p.key, progX, progY);
      drawText(p.label, progX + 8, progY, 6, smallFont);
      drawText(p.sub, progX + 8, progY - 7, 5, smallFont, rgb(0.5, 0.5, 0.5));
      progX += progColW;
    }

    // Row 2: Group Health Plan, FECA, BLK LUNG, OTHER
    const progY2 = progY - 16;
    progX = leftX + 18;
    for (let i = 4; i < 8; i++) {
      const p = programs[i];
      drawCheckbox(prog === p.key, progX, progY2);
      drawText(p.label, progX + 8, progY2, 6, smallFont);
      drawText(p.sub, progX + 8, progY2 - 7, 5, smallFont, rgb(0.5, 0.5, 0.5));
      progX += progColW;
    }

    y = progY2 - 14;

    // ── Field 1a: Insured's I.D. Number ─────────────────────────────────────
    drawLine(leftX, y, rightX, y);
    y -= 10;
    drawLabel('1a. INSURED\'S I.D. NUMBER (For Program in Item 1)', leftX + 2, y);
    drawValue(superbill.insurance?.policyNumber || '', leftX + 160, y - 1);
    y -= 16;
    drawLine(leftX, y, rightX, y);

    // ── Fields 2-7: Patient & Insured Info (two columns) ────────────────────
    // Left column: 2, 3, 5, 6, 7
    // Right column: 4, 7a (insured address), 11
    const colTop = y - 4;
    const leftColX = leftX + 2;
    const rightColX = midX + 4;
    const colW = FORM_W / 2 - 8;

    // Field 2: Patient's Name
    let ly = colTop;
    drawLabel('2. PATIENT\'S NAME (Last Name, First Name, Middle Initial)', leftColX, ly);
    ly -= 12;
    drawValue(superbill.patientName || '', leftColX, ly);
    ly -= 4;
    drawLine(leftX, ly, midX, ly);

    // Field 3: Patient's Birth Date + Sex
    ly -= 10;
    drawLabel('3. PATIENT\'S BIRTH DATE', leftColX, ly);
    drawLabel('SEX', leftColX + 130, ly);
    ly -= 12;
    drawValue(fmtDate(superbill.patientDOB), leftColX, ly);
    const pSex = (superbill as any).patientSex || '';
    drawCheckbox(pSex === 'M', leftColX + 140, ly); drawText('M', leftColX + 148, ly, 7, smallFont);
    drawCheckbox(pSex === 'F', leftColX + 160, ly); drawText('F', leftColX + 168, ly, 7, smallFont);
    ly -= 4;
    drawLine(leftX, ly, midX, ly);

    // Field 5: Patient's Address
    ly -= 10;
    drawLabel('5. PATIENT\'S ADDRESS (No., Street)', leftColX, ly);
    ly -= 12;
    drawValue(superbill.patientAddress?.street || '', leftColX, ly);
    ly -= 4;
    drawLine(leftX, ly, midX, ly);

    // City / State / Zip / Phone
    ly -= 10;
    drawLabel('CITY', leftColX, ly);
    drawLabel('STATE', leftColX + 90, ly);
    drawLabel('ZIP CODE', leftColX + 130, ly);
    drawLabel('TELEPHONE (Include Area Code)', leftColX + 180, ly);
    ly -= 12;
    drawValue(superbill.patientAddress?.city || '', leftColX, ly, 8);
    drawValue(superbill.patientAddress?.state || '', leftColX + 90, ly, 8);
    drawValue(superbill.patientAddress?.zipCode || '', leftColX + 130, ly, 8);
    drawValue(superbill.patientPhone || '', leftColX + 180, ly, 8);
    ly -= 4;
    drawLine(leftX, ly, midX, ly);

    // Field 6: Patient Relationship to Insured
    ly -= 10;
    drawLabel('6. PATIENT RELATIONSHIP TO INSURED', leftColX, ly);
    ly -= 12;
    const rel = superbill.insurance?.subscriberRelation || '';
    drawCheckbox(rel === 'Self', leftColX, ly); drawText('Self', leftColX + 8, ly, 7, smallFont);
    drawCheckbox(rel === 'Spouse', leftColX + 40, ly); drawText('Spouse', leftColX + 48, ly, 7, smallFont);
    drawCheckbox(rel === 'Child' || rel === 'Dependent', leftColX + 90, ly); drawText('Child', leftColX + 98, ly, 7, smallFont);
    drawCheckbox(rel !== 'Self' && rel !== 'Spouse' && rel !== 'Child' && rel !== 'Dependent' && !!rel, leftColX + 130, ly); drawText('Other', leftColX + 138, ly, 7, smallFont);
    ly -= 4;
    drawLine(leftX, ly, midX, ly);

    // Field 7: Insured's Address
    ly -= 10;
    drawLabel('7. INSURED\'S ADDRESS (No., Street)', leftColX, ly);
    ly -= 12;
    const insuredAddr = (superbill as any).insuredAddress;
    drawValue(insuredAddr?.street || superbill.patientAddress?.street || '', leftColX, ly);
    ly -= 4;
    drawLine(leftX, ly, midX, ly);

    ly -= 10;
    drawLabel('CITY', leftColX, ly);
    drawLabel('STATE', leftColX + 90, ly);
    drawLabel('ZIP', leftColX + 130, ly);
    drawLabel('TELEPHONE', leftColX + 170, ly);
    ly -= 12;
    drawValue(insuredAddr?.city || superbill.patientAddress?.city || '', leftColX, ly, 8);
    drawValue(insuredAddr?.state || superbill.patientAddress?.state || '', leftColX + 90, ly, 8);
    drawValue(insuredAddr?.zipCode || superbill.patientAddress?.zipCode || '', leftColX + 130, ly, 8);
    ly -= 4;
    drawLine(leftX, ly, midX, ly);

    // Right column: 4, 11, 11a, 11b, 11c, 11d
    let ry = colTop;

    // Field 4: Insured's Name
    drawLabel('4. INSURED\'S NAME (Last Name, First Name, Middle Initial)', rightColX, ry);
    ry -= 12;
    drawValue(superbill.insurance?.subscriberName || '', rightColX, ry);
    ry -= 4;
    drawLine(midX, ry, rightX, ry);

    // Field 11: Insured's Policy Group or FECA Number
    ry -= 10;
    drawLabel('11. INSURED\'S POLICY GROUP OR FECA NUMBER', rightColX, ry);
    ry -= 12;
    drawValue(superbill.insurance?.groupNumber || '', rightColX, ry);
    ry -= 4;
    drawLine(midX, ry, rightX, ry);

    // Field 11a: Insured's DOB + Sex
    ry -= 10;
    drawLabel('a. INSURED\'S DATE OF BIRTH', rightColX, ry);
    drawLabel('SEX', rightColX + 120, ry);
    ry -= 12;
    drawValue(fmtDate((superbill as any).insuredDOB || superbill.patientDOB), rightColX, ry);
    const iSex = (superbill as any).insuredSex || (superbill as any).patientSex || '';
    drawCheckbox(iSex === 'M', rightColX + 130, ry); drawText('M', rightColX + 138, ry, 7, smallFont);
    drawCheckbox(iSex === 'F', rightColX + 150, ry); drawText('F', rightColX + 158, ry, 7, smallFont);
    ry -= 4;
    drawLine(midX, ry, rightX, ry);

    // Field 11b: Claim ID
    ry -= 10;
    drawLabel('b. OTHER CLAIM ID (Designated by NUCC)', rightColX, ry);
    ry -= 12;
    ry -= 4;
    drawLine(midX, ry, rightX, ry);

    // Field 11c: Insurance Plan Name
    ry -= 10;
    drawLabel('c. INSURANCE PLAN NAME OR PROGRAM NAME', rightColX, ry);
    ry -= 12;
    drawValue(superbill.insurance?.provider || '', rightColX, ry);
    ry -= 4;
    drawLine(midX, ry, rightX, ry);

    // Field 11d: Is there another health benefit plan?
    ry -= 10;
    drawLabel('d. IS THERE ANOTHER HEALTH BENEFIT PLAN?', rightColX, ry);
    drawLabel('YES', rightColX + 140, ry);
    drawLabel('NO', rightColX + 170, ry);
    ry -= 12;
    drawCheckbox(false, rightColX + 140, ry); drawText('YES', rightColX + 148, ry, 7, smallFont);
    drawCheckbox(true, rightColX + 170, ry); drawText('NO', rightColX + 178, ry, 7, smallFont);
    ry -= 4;
    drawLine(midX, ry, rightX, ry);

    // Sync y to bottom of both columns
    y = Math.min(ly, ry) - 4;
    drawLine(leftX, y, rightX, y);

    // ── Fields 9, 9a, 9d: Other Insured's Info ──────────────────────────────
    y -= 10;
    drawLabel('9. OTHER INSURED\'S NAME (Last Name, First Name, Middle Initial)', leftX + 2, y);
    drawLabel('9a. OTHER INSURED\'S POLICY OR GROUP NUMBER', midX + 4, y);
    y -= 12;
    drawLine(leftX, y, midX, y);
    drawLine(midX, y, rightX, y);

    y -= 10;
    drawLabel('9b. RESERVED FOR NUCC USE', leftX + 2, y);
    drawLabel('9c. RESERVED FOR NUCC USE', midX + 4, y);
    y -= 12;
    drawLine(leftX, y, midX, y);
    drawLine(midX, y, rightX, y);

    y -= 10;
    drawLabel('9d. INSURANCE PLAN NAME OR PROGRAM NAME', leftX + 2, y);
    y -= 12;
    drawLine(leftX, y, rightX, y);

    // ── Fields 10, 10a-c: Condition Related To ──────────────────────────────
    y -= 10;
    drawLabel('10. IS PATIENT\'S CONDITION RELATED TO:', leftX + 2, y);
    y -= 12;

    // 10a. Employment
    drawLabel('a. EMPLOYMENT? (Current or Previous)', leftX + 2, y);
    drawCheckbox(superbill.isEmploymentRelated === true, leftX + 140, y); drawText('YES', leftX + 148, y, 7, smallFont);
    drawCheckbox(superbill.isEmploymentRelated === false, leftX + 172, y); drawText('NO', leftX + 180, y, 7, smallFont);
    y -= 4;
    drawLine(leftX, y, midX, y);

    // 10b. Auto Accident
    y -= 10;
    drawLabel('b. AUTO ACCIDENT?', leftX + 2, y);
    drawLabel('PLACE (State)', leftX + 100, y);
    drawCheckbox(superbill.isAutoAccident === true, leftX + 160, y); drawText('YES', leftX + 168, y, 7, smallFont);
    drawCheckbox(superbill.isAutoAccident === false, leftX + 190, y); drawText('NO', leftX + 198, y, 7, smallFont);
    y -= 4;
    drawLine(leftX, y, midX, y);

    // 10c. Other Accident
    y -= 10;
    drawLabel('c. OTHER ACCIDENT?', leftX + 2, y);
    drawCheckbox(superbill.isOtherAccident === true, leftX + 100, y); drawText('YES', leftX + 108, y, 7, smallFont);
    drawCheckbox(superbill.isOtherAccident === false, leftX + 130, y); drawText('NO', leftX + 138, y, 7, smallFont);
    y -= 4;
    drawLine(leftX, y, rightX, y);

    // 10d. Claim Codes
    y -= 10;
    drawLabel('10d. CLAIM CODES (Designated by NUCC)', leftX + 2, y);
    y -= 12;
    drawLine(leftX, y, rightX, y);

    // ── Fields 12-13: Signatures ────────────────────────────────────────────
    y -= 10;
    drawLabel('12. PATIENT\'S OR AUTHORIZED PERSON\'S SIGNATURE. I authorize the release of any medical or other', leftX + 2, y);
    y -= 8;
    drawLabel('information necessary to process this claim. I also request payment of government benefits either to myself', leftX + 2, y);
    y -= 8;
    drawLabel('or to the party who accepts assignment below.', leftX + 2, y);
    y -= 12;
    drawText('SIGNED', leftX + 2, y, 8, boldFont);
    drawText('DATE ' + fmtDate(superbill.serviceDate), leftX + 80, y, 8, smallFont);
    drawLine(leftX, y - 2, midX, y - 2);

    // Field 13: Insured's Signature
    drawLabel('13. INSURED\'S OR AUTHORIZED PERSON\'S SIGNATURE I authorize payment of medical benefits to the', midX + 4, y + 20);
    drawLabel('undersigned physician or supplier for services described below.', midX + 4, y + 12);
    drawText('SIGNED', midX + 4, y, 8, boldFont);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // ── Fields 14-23: Dates, Referral, Auth ─────────────────────────────────
    // Field 14: Date of Current Illness
    y -= 10;
    drawLabel('14. DATE OF CURRENT ILLNESS, INJURY, or PREGNANCY (LMP):', leftX + 2, y);
    drawLabel('QUAL', leftX + 200, y);
    y -= 12;
    drawValue(fmtDate((superbill as any).dateOfIllness), leftX + 2, y);
    drawLine(leftX, y - 2, midX, y - 2);

    // Field 15: Other Date
    drawLabel('15. OTHER DATE', midX + 4, y + 10);
    drawLabel('QUAL', midX + 80, y + 10);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // Field 16: Dates Unable to Work
    y -= 10;
    drawLabel('16. DATES PATIENT UNABLE TO WORK IN CURRENT OCCUPATION', leftX + 2, y);
    drawLabel('FROM', leftX + 180, y);
    drawLabel('TO', leftX + 230, y);
    y -= 12;
    drawLine(leftX, y - 2, midX, y - 2);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // Field 17: Referring Provider + 17b NPI
    y -= 10;
    drawLabel('17. NAME OF REFERRING PROVIDER OR OTHER SOURCE', leftX + 2, y);
    drawLabel('17b. NPI', midX + 4, y);
    y -= 12;
    drawValue((superbill as any).referringProviderName || '', leftX + 2, y);
    drawValue((superbill as any).referringProviderNPI || '', midX + 4, y);
    drawLine(leftX, y - 2, midX, y - 2);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // Field 18: Hospitalization Dates
    y -= 10;
    drawLabel('18. HOSPITALIZATION DATES RELATED TO CURRENT SERVICES', leftX + 2, y);
    drawLabel('FROM', leftX + 200, y);
    drawLabel('TO', leftX + 250, y);
    y -= 12;
    drawValue(fmtDate(superbill.admissionDate), leftX + 200, y, 8);
    drawValue(fmtDate(superbill.dischargeDate), leftX + 250, y, 8);
    drawLine(leftX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // Field 19: Additional Claim Info
    y -= 10;
    drawLabel('19. ADDITIONAL CLAIM INFORMATION (Designated by NUCC)', leftX + 2, y);
    y -= 12;
    drawLine(leftX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // Field 20: Outside Lab
    y -= 10;
    drawLabel('20. OUTSIDE LAB?', leftX + 2, y);
    drawLabel('YES', leftX + 70, y);
    drawLabel('NO', leftX + 95, y);
    drawLabel('$ CHARGES', leftX + 120, y);
    y -= 12;
    drawCheckbox((superbill as any).outsideLab === true, leftX + 70, y); drawText('YES', leftX + 78, y, 7, smallFont);
    drawCheckbox((superbill as any).outsideLab === false, leftX + 95, y); drawText('NO', leftX + 103, y, 7, smallFont);
    drawValue(fmtMoney((superbill as any).outsideLabCharges), leftX + 120, y);
    drawLine(leftX, y - 2, midX, y - 2);

    // Field 21: Diagnosis (right side)
    drawLabel('21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY', midX + 4, y + 10);
    drawLabel('Relate A-L to service line below (24E)', midX + 4, y + 3);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // Field 21 diagnosis values (A-L)
    y -= 10;
    const dxLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const diagnoses = superbill.diagnoses || [];
    const dxColW = (FORM_W / 2 - 8) / 4;
    for (let i = 0; i < Math.min(diagnoses.length, 12); i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const dxX = midX + 4 + col * dxColW;
      const dxY = y - row * 14;
      drawText(dxLetters[i] + '.', dxX, dxY, 7, boldFont);
      drawValue(diagnoses[i].icdCode, dxX + 10, dxY, 8);
    }
    // ICD Indicator
    drawLabel('ICD Ind.', midX + 4, y - 44);
    drawValue('0', midX + 40, y - 44, 8); // ICD-10 indicator

    y -= 56;
    drawLine(leftX, y, rightX, y);

    // Field 22: Resubmission Code + Original Ref No
    y -= 10;
    drawLabel('22. RESUBMISSION CODE', leftX + 2, y);
    drawLabel('ORIGINAL REF. NO.', leftX + 100, y);
    y -= 12;
    drawValue((superbill as any).resubmissionCode || '', leftX + 2, y);
    drawValue((superbill as any).originalRefNo || '', leftX + 100, y);
    drawLine(leftX, y - 2, midX, y - 2);

    // Field 23: Prior Authorization Number
    drawLabel('23. PRIOR AUTHORIZATION NUMBER', midX + 4, y + 10);
    drawValue((superbill as any).priorAuthNumber || superbill.referralNumber || '', midX + 4, y);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // ── Field 24: Service Lines (A-J columns) ───────────────────────────────
    y -= 12;
    // Column headers
    const col24A = leftX + 2;       // Date(s) of Service
    const col24B = leftX + 60;      // Place of Service
    const col24C = leftX + 80;      // EMG
    const col24D = leftX + 95;      // CPT/HCPCS + Modifier
    const col24E = leftX + 200;     // Diagnosis Pointer
    const col24F = leftX + 230;     // $ Charges
    const col24G = leftX + 280;     // Days or Units
    const col24H = leftX + 305;     // EPSDT Family Plan
    const col24I = leftX + 330;     // ID Qualifier
    const col24J = leftX + 350;     // Rendering Provider ID

    drawLabel('24.a DATE(S) OF SERVICE', col24A, y);
    drawLabel('b. POS', col24B, y);
    drawLabel('c. EMG', col24C, y);
    drawLabel('d. PROCEDURES, SERVICES, OR SUPPLIES (CPT/HCPCS) MODIFIER', col24D, y);
    drawLabel('e. DX PTR', col24E, y);
    drawLabel('f. $ CHARGES', col24F, y);
    drawLabel('g. DAYS OR UNITS', col24G, y);
    drawLabel('h. EPSDT', col24H, y);
    drawLabel('i. ID. QUAL.', col24I, y);
    drawLabel('j. RENDERING PROVIDER ID #', col24J, y);
    y -= 10;
    drawLine(leftX, y, rightX, y);

    // Service line rows (up to 6)
    const procedures = superbill.procedures || [];
    for (let i = 0; i < Math.min(procedures.length, 6); i++) {
      const p = procedures[i];
      y -= 12;
      // 24a: Date(s) of Service (FROM - TO)
      drawValue(fmtDate(p.serviceDate || superbill.serviceDate), col24A, y, 7);
      // 24b: Place of Service
      drawValue(superbill.posCode || '11', col24B, y, 8);
      // 24d: CPT/HCPCS + Modifiers
      drawValue(p.cptCode, col24D, y, 8);
      const mods = (p.modifiers || []).join(' ');
      if (mods) drawText(mods, col24D + 50, y, 7, smallFont);
      // 24e: Diagnosis Pointer
      drawValue((p.diagnosisPointer || []).map(n => dxLetters[parseInt(n) - 1] || n).join(' '), col24E, y, 8);
      // 24f: $ Charges
      drawValue(fmtMoney(p.charge), col24F, y, 8);
      // 24g: Days or Units
      drawValue(String(p.units || 1), col24G, y, 8);
      // 24j: Rendering Provider ID
      drawValue((superbill as any).renderingProviderId || superbill.providerNPI || '', col24J, y, 7);
      y -= 4;
      drawLine(leftX, y, rightX, y);
    }

    // Fill remaining empty rows
    for (let i = procedures.length; i < 6; i++) {
      y -= 12;
      y -= 4;
      drawLine(leftX, y, rightX, y);
    }

    // ── Fields 25-30: Tax Info, Account No, Assignment, Totals ──────────────
    y -= 10;
    // 25. Federal Tax ID
    drawLabel('25. FEDERAL TAX I.D. NUMBER', leftX + 2, y);
    drawLabel('SSN', leftX + 120, y);
    drawLabel('EIN', leftX + 150, y);
    y -= 12;
    drawValue(superbill.providerTaxId || '', leftX + 2, y, 8);
    drawCheckbox(false, leftX + 120, y); // SSN
    drawCheckbox(true, leftX + 150, y);  // EIN
    drawLine(leftX, y - 2, midX, y - 2);

    // 26. Patient's Account No
    drawLabel('26. PATIENT\'S ACCOUNT NO.', midX + 4, y + 10);
    drawValue((superbill as any).patientAccountNo || superbill.patientId?.slice(0, 12) || '', midX + 4, y);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // 27. Accept Assignment
    y -= 10;
    drawLabel('27. ACCEPT ASSIGNMENT?', leftX + 2, y);
    drawLabel('YES', leftX + 120, y);
    drawLabel('NO', leftX + 150, y);
    y -= 12;
    const acceptAssign = (superbill as any).acceptAssignment !== false;
    drawCheckbox(acceptAssign, leftX + 120, y); drawText('YES', leftX + 128, y, 7, smallFont);
    drawCheckbox(!acceptAssign, leftX + 150, y); drawText('NO', leftX + 158, y, 7, smallFont);
    drawLine(leftX, y - 2, midX, y - 2);

    // 28. Total Charge + 29. Amount Paid + 30. Reserved
    drawLabel('28. TOTAL CHARGE', midX + 4, y + 10);
    drawLabel('29. AMOUNT PAID', midX + 90, y + 10);
    drawLabel('30. Rsvd for NUCC Use', midX + 170, y + 10);
    drawValue(fmtMoney(superbill.totalAmount), midX + 4, y);
    drawValue(fmtMoney((superbill as any).amountPaid), midX + 90, y);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // ── Fields 31-33: Signatures & Provider Info ────────────────────────────
    // Field 31: Signature of Physician
    y -= 10;
    drawLabel('31. SIGNATURE OF PHYSICIAN OR SUPPLIER INCLUDING DEGREES OR CREDENTIALS', leftX + 2, y);
    drawLabel('DATE', leftX + 300, y);
    y -= 12;
    drawValue((superbill as any).physicianSignature || superbill.providerName || '', leftX + 2, y, 8);
    drawValue(fmtDate((superbill as any).physicianSignatureDate || superbill.serviceDate), leftX + 300, y, 8);
    y -= 4;
    drawLine(leftX, y, midX, y);

    // Field 32: Service Facility Location
    drawLabel('32. SERVICE FACILITY LOCATION INFORMATION', midX + 4, y + 10);
    drawLabel('a. NPI', midX + 4, y + 2);
    y -= 12;
    drawValue(superbill.facilityName || '', midX + 4, y, 8);
    drawValue(superbill.facilityNPI || '', midX + 40, y, 8);
    drawLine(midX, y - 2, rightX, y - 2);
    y -= 8;
    drawLine(leftX, y, rightX, y);

    // Field 33: Billing Provider Info
    y -= 10;
    drawLabel('33. BILLING PROVIDER INFO & PH #', leftX + 2, y);
    drawLabel('a. NPI', leftX + 200, y);
    drawLabel('b. Other ID', leftX + 260, y);
    y -= 12;
    drawValue(superbill.providerName || '', leftX + 2, y, 8);
    const provAddr = superbill.providerAddress;
    if (provAddr) {
      drawText(`${provAddr.street || ''}, ${provAddr.city || ''}, ${provAddr.state || ''} ${provAddr.zipCode || ''}`, leftX + 2, y - 10, 7, smallFont);
    }
    drawValue(superbill.providerNPI || '', leftX + 200, y, 8);
    drawLine(leftX, y - 2, rightX, y - 2);

    // Bottom border
    y -= 20;
    drawLine(leftX, y, rightX, y);

    // Footer
    y -= 12;
    drawText('NUCC Instruction Manual available at: www.nucc.org', leftX, y, 6, smallFont, rgb(0.4, 0.4, 0.4));
    drawText('PLEASE PRINT OR TYPE', rightX - 80, y, 6, smallFont, rgb(0.4, 0.4, 0.4));

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
