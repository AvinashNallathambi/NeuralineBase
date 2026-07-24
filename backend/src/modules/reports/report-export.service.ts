import { Injectable } from '@nestjs/common';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

export interface ExportData {
  filename: string;
  title: string;
  columns: string[];
  rows: Array<Record<string, any>>;
}

@Injectable()
export class ReportExportService {
  /**
   * Convert export data to the requested format and return
   * { contentType, buffer } for the controller to send.
   */
  async export(data: ExportData, format: ExportFormat): Promise<{ contentType: string; buffer: Buffer; filename: string }> {
    switch (format) {
      case 'csv':
        return this.exportCsv(data);
      case 'excel':
        // Excel-compatible CSV (Excel opens .csv natively; .xls extension also works)
        return this.exportCsv(data, 'excel');
      case 'pdf':
        return this.exportPdf(data);
      case 'json':
      default:
        return this.exportJson(data);
    }
  }

  private exportCsv(data: ExportData, variant: 'csv' | 'excel' = 'csv'): { contentType: string; buffer: Buffer; filename: string } {
    const sep = variant === 'excel' ? '\t' : ',';
    const ext = variant === 'excel' ? '.xls' : '.csv';
    const mimeType = variant === 'excel' ? 'application/vnd.ms-excel' : 'text/csv';

    const header = data.columns.map((c) => this.escapeCsv(c, sep)).join(sep);
    const lines = data.rows.map((row) =>
      data.columns.map((col) => this.escapeCsv(row[col] ?? '', sep)).join(sep),
    );

    // Prepend a title line for Excel variant
    const content = variant === 'excel'
      ? `${data.title}\n${header}\n${lines.join('\n')}\n`
      : `${header}\n${lines.join('\n')}\n`;

    return {
      contentType: `${mimeType}; charset=utf-8`,
      buffer: Buffer.from(content, 'utf-8'),
      filename: `${data.filename}${ext}`,
    };
  }

  private escapeCsv(value: any, sep: string): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If contains separator, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(sep) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private exportJson(data: ExportData): { contentType: string; buffer: Buffer; filename: string } {
    return {
      contentType: 'application/json; charset=utf-8',
      buffer: Buffer.from(JSON.stringify({ title: data.title, columns: data.columns, rows: data.rows }, null, 2), 'utf-8'),
      filename: `${data.filename}.json`,
    };
  }

  /**
   * Generate a simple printable HTML document that the browser can
   * save as PDF via window.print(). This avoids heavy PDF dependencies.
   * The HTML is structured for clean printing.
   */
  private exportPdf(data: ExportData): { contentType: string; buffer: Buffer; filename: string } {
    const headerCells = data.columns.map((c) => `<th>${this.escapeHtml(c)}</th>`).join('');
    const bodyRows = data.rows
      .map((row) => `<tr>${data.columns.map((c) => `<td>${this.escapeHtml(row[c] ?? '')}</td>`).join('')}</tr>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${this.escapeHtml(data.title)}</title>
<style>
  @page { margin: 1in; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; }
  h1 { font-size: 20px; border-bottom: 2px solid #0D7C8A; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
  th { background: #0D7C8A; color: #fff; padding: 8px 10px; text-align: left; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; }
</style>
</head>
<body>
<h1>${this.escapeHtml(data.title)}</h1>
<p>Generated: ${new Date().toISOString()}</p>
<table>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
<div class="footer">Neuraline EMR — Confidential</div>
</body>
</html>`;

    return {
      contentType: 'text/html; charset=utf-8',
      buffer: Buffer.from(html, 'utf-8'),
      filename: `${data.filename}.html`,
    };
  }

  private escapeHtml(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Flatten a nested report object into tabular rows for export.
   * Extracts array-of-objects fields into separate export sections.
   */
  flattenReport(report: any, titlePrefix: string): ExportData[] {
    const sections: ExportData[] = [];

    for (const [key, value] of Object.entries(report)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        const columns = Object.keys(value[0]);
        sections.push({
          filename: `${titlePrefix}-${key}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          title: `${titlePrefix} — ${key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}`,
          columns,
          rows: value,
        });
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Flatten KPI objects into a single-row table
        const kpiObj = value as Record<string, any>;
        const columns = Object.keys(kpiObj);
        if (columns.length > 0 && columns.every((c) => typeof kpiObj[c] !== 'object')) {
          sections.push({
            filename: `${titlePrefix}-${key}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            title: `${titlePrefix} — ${key.toUpperCase()}`,
            columns,
            rows: [kpiObj],
          });
        }
      }
    }

    return sections;
  }
}
