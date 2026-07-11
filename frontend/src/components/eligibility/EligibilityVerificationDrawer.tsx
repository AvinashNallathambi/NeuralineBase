import React from 'react';
import { Drawer, Descriptions, Tag, Card, Row, Col, Statistic, Divider, Space, Progress, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import type { EligibilityVerification, CoverageBenefit } from '../../types';
import EligibilityStatusBadge from './EligibilityStatusBadge';

const { Text } = Typography;

interface Props {
  open: boolean;
  verification: EligibilityVerification | null;
  onClose: () => void;
}

export const EligibilityVerificationDrawer: React.FC<Props> = ({
  open,
  verification,
  onClose,
}) => {
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

  return (
    <Drawer
      title="Eligibility Verification Details"
      width={720}
      open={open}
      onClose={onClose}
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
