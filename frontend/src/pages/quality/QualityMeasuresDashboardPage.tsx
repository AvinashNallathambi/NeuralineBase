import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Table,
  Tag,
  Statistic,
  Spin,
  Empty,
  Button,
  Alert,
  Typography,
  Space,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  AimOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  PracticeQualityDashboard,
  PracticeMeasureSummary,
} from '../../services/qualityMeasuresService';
import { qualityMeasuresService } from '../../services/qualityMeasuresService';

const { Text, Title: AntTitle } = Typography;

const programColors: Record<string, string> = {
  MIPS: 'gold',
  eCQM: 'blue',
  HEDIS: 'green',
  UDS: 'orange',
};

const categoryColors: Record<string, string> = {
  preventive: 'blue',
  chronic_care: 'purple',
  medication_safety: 'magenta',
  lab_monitoring: 'cyan',
  imaging: 'geekblue',
  immunization: 'green',
  care_coordination: 'orange',
};

const QualityMeasuresDashboardPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<PracticeQualityDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityMeasuresService.getPracticeDashboard();
      setDashboard(data);
    } catch (err: any) {
      message.error('Failed to load quality dashboard: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !dashboard) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" tip="Loading quality dashboard..." />
      </div>
    );
  }

  if (!dashboard) {
    return <Card><Empty description="No quality measures data available" /></Card>;
  }

  const columns: ColumnsType<PracticeMeasureSummary> = [
    {
      title: 'Measure',
      dataIndex: 'measureTitle',
      key: 'measureTitle',
      render: (title: string, record: PracticeMeasureSummary) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          <Space size={4}>
            <Tag color={programColors[record.program] || 'default'}>{record.program}</Tag>
            <Tag color={categoryColors[record.category] || 'default'}>{record.category.replace(/_/g, ' ')}</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Eligible',
      dataIndex: 'eligible',
      key: 'eligible',
      width: 90,
      render: (v: number) => <Text>{v}</Text>,
    },
    {
      title: 'Met',
      dataIndex: 'met',
      key: 'met',
      width: 70,
      render: (v: number) => <Text style={{ color: '#52c41a' }}>{v}</Text>,
    },
    {
      title: 'Not Met',
      dataIndex: 'notMet',
      key: 'notMet',
      width: 80,
      render: (v: number) => <Text style={{ color: v > 0 ? '#ff4d4f' : undefined }}>{v}</Text>,
    },
    {
      title: 'Overdue',
      dataIndex: 'overdue',
      key: 'overdue',
      width: 80,
      render: (v: number) => <Text style={{ color: v > 0 ? '#faad14' : undefined }}>{v}</Text>,
    },
    {
      title: 'Compliance',
      dataIndex: 'complianceRate',
      key: 'complianceRate',
      width: 140,
      render: (rate: number) => {
        const color = rate >= 80 ? '#52c41a' : rate >= 60 ? '#faad14' : '#ff4d4f';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress percent={rate} size="small" strokeColor={color} style={{ width: 80 }} />
            <Text style={{ color, fontWeight: 600 }}>{rate}%</Text>
          </div>
        );
      },
      sorter: (a, b) => a.complianceRate - b.complianceRate,
    },
  ];

  const complianceColor = dashboard.overallCompliance >= 80 ? '#52c41a' : dashboard.overallCompliance >= 60 ? '#faad14' : '#ff4d4f';

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <AntTitle level={3}>
          <Space>
            <SafetyCertificateOutlined style={{ color: '#0D7C8A' }} />
            Quality Measures Dashboard
          </Space>
        </AntTitle>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <Progress
                  type="circle"
                  percent={dashboard.overallCompliance}
                  size={90}
                  strokeColor={complianceColor}
                  format={(p) => <span style={{ fontSize: 18, fontWeight: 700, color: complianceColor }}>{p}%</span>}
                />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">Overall Compliance</Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Est. Quality Score"
                value={dashboard.estimatedQualityScore}
                suffix="/100"
                valueStyle={{ color: dashboard.estimatedQualityScore >= 75 ? '#52c41a' : '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Patients"
                value={dashboard.totalPatients}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Active Measures"
                value={dashboard.measures.length}
              />
            </Card>
          </Col>
        </Row>

        {/* AI Insights */}
        {dashboard.aiInsights && (
          <Card
            style={{ marginBottom: 16 }}
            title={<Space><RobotOutlined style={{ color: '#0D7C8A' }} /> AI Insights</Space>}
            extra={<Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small">Refresh</Button>}
          >
            <Alert
              type={dashboard.overallCompliance >= 70 ? 'success' : 'warning'}
              message={dashboard.aiInsights}
              showIcon
            />
          </Card>
        )}

        {/* Top Gaps */}
        {dashboard.topGaps.length > 0 && (
          <Card style={{ marginBottom: 16 }} title={<Space><AimOutlined /> Top Quality Gaps</Space>}>
            <Row gutter={[16, 16]}>
              {dashboard.topGaps.map((gap) => (
                <Col xs={24} sm={12} md={8} key={gap.measureId}>
                  <Card size="small" style={{ borderLeft: `3px solid ${gap.complianceRate < 50 ? '#ff4d4f' : '#faad14'}` }}>
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <Text strong>{gap.measureTitle}</Text>
                      <Space>
                        <Tag color="error">{gap.gapCount} gaps</Tag>
                        <Text type="secondary">{gap.complianceRate}% compliance</Text>
                      </Space>
                      <Progress percent={gap.complianceRate} size="small" strokeColor={gap.complianceRate < 50 ? '#ff4d4f' : '#faad14'} />
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {/* Measures Table */}
        <Card
          title={<Space><SafetyCertificateOutlined /> All Quality Measures ({dashboard.measures.length})</Space>}
          extra={!dashboard.aiInsights && <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small">Refresh</Button>}
        >
          <Table
            columns={columns}
            dataSource={dashboard.measures}
            rowKey="measureId"
            pagination={false}
            size="small"
          />
        </Card>

        {/* Reporting Period */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Text type="secondary">
            Reporting Period: {dashboard.reportingPeriod.start} — {dashboard.reportingPeriod.end} | Generated: {new Date(dashboard.generatedAt).toLocaleString()}
          </Text>
        </div>
      </div>
    </Spin>
  );
};

export default QualityMeasuresDashboardPage;
