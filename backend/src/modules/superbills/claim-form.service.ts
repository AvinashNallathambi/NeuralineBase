import { Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SuperbillsService } from './superbills.service';

@Injectable()
export class ClaimFormService {
  constructor(private readonly superbillsService: SuperbillsService) {}

  async generateCms1500(id: string): Promise<Buffer> {
    const superbill = await this.superbillsService.findOne(id);

    if (!superbill) {
      throw new NotFoundException('Superbill not found');
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);

    const startX = 36;
    const startY = height - 36;
    let y = startY;

    const drawText = (text: string, x: number, y2: number, size = 9, f = font) => {
      page.drawText(text, { x, y: y2, size, font: f, color: black });
    };

    const drawLabel = (text: string, x: number, y2: number) => {
      drawText(text, x, y2, 7, font);
      return y2 - 9;
    };

    const drawField = (text: string, x: number, y2: number) => {
      drawText(text, x, y2, 10, boldFont);
      return y2 - 14;
    };

    const drawLine = (y2: number, x1 = startX, x2 = width - 36) => {
      page.drawLine({ start: { x: x1, y: y2 }, end: { x: x2, y: y2 }, thickness: 0.5, color: gray });
    };

    drawText('CMS-1500 Health Insurance Claim Form', startX, y, 16, boldFont);
    y -= 30;
    drawLine(y);

    // Patient / insured block
    const leftCol = startX;
    const rightCol = width / 2 + 18;

    y = drawLabel("1. Patient's Name (Last, First, Middle)", leftCol, y);
    y = drawField(
      `${superbill.patientName || ''}`,
      leftCol,
      y,
    );
    y = drawLabel("2. Patient's Date of Birth (MM | DD | YYYY)", leftCol, y);
    y = drawField(superbill.patientDOB ? new Date(superbill.patientDOB).toLocaleDateString() : '', leftCol, y);
    y = drawLabel("3. Patient's Address", leftCol, y);
    y = drawField(
      superbill.patientAddress
        ? `${superbill.patientAddress.street}, ${superbill.patientAddress.city}, ${superbill.patientAddress.state} ${superbill.patientAddress.zipCode}`
        : '',
      leftCol,
      y,
    );
    y = drawLabel("4. Patient's Phone", leftCol, y);
    y = drawField(superbill.patientPhone || '', leftCol, y);

    // Right column
    let y2 = drawLabel("1a. Insured's ID Number", rightCol, y + 88);
    y2 = drawField(superbill.insurance?.policyNumber || '', rightCol, y2);
    y2 = drawLabel("2. Insured's Name", rightCol, y2);
    y2 = drawField(superbill.insurance?.subscriberName || '', rightCol, y2);
    y2 = drawLabel("3. Insurance Plan / Payer", rightCol, y2);
    y2 = drawField(superbill.insurance?.provider || '', rightCol, y2);
    y2 = drawLabel("4. Payer ID", rightCol, y2);
    y2 = drawField(superbill.insurance?.payerId || '', rightCol, y2);

    y = Math.min(y, y2);
    y -= 10;
    drawLine(y);

    // Provider / claim data
    y = drawLabel("5. Provider Name", leftCol, y);
    y = drawField(superbill.providerName || '', leftCol, y);
    y = drawLabel("6. Provider NPI", leftCol, y);
    y = drawField(superbill.providerNPI || '', leftCol, y);
    y = drawLabel("7. Provider Address", leftCol, y);
    y = drawField(
      superbill.providerAddress
        ? `${superbill.providerAddress.street}, ${superbill.providerAddress.city}, ${superbill.providerAddress.state} ${superbill.providerAddress.zipCode}`
        : '',
      leftCol,
      y,
    );
    y = drawLabel("8. Provider Tax ID", leftCol, y);
    y = drawField(superbill.providerTaxId || '', leftCol, y);

    y2 = drawLabel("9. Place of Service (POS)", rightCol, y + 74);
    y2 = drawField(superbill.posCode || '', rightCol, y2);
    y2 = drawLabel("10. Facility Name", rightCol, y2);
    y2 = drawField(superbill.facilityName || '', rightCol, y2);
    y2 = drawLabel("11. Facility NPI", rightCol, y2);
    y2 = drawField(superbill.facilityNPI || '', rightCol, y2);
    y2 = drawLabel("12. Referral Number", rightCol, y2);
    y2 = drawField(superbill.referralNumber || '', rightCol, y2);

    y = Math.min(y, y2);
    y -= 10;
    drawLine(y);

    // Diagnoses
    y = drawLabel("Diagnosis / Nature of Illness (ICD-10)", leftCol, y);
    let dxY = y;
    for (const dx of superbill.diagnoses || []) {
      dxY = drawField(`${dx.icdCode} - ${dx.description}`, leftCol, dxY);
    }
    y = dxY;

    // Procedure lines
    y -= 10;
    drawLine(y);
    y = drawLabel("Service Lines (CPT/HCPCS)", leftCol, y);
    y = drawLabel(
      "Date(s) of Service | POS | CPT | Mod | Diagnosis Pointer | Charges | Units",
      leftCol,
      y,
    );
    let lineY = y;
    for (const p of superbill.procedures || []) {
      const date = p.serviceDate
        ? new Date(p.serviceDate).toLocaleDateString()
        : '';
      const dxPointer = (p.diagnosisPointer || []).join(',');
      const modifiers = (p.modifiers || []).join(',');
      const line = `${date} | ${superbill.posCode || ''} | ${p.cptCode} | ${modifiers} | ${dxPointer} | $${p.charge} | ${p.units}`;
      lineY = drawField(line, leftCol, lineY);
    }
    for (const c of superbill.charges || []) {
      const line = `Additional | ${c.type} | $${c.amount}`;
      lineY = drawField(line, leftCol, lineY);
    }
    y = lineY;

    y -= 10;
    drawLine(y);

    y = drawLabel("Total Charges", rightCol - 100, y);
    y = drawField(`$${Number(superbill.totalAmount || 0).toFixed(2)}`, rightCol - 100, y);
    y = drawLabel("Patient Responsibility", rightCol - 100, y);
    y = drawField(`$${Number(superbill.patientResponsibility || 0).toFixed(2)}`, rightCol - 100, y);
    y = drawLabel("Insurance Payment", rightCol - 100, y);
    y = drawField(`$${Number(superbill.insurancePayment || 0).toFixed(2)}`, rightCol - 100, y);
    y = drawLabel("Balance", rightCol - 100, y);
    y = drawField(`$${Number(superbill.balance || 0).toFixed(2)}`, rightCol - 100, y);

    y -= 10;
    drawLine(y);

    y = drawLabel("Patient Signature / Authorization", leftCol, y);
    y = drawField(superbill.insurance?.authorizationNumber || '', leftCol, y);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
