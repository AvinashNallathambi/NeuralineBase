import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Tag,
  Alert,
  Spin,
  Empty,
  Button,
  Collapse,
  Statistic,
  Tooltip,
  Badge,
  Divider,
  Typography,
  Space,
  List,
  Table,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  AimOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  PatientQualityProfile,
  MeasureResult,
} from '../../services/qualityMeasuresService';
import { qualityMeasuresService } from '../../services/qualityMeasuresService';

const { Text, Paragraph } = Typography;

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  met: { color: 'success', icon: <CheckCircleOutlined />, label: 'Met' },
  not_met: { color: 'error', icon: <CloseCircleOutlined />, label: 'Not Met' },
  overdue: { color: 'warning', icon: <ExclamationCircleOutlined />, label: 'Overdue' },
  not_applicable: { color: 'default', icon: <ExclamationCircleOutlined />, label: 'N/A' },
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

const programColors: Record<string, string> = {
  MIPS: 'gold',
  eCQM: 'blue',
  HEDIS: 'green',
  UDS: 'orange',
};

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  patientId: string;
}

const QualityMeasuresTab: React.FC<Props> = ({ patientId }) => {
  const [profile, setProfile] = useState<PatientQualityProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityMeasuresService.getPatientQualityProfile(patientId);
      setProfile(data);
    } catch (err: any) {
      message.error('Failed to load quality measures: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !profile) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" tip="Calculating quality measures..." />
      </div>
    );
  }

  if (!profile) {
    return <Card><Empty description="No quality measures data available" /></Card>;
  }

  const { summary, measures, aiRecommendations } = profile;

  const measureColumns: ColumnsType<MeasureResult> = [
    {
      title: 'Measure',
      dataIndex: 'measureTitle',
      key: 'measureTitle',
      render: (title: string, record: MeasureResult) => (
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const cfg = statusConfig[status] || statusConfig.not_met;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Last Value',
      dataIndex: 'lastValue',
      key: 'lastValue',
      width: 140,
      render: (v: string | null) => v ? <Text>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Target',
      dataIndex: 'targetValue',
      key: 'targetValue',
      width: 140,
      render: (v: string | null) => v ? <Text type="secondary">{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p: number) => {
        const colors = ['#ff4d4f', '#fa8c16', '#faad14', '#52c41a', '#52c41a'];
        return <Tag color={colors[p - 1] || 'default'}>P{p}</Tag>;
      },
    },
    {
      title: 'Closeable',
      dataIndex: 'closeableInVisit',
      key: 'closeableInVisit',
      width: 80,
      render: (c: boolean, record: MeasureResult) =>
        c && record.status !== 'met' ? (
          <Tooltip title="Can be addressed during a routine visit">
            <Tag color="green" icon={<ThunderboltOutlined />}>Yes</Tag>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  const expandedRowRender = (record: MeasureResult) => (
    <div style={{ padding: '8px 0' }}>
      <Alert
        type={record.status === 'met' ? 'success' : record.status === 'overdue' ? 'warning' : 'error'}
        message="Explanation"
        description={record.explanation}
        showIcon
        style={{ marginBottom: 12 }}
      />
      {record.recommendation && (
        <Alert
          type="info"
          message="Recommended Action"
          description={record.recommendation}
          showIcon
          icon={<AimOutlined />}
          style={{ marginBottom: 12 }}
        />
      )}
      {record.crossProgramMappings.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">Cross-program mappings: </Text>
          {record.crossProgramMappings.map((m, i) => (
            <Tooltip key={i} title={m.measureTitle}>
              <Tag color={programColors[m.program] || 'default'} style={{ marginBottom: 4 }}>
                {m.program}: {m.measureId}
              </Tag>
            </Tooltip>
          ))}
        </div>
      )}
      {record.dataElements.length > 0 && (
        <div>
          <Text type="secondary">Data elements driving this result:</Text>
          <List
            size="small"
            dataSource={record.dataElements}
            renderItem={(el) => (
              <List.Item>
                <Space>
                  <Tag>{el.source}</Tag>
                  <Text>{el.field}: {el.value}</Text>
                  {el.date && <Text type="secondary">({el.date})</Text>}
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );

  const complianceColor = summary.complianceRate >= 80 ? '#52c41a' : summary.complianceRate >= 60 ? '#faad14' : '#ff4d4f';

  return (
    <Spin spinning={loading}>
      {/* Summary Dashboard */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col xs={24} sm={6} md={4}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={summary.complianceRate}
                size={100}
                strokeColor={complianceColor}
                format={(p) => <span style={{ fontSize: 20, fontWeight: 700, color: complianceColor }}>{p}%</span>}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Compliance Rate</Text>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={18} md={20}>
            <Row gutter={16}>
              <Col xs={12} sm={6} md={4}>
                <Statistic title="Total Measures" value={summary.total} />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Statistic title="Met" value={summary.met} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Statistic title="Not Met" value={summary.notMet} valueStyle={{ color: '#ff4d4f' }} prefix={<CloseCircleOutlined />} />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Statistic title="Overdue" value={summary.overdue} valueStyle={{ color: '#faad14' }} prefix={<ExclamationCircleOutlined />} />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Statistic title="Open Gaps" value={summary.openGaps} valueStyle={{ color: summary.openGaps > 0 ? '#ff4d4f' : '#52c41a' }} />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Statistic
                  title="Est. Quality Score"
                  value={summary.estimatedQualityScore}
                  suffix="/100"
                  valueStyle={{ color: summary.estimatedQualityScore >= 75 ? '#52c41a' : '#faad14' }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Space>
              <Badge count={summary.closeableGaps} offset={[-2, 0]}>
                <Tag color="green" icon={<ThunderboltOutlined />}>Closeable in Visit: {summary.closeableGaps}</Tag>
              </Badge>
              <Text type="secondary">
                Reporting Period: {profile.reportingPeriod.start} — {profile.reportingPeriod.end}
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* AI Recommendations */}
      {aiRecommendations && (
        <Card
          style={{ marginBottom: 16 }}
          title={<Space><RobotOutlined style={{ color: '#0D7C8A' }} /> AI Recommendations</Space>}
          extra={<Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small">Refresh</Button>}
        >
          <Alert
            type="info"
            message="AI Quality Summary"
            description={aiRecommendations.summary}
            showIcon
            style={{ marginBottom: 16 }}
          />
          {aiRecommendations.topPriorities.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Title level={5}><AimOutlined /> Top Priority Actions</Title>
              <List
                size="small"
                dataSource={aiRecommendations.topPriorities}
                renderItem={(item, idx) => (
                  <List.Item>
                    <Space align="start" style={{ width: '100%' }}>
                      <Tag color="red">#{idx + 1}</Tag>
                      <div style={{ flex: 1 }}>
                        <Text strong>{item.title}</Text>
                        <br />
                        <Text>{item.action}</Text>
                        <br />
                        <Text type="secondary">Impact: {item.impact}</Text>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          )}
          {aiRecommendations.visitReadiness.length > 0 && (
            <div>
              <Title level={5}><ThunderboltOutlined /> Closeable During Next Visit</Title>
              <List
                size="small"
                dataSource={aiRecommendations.visitReadiness}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      <Tag color="green" icon={<ThunderboltOutlined />}>Visit</Tag>
                      <div>
                        <Text strong>{item.title}</Text>
                        <br />
                        <Text type="secondary">{item.action}</Text>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          )}
        </Card>
      )}

      {/* Measures Table */}
      <Card
        title={<Space><SafetyCertificateOutlined /> Quality Measures ({measures.length})</Space>}
        extra={!aiRecommendations && <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small">Refresh</Button>}
      >
        <Table
          columns={measureColumns}
          dataSource={measures}
          rowKey="measureId"
          pagination={false}
          size="small"
          expandable={{ expandedRowRender, rowExpandable: (r) => !!r.explanation }}
          rowClassName={(record) =>
            record.status === 'met' ? 'quality-row-met' :
            record.status === 'overdue' ? 'quality-row-overdue' :
            record.status === 'not_met' ? 'quality-row-not-met' : ''
          }
        />
      </Card>
    </Spin>
  );
};

// Small helper component for section titles
const Title: React.FC<{ level?: 1 | 2 | 3 | 4 | 5; children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{children}</div>
);

export default QualityMeasuresTab;
