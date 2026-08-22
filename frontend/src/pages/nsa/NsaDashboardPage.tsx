import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Progress,
  Alert,
  Tabs,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tooltip,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  RobotOutlined,
  SendOutlined,
  GavelOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { NsaComplianceDashboard, NsaIdrCase, NsaIdrDeadline, GoodFaithEstimate } from '../types';
import { nsaService } from '../services/nsaService';

const { Title, Text } = Typography;

const IDR_STATUS_COLORS: Record<string, string> = {
  open_negotiation: 'processing',
  idr_initiated: 'warning',
  idr_submitted: 'warning',
  won: 'success',
  lost: 'error',
  withdrawn: 'default',
  expired: 'default',
  settled: 'success',
};

const DEADLINE_STATUS_COLORS: Record<string, string> = {
  upcoming: 'default',
  due_soon: 'warning',
  overdue: 'error',
  met: 'success',
  missed: 'error',
};

const NsaDashboardPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<NsaComplianceDashboard | null>(null);
  const [idrCases, setIdrCases] = useState<NsaIdrCase[]>([]);
  const [deadlines, setDeadlines] = useState<NsaIdrDeadline[]>([]);
  const [loading, setLoading] = useState(false);
  const [idrModalOpen, setIdrModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<NsaIdrCase | null>(null);
  const [idrForm] = Form.useForm();
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, cases, dl] = await Promise.all([
        nsaService.getDashboard(),
        nsaService.listIdrCases(),
        nsaService.getAllDeadlines(),
      ]);
      setDashboard(dash);
      setIdrCases(cases);
      setDeadlines(dl);
    } catch (err: any) {
      message.error(err.message || 'Failed to load NSA dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ── IDR Case Actions ──────────────────────────────────────────────
  const handleCreateIdrCase = async () => {
    try {
      const values = await idrForm.validateFields();
      await nsaService.createIdrCase({
        patientId: values.patientId,
        patientName: values.patientName,
        claimId: values.claimId,
        gfeId: values.gfeId,
        varianceRecordId: values.varianceRecordId,
        payerName: values.payerName,
        billedAmount: values.billedAmount,
        encounterNotes: values.encounterNotes,
        cptCodes: values.cptCodes ? values.cptCodes.split(',').map((c: string) => c.trim()) : [],
      });
      message.success('IDR case created');
      setIdrModalOpen(false);
      idrForm.resetFields();
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to create IDR case');
    }
  };

  const handleAssessEligibility = async (idrCase: NsaIdrCase) => {
    setAiLoading(`eligibility-${idrCase.id}`);
    try {
      const state = prompt('Patient state (e.g., CA, NY, TX):');
      if (!state) return;
      const paidAmount = prompt('Paid amount by payer ($):');
      if (!paidAmount) return;
      await nsaService.assessEligibility(idrCase.id, {
        patientState: state,
        paidAmount: parseFloat(paidAmount),
        serviceType: 'emergency',
        isEmergency: true,
        isAirAmbulance: false,
        payerType: 'commercial',
      });
      message.success('AI eligibility assessment complete');
      loadData();
    } catch (err: any) {
      message.error(err.message || 'Assessment failed');
    } finally {
      setAiLoading(null);
    }
  };

  const handleGenerateOffer = async (idrCase: NsaIdrCase) => {
    setAiLoading(`offer-${idrCase.id}`);
    try {
      await nsaService.generateOffer(idrCase.id);
      message.success('AI open negotiation offer generated');
      loadData();
    } catch (err: any) {
      message.error(err.message || 'Offer generation failed');
    } finally {
      setAiLoading(null);
    }
  };

  const handleWinProbability = async (idrCase: NsaIdrCase) => {
    setAiLoading(`win-${idrCase.id}`);
    try {
      await nsaService.predictWinProbability(idrCase.id);
      message.success('AI win probability prediction complete');
      loadData();
    } catch (err: any) {
      message.error(err.message || 'Prediction failed');
    } finally {
      setAiLoading(null);
    }
  };

  const handleAcuityLetter = async (idrCase: NsaIdrCase) => {
    setAiLoading(`acuity-${idrCase.id}`);
    try {
      await nsaService.generateAcuityLetter(idrCase.id, { conditions: [] });
      message.success('Patient acuity letter generated');
      loadData();
    } catch (err: any) {
      message.error(err.message || 'Letter generation failed');
    } finally {
      setAiLoading(null);
    }
  };

  const idrColumns = [
    { title: 'Patient', dataIndex: 'patientName', key: 'patientName' },
    { title: 'Payer', dataIndex: 'payerName', key: 'payerName' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={IDR_STATUS_COLORS[status]}>{status.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Jurisdiction',
      dataIndex: 'jurisdiction',
      key: 'jurisdiction',
      render: (j: string) => <Tag>{j.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Billed',
      dataIndex: 'billedAmount',
      key: 'billedAmount',
      render: (v: number | null) => v ? `$${v.toFixed(2)}` : '-',
    },
    {
      title: 'QPA',
      dataIndex: 'qpaAmount',
      key: 'qpaAmount',
      render: (v: number | null) => v ? `$${v.toFixed(2)}` : '-',
    },
    {
      title: 'Eligibility',
      dataIndex: 'eligibilityScore',
      key: 'eligibilityScore',
      render: (v: number | null) => v ? <Progress percent={v} size="small" /> : '-',
    },
    {
      title: 'Win Prob.',
      dataIndex: 'winProbability',
      key: 'winProbability',
      render: (v: number | null) => v ? <Progress percent={v} size="small" strokeColor={v > 60 ? '#52c41a' : v > 30 ? '#faad14' : '#ff4d4f'} /> : '-',
    },
    {
      title: 'Recovery',
      dataIndex: 'expectedRecovery',
      key: 'expectedRecovery',
      render: (v: number | null) => v ? `$${v.toFixed(2)}` : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: NsaIdrCase) => (
        <Space size="small">
          <Tooltip title="AI Eligibility Assessment">
            <Button size="small" icon={<RobotOutlined />} loading={aiLoading === `eligibility-${record.id}`} onClick={() => handleAssessEligibility(record)} />
          </Tooltip>
          <Tooltip title="AI Generate Offer">
            <Button size="small" icon={<DollarOutlined />} loading={aiLoading === `offer-${record.id}`} onClick={() => handleGenerateOffer(record)} />
          </Tooltip>
          <Tooltip title="AI Win Probability">
            <Button size="small" icon={<ThunderboltOutlined />} loading={aiLoading === `win-${record.id}`} onClick={() => handleWinProbability(record)} />
          </Tooltip>
          <Tooltip title="AI Acuity Letter">
            <Button size="small" icon={<FileTextOutlined />} loading={aiLoading === `acuity-${record.id}`} onClick={() => handleAcuityLetter(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const deadlineColumns = [
    {
      title: 'Case',
      dataIndex: 'idrCaseId',
      key: 'idrCaseId',
      render: (id: string) => id.substring(0, 8),
    },
    {
      title: 'Type',
      dataIndex: 'deadlineType',
      key: 'deadlineType',
      render: (t: string) => <Tag>{t.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={DEADLINE_STATUS_COLORS[s]}>{s.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Met',
      dataIndex: 'isMet',
      key: 'isMet',
      render: (m: boolean) => m ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ClockCircleOutlined style={{ color: '#faad14' }} />,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: NsaIdrDeadline) =>
        !record.isMet && (
          <Button size="small" type="link" onClick={async () => { await nsaService.markDeadlineMet(record.id); loadData(); }}>
            Mark Met
          </Button>
        ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <GavelOutlined style={{ marginRight: 8 }} />
        No Surprises Act Compliance Dashboard
      </Title>

      {/* Compliance Metrics */}
      {dashboard && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic title="Total GFEs" value={dashboard.totalGfes} prefix={<FileTextOutlined />} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="Delivered" value={dashboard.delivered} prefix={<SendOutlined />} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="Acknowledged" value={dashboard.acknowledged} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="On-Time Rate"
                value={dashboard.onTimeDeliveryRate}
                suffix="%"
                valueStyle={{ color: dashboard.onTimeDeliveryRate > 90 ? '#52c41a' : '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="Pending Delivery" value={dashboard.pendingDelivery} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="Overdue" value={dashboard.overdueDelivery} prefix={<WarningOutlined />} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>
      )}

      {dashboard && dashboard.overdueDelivery > 0 && (
        <Alert
          type="error"
          message={`${dashboard.overdueDelivery} GFE(s) are OVERDUE for delivery — NSA compliance violation risk`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {dashboard && dashboard.varianceOverThreshold > 0 && (
        <Alert
          type="warning"
          message={`${dashboard.varianceOverThreshold} variance record(s) exceed the $400 NSA threshold — IDR dispute may be warranted`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        items={[
          {
            key: 'idr',
            label: <span><GavelOutlined /> IDR Cases ({idrCases.length})</span>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setIdrModalOpen(true)}>
                    Create IDR Case
                  </Button>
                </div>
                <Table columns={idrColumns} dataSource={idrCases} rowKey="id" loading={loading} size="small" />
              </>
            ),
          },
          {
            key: 'deadlines',
            label: <span><ClockCircleOutlined /> Deadlines ({deadlines.length})</span>,
            children: <Table columns={deadlineColumns} dataSource={deadlines} rowKey="id" loading={loading} size="small" />,
          },
        ]}
      />

      {/* Create IDR Case Modal */}
      <Modal
        title="Create IDR Case"
        open={idrModalOpen}
        onOk={handleCreateIdrCase}
        onCancel={() => setIdrModalOpen(false)}
        width={600}
      >
        <Form form={idrForm} layout="vertical">
          <Form.Item name="patientId" label="Patient ID" rules={[{ required: true }]}>
            <Input placeholder="Patient UUID" />
          </Form.Item>
          <Form.Item name="patientName" label="Patient Name">
            <Input placeholder="Patient name" />
          </Form.Item>
          <Form.Item name="payerName" label="Payer Name">
            <Input placeholder="Insurance company" />
          </Form.Item>
          <Form.Item name="billedAmount" label="Billed Amount">
            <InputNumber prefix="$" style={{ width: '100%' }} step={0.01} />
          </Form.Item>
          <Form.Item name="claimId" label="Claim ID">
            <Input placeholder="Claim UUID (optional)" />
          </Form.Item>
          <Form.Item name="gfeId" label="GFE ID">
            <Input placeholder="GFE UUID (optional)" />
          </Form.Item>
          <Form.Item name="cptCodes" label="CPT Codes (comma-separated)">
            <Input placeholder="99213, 80053, 85025" />
          </Form.Item>
          <Form.Item name="encounterNotes" label="Encounter Notes">
            <Input.TextArea rows={4} placeholder="Clinical notes from the encounter..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

import { PlusOutlined } from '@ant-design/icons';

export default NsaDashboardPage;
