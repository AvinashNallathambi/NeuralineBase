import React, { useState, useEffect, useRef } from 'react';
import { Button, Space, Spin, message } from 'antd';
import { PrinterOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { superbillService } from '../../services/superbillService';

/**
 * Cms1500FormPage — Interactive pixel-perfect CMS-1500 (02/12) claim form.
 *
 * Renders the official NUCC CMS-1500 layout as a React component with
 * CSS Grid. Pre-fills from superbill data when a superbill ID is provided.
 * Supports print-to-PDF via browser print.
 *
 * Reference: https://www.nucc.org/images/stories/PDF/1500_claim_form_2012_02.pdf
 */

const OCR_RED = '#e53935';

const Cms1500FormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const sb = await superbillService.findOne(id);
        setData(sb);
      } catch {
        message.error('Failed to load superbill data');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const blob = await superbillService.downloadCms1500(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cms1500-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('CMS-1500 PDF downloaded');
    } catch (error: any) {
      message.error('Failed to download: ' + (error?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // ── Data helpers ──────────────────────────────────────────────────────────
  const sb: any = data;
  const val = (field: string) => (sb?.[field] ?? '');
  const insVal = (field: string) => (sb?.insurance?.[field] ?? '');
  const anyVal = (field: string) => (sb?.[field] ?? '');

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${mm} ${dd} ${yy}`;
  };

  const fmtMoney = (n: number | null | undefined) => {
    if (n === null || n === undefined) return '';
    return Number(n).toFixed(2);
  };

  const procedures = sb?.procedures || [];
  const diagnoses = sb?.diagnoses || [];
  const dxLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  // Fill 6 service line rows
  const serviceRows = Array.from({ length: 6 }, (_, i) => procedures[i] || null);

  // ── Shared CSS ────────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    color: OCR_RED,
    fontSize: '5.5pt',
    lineHeight: 1.15,
    fontWeight: 400,
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '9pt',
    color: '#000',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    width: '100%',
    padding: 0,
  };

  const checkboxStyle: React.CSSProperties = {
    appearance: 'none',
    WebkitAppearance: 'none',
    width: 9,
    height: 9,
    border: `1px solid ${OCR_RED}`,
    background: 'transparent',
    cursor: 'pointer',
    position: 'relative',
    flexShrink: 0,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading && !sb) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ background: '#f0f0f0', minHeight: '100vh', padding: '20px' }}>
      <style>{`
        @page { size: letter; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          .cms1500-print-area, .cms1500-print-area * { visibility: visible; }
          .cms1500-print-area { position: absolute; left: 0; top: 0; margin: 0 !important; }
          .no-print { display: none !important; }
        }
        .cms1500-input:focus { background: #fffde7 !important; }
        .cms1500-checkbox:checked::after {
          content: '✓'; position: absolute; top: -3px; left: 0px;
          font-size: 10px; color: #000; font-weight: bold;
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ maxWidth: '8.5in', margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
          <h2 style={{ margin: 0 }}>CMS-1500 Claim Form</h2>
        </Space>
        <Space>
          {id && (
            <Button icon={<DownloadOutlined />} onClick={handleDownloadPdf} loading={loading}>
              Download Backend PDF
            </Button>
          )}
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            Print / Save as PDF
          </Button>
        </Space>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
           CMS-1500 FORM — 8.5" × 11"
           ═══════════════════════════════════════════════════════════════════════ */}
      <div className="cms1500-print-area" style={{
        width: '8.5in', minHeight: '11in', background: '#fff',
        margin: '0 auto', position: 'relative', overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}>
        <div style={{
          position: 'absolute', top: '0.5in', left: '0.25in', right: '0.25in', bottom: '0.3in',
          border: `1.5px solid ${OCR_RED}`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.2in 1fr 1.5in',
            borderBottom: `1px solid ${OCR_RED}`, height: '0.45in',
          }}>
            {/* Barcode area */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '5pt', color: OCR_RED, lineHeight: 1, letterSpacing: '-0.5px' }}>||||||| || |||| ||||| ||| |||| ||| ||||| || ||||| ||| |||| |||</div>
              <div style={{ fontSize: '5pt', color: OCR_RED, textAlign: 'center' }}>PICA</div>
            </div>
            {/* Title */}
            <div style={{ padding: '2px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '11pt', fontWeight: 700, color: OCR_RED, letterSpacing: '0.5px' }}>HEALTH INSURANCE CLAIM FORM</div>
              <div style={{ fontSize: '5.5pt', color: OCR_RED, marginTop: '1px' }}>APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12</div>
              <div style={{ fontSize: '6pt', color: OCR_RED, marginTop: '2px', fontStyle: 'italic' }}>PLEASE PRINT OR TYPE</div>
            </div>
            {/* OMB + Carrier */}
            <div style={{ borderLeft: `1px solid ${OCR_RED}`, padding: '2px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '6pt', color: OCR_RED, textAlign: 'right' }}>APPROVED OMB-0938-1197 FORM 1500 (02-12)</div>
              <div style={{ flex: 1, border: `1px solid ${OCR_RED}`, marginTop: '2px' }} />
            </div>
          </div>

          {/* ── Box 1: Insurance Program ───────────────────────────────────── */}
          <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '3px 4px 4px' }}>
            <div style={{ fontSize: '6pt', color: OCR_RED, fontWeight: 700, marginBottom: '2px' }}>
              1.&nbsp;&nbsp;<span style={{ fontWeight: 400 }}>Select the appropriate program:</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto auto' }}>
              {[
                ['medicare', 'MEDICARE', '(Medicare #)'],
                ['medicaid', 'MEDICAID', '(Medicaid #)'],
                ['tricare', 'TRICARE', '(Member ID #)'],
                ['champva', 'CHAMPVA', '(Member ID #)'],
                ['group_health_plan', 'GROUP HEALTH PLAN', '(ID#)'],
                ['feca', 'FECA', '(ID#)'],
                ['blk_lung', 'BLK LUNG', '(ID#)'],
                ['other', 'OTHER', '(ID#)'],
              ].map(([key, label, sub]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '1px 4px' }}>
                  <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={anyVal('insuranceProgram') === key} readOnly />
                  <div>
                    <span style={{ fontSize: '6.5pt', color: OCR_RED, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: '5pt', color: OCR_RED, display: 'block', lineHeight: 1 }}>{sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Box 1a: Insured's ID ───────────────────────────────────────── */}
          <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '0.22in' }}>
            <span style={labelStyle}>1a. INSURED'S I.D. NUMBER (For Program in Item 1)</span>
            <input className="cms1500-input" style={inputStyle} defaultValue={insVal('policyNumber')} />
          </div>

          {/* ── Two-column: Patient (left) / Insured (right) ────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${OCR_RED}` }}>
            {/* ── LEFT COLUMN (Patient) ─────────────────────────────────────── */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, display: 'flex', flexDirection: 'column' }}>
              {/* Box 2: Patient Name */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>2. PATIENT'S NAME (Last Name, First Name, Middle Initial)</div>
                <input className="cms1500-input" style={inputStyle} defaultValue={val('patientName')} />
              </div>
              {/* Box 3: DOB + Sex */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.5in', borderBottom: `1px solid ${OCR_RED}`, minHeight: '0.2in' }}>
                <div style={{ padding: '2px 4px', borderRight: `1px solid ${OCR_RED}` }}>
                  <div style={labelStyle}>3. PATIENT'S BIRTH DATE</div>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={fmtDate(val('patientDOB'))} />
                </div>
                <div style={{ padding: '2px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={labelStyle}>SEX</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[['M', anyVal('patientSex') === 'M'], ['F', anyVal('patientSex') === 'F']].map(([l, checked]) => (
                      <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                        <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={checked as boolean} readOnly />
                        <span style={{ fontSize: '7pt', color: OCR_RED, fontWeight: 600 }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Box 5: Address */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>5. PATIENT'S ADDRESS (No., Street)</div>
                <input className="cms1500-input" style={inputStyle} defaultValue={sb?.patientAddress?.street || ''} />
              </div>
              {/* City/State/Zip/Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.5in 0.7in 1fr', borderBottom: `1px solid ${OCR_RED}`, minHeight: '0.2in' }}>
                {[
                  ['CITY', sb?.patientAddress?.city || ''],
                  ['STATE', sb?.patientAddress?.state || ''],
                  ['ZIP CODE', sb?.patientAddress?.zipCode || ''],
                  ['TELEPHONE (Include Area Code)', val('patientPhone')],
                ].map(([label, value], i) => (
                  <div key={i} style={{ padding: '2px 4px', borderRight: i < 3 ? `1px solid ${OCR_RED}` : 'none' }}>
                    <div style={{ ...labelStyle, fontSize: '5pt' }}>{label}</div>
                    <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={value as string} />
                  </div>
                ))}
              </div>
              {/* Box 6: Relationship */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={labelStyle}>6. PATIENT RELATIONSHIP TO INSURED</span>
                {['Self', 'Spouse', 'Child', 'Other'].map((rel) => {
                  const relVal = (insVal('subscriberRelation') || '').toLowerCase();
                  const checked = relVal === rel.toLowerCase() || (rel === 'Child' && relVal === 'dependent');
                  return (
                    <div key={rel} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={checked} readOnly />
                      <span style={{ fontSize: '7pt', color: OCR_RED }}>{rel}</span>
                    </div>
                  );
                })}
              </div>
              {/* Box 7: Insured Address */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>7. INSURED'S ADDRESS (No., Street)</div>
                <input className="cms1500-input" style={inputStyle} defaultValue={anyVal('insuredAddress')?.street || sb?.patientAddress?.street || ''} />
              </div>
              {/* Insured City/State/Zip */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.5in 0.7in 1fr', borderBottom: `1px solid ${OCR_RED}`, minHeight: '0.2in' }}>
                {[
                  ['CITY', anyVal('insuredAddress')?.city || sb?.patientAddress?.city || ''],
                  ['STATE', anyVal('insuredAddress')?.state || sb?.patientAddress?.state || ''],
                  ['ZIP CODE', anyVal('insuredAddress')?.zipCode || sb?.patientAddress?.zipCode || ''],
                  ['TELEPHONE', ''],
                ].map(([label, value], i) => (
                  <div key={i} style={{ padding: '2px 4px', borderRight: i < 3 ? `1px solid ${OCR_RED}` : 'none' }}>
                    <div style={{ ...labelStyle, fontSize: '5pt' }}>{label}</div>
                    <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={value as string} />
                  </div>
                ))}
              </div>
              {/* Box 9: Other Insured */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>9. OTHER INSURED'S NAME (Last Name, First Name, Middle Initial)</div>
                <input className="cms1500-input" style={inputStyle} />
              </div>
              {/* Box 9a */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>9a. OTHER INSURED'S POLICY OR GROUP NUMBER</div>
                <input className="cms1500-input" style={inputStyle} />
              </div>
              {/* Box 9d */}
              <div style={{ padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>9d. INSURANCE PLAN NAME OR PROGRAM NAME</div>
                <input className="cms1500-input" style={inputStyle} />
              </div>
            </div>

            {/* ── RIGHT COLUMN (Insured) ────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Box 4: Insured Name */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>4. INSURED'S NAME (Last Name, First Name, Middle Initial)</div>
                <input className="cms1500-input" style={inputStyle} defaultValue={insVal('subscriberName')} />
              </div>
              {/* Box 11: Policy Group */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>11. INSURED'S POLICY GROUP OR FECA NUMBER</div>
                <input className="cms1500-input" style={inputStyle} defaultValue={insVal('groupNumber')} />
              </div>
              {/* Box 11a: DOB + Sex */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.5in', borderBottom: `1px solid ${OCR_RED}`, minHeight: '0.2in' }}>
                <div style={{ padding: '2px 4px', borderRight: `1px solid ${OCR_RED}` }}>
                  <div style={labelStyle}>a. INSURED'S DATE OF BIRTH</div>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={fmtDate(anyVal('insuredDOB') || val('patientDOB'))} />
                </div>
                <div style={{ padding: '2px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={labelStyle}>SEX</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[['M', (anyVal('insuredSex') || anyVal('patientSex')) === 'M'], ['F', (anyVal('insuredSex') || anyVal('patientSex')) === 'F']].map(([l, checked]) => (
                      <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                        <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={checked as boolean} readOnly />
                        <span style={{ fontSize: '7pt', color: OCR_RED, fontWeight: 600 }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Box 11b */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>b. OTHER CLAIM ID (Designated by NUCC)</div>
                <input className="cms1500-input" style={inputStyle} />
              </div>
              {/* Box 11c */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in' }}>
                <div style={labelStyle}>c. INSURANCE PLAN NAME OR PROGRAM NAME</div>
                <input className="cms1500-input" style={inputStyle} defaultValue={insVal('provider')} />
              </div>
              {/* Box 11d */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.2in', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={labelStyle}>d. IS THERE ANOTHER HEALTH BENEFIT PLAN?</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[['YES', false], ['NO', true]].map(([l, checked]) => (
                    <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                      <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={checked as boolean} readOnly />
                      <span style={{ fontSize: '6pt', color: OCR_RED }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Box 10: Condition Related To */}
              <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.55in' }}>
                <div style={labelStyle}>10. IS PATIENT'S CONDITION RELATED TO:</div>
                {[
                  ['a. EMPLOYMENT? (Current or Previous)', val('isEmploymentRelated')],
                  ['b. AUTO ACCIDENT?', val('isAutoAccident')],
                  ['c. OTHER ACCIDENT?', val('isOtherAccident')],
                ].map(([label, condition], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>{label}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[['YES', condition === true], ['NO', condition === false]].map(([l, checked]) => (
                        <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                          <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={checked as boolean} readOnly />
                          <span style={{ fontSize: '6pt', color: OCR_RED }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Box 10d */}
              <div style={{ padding: '2px 4px', minHeight: '0.2in', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={labelStyle}>10d. CLAIM CODES (Designated by NUCC)</span>
                <input className="cms1500-input" style={{ ...inputStyle, flex: 1 }} />
              </div>
            </div>
          </div>

          {/* ── Box 12 & 13: Signatures ────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${OCR_RED}`, minHeight: '0.55in' }}>
            <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '3px 4px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '5pt', color: OCR_RED, lineHeight: 1.2, marginBottom: '4px' }}>
                12. PATIENT'S OR AUTHORIZED PERSON'S SIGNATURE. I authorize the release of any medical or other<br />
                information necessary to process this claim. I also request payment of government benefits either to myself<br />
                or to the party who accepts assignment below.
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: 'auto' }}>
                <span style={{ fontSize: '7pt', color: OCR_RED, fontWeight: 600 }}>SIGNED</span>
                <div style={{ flex: 1, borderBottom: `1px solid ${OCR_RED}`, minHeight: '14px' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} />
                </div>
                <span style={{ fontSize: '6pt', color: OCR_RED }}>DATE</span>
                <div style={{ width: '0.8in', borderBottom: `1px solid ${OCR_RED}` }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={fmtDate(val('serviceDate'))} />
                </div>
              </div>
            </div>
            <div style={{ padding: '3px 4px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '5pt', color: OCR_RED, lineHeight: 1.2, marginBottom: '4px' }}>
                13. INSURED'S OR AUTHORIZED PERSON'S SIGNATURE I authorize payment of medical benefits to the<br />
                undersigned physician or supplier for services described below.
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: 'auto' }}>
                <span style={{ fontSize: '7pt', color: OCR_RED, fontWeight: 600 }}>SIGNED</span>
                <div style={{ flex: 1, borderBottom: `1px solid ${OCR_RED}`, minHeight: '14px' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Boxes 14-23: Dates & Diagnosis ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${OCR_RED}` }}>
            {/* Box 14 */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>14. DATE OF CURRENT ILLNESS, INJURY, or PREGNANCY (LMP):</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.7in', borderBottom: `1px solid ${OCR_RED}`, fontSize: '8pt' }} defaultValue={fmtDate(anyVal('dateOfIllness'))} />
              <span style={labelStyle}>QUAL</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.3in', textAlign: 'center', fontSize: '8pt' }} />
            </div>
            {/* Box 15 */}
            <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>15. OTHER DATE</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.7in', borderBottom: `1px solid ${OCR_RED}`, fontSize: '8pt' }} />
              <span style={labelStyle}>QUAL</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.3in', textAlign: 'center', fontSize: '8pt' }} />
            </div>
            {/* Box 16 */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>16. DATES PATIENT UNABLE TO WORK IN CURRENT OCCUPATION</span>
              <span style={{ ...labelStyle, fontSize: '5pt' }}>FROM</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.7in', borderBottom: `1px solid ${OCR_RED}`, fontSize: '8pt' }} />
              <span style={{ ...labelStyle, fontSize: '5pt' }}>TO</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.7in', borderBottom: `1px solid ${OCR_RED}`, fontSize: '8pt' }} />
            </div>
            {/* Box 17 */}
            <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={labelStyle}>17a. OTHER ID</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.8in', fontSize: '8pt' }} />
              <span style={labelStyle}>17b. NPI</span>
              <input className="cms1500-input" style={{ ...inputStyle, flex: 1, fontSize: '8pt' }} defaultValue={anyVal('referringProviderNPI')} />
            </div>
            {/* Box 17 (left) */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>17. NAME OF REFERRING PROVIDER OR OTHER SOURCE</span>
              <input className="cms1500-input" style={{ ...inputStyle, flex: 1 }} defaultValue={anyVal('referringProviderName')} />
            </div>
            {/* Box 18 (right) */}
            <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>18. HOSPITALIZATION DATES RELATED TO CURRENT SERVICES</span>
              <span style={{ ...labelStyle, fontSize: '5pt' }}>FROM</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.7in', borderBottom: `1px solid ${OCR_RED}`, fontSize: '8pt' }} defaultValue={fmtDate(val('admissionDate'))} />
              <span style={{ ...labelStyle, fontSize: '5pt' }}>TO</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.7in', borderBottom: `1px solid ${OCR_RED}`, fontSize: '8pt' }} defaultValue={fmtDate(val('dischargeDate'))} />
            </div>
            {/* Box 19 (full width) */}
            <div style={{ gridColumn: '1/-1', borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>19. ADDITIONAL CLAIM INFORMATION (Designated by NUCC)</span>
              <input className="cms1500-input" style={{ ...inputStyle, flex: 1 }} />
            </div>
            {/* Box 20 */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>20. OUTSIDE LAB?</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[['YES', anyVal('outsideLab') === true], ['NO', anyVal('outsideLab') === false]].map(([l, checked]) => (
                  <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                    <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={checked as boolean} readOnly />
                    <span style={{ fontSize: '6pt', color: OCR_RED }}>{l}</span>
                  </div>
                ))}
              </div>
              <span style={labelStyle}>$ CHARGES</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.7in', fontSize: '8pt' }} defaultValue={fmtMoney(anyVal('outsideLabCharges'))} />
            </div>
            {/* Box 21: Diagnosis */}
            <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.65in' }}>
              <div style={labelStyle}>21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY — Relate A-L to service line below (24E)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: '1px', marginTop: '2px' }}>
                {dxLetters.map((letter, i) => (
                  <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 2px' }}>
                    <span style={{ fontSize: '7pt', color: OCR_RED, fontWeight: 600, width: '10px', flexShrink: 0 }}>{letter}.</span>
                    <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={diagnoses[i]?.icdCode || ''} />
                  </div>
                )).flatMap((el, i) => {
                  // Insert ICD indicator after the 3rd cell (I.)
                  if (i === 3) return [
                    <div key="icdind" style={{ display: 'flex', alignItems: 'center', padding: '1px 2px' }}>
                      <span style={{ fontSize: '5pt', color: OCR_RED }}>ICD Ind.</span>
                      <input className="cms1500-input" style={{ ...inputStyle, width: '0.3in', fontSize: '7pt' }} defaultValue="0" />
                    </div>,
                    el,
                  ];
                  if (i === 7 || i === 11) return [el, <div key={`empty-${i}`} />];
                  return [el];
                })}
              </div>
            </div>
            {/* Box 22 */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>22. RESUBMISSION CODE</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '0.4in', fontSize: '8pt' }} defaultValue={anyVal('resubmissionCode')} />
              <span style={labelStyle}>ORIGINAL REF. NO.</span>
              <input className="cms1500-input" style={{ ...inputStyle, flex: 1, fontSize: '8pt' }} defaultValue={anyVal('originalRefNo')} />
            </div>
            {/* Box 23 */}
            <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>23. PRIOR AUTHORIZATION NUMBER</span>
              <input className="cms1500-input" style={{ ...inputStyle, flex: 1 }} defaultValue={anyVal('priorAuthNumber') || val('referralNumber')} />
            </div>
          </div>

          {/* ── Box 24: Service Lines ──────────────────────────────────────── */}
          <div style={{ borderBottom: `1px solid ${OCR_RED}` }}>
            {/* Column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '0.8in 0.35in 0.25in 1.1in 0.35in 0.55in 0.3in 0.35in 0.45in 0.6in',
              borderBottom: `1px solid ${OCR_RED}`, minHeight: '0.35in',
            }}>
              {[
                ['24.a', 'DATE(S) OF SERVICE', 'From  To\nMM DD YY'],
                ['24.b', '', 'PLACE OF SERVICE'],
                ['24.c', '', 'EMG'],
                ['24.d', 'PROCEDURES, SERVICES, OR SUPPLIES', '(Explain Unusual Circumstances)\nCPT/HCPCS    MODIFIER'],
                ['24.e', '', 'DIAGNOSIS POINTER'],
                ['24.f', '', '$ CHARGES'],
                ['24.g', '', 'DAYS OR UNITS'],
                ['24.h', '', 'EPSDT\nFamily\nPlan'],
                ['24.i', '', 'ID. QUAL.'],
                ['24.j', '', 'RENDERING PROVIDER ID #'],
              ].map(([num, title, sub], i) => (
                <div key={i} style={{ borderRight: i < 9 ? `1px solid ${OCR_RED}` : 'none', padding: '2px 2px' }}>
                  <div style={{ fontSize: '5pt', color: OCR_RED, fontWeight: 600, lineHeight: 1.1 }}>{num} {title}</div>
                  <div style={{ fontSize: '4.5pt', color: OCR_RED, lineHeight: 1, whiteSpace: 'pre-line' }}>{sub}</div>
                </div>
              ))}
            </div>
            {/* 6 service rows */}
            {serviceRows.map((proc, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '0.8in 0.35in 0.25in 1.1in 0.35in 0.55in 0.3in 0.35in 0.45in 0.6in',
                borderBottom: i < 5 ? `1px solid ${OCR_RED}` : 'none',
                minHeight: '0.22in',
                background: i % 2 === 0 ? 'rgba(229, 57, 53, 0.04)' : 'transparent',
              }}>
                {/* 24A: Date From/To */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '1px 1px' }}>
                  <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '0 1px' }}>
                    <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt' }} defaultValue={proc ? fmtDate(proc.serviceDate || sb?.serviceDate) : ''} />
                  </div>
                  <div style={{ padding: '0 1px' }}>
                    <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt' }} />
                  </div>
                </div>
                {/* 24B: POS */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '1px 2px', display: 'flex', alignItems: 'center' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt', textAlign: 'center' }} defaultValue={proc ? (val('posCode') || '11') : ''} />
                </div>
                {/* 24C: EMG */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '1px 2px', display: 'flex', alignItems: 'center' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt', textAlign: 'center' }} />
                </div>
                {/* 24D: CPT + Modifier */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, display: 'grid', gridTemplateColumns: '1fr 0.35in', padding: '1px 1px' }}>
                  <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '0 1px' }}>
                    <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7.5pt' }} defaultValue={proc?.cptCode || ''} />
                  </div>
                  <div style={{ padding: '0 1px' }}>
                    <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt' }} defaultValue={proc ? (proc.modifiers || []).join(' ') : ''} />
                  </div>
                </div>
                {/* 24E: Dx Pointer */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '1px 2px', display: 'flex', alignItems: 'center' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7.5pt', textAlign: 'center' }} defaultValue={proc ? (proc.diagnosisPointer || []).map((n: string) => dxLetters[parseInt(n) - 1] || n).join('') : ''} />
                </div>
                {/* 24F: Charges */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '1px 2px', display: 'flex', alignItems: 'center' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7.5pt' }} defaultValue={proc ? fmtMoney(proc.charge) : ''} />
                </div>
                {/* 24G: Units */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '1px 2px', display: 'flex', alignItems: 'center' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7.5pt', textAlign: 'center' }} defaultValue={proc ? String(proc.units || 1) : ''} />
                </div>
                {/* 24H: EPSDT */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '1px 2px', display: 'flex', alignItems: 'center' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt', textAlign: 'center' }} />
                </div>
                {/* 24I: ID Qual */}
                <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '1px 2px', display: 'flex', alignItems: 'center' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt', textAlign: 'center' }} />
                </div>
                {/* 24J: Rendering Provider ID */}
                <div style={{ padding: '1px 2px', display: 'flex', alignItems: 'center' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt' }} defaultValue={proc ? (anyVal('renderingProviderId') || val('providerNPI')) : ''} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Boxes 25-33: Footer ────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {/* Box 25 */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>25. FEDERAL TAX I.D. NUMBER</span>
              <input className="cms1500-input" style={{ ...inputStyle, width: '1in', borderBottom: `1px solid ${OCR_RED}`, fontSize: '8pt' }} defaultValue={val('providerTaxId')} />
              <div style={{ display: 'flex', gap: '4px' }}>
                {[['SSN', false], ['EIN', true]].map(([l, checked]) => (
                  <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                    <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={checked as boolean} readOnly />
                    <span style={{ fontSize: '6pt', color: OCR_RED }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Box 26 */}
            <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={labelStyle}>26. PATIENT'S ACCOUNT NO.</span>
              <input className="cms1500-input" style={{ ...inputStyle, flex: 1 }} defaultValue={anyVal('patientAccountNo') || (val('patientId')?.slice(0, 12) || '')} />
            </div>
            {/* Box 27 */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.22in', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={labelStyle}>27. ACCEPT ASSIGNMENT?</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[['YES', anyVal('acceptAssignment') !== false], ['NO', anyVal('acceptAssignment') === false]].map(([l, checked]) => (
                  <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                    <input type="checkbox" className="cms1500-checkbox" style={checkboxStyle} checked={checked as boolean} readOnly />
                    <span style={{ fontSize: '6pt', color: OCR_RED }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Box 28-30 */}
            <div style={{ borderBottom: `1px solid ${OCR_RED}`, display: 'grid', gridTemplateColumns: '1fr 1fr 0.8in', minHeight: '0.22in' }}>
              <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={labelStyle}>28. TOTAL CHARGE $</span>
                <input className="cms1500-input" style={{ ...inputStyle, flex: 1, fontSize: '8pt' }} defaultValue={fmtMoney(val('totalAmount'))} />
              </div>
              <div style={{ borderRight: `1px solid ${OCR_RED}`, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={labelStyle}>29. AMOUNT PAID $</span>
                <input className="cms1500-input" style={{ ...inputStyle, flex: 1, fontSize: '8pt' }} defaultValue={fmtMoney(anyVal('amountPaid'))} />
              </div>
              <div style={{ padding: '2px 4px' }}>
                <span style={{ ...labelStyle, fontSize: '5pt' }}>30. Rsvd for NUCC Use</span>
              </div>
            </div>
            {/* Box 31: Physician Signature */}
            <div style={{ borderRight: `1px solid ${OCR_RED}`, borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.3in', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '5pt', color: OCR_RED, lineHeight: 1.2 }}>
                31. SIGNATURE OF PHYSICIAN OR SUPPLIER INCLUDING DEGREES OR CREDENTIALS<br />
                (I certify that the statements on the reverse apply to this bill and are made a part thereof.)
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: 'auto' }}>
                <span style={{ fontSize: '7pt', color: OCR_RED, fontWeight: 600 }}>SIGNED</span>
                <div style={{ flex: 1, borderBottom: `1px solid ${OCR_RED}`, minHeight: '14px' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={anyVal('physicianSignature') || val('providerName')} />
                </div>
                <span style={{ fontSize: '6pt', color: OCR_RED }}>DATE</span>
                <div style={{ width: '0.8in', borderBottom: `1px solid ${OCR_RED}` }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={fmtDate(anyVal('physicianSignatureDate') || val('serviceDate'))} />
                </div>
              </div>
            </div>
            {/* Box 32: Service Facility */}
            <div style={{ borderBottom: `1px solid ${OCR_RED}`, padding: '2px 4px', minHeight: '0.3in', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '5pt', color: OCR_RED }}>32. SERVICE FACILITY LOCATION INFORMATION</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
                <input className="cms1500-input" style={{ ...inputStyle, flex: 1, fontSize: '8pt' }} defaultValue={val('facilityName')} placeholder="Facility name & address" />
                <span style={{ fontSize: '5pt', color: OCR_RED }}>a. NPI</span>
                <input className="cms1500-input" style={{ ...inputStyle, width: '0.8in', fontSize: '8pt' }} defaultValue={val('facilityNPI')} />
              </div>
            </div>
            {/* Box 33: Billing Provider (full width) */}
            <div style={{ gridColumn: '1/-1', padding: '2px 4px', minHeight: '0.4in', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '5pt', color: OCR_RED }}>33. BILLING PROVIDER INFO & PH #</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6in 0.6in', gap: '4px', marginTop: '2px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={val('providerName')} placeholder="Billing provider name" />
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '7pt', marginTop: '2px' }} defaultValue={sb?.providerAddress ? `${sb.providerAddress.street || ''}, ${sb.providerAddress.city || ''}, ${sb.providerAddress.state || ''} ${sb.providerAddress.zipCode || ''}` : ''} placeholder="Street, City, State, ZIP" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '5pt', color: OCR_RED }}>a. NPI</span>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} defaultValue={val('providerNPI')} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '5pt', color: OCR_RED }}>b. Other ID</span>
                  <input className="cms1500-input" style={{ ...inputStyle, fontSize: '8pt' }} />
                </div>
              </div>
            </div>
            {/* NUCC Footer */}
            <div style={{ gridColumn: '1/-1', borderTop: `1px solid ${OCR_RED}`, padding: '2px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '0.18in' }}>
              <span style={{ fontSize: '5.5pt', color: OCR_RED }}>NUCC Instruction Manual available at: www.nucc.org</span>
              <span style={{ fontSize: '6pt', color: OCR_RED, fontStyle: 'italic' }}>PLEASE PRINT OR TYPE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cms1500FormPage;
