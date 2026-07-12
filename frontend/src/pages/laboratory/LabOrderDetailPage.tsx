import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Card,
  Table,
  Tag,
  Space,
  Descriptions,
  Tabs,
  Row,
  Col,
  Spin,
  Form,
  Input,
  Select,
  Modal,
  Timeline,
  message,
  Popconfirm,
  Badge,
  Divider,
  Alert,
  List,
  Progress,
} from 'antd';
import {
  ArrowLeftOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PrinterOutlined,
  CloseCircleOutlined,
  ArrowRightOutlined,
  InboxOutlined,
  FileTextOutlined,
  HistoryOutlined,
  RobotOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  laboratoryService,
  type LabOrder,
  type LabResult,
  type Specimen,
  type LabOrderStatusHistory,
  type LabResultEntryDto,
  type ResultSummary,
} from '../../services/laboratoryService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColors: Record<string, string> = {
  draft: 'default',
  ordered: 'gold',
  collected: 'cyan',
  in_progress: 'processing',
  resulted: 'blue',
  completed: 'green',
  cancelled: 'red',
};

const priorityColors: Record<string, string> = {
  routine: 'blue',
  urgent: 'orange',
  stat: 'red',
  asap: 'volcano',
};

const flagColors: Record<string, string> = {
  normal: 'green',
  high: 'orange',
  low: 'blue',
  critical_high: 'red',
  critical_low: 'red',
};

const conditionColors: Record<string, string> = {
  good: 'green',
  hemolyzed: 'orange',
  clotted: 'orange',
  insufficient: 'volcano',
  rejected: 'red',
};

// Status workflow transitions
const STATUS_TRANSITIONS: Record<string, { label: string; value: string; color: string }[]> = {
  draft: [{ label: 'Send Order', value: 'ordered', color: 'primary' }],
  ordered: [
    { label: 'Collect Specimen', value: 'collected', color: 'primary' },
  ],
  collected: [{ label: 'Start Processing', value: 'in_progress', color: 'primary' }],
  in_progress: [{ label: 'Submit Results', value: 'resulted', color: 'primary' }],
  resulted: [{ label: 'Mark Complete', value: 'completed', color: 'primary' }],
  completed: [],
  cancelled: [],
};

const LabOrderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<LabOrder | null>(null);
  const [results, setResults] = useState<LabResult[]>([]);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [statusHistory, setStatusHistory] = useState<LabOrderStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tests');

  // Result entry form
  const [resultForm] = Form.useForm();
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [submittingResults, setSubmittingResults] = useState(false);

  // Specimen collection form
  const [specimenForm] = Form.useForm();
  const [specimenModalOpen, setSpecimenModalOpen] = useState(false);
  const [submittingSpecimen, setSubmittingSpecimen] = useState(false);

  // Cancel modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Status transition loading
  const [transitioning, setTransitioning] = useState(false);
  const [aiSummary, setAiSummary] = useState<ResultSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [orderData, resultsData, specimensData, historyData] = await Promise.all([
        laboratoryService.getOrder(id),
        laboratoryService.getResults(id).catch(() => [] as LabResult[]),
        laboratoryService.getSpecimens(id).catch(() => [] as Specimen[]),
        laboratoryService.getOrderStatusHistory(id).catch(() => [] as LabOrderStatusHistory[]),
      ]);
      setOrder({ ...orderData, tests: orderData.tests || [] });
      setResults(resultsData);
      setSpecimens(specimensData);
      setStatusHistory(historyData);
    } catch (error) {
      console.error('Failed to load lab order:', error);
      message.error('Failed to load lab order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // ── Status transition ──────────────────────────────────────────────────────

  const handleStatusTransition = async (newStatus: string) => {
    if (!order) return;
    setTransitioning(true);
    try {
      await laboratoryService.updateOrderStatus(order.id, newStatus);
      message.success(`Order status changed to ${newStatus.replace('_', ' ')}`);
      await loadOrder();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to update status');
    } finally {
      setTransitioning(false);
    }
  };

  const handleCancel = async () => {
    if (!order || !cancelReason.trim()) {
      message.error('Please provide a cancellation reason');
      return;
    }
    setCancelling(true);
    try {
      await laboratoryService.cancelOrder(order.id, cancelReason);
      message.success('Order cancelled');
      setCancelModalOpen(false);
      setCancelReason('');
      await loadOrder();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  // ── AI Summarization ──────────────────────────────────────────────────────

  const handleSummarize = async () => {
    if (!order) return;
    setSummarizing(true);
    setSummaryModalOpen(true);
    setAiSummary(null);
    try {
      const summary = await laboratoryService.summarizeResults(order.id);
      setAiSummary(summary);
    } catch (error: any) {
      message.error(
        error?.response?.data?.message ||
          'AI summarization failed. Ensure Ollama is running.',
      );
      setSummaryModalOpen(false);
    } finally {
      setSummarizing(false);
    }
  };

  // ── Result submission ──────────────────────────────────────────────────────

  const openResultModal = () => {
    if (!order) return;
    // Pre-fill form with test entries
    const fields: Record<string, any> = {};
    for (const test of order.tests) {
      fields[`value_${test.id}`] = '';
      fields[`unit_${test.id}`] = '';
      fields[`flag_${test.id}`] = 'normal';
      fields[`referenceRange_${test.id}`] = '';
    }
    resultForm.setFieldsValue(fields);
    setResultModalOpen(true);
  };

  const handleSubmitResults = async () => {
    if (!order) return;
    try {
      const values = await resultForm.validateFields();
      const results: LabResultEntryDto[] = [];

      for (const test of order.tests) {
        const value = values[`value_${test.id}`];
        if (value && value.trim()) {
          const unit = values[`unit_${test.id}`] || undefined;
          const flag = values[`flag_${test.id}`] || 'normal';
          const referenceRange = values[`referenceRange_${test.id}`] || undefined;
          const numericValue = parseFloat(value);
          results.push({
            testId: test.id,
            value: value.trim(),
            numericValue: Number.isNaN(numericValue) ? undefined : numericValue,
            unit,
            flag,
            referenceRange,
          });
        }
      }

      if (results.length === 0) {
        message.error('Please enter at least one result value');
        return;
      }

      setSubmittingResults(true);
      await laboratoryService.submitResults(order.id, { results });
      message.success(`${results.length} result(s) submitted successfully`);
      setResultModalOpen(false);
      resultForm.resetFields();
      await loadOrder();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || 'Failed to submit results');
    } finally {
      setSubmittingResults(false);
    }
  };

  // ── Specimen collection ────────────────────────────────────────────────────

  const handleSubmitSpecimen = async () => {
    if (!order) return;
    try {
      const values = await specimenForm.validateFields();
      setSubmittingSpecimen(true);
      await laboratoryService.collectSpecimen(order.id, {
        specimenType: values.specimenType,
        collectionMethod: values.collectionMethod,
        volume: values.volume,
        containerType: values.containerType,
        collectedBy: values.collectedBy,
        condition: values.condition || 'good',
        trackingNumber: values.trackingNumber,
        rejectionReason: values.rejectionReason,
      });
      message.success('Specimen collected successfully');
      setSpecimenModalOpen(false);
      specimenForm.resetFields();
      await loadOrder();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || 'Failed to collect specimen');
    } finally {
      setSubmittingSpecimen(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Loading lab order..." />
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Title level={4}>Lab order not found</Title>
        <Button type="primary" onClick={() => navigate('/laboratory')}>
          Back to Laboratory
        </Button>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[order.status] || [];
  const canCancel = order.status !== 'cancelled' && order.status !== 'completed';
  const canEnterResults = order.status === 'in_progress' || order.status === 'collected' || order.status === 'resulted';

  // Build result map for quick lookup
  const resultMap = new Map(results.map((r) => [r.testId, r]));

  // ── Tests Tab ──────────────────────────────────────────────────────────────

  const testColumns: ColumnsType<any> = [
    { title: 'Test', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: 'LOINC',
      dataIndex: 'loincCode',
      key: 'loincCode',
      width: 100,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Result',
      key: 'result',
      width: 150,
      render: (_: unknown, test: any) => {
        const result = resultMap.get(test.id);
        if (!result) return <Text type="secondary">Pending</Text>;
        const isCritical = result.flag?.startsWith('critical');
        const isAbnormal = result.flag && result.flag !== 'normal';
        return (
          <Space>
            <Text strong style={isCritical ? { color: '#ff4d4f' } : isAbnormal ? { color: '#faad14' } : undefined}>
              {result.value}
            </Text>
            {result.unit && <Text type="secondary">{result.unit}</Text>}
          </Space>
        );
      },
    },
    {
      title: 'Flag',
      key: 'flag',
      width: 120,
      render: (_: unknown, test: any) => {
        const result = resultMap.get(test.id);
        if (!result?.flag || result.flag === 'normal') {
          return result ? <Tag color="green">Normal</Tag> : <Text type="secondary">—</Text>;
        }
        return (
          <Tag color={flagColors[result.flag] || 'default'}>
            {result.flag.replace('_', ' ').toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Ref Range',
      key: 'refRange',
      width: 180,
      render: (_: unknown, test: any) => {
        const result = resultMap.get(test.id);
        const range = result?.referenceRange || test.referenceRange;
        return range ? <Text type="secondary">{range}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>
          {(status || '').replace('_', ' ')}
        </Tag>
      ),
    },
  ];

  // ── Specimens Tab ──────────────────────────────────────────────────────────

  const specimenColumns: ColumnsType<Specimen> = [
    {
      title: 'Type',
      dataIndex: 'specimenType',
      key: 'specimenType',
      width: 120,
    },
    {
      title: 'Method',
      dataIndex: 'collectionMethod',
      key: 'collectionMethod',
      width: 120,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Volume',
      dataIndex: 'volume',
      key: 'volume',
      width: 80,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Container',
      dataIndex: 'containerType',
      key: 'containerType',
      width: 150,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Collected By',
      dataIndex: 'collectedBy',
      key: 'collectedBy',
      width: 120,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Collected At',
      dataIndex: 'collectedAt',
      key: 'collectedAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : <Text type="secondary">—</Text>),
    },
    {
      title: 'Condition',
      dataIndex: 'condition',
      key: 'condition',
      width: 100,
      render: (condition: string) => (
        <Tag color={conditionColors[condition] || 'default'}>{condition}</Tag>
      ),
    },
    {
      title: 'Tracking #',
      dataIndex: 'trackingNumber',
      key: 'trackingNumber',
      width: 120,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
  ];

  // ── Status History Tab ─────────────────────────────────────────────────────

  const timelineItems = [...statusHistory].reverse().map((h) => ({
    color: h.newStatus === 'cancelled' ? 'red' : h.newStatus === 'completed' ? 'green' : 'blue',
    dot: h.newStatus === 'completed' ? <CheckCircleOutlined /> : h.newStatus === 'cancelled' ? <CloseCircleOutlined /> : undefined,
    children: (
      <div>
        <Text strong>{(h.newStatus || '').replace('_', ' ').toUpperCase()}</Text>
        {h.previousStatus && <Text type="secondary"> from {(h.previousStatus || '').replace('_', ' ')}</Text>}
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(h.createdAt).toLocaleString()}
          {h.changedBy ? ` · by ${h.changedBy}` : ''}
        </Text>
        {h.reason && (
          <>
            <br />
            <Text type="secondary">{h.reason}</Text>
          </>
        )}
      </div>
    ),
  }));

  // ── Tab items ──────────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'tests',
      label: (
        <Space>
          <ExperimentOutlined />
          Tests ({order.tests.length})
        </Space>
      ),
      children: (
        <Table
          columns={testColumns}
          dataSource={order.tests}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
        />
      ),
    },
    {
      key: 'specimens',
      label: (
        <Space>
          <InboxOutlined />
          Specimens ({specimens.length})
        </Space>
      ),
      children: (
        <div>
          {order.status !== 'cancelled' && order.status !== 'completed' && (
            <Button
              type="primary"
              icon={<InboxOutlined />}
              onClick={() => setSpecimenModalOpen(true)}
              style={{ marginBottom: 16 }}
            >
              Collect Specimen
            </Button>
          )}
          <Table
            columns={specimenColumns}
            dataSource={specimens}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 900 }}
          />
        </div>
      ),
    },
    {
      key: 'results',
      label: (
        <Space>
          <FileTextOutlined />
          Results ({results.length})
        </Space>
      ),
      children: (
        <div>
          {canEnterResults && (
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={openResultModal}
              style={{ marginBottom: 16 }}
            >
              Enter Results
            </Button>
          )}
          {results.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: 24 }}>
                <FileTextOutlined style={{ fontSize: 32, color: '#999' }} />
                <br />
                <Text type="secondary">No results submitted yet</Text>
              </div>
            </Card>
          ) : (
            <Table
              columns={[
                {
                  title: 'Test',
                  key: 'testName',
                  width: 200,
                  render: (_: unknown, r: LabResult) => {
                    const test = order.tests.find((t) => t.id === r.testId);
                    return test?.name || r.testId;
                  },
                },
                {
                  title: 'Value',
                  dataIndex: 'value',
                  key: 'value',
                  width: 120,
                  render: (v: string, r: LabResult) => (
                    <Space>
                      <Text strong style={r.flag?.startsWith('critical') ? { color: '#ff4d4f' } : undefined}>
                        {v}
                      </Text>
                      {r.unit && <Text type="secondary">{r.unit}</Text>}
                    </Space>
                  ),
                },
                {
                  title: 'Flag',
                  dataIndex: 'flag',
                  key: 'flag',
                  width: 120,
                  render: (flag: string) =>
                    flag ? (
                      <Tag color={flagColors[flag] || 'default'}>
                        {flag.replace('_', ' ').toUpperCase()}
                      </Tag>
                    ) : (
                      <Text type="secondary">—</Text>
                    ),
                },
                {
                  title: 'Ref Range',
                  dataIndex: 'referenceRange',
                  key: 'referenceRange',
                  width: 150,
                  render: (v: string) => v || <Text type="secondary">—</Text>,
                },
                {
                  title: 'Status',
                  dataIndex: 'resultStatus',
                  key: 'resultStatus',
                  width: 100,
                  render: (s: string) => <Tag>{s}</Tag>,
                },
                {
                  title: 'Resulted At',
                  dataIndex: 'resultedAt',
                  key: 'resultedAt',
                  width: 160,
                  render: (v: string) => new Date(v).toLocaleString(),
                },
                {
                  title: 'Acknowledged',
                  key: 'acknowledged',
                  width: 120,
                  render: (_: unknown, r: LabResult) =>
                    r.isAcknowledged ? (
                      <Tag color="green">Yes</Tag>
                    ) : r.flag?.startsWith('critical') ? (
                      <Badge count="!" style={{ backgroundColor: '#ff4d4f' }}>
                        <Tag color="red">Pending</Tag>
                      </Badge>
                    ) : (
                      <Text type="secondary">—</Text>
                    ),
                },
              ]}
              dataSource={results}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 900 }}
            />
          )}
        </div>
      ),
    },
    {
      key: 'history',
      label: (
        <Space>
          <HistoryOutlined />
          Status History
        </Space>
      ),
      children: (
        <Card>
          {timelineItems.length > 0 ? (
            <Timeline items={timelineItems} />
          ) : (
            <Text type="secondary">No status history available</Text>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/laboratory')}
            >
              Back
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              Lab Order Detail
            </Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleSummarize}
              loading={summarizing}
              disabled={results.length === 0}
            >
              AI Summarize
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print
            </Button>
            {canCancel && (
              <Button danger onClick={() => setCancelModalOpen(true)}>
                Cancel Order
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Order summary card */}
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Order ID">
            <Text strong style={{ color: '#0D7C8A' }}>{order.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={statusColors[order.status] || 'default'} style={{ fontSize: 13 }}>
              {(order.status || '').replace('_', ' ').toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Priority">
            <Tag color={priorityColors[order.priority] || 'default'}>
              {(order.priority || '').toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Patient">{order.patientName}</Descriptions.Item>
          <Descriptions.Item label="Provider">{order.providerName}</Descriptions.Item>
          <Descriptions.Item label="Ordered Date">
            {new Date(order.orderedDate).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Fasting Required">
            {order.fastingRequired ? <Tag color="orange">Yes</Tag> : 'No'}
          </Descriptions.Item>
          <Descriptions.Item label="Diagnosis Codes">
            {order.diagnosisCodes?.length > 0
              ? order.diagnosisCodes.map((c) => <Tag key={c}>{c}</Tag>)
              : <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Lab Facility">
            {order.labFacilityName || <Text type="secondary">—</Text>}
          </Descriptions.Item>
        </Descriptions>
        {order.notes && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Paragraph type="secondary">
              <Text strong>Notes: </Text>
              {order.notes}
            </Paragraph>
          </>
        )}
      </Card>

      {/* Status transition actions */}
      {transitions.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <Text strong>Actions:</Text>
            {transitions.map((t) => (
              <Button
                key={t.value}
                type={t.color as any}
                icon={<ArrowRightOutlined />}
                loading={transitioning}
                onClick={() => handleStatusTransition(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </Space>
        </Card>
      )}

      {/* Main content tabs */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      {/* ── Result Entry Modal ─────────────────────────────────────────────── */}
      <Modal
        title="Enter Lab Results"
        open={resultModalOpen}
        onCancel={() => setResultModalOpen(false)}
        onOk={handleSubmitResults}
        okText="Submit Results"
        confirmLoading={submittingResults}
        width={800}
      >
        <Form form={resultForm} layout="vertical">
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Enter result values for each test. Leave blank to skip a test.
          </Text>
          {order.tests.map((test) => (
            <Card
              key={test.id}
              size="small"
              type="inner"
              title={test.name}
              extra={test.loincCode ? <Tag>LOINC: {test.loincCode}</Tag> : undefined}
              style={{ marginBottom: 12 }}
            >
              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name={`value_${test.id}`} label="Value">
                    <Input placeholder="e.g. 7.2" />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name={`unit_${test.id}`} label="Unit">
                    <Input placeholder="e.g. mg/dL" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name={`flag_${test.id}`} label="Flag">
                    <Select
                      options={[
                        { value: 'normal', label: 'Normal' },
                        { value: 'high', label: 'High' },
                        { value: 'low', label: 'Low' },
                        { value: 'critical_high', label: 'Critical High' },
                        { value: 'critical_low', label: 'Critical Low' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={`referenceRange_${test.id}`} label="Ref Range">
                    <Input placeholder="e.g. 4.0-5.6" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}
        </Form>
      </Modal>

      {/* ── Specimen Collection Modal ──────────────────────────────────────── */}
      <Modal
        title="Collect Specimen"
        open={specimenModalOpen}
        onCancel={() => setSpecimenModalOpen(false)}
        onOk={handleSubmitSpecimen}
        okText="Record Collection"
        confirmLoading={submittingSpecimen}
        width={600}
      >
        <Form form={specimenForm} layout="vertical">
          <Form.Item
            name="specimenType"
            label="Specimen Type"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select
              placeholder="Select specimen type..."
              options={[
                { value: 'Whole blood', label: 'Whole blood' },
                { value: 'Serum', label: 'Serum' },
                { value: 'Plasma', label: 'Plasma' },
                { value: 'Urine', label: 'Urine' },
                { value: 'Urine, random', label: 'Urine, random' },
                { value: 'Urine, 24h', label: 'Urine, 24h' },
                { value: 'Stool', label: 'Stool' },
                { value: 'Sputum', label: 'Sputum' },
                { value: 'CSF', label: 'CSF' },
                { value: 'Tissue', label: 'Tissue' },
                { value: 'Swab', label: 'Swab' },
                { value: 'Other', label: 'Other' },
              ]}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="collectionMethod" label="Collection Method">
                <Input placeholder="e.g. Venipuncture" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="volume" label="Volume">
                <Input placeholder="e.g. 5 mL" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="containerType" label="Container Type">
                <Input placeholder="e.g. Lavender top (EDTA)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="collectedBy" label="Collected By">
                <Input placeholder="Name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="condition" label="Condition">
                <Select
                  placeholder="Select condition..."
                  options={[
                    { value: 'good', label: 'Good' },
                    { value: 'hemolyzed', label: 'Hemolyzed' },
                    { value: 'clotted', label: 'Clotted' },
                    { value: 'insufficient', label: 'Insufficient' },
                    { value: 'rejected', label: 'Rejected' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trackingNumber" label="Tracking Number">
                <Input placeholder="Barcode/tracking #" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="rejectionReason" label="Rejection Reason (if rejected)">
            <TextArea rows={2} placeholder="Reason for rejection..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Cancel Order Modal ─────────────────────────────────────────────── */}
      <Modal
        title="Cancel Lab Order"
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        onOk={handleCancel}
        okText="Confirm Cancellation"
        okButtonProps={{ danger: true }}
        confirmLoading={cancelling}
      >
        <Text>Are you sure you want to cancel this lab order?</Text>
        <br />
        <br />
        <Form.Item label="Cancellation Reason" required>
          <TextArea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Provide a reason for cancellation..."
          />
        </Form.Item>
      </Modal>

      {/* AI Summary Modal */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#0D7C8A' }} />
            AI Result Summary
          </Space>
        }
        open={summaryModalOpen}
        onCancel={() => setSummaryModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setSummaryModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={640}
      >
        {summarizing ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="AI is analyzing results..." />
          </div>
        ) : aiSummary ? (
          <div>
            <Alert
              message="AI-Generated Summary"
              description="This summary is generated by AI and should be reviewed by a licensed provider. It is not a substitute for clinical judgment."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {aiSummary.riskLevel && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>Risk Level: </Text>
                <Tag
                  color={
                    aiSummary.riskLevel === 'critical'
                      ? 'red'
                      : aiSummary.riskLevel === 'high'
                        ? 'orange'
                        : aiSummary.riskLevel === 'moderate'
                          ? 'gold'
                          : 'green'
                  }
                  style={{ fontSize: 14, padding: '4px 12px' }}
                >
                  {aiSummary.riskLevel.toUpperCase()}
                </Tag>
              </div>
            )}

            <Card size="small" title="Summary" style={{ marginBottom: 16 }}>
              <Paragraph>{aiSummary.summary}</Paragraph>
            </Card>

            {aiSummary.keyFindings && aiSummary.keyFindings.length > 0 && (
              <Card
                size="small"
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#faad14' }} />
                    Key Findings
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <List
                  size="small"
                  dataSource={aiSummary.keyFindings}
                  renderItem={(item) => (
                    <List.Item>
                      <Text>{item}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {aiSummary.recommendations && aiSummary.recommendations.length > 0 && (
              <Card
                size="small"
                title={
                  <Space>
                    <BulbOutlined style={{ color: '#0D7C8A' }} />
                    Recommendations
                  </Space>
                }
              >
                <List
                  size="small"
                  dataSource={aiSummary.recommendations}
                  renderItem={(item) => (
                    <List.Item>
                      <Text>{item}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </div>
        ) : (
          <Text type="secondary">No summary available.</Text>
        )}
      </Modal>
    </div>
  );
};

export default LabOrderDetailPage;
