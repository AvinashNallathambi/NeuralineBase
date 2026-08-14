import React, { useState } from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Divider,
  Space,
  Progress,
  Table,
  Typography,
  Button,
  Alert,
  Spin,
  Input,
  Empty,
  message,
} from 'antd';
import {
  ThunderboltOutlined,
  FileTextOutlined,
  WarningOutlined,
  DollarOutlined,
  MedicineBoxOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { EligibilityVerification, CoverageBenefit } from '../../types';
import EligibilityStatusBadge from './EligibilityStatusBadge';
import { eligibilityService } from '../../services/eligibilityService';

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  verification: EligibilityVerification | null;
  onClose: () => void;
}

interface AiAlert {
  severity: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  action: string;
}

export const EligibilityVerificationDrawer: React.FC<Props> = ({
  open,
  verification,
  onClose,
}) => {
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiAlerts, setAiAlerts] = useState<AiAlert[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [denialRisk, setDenialRisk] = useState<any>(null);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [priorAuthLetter, setPriorAuthLetter] = useState<string | null>(null);
  const [cptInput, setCptInput] = useState('99213, 99214');

  if (!verification) return null;

  const limitation = verification.benefitLimitations || {};

  // Financial progress helpers
  const deductibleUsed = verification.deductibleIndividual != null
    ? Number(verification.deductibleIndividual) - Number(verification.deductibleRemaining || 0)
    : null;
  const deductiblePct = verification.deductibleIndividual
    ? Math.min(100, Math.round((deductibleUsed! / Number(verification.deductibleIndividual)) * 100))
    : 0;

  const oopUsed = verification.outOfPocketIndividual != null
    ? Number(verification.outOfPocketIndividual) - Number(verification.outOfPocketRemaining || 0)
    : null;
  const oopPct = verification.outOfPocketIndividual
    ? Math.min(100, Math.round((oopUsed! / Number(verification.outOfPocketIndividual)) * 100))
    : 0;

  // Benefits table columns
  const benefitColumns = [
    { title: 'Category', dataIndex: 'category', key: 'category' },
    {
      title: 'Copay',
      dataIndex: 'copay',
      key: 'copay',
      render: (v: number | null) => v != null ? `$${v}` : '—',
    },
    {
      title: 'Coinsurance',
      dataIndex: 'coinsurance',
      key: 'coinsurance',
      render: (v: number | null) => v != null ? `${v}%` : '—',
    },
    {
      title: 'Network',
      dataIndex: 'network',
      key: 'network',
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Prior Auth',
      dataIndex: 'priorAuth',
      key: 'priorAuth',
      render: (v: boolean) => <Tag color={v ? 'red' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Visit Limit',
      dataIndex: 'visitLimit',
      key: 'visitLimit',
      render: (v: number | null) => v != null ? `${v}/year` : 'Unlimited',
    },
  ];

  const benefits: CoverageBenefit[] = (verification.benefits || []) as CoverageBenefit[];

  const resetAi = () => {
    setAiAlerts(null);
    setAiSummary(null);
    setDenialRisk(null);
    setCostEstimate(null);
    setPriorAuthLetter(null);
  };

  const handleFetchAlerts = async () => {
    setAiLoading('alerts');
    resetAi();
    try {
      const result = await eligibilityService.generateAlerts(verification.id);
      setAiAlerts(result.alerts);
      setAiSummary(result.summary);
    } catch {
      message.error('Failed to generate AI alerts');
    } finally {
      setAiLoading(null);
    }
  };

  const handleFetchSummary = async () => {
    setAiLoading('summary');
    resetAi();
    try {
      const result = await eligibilityService.generateSummary(verification.id);
      setAiSummary(result.summary);
    } catch {
      message.error('Failed to generate AI summary');
    } finally {
      setAiLoading(null);
    }
  };

  const handleFetchDenialRisk = async () => {
    setAiLoading('denial');
    resetAi();
    try {
      const result = await eligibilityService.assessDenialRisk(verification.id);
      setDenialRisk(result);
    } catch {
      message.error('Failed to assess denial risk');
    } finally {
      setAiLoading(null);
    }
  };

  const handleFetchCostEstimate = async () => {
    setAiLoading('cost');
    resetAi();
    try {
      const codes = cptInput.split(',').map((c) => c.trim()).filter(Boolean);
      const result = await eligibilityService.estimateResponsibility(verification.id, codes);
      setCostEstimate(result);
    } catch {
      message.error('Failed to estimate patient responsibility');
    } finally {
      setAiLoading(null);
    }
  };

  const handleFetchPriorAuth = async () => {
    setAiLoading('priorauth');
    resetAi();
    try {
      const result = await eligibilityService.generatePriorAuthLetter(verification.id);
      setPriorAuthLetter(result.letter);
    } catch {
      message.error('Failed to generate prior auth letter');
    } finally {
      setAiLoading(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const severityColor = (sev: string) => {
    if (sev === 'critical') return 'error';
    if (sev === 'warning') return 'warning';
    return 'info';
  };

  const riskColor = (level: string) => {
    if (level === 'high') return 'red';
    if (level === 'medium') return 'orange';
    return 'green';
  };

  return (
    <Drawer
      title="Eligibility Verification Details"
      width={720}
      open={open}
      onClose={() => { resetAi(); onClose(); }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* General Info */}
        <Card>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Status">
              <EligibilityStatusBadge status={verification.status} coverageStatus={verification.coverageStatus} />
            </Descriptions.Item>
            <Descriptions.Item label="Plan">{verification.planName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Payer">{verification.payerName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Plan Type">
              {verification.planType ? <Tag>{verification.planType}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Policy">{verification.policyNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Group">{verification.groupNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Network">
              {verification.network ? (
                <Tag color={verification.network.includes('In') || verification.network.includes('Participating') ? 'green' : 'orange'}>
                  {verification.network}
                </Tag>
              ) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Service Type">{verification.serviceType || '—'}</Descriptions.Item>
            <Descriptions.Item label="Subscriber">{verification.subscriberName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Relationship">{verification.subscriberRelation || '—'}</Descriptions.Item>
            <Descriptions.Item label="Verified At">
              {verification.verifiedAt ? dayjs(verification.verifiedAt).format('MM/DD/YYYY h:mm A') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Verified By">{verification.verifiedByName || '—'}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* AI Analysis Section */}
        <Card
          title={<Space><ThunderboltOutlined /> AI Analysis</Space>}
          size="small"
        >
          <Space wrap style={{ marginBottom: 12 }}>
            <Button
              icon={<WarningOutlined />}
              loading={aiLoading === 'alerts'}
              onClick={handleFetchAlerts}
            >
              AI Alerts
            </Button>
            <Button
              icon={<FileTextOutlined />}
              loading={aiLoading === 'summary'}
              onClick={handleFetchSummary}
            >
              Summary
            </Button>
            <Button
              icon={<WarningOutlined />}
              loading={aiLoading === 'denial'}
              onClick={handleFetchDenialRisk}
            >
              Denial Risk
            </Button>
            <Button
              icon={<DollarOutlined />}
              loading={aiLoading === 'cost'}
              onClick={handleFetchCostEstimate}
            >
              Cost Estimate
            </Button>
            <Button
              icon={<MedicineBoxOutlined />}
              loading={aiLoading === 'priorauth'}
              onClick={handleFetchPriorAuth}
            >
              Prior Auth Letter
            </Button>
          </Space>

          {/* CPT input for cost estimate */}
          {aiLoading === 'cost' || costEstimate !== undefined ? null : null}

          {aiLoading && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin tip="AI is analyzing... this may take up to a minute" />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Running {aiLoading} analysis. Please wait...
                </Text>
              </div>
            </div>
          )}

          {/* AI Alerts */}
          {aiAlerts && (
            <>
              {aiSummary && (
                <Alert
                  type="info"
                  message="Summary"
                  description={aiSummary}
                  style={{ marginBottom: 12 }}
                  showIcon
                />
              )}
              {aiAlerts.map((alert, i) => (
                <Alert
                  key={i}
                  type={severityColor(alert.severity) as any}
                  message={`[${alert.category}] ${alert.message}`}
                  description={`Action: ${alert.action}`}
                  style={{ marginBottom: 8 }}
                  showIcon
                />
              ))}
            </>
          )}

          {/* AI Summary only */}
          {aiSummary && !aiAlerts && (
            <Card size="small" style={{ background: '#f6ffed' }}>
              <Paragraph>{aiSummary}</Paragraph>
            </Card>
          )}

          {/* Denial Risk */}
          {denialRisk && (
            <>
              <Space style={{ marginBottom: 12 }}>
                <Tag color={riskColor(denialRisk.riskLevel)} style={{ fontSize: 14, padding: '4px 12px' }}>
                  {denialRisk.riskLevel?.toUpperCase()} RISK ({denialRisk.riskScore}/100)
                </Tag>
              </Space>
              <Paragraph type="secondary">{denialRisk.summary}</Paragraph>
              {denialRisk.riskFactors?.length > 0 && (
                <>
                  <Text strong>Risk Factors:</Text>
                  {denialRisk.riskFactors.map((rf: any, i: number) => (
                    <Alert
                      key={i}
                      type={rf.severity === 'high' ? 'error' : rf.severity === 'medium' ? 'warning' : 'info'}
                      message={rf.factor}
                      description={rf.recommendation}
                      style={{ marginBottom: 8, marginTop: 4 }}
                      showIcon
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* Cost Estimate */}
          {costEstimate && (
            <>
              <Input
                placeholder="CPT codes (comma-separated)"
                value={cptInput}
                onChange={(e) => setCptInput(e.target.value)}
                style={{ marginBottom: 12, maxWidth: 300 }}
              />
              {costEstimate.estimates?.length > 0 && (
                <Table
                  dataSource={costEstimate.estimates}
                  columns={[
                    { title: 'CPT', dataIndex: 'cptCode', key: 'cptCode', width: 80 },
                    { title: 'Description', dataIndex: 'description', key: 'description' },
                    { title: 'Allowed', dataIndex: 'allowedAmount', key: 'allowedAmount', render: (v: number) => `$${v?.toFixed(2)}` },
                    { title: 'Patient', dataIndex: 'patientResponsibility', key: 'patientResponsibility', render: (v: number) => `$${v?.toFixed(2)}` },
                    { title: 'Payer', dataIndex: 'payerResponsibility', key: 'payerResponsibility', render: (v: number) => `$${v?.toFixed(2)}` },
                  ]}
                  rowKey="cptCode"
                  pagination={false}
                  size="small"
                  bordered
                  style={{ marginBottom: 12 }}
                />
              )}
              <Statistic
                title="Total Patient Responsibility"
                value={costEstimate.totalPatientResponsibility}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
              {costEstimate.notes && (
                <Paragraph type="secondary" style={{ marginTop: 8 }}>{costEstimate.notes}</Paragraph>
              )}
            </>
          )}

          {/* Prior Auth Letter */}
          {priorAuthLetter && (
            <Card
              size="small"
              title={<Space><MedicineBoxOutlined /> Prior Authorization Letter</Space>}
              extra={<Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(priorAuthLetter)}>Copy</Button>}
            >
              <Paragraph style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
                {priorAuthLetter}
              </Paragraph>
            </Card>
          )}

          {/* Empty state when no AI result loaded */}
          {!aiLoading && !aiAlerts && !aiSummary && !denialRisk && !costEstimate && !priorAuthLetter && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Click a button above to run AI analysis on this verification"
            />
          )}
        </Card>

        {/* Coverage Period */}
        <Card title="Coverage Period" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="Effective Date"
                value={verification.effectiveDate ? dayjs(verification.effectiveDate).format('MM/DD/YYYY') : '—'}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Expiration Date"
                value={verification.expirationDate ? dayjs(verification.expirationDate).format('MM/DD/YYYY') : '—'}
              />
            </Col>
          </Row>
        </Card>

        {/* Financial Summary with Progress Bars */}
        <Card title="Financial Summary" size="small">
          <Row gutter={[16, 24]}>
            {/* Deductible */}
            <Col span={12}>
              <Text strong>Individual Deductible</Text>
              {verification.deductibleIndividual != null ? (
                <>
                  <Progress
                    percent={deductiblePct}
                    strokeColor={deductiblePct >= 100 ? '#52c41a' : '#1890ff'}
                    format={() => `$${deductibleUsed?.toFixed(0)} / $${Number(verification.deductibleIndividual).toFixed(0)}`}
                    style={{ marginTop: 4 }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Remaining: ${Number(verification.deductibleRemaining || 0).toFixed(2)}
                  </Text>
                </>
              ) : (
                <Text type="secondary" style={{ display: 'block' }}>Not applicable</Text>
              )}
            </Col>

            {/* OOP Max */}
            <Col span={12}>
              <Text strong>Out-of-Pocket Maximum</Text>
              {verification.outOfPocketIndividual != null ? (
                <>
                  <Progress
                    percent={oopPct}
                    strokeColor={oopPct >= 100 ? '#52c41a' : '#fa8c16'}
                    format={() => `$${oopUsed?.toFixed(0)} / $${Number(verification.outOfPocketIndividual).toFixed(0)}`}
                    style={{ marginTop: 4 }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Remaining: ${Number(verification.outOfPocketRemaining || 0).toFixed(2)}
                  </Text>
                </>
              ) : (
                <Text type="secondary" style={{ display: 'block' }}>Not applicable</Text>
              )}
            </Col>

            {/* Family Deductible */}
            {verification.deductibleFamily != null && (
              <Col span={12}>
                <Statistic title="Family Deductible" value={Number(verification.deductibleFamily)} prefix="$" precision={2} />
              </Col>
            )}

            {/* Family OOP */}
            {verification.outOfPocketFamily != null && (
              <Col span={12}>
                <Statistic title="Family OOP Max" value={Number(verification.outOfPocketFamily)} prefix="$" precision={2} />
              </Col>
            )}

            <Col span={8}>
              <Statistic title="Copay" value={verification.copayAmount ?? '—'} prefix={verification.copayAmount != null ? '$' : undefined} precision={2} />
            </Col>
            <Col span={8}>
              <Statistic title="Coinsurance" value={verification.coinsurancePercentage ?? '—'} suffix={verification.coinsurancePercentage != null ? '%' : undefined} precision={0} />
            </Col>
          </Row>
        </Card>

        {/* Requirements */}
        <Card title="Requirements" size="small">
          <Space size="middle">
            <Tag color={verification.authorizationRequired ? 'red' : 'default'}>
              Authorization {verification.authorizationRequired ? 'Required' : 'Not Required'}
            </Tag>
            <Tag color={verification.referralRequired ? 'red' : 'default'}>
              Referral {verification.referralRequired ? 'Required' : 'Not Required'}
            </Tag>
          </Space>
          {limitation && Object.keys(limitation).length > 0 && (
            <>
              <Divider />
              <Descriptions column={1} size="small">
                {Object.entries(limitation).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key.replace(/([A-Z])/g, ' $1').trim()}>
                    {String(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </>
          )}
        </Card>

        {/* Coverage Benefits Table */}
        {benefits.length > 0 && (
          <Card title="Coverage Benefits" size="small">
            <Table
              dataSource={benefits}
              columns={benefitColumns}
              rowKey="category"
              pagination={false}
              size="small"
              bordered
            />
          </Card>
        )}

        {/* Error Details */}
        {verification.errorMessage && (
          <Card title="Error Details" bordered={false} style={{ background: '#fff1f0' }}>
            <Tag color="red">{verification.errorCode || 'ERROR'}</Tag>
            <p style={{ marginTop: 8, marginBottom: 0 }}>{verification.errorMessage}</p>
          </Card>
        )}

        {/* Notes */}
        {verification.notes && (
          <Card title="Notes" size="small">
            <p style={{ margin: 0 }}>{verification.notes}</p>
          </Card>
        )}
      </Space>
    </Drawer>
  );
};

export default EligibilityVerificationDrawer;
