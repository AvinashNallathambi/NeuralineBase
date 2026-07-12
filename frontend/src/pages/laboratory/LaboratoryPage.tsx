import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Card,
  Table,
  Tag,
  Space,
  Input,
  Tabs,
  Row,
  Col,
  Statistic,
  Drawer,
  Form,
  Select,
  Switch,
  Spin,
  Modal,
  Alert,
  Descriptions,
  DatePicker,
  Progress,
  message,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  ExperimentOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PrinterOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  HistoryOutlined,
  RobotOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import type { LabOrder, LabTest } from '../../types';
import { useNavigate } from 'react-router-dom';
import { usePatientStore, useProviderStore } from '../../store/dataStore';
import {
  laboratoryService,
  type LabPanel,
  type LabStats,
  type Provider as LabProvider,
  type CreateLabOrderDto,
} from '../../services/laboratoryService';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const priorityColors: Record<string, string> = {
  routine: 'blue',
  urgent: 'orange',
  stat: 'red',
};

const statusColors: Record<string, string> = {
  ordered: 'gold',
  in_progress: 'processing',
  completed: 'green',
  cancelled: 'default',
  pending: 'gold',
  abnormal: 'red',
  scheduled: 'cyan',
};

const LaboratoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { patients, fetchPatients } = usePatientStore();
  const { providers: mockProviders } = useProviderStore();
  const [activeTab, setActiveTab] = useState('orders');
  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  // Real API data state
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [labPanels, setLabPanels] = useState<LabPanel[]>([]);
  const [apiProviders, setApiProviders] = useState<LabProvider[]>([]);
  const [stats, setStats] = useState<LabStats>({
    pendingOrders: 0,
    completedToday: 0,
    abnormalResults: 0,
    criticalUnacknowledged: 0,
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [criticalResults, setCriticalResults] = useState<any[]>([]);
  const [pendingReviewResults, setPendingReviewResults] = useState<any[]>([]);
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [ackResult, setAckResult] = useState<any>(null);
  const [ackNote, setAckNote] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);
  const [imagingOrders, setImagingOrders] = useState<any[]>([]);
  const [imagingDrawerOpen, setImagingDrawerOpen] = useState(false);
  const [imagingForm] = Form.useForm();
  const [submittingImaging, setSubmittingImaging] = useState(false);
  const [findingsModalOpen, setFindingsModalOpen] = useState(false);
  const [imagingDetail, setImagingDetail] = useState<any>(null);
  const [findingsForm] = Form.useForm();
  const [submittingFindings, setSubmittingFindings] = useState(false);
  const [triageScores, setTriageScores] = useState<any[]>([]);
  const [triageLoading, setTriageLoading] = useState(false);
  const [nlQuery, setNlQuery] = useState('');
  const [nlResults, setNlResults] = useState<any>(null);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlModalOpen, setNlModalOpen] = useState(false);

  // Fetch real data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [ordersResult, panels, providersData, statsData, critical, pendingReview, imaging] = await Promise.all([
          laboratoryService.getOrders({ page: 1, limit: 100 }),
          laboratoryService.getPanels(),
          laboratoryService.getProviders().catch(() => [] as LabProvider[]),
          laboratoryService.getStats().catch(() => ({
            pendingOrders: 0,
            completedToday: 0,
            abnormalResults: 0,
            criticalUnacknowledged: 0,
          })),
          laboratoryService.getCriticalResults().catch(() => [] as any[]),
          laboratoryService.getPendingReviewResults().catch(() => [] as any[]),
          laboratoryService.getImagingOrders({ page: 1, limit: 100 }).catch(() => ({ data: [] as any[], total: 0, page: 1, limit: 100 })),
        ]);
        setLabOrders(ordersResult.data.map((o: any) => ({ ...o, tests: o.tests || [] })));
        setLabPanels(panels);
        setApiProviders(providersData);
        setStats(statsData);
        setCriticalResults(critical);
        setPendingReviewResults(pendingReview);
        setImagingOrders(imaging.data || []);
      } catch (error) {
        console.error('Failed to load lab data:', error);
        message.error('Failed to load lab data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
    // Fetch patients if not already loaded
    if (patients.length === 0) {
      fetchPatients();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Use API providers if available, fall back to mock providers
  const providers = apiProviders.length > 0 ? apiProviders : mockProviders;

  // Stats from real data
  const pendingOrders = stats.pendingOrders;
  const completedToday = stats.completedToday;
  const abnormalResults = stats.abnormalResults;

  // Filtered lab orders
  const filteredOrders = useMemo(() => {
    if (!searchText) return labOrders;
    const lower = searchText.toLowerCase();
    return labOrders.filter(
      (o) =>
        o.patientName.toLowerCase().includes(lower) ||
        o.id.toLowerCase().includes(lower) ||
        o.tests.some((t) => t.name.toLowerCase().includes(lower))
    );
  }, [searchText, labOrders]);

  // Submit new lab order
  const handleSubmitOrder = async () => {
    try {
      const values = await form.validateFields();

      // Build the tests array from selected panels and individual tests
      const tests: { name: string; loincCode?: string; cptCode?: string; category?: string; specimenType?: string }[] = [];

      // Expand selected panels into individual tests
      if (values.panels) {
        for (const panelCode of values.panels as string[]) {
          const panel = labPanels.find((p) => p.code === panelCode || p.id === panelCode);
          if (panel) {
            for (const t of panel.tests) {
              tests.push({
                name: t.name,
                loincCode: t.loincCode,
                category: t.category || panel.category || undefined,
              });
            }
          }
        }
      }

      // Add individual tests (from the hardcoded list — mapped to names)
      if (values.individualTests) {
        const individualTestMap: Record<string, { name: string; category?: string }> = {
          WBC: { name: 'White Blood Cell Count', category: 'Hematology' },
          RBC: { name: 'Red Blood Cell Count', category: 'Hematology' },
          HGB: { name: 'Hemoglobin', category: 'Hematology' },
          HCT: { name: 'Hematocrit', category: 'Hematology' },
          PLT: { name: 'Platelet Count', category: 'Hematology' },
          Na: { name: 'Sodium', category: 'Chemistry' },
          K: { name: 'Potassium', category: 'Chemistry' },
          Cl: { name: 'Chloride', category: 'Chemistry' },
          CO2: { name: 'CO2', category: 'Chemistry' },
          BUN: { name: 'Blood Urea Nitrogen', category: 'Chemistry' },
          Cr: { name: 'Creatinine', category: 'Chemistry' },
          Glu: { name: 'Glucose', category: 'Chemistry' },
          Ca: { name: 'Calcium', category: 'Chemistry' },
          Mg: { name: 'Magnesium', category: 'Chemistry' },
          Phos: { name: 'Phosphorus', category: 'Chemistry' },
          UA: { name: 'Uric Acid', category: 'Chemistry' },
          Fe: { name: 'Iron', category: 'Chemistry' },
          TIBC: { name: 'Total Iron Binding Capacity', category: 'Chemistry' },
          Ferritin: { name: 'Ferritin', category: 'Chemistry' },
          VitD: { name: 'Vitamin D, 25-Hydroxy', category: 'Endocrine' },
          VitB12: { name: 'Vitamin B12', category: 'Endocrine' },
          Folate: { name: 'Folate', category: 'Endocrine' },
          ESR: { name: 'Erythrocyte Sedimentation Rate', category: 'Hematology' },
          CRP: { name: 'C-Reactive Protein', category: 'Chemistry' },
        };
        for (const testCode of values.individualTests as string[]) {
          const t = individualTestMap[testCode];
          if (t) {
            // Avoid duplicates if already included via a panel
            if (!tests.some((existing) => existing.name === t.name)) {
              tests.push({ name: t.name, category: t.category });
            }
          }
        }
      }

      if (tests.length === 0) {
        message.error('No tests selected. Please select at least one panel or individual test.');
        return;
      }

      // Find the selected patient and provider
      const patient = patients.find((p) => p.id === values.patientId);
      const provider = providers.find((p) => p.id === values.providerId);

      if (!patient) {
        message.error('Please select a valid patient');
        return;
      }
      if (!provider) {
        message.error('Please select a valid provider');
        return;
      }

      const dto: CreateLabOrderDto = {
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        providerId: provider.id,
        providerName: `${provider.firstName} ${provider.lastName}`,
        tests,
        priority: values.priority || 'routine',
        fastingRequired: values.fasting || false,
        notes: values.clinicalNotes || undefined,
      };

      setSubmitting(true);
      const created = await laboratoryService.createOrder(dto);
      message.success(`Lab order created successfully (${created.id.slice(0, 8)})!`);

      // Refresh orders list
      const ordersResult = await laboratoryService.getOrders({ page: 1, limit: 100 });
      setLabOrders(ordersResult.data.map((o: any) => ({ ...o, tests: o.tests || [] })));

      // Refresh stats
      const statsData = await laboratoryService.getStats().catch(() => stats);
      setStats(statsData);

      setDrawerOpen(false);
      form.resetFields();
    } catch (error: any) {
      if (error?.errorFields) return; // form validation error, don't show
      console.error('Failed to create lab order:', error);
      message.error(error?.response?.data?.message || 'Failed to create lab order');
    } finally {
      setSubmitting(false);
    }
  };

  // Acknowledge critical result
  const handleAcknowledge = async () => {
    if (!ackResult) return;
    setAcknowledging(true);
    try {
      await laboratoryService.acknowledgeResult(ackResult.id, ackNote || undefined);
      message.success('Critical result acknowledged');
      setAckModalOpen(false);
      setAckResult(null);
      setAckNote('');
      // Refresh critical results and stats
      const [critical, statsData] = await Promise.all([
        laboratoryService.getCriticalResults().catch(() => [] as any[]),
        laboratoryService.getStats().catch(() => stats),
      ]);
      setCriticalResults(critical);
      setStats(statsData);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to acknowledge result');
    } finally {
      setAcknowledging(false);
    }
  };

  // Submit new imaging order
  const handleSubmitImaging = async () => {
    try {
      const values = await imagingForm.validateFields();
      const patient = patients.find((p) => p.id === values.patientId);
      const provider = providers.find((p) => p.id === values.providerId);
      if (!patient || !provider) {
        message.error('Patient or provider not found');
        return;
      }
      setSubmittingImaging(true);
      await laboratoryService.createImagingOrder({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        providerId: provider.id,
        providerName: `${provider.firstName} ${provider.lastName}`,
        modality: values.modality,
        bodyPart: values.bodyPart,
        studyName: values.studyName,
        cptCode: values.cptCode,
        priority: values.priority || 'routine',
        notes: values.notes,
        scheduledDate: values.scheduledDate?.toISOString(),
      });
      message.success('Imaging order created successfully');
      setImagingDrawerOpen(false);
      imagingForm.resetFields();
      // Refresh imaging orders
      const imaging = await laboratoryService.getImagingOrders({ page: 1, limit: 100 });
      setImagingOrders(imaging.data || []);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || 'Failed to create imaging order');
    } finally {
      setSubmittingImaging(false);
    }
  };

  // Submit imaging findings
  const handleSubmitFindings = async () => {
    if (!imagingDetail) return;
    try {
      const values = await findingsForm.validateFields();
      setSubmittingFindings(true);
      const updated = await laboratoryService.submitImagingFindings(imagingDetail.id, {
        findings: values.findings,
        impression: values.impression,
        radiologyReportUrl: values.radiologyReportUrl,
      });
      message.success('Findings submitted successfully');
      setFindingsModalOpen(false);
      setImagingDetail(null);
      findingsForm.resetFields();
      // Update imaging orders list
      const imaging = await laboratoryService.getImagingOrders({ page: 1, limit: 100 });
      setImagingOrders(imaging.data || []);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || 'Failed to submit findings');
    } finally {
      setSubmittingFindings(false);
    }
  };

  // AI Triage
  const handleLoadTriage = async () => {
    setTriageLoading(true);
    try {
      const scores = await laboratoryService.triageAbnormalResults();
      setTriageScores(scores);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'AI triage failed. Ensure Ollama is running.');
    } finally {
      setTriageLoading(false);
    }
  };

  // Natural language query
  const handleNaturalLanguageQuery = async () => {
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    setNlModalOpen(true);
    setNlResults(null);
    try {
      const results = await laboratoryService.naturalLanguageQuery(nlQuery.trim());
      setNlResults(results);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'AI query failed. Ensure Ollama is running.');
      setNlModalOpen(false);
    } finally {
      setNlLoading(false);
    }
  };

  // ─── Lab Orders Tab ─────────────────────────────────────────────────────

  const expandedOrderRow = (record: LabOrder) => {
    const testColumns: ColumnsType<LabTest> = [
      { title: 'Test', dataIndex: 'name', key: 'name', width: 200 },
      { title: 'Code', dataIndex: 'code', key: 'code', width: 80 },
      { title: 'Category', dataIndex: 'category', key: 'category', width: 120 },
      {
        title: 'Result',
        dataIndex: 'result',
        key: 'result',
        width: 280,
        render: (result: string, test: LabTest) => {
          if (!result) return <Text type="secondary">Pending</Text>;
          const isAbnormal = test.status === 'abnormal';
          return (
            <Space>
              <Text style={isAbnormal ? { color: '#ff4d4f', fontWeight: 600 } : undefined}>
                {result}
              </Text>
              {isAbnormal && test.abnormalFlag && (
                <Tag color="red" icon={test.abnormalFlag === 'high' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
                  {test.abnormalFlag.toUpperCase()}
                </Tag>
              )}
            </Space>
          );
        },
      },
      {
        title: 'Reference Range',
        dataIndex: 'referenceRange',
        key: 'referenceRange',
        width: 220,
        render: (range: string) => range || '-',
      },
      { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 80, render: (u: string) => u || '-' },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: string) => (
          <Tag color={statusColors[status] || 'default'}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Tag>
        ),
      },
    ];

    return (
      <Table
        columns={testColumns}
        dataSource={record.tests}
        rowKey="id"
        pagination={false}
        size="small"
      />
    );
  };

  const orderColumns: ColumnsType<LabOrder> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string) => <Text strong style={{ color: '#0D7C8A' }}>{id}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'orderedDate',
      key: 'orderedDate',
      width: 110,
      sorter: (a, b) => a.orderedDate.localeCompare(b.orderedDate),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 150,
    },
    {
      title: 'Tests Ordered',
      key: 'tests',
      width: 280,
      render: (_: unknown, record: LabOrder) => (
        <Space wrap>
          {record.tests.map((t) => (
            <Tag
              key={t.id}
              color={t.status === 'abnormal' ? 'red' : undefined}
            >
              {t.status === 'abnormal' && <ExclamationCircleOutlined style={{ marginRight: 4 }} />}
              {t.code}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => (
        <Tag color={priorityColors[priority] || 'default'}>
          {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>
          {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_: unknown, record: LabOrder) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/laboratory/${record.id}`);
              }}
            />
          </Tooltip>
          <Tooltip title="Patient Lab History">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/laboratory/patient/${record.patientId}`);
              }}
            />
          </Tooltip>
          <Tooltip title="Print">
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                message.info('Printing lab order...');
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ─── Results Tab ────────────────────────────────────────────────────────

  const completedOrders = labOrders.filter((o) => o.status === 'completed');

  const resultColumns: ColumnsType<LabOrder> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string) => <Text strong style={{ color: '#0D7C8A' }}>{id}</Text>,
    },
    {
      title: 'Completed',
      dataIndex: 'completedDate',
      key: 'completedDate',
      width: 110,
      sorter: (a, b) => (a.completedDate || '').localeCompare(b.completedDate || ''),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 150,
    },
    {
      title: 'Provider',
      dataIndex: 'providerName',
      key: 'providerName',
      width: 150,
    },
    {
      title: 'Tests',
      key: 'tests',
      width: 280,
      render: (_: unknown, record: LabOrder) => (
        <Space wrap>
          {record.tests.map((t) => {
            const isAbnormal = t.status === 'abnormal';
            return (
              <Badge key={t.id} dot={isAbnormal} offset={[-2, 2]}>
                <Tag color={isAbnormal ? 'red' : 'green'}>
                  {isAbnormal && <ExclamationCircleOutlined style={{ marginRight: 4 }} />}
                  {t.name}
                </Tag>
              </Badge>
            );
          })}
        </Space>
      ),
    },
    {
      title: 'Abnormal',
      key: 'abnormal',
      width: 100,
      render: (_: unknown, record: LabOrder) => {
        const abnCount = record.tests.filter((t) => t.status === 'abnormal').length;
        return abnCount > 0 ? (
          <Tag color="red" icon={<WarningOutlined />}>
            {abnCount} abnormal
          </Tag>
        ) : (
          <Tag color="green">Normal</Tag>
        );
      },
    },
  ];

  // ─── Imaging Tab ────────────────────────────────────────────────────────

  const imagingColumns: ColumnsType<any> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text strong style={{ color: '#0D7C8A' }}>{id.slice(0, 8)}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'orderedDate',
      key: 'orderedDate',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 150,
    },
    {
      title: 'Modality',
      dataIndex: 'modality',
      key: 'modality',
      width: 100,
      render: (modality: string) => <Tag color="purple">{modality.toUpperCase()}</Tag>,
    },
    {
      title: 'Study',
      dataIndex: 'studyName',
      key: 'studyName',
      width: 200,
    },
    {
      title: 'Body Part',
      dataIndex: 'bodyPart',
      key: 'bodyPart',
      width: 120,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => (
        <Tag color={priorityColors[priority]}>
          {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Findings',
      dataIndex: 'findings',
      key: 'findings',
      ellipsis: true,
      render: (findings: string) =>
        findings ? (
          <Tooltip title={findings}>
            <Text>{findings.slice(0, 50)}...</Text>
          </Tooltip>
        ) : (
          <Text type="secondary">Pending</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: any) => (
        <Tooltip title="View Findings">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setImagingDetail(record);
              setFindingsModalOpen(true);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'orders',
      label: (
        <Space>
          <ExperimentOutlined />
          Lab Orders
        </Space>
      ),
      children: (
        <div>
          <Input
            placeholder="Search by patient, order ID, or test name..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ marginBottom: 16, maxWidth: 400 }}
          />
          <Table
            columns={orderColumns}
            dataSource={filteredOrders}
            rowKey="id"
            expandable={{ expandedRowRender: expandedOrderRow }}
            onRow={(record) => ({
              onClick: () => navigate(`/laboratory/${record.id}`),
              style: { cursor: 'pointer' },
            })}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} orders` }}
            scroll={{ x: 1100 }}
          />
        </div>
      ),
    },
    {
      key: 'results',
      label: (
        <Space>
          <CheckCircleOutlined />
          Results
        </Space>
      ),
      children: (
        <Table
          columns={resultColumns}
          dataSource={completedOrders}
          rowKey="id"
          expandable={{ expandedRowRender: expandedOrderRow }}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} results` }}
          scroll={{ x: 1000 }}
        />
      ),
    },
    {
      key: 'critical',
      label: (
        <Space>
          <WarningOutlined />
          Critical Values
          {criticalResults.length > 0 && (
            <Badge count={criticalResults.length} style={{ backgroundColor: '#ff4d4f' }} />
          )}
        </Space>
      ),
      children: (
        <div>
          {criticalResults.length > 0 && (
            <Alert
              message="Unacknowledged Critical Results"
              description="These results require immediate provider acknowledgment (critical value read-back)."
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Table
            columns={[
              {
                title: 'Test',
                key: 'testName',
                width: 200,
                render: (_: unknown, r: any) => {
                  const order = labOrders.find((o) => o.id === r.orderId);
                  const test = order?.tests.find((t) => t.id === r.testId);
                  return test?.name || r.testId;
                },
              },
              {
                title: 'Value',
                dataIndex: 'value',
                key: 'value',
                width: 120,
                render: (v: string, r: any) => (
                  <Space>
                    <Text strong style={{ color: '#ff4d4f' }}>{v}</Text>
                    {r.unit && <Text type="secondary">{r.unit}</Text>}
                  </Space>
                ),
              },
              {
                title: 'Flag',
                dataIndex: 'flag',
                key: 'flag',
                width: 130,
                render: (flag: string) => (
                  <Tag color="red">{flag?.replace('_', ' ').toUpperCase()}</Tag>
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
                title: 'Resulted At',
                dataIndex: 'resultedAt',
                key: 'resultedAt',
                width: 160,
                render: (v: string) => new Date(v).toLocaleString(),
              },
              {
                title: 'Action',
                key: 'action',
                width: 140,
                render: (_: unknown, r: any) => (
                  <Button
                    type="primary"
                    danger
                    size="small"
                    onClick={() => {
                      setAckResult(r);
                      setAckNote('');
                      setAckModalOpen(true);
                    }}
                  >
                    Acknowledge
                  </Button>
                ),
              },
            ]}
            dataSource={criticalResults}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 900 }}
            locale={{ emptyText: 'No unacknowledged critical results' }}
          />
        </div>
      ),
    },
    {
      key: 'pendingReview',
      label: (
        <Space>
          <CheckCircleOutlined />
          Pending Review
          {pendingReviewResults.length > 0 && (
            <Badge count={pendingReviewResults.length} style={{ backgroundColor: '#faad14' }} />
          )}
        </Space>
      ),
      children: (
        <Table
          columns={[
            {
              title: 'Test',
              key: 'testName',
              width: 200,
              render: (_: unknown, r: any) => {
                const order = labOrders.find((o) => o.id === r.orderId);
                const test = order?.tests.find((t) => t.id === r.testId);
                return test?.name || r.testId;
              },
            },
            {
              title: 'Value',
              dataIndex: 'value',
              key: 'value',
              width: 120,
              render: (v: string, r: any) => (
                <Space>
                  <Text strong>{v}</Text>
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
                flag && flag !== 'normal' ? (
                  <Tag color={flag.startsWith('critical') ? 'red' : 'orange'}>
                    {flag.replace('_', ' ').toUpperCase()}
                  </Tag>
                ) : (
                  <Tag color="green">Normal</Tag>
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
              title: 'Resulted At',
              dataIndex: 'resultedAt',
              key: 'resultedAt',
              width: 160,
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: 'Order',
              key: 'order',
              width: 100,
              render: (_: unknown, r: any) => (
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate(`/laboratory/${r.orderId}`)}
                >
                  View Order
                </Button>
              ),
            },
          ]}
          dataSource={pendingReviewResults}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
          locale={{ emptyText: 'No results pending review' }}
        />
      ),
    },
    {
      key: 'triage',
      label: (
        <Space>
          <RobotOutlined />
          AI Triage
        </Space>
      ),
      children: (
        <div>
          <Alert
            message="AI-Powered Smart Triage"
            description="Scores abnormal results by clinical urgency using AI. Click 'Run Triage' to analyze all abnormal results."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleLoadTriage}
            loading={triageLoading}
            style={{ marginBottom: 16 }}
          >
            Run AI Triage
          </Button>
          {triageScores.length > 0 ? (
            <Table
              columns={[
                {
                  title: 'Score',
                  dataIndex: 'triageScore',
                  key: 'triageScore',
                  width: 120,
                  render: (score: number, r: any) => (
                    <Space direction="vertical" style={{ width: 100 }}>
                      <Progress
                        percent={score}
                        size="small"
                        strokeColor={
                          score >= 80 ? '#ff4d4f' : score >= 60 ? '#faad14' : score >= 30 ? '#1890ff' : '#52c41a'
                        }
                        format={() => `${score}`}
                      />
                    </Space>
                  ),
                  sorter: (a: any, b: any) => b.triageScore - a.triageScore,
                  defaultSortOrder: 'descend' as const,
                },
                {
                  title: 'Category',
                  dataIndex: 'triageCategory',
                  key: 'triageCategory',
                  width: 100,
                  render: (cat: string) => {
                    const colors: Record<string, string> = {
                      critical: 'red',
                      urgent: 'orange',
                      abnormal: 'blue',
                      normal: 'green',
                    };
                    return <Tag color={colors[cat] || 'default'}>{(cat || '').toUpperCase()}</Tag>;
                  },
                },
                {
                  title: 'Test',
                  dataIndex: 'testName',
                  key: 'testName',
                  width: 180,
                },
                {
                  title: 'Value',
                  dataIndex: 'value',
                  key: 'value',
                  width: 100,
                  render: (v: string, r: any) => (
                    <Text strong style={r.flag?.startsWith('critical') ? { color: '#ff4d4f' } : undefined}>
                      {v}
                    </Text>
                  ),
                },
                {
                  title: 'Flag',
                  dataIndex: 'flag',
                  key: 'flag',
                  width: 120,
                  render: (flag: string) => (
                    <Tag color={flag?.startsWith('critical') ? 'red' : 'orange'}>
                      {(flag || '').replace('_', ' ').toUpperCase()}
                    </Tag>
                  ),
                },
                {
                  title: 'AI Reasoning',
                  dataIndex: 'reasoning',
                  key: 'reasoning',
                  ellipsis: true,
                  render: (v: string) => <Text type="secondary">{v}</Text>,
                },
                {
                  title: 'Suggested Action',
                  dataIndex: 'suggestedAction',
                  key: 'suggestedAction',
                  ellipsis: true,
                  render: (v: string) => (
                    <Space>
                      <BulbOutlined style={{ color: '#0D7C8A' }} />
                      <Text>{v}</Text>
                    </Space>
                  ),
                },
              ]}
              dataSource={triageScores}
              rowKey="resultId"
              pagination={false}
              size="small"
              scroll={{ x: 1000 }}
            />
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: 24 }}>
                <RobotOutlined style={{ fontSize: 32, color: '#999' }} />
                <br />
                <Text type="secondary">
                  {triageLoading ? 'AI is analyzing abnormal results...' : 'No triage scores yet. Click "Run AI Triage" to analyze.'}
                </Text>
              </div>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'imaging',
      label: (
        <Space>
          <EyeOutlined />
          Imaging
        </Space>
      ),
      children: (
        <div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setImagingDrawerOpen(true)}
            style={{ marginBottom: 16 }}
          >
            New Imaging Order
          </Button>
          <Table
            columns={imagingColumns}
            dataSource={imagingOrders}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} imaging orders` }}
            scroll={{ x: 1200 }}
            locale={{ emptyText: 'No imaging orders found' }}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Laboratory & Diagnostics
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => setDrawerOpen(true)}
          >
            New Lab Order
          </Button>
        </Col>
      </Row>

      {/* AI Natural Language Query Bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder='AI Search: e.g. "Which patients have high HbA1c?" or "Show critical results"'
            prefix={<RobotOutlined style={{ color: '#0D7C8A' }} />}
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            onPressEnter={handleNaturalLanguageQuery}
            allowClear
          />
          <Button
            type="primary"
            onClick={handleNaturalLanguageQuery}
            loading={nlLoading}
          >
            Ask AI
          </Button>
        </Space.Compact>
      </Card>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Pending Orders"
              value={pendingOrders}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Completed Today"
              value={completedToday}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Abnormal Results"
              value={abnormalResults}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Card>
        <Spin spinning={loading}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Spin>
      </Card>

      {/* New Lab Order Drawer */}
      <Drawer
        title="New Lab Order"
        placement="right"
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmitOrder}>
              Submit Order
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading && patients.length === 0}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="patientId"
              label="Patient"
              rules={[{ required: true, message: 'Please select a patient' }]}
            >
              <Select
                showSearch
                placeholder="Select patient..."
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                }
                options={patients.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName} (${p.mrn})`,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="providerId"
              label="Ordering Provider"
              rules={[{ required: true, message: 'Please select a provider' }]}
            >
              <Select
                showSearch
                placeholder="Select provider..."
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                }
                options={providers.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}${p.specialization ? ` — ${p.specialization}` : ''}`,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="panels"
              label="Lab Panels"
              rules={[{ required: true, message: 'Select at least one panel or test' }]}
            >
              <Select
                mode="multiple"
                placeholder="Select lab panels..."
                options={labPanels.map((p) => ({
                  value: p.code || p.id,
                  label: `${p.name}${p.tests.length > 0 ? ` (${p.tests.length} tests)` : ''}`,
                }))}
              />
            </Form.Item>

            <Form.Item name="individualTests" label="Individual Tests">
              <Select
                mode="multiple"
                placeholder="Add individual tests..."
                options={[
                  { value: 'WBC', label: 'White Blood Cell Count' },
                  { value: 'RBC', label: 'Red Blood Cell Count' },
                  { value: 'HGB', label: 'Hemoglobin' },
                  { value: 'HCT', label: 'Hematocrit' },
                  { value: 'PLT', label: 'Platelet Count' },
                  { value: 'Na', label: 'Sodium' },
                  { value: 'K', label: 'Potassium' },
                  { value: 'Cl', label: 'Chloride' },
                  { value: 'CO2', label: 'CO2' },
                  { value: 'BUN', label: 'Blood Urea Nitrogen' },
                  { value: 'Cr', label: 'Creatinine' },
                  { value: 'Glu', label: 'Glucose' },
                  { value: 'Ca', label: 'Calcium' },
                  { value: 'Mg', label: 'Magnesium' },
                  { value: 'Phos', label: 'Phosphorus' },
                  { value: 'UA', label: 'Uric Acid' },
                  { value: 'Fe', label: 'Iron' },
                  { value: 'TIBC', label: 'Total Iron Binding Capacity' },
                  { value: 'Ferritin', label: 'Ferritin' },
                  { value: 'VitD', label: 'Vitamin D, 25-Hydroxy' },
                  { value: 'VitB12', label: 'Vitamin B12' },
                  { value: 'Folate', label: 'Folate' },
                  { value: 'ESR', label: 'Erythrocyte Sedimentation Rate' },
                  { value: 'CRP', label: 'C-Reactive Protein' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="priority"
              label="Priority"
              rules={[{ required: true, message: 'Select priority' }]}
            >
              <Select
                placeholder="Select priority"
                options={[
                  { value: 'routine', label: 'Routine' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'stat', label: 'STAT' },
                ]}
              />
            </Form.Item>

            <Form.Item name="clinicalNotes" label="Clinical Notes">
              <TextArea rows={3} placeholder="Enter clinical notes or reason for order..." />
            </Form.Item>

            <Form.Item name="fasting" label="Fasting Required" valuePropName="checked">
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </Form>
        </Spin>
      </Drawer>

      {/* Critical Value Acknowledgment Modal */}
      <Modal
        title="Acknowledge Critical Result"
        open={ackModalOpen}
        onCancel={() => {
          setAckModalOpen(false);
          setAckResult(null);
          setAckNote('');
        }}
        onOk={handleAcknowledge}
        okText="Confirm Acknowledgment"
        okButtonProps={{ danger: true }}
        confirmLoading={acknowledging}
        width={500}
      >
        {ackResult && (
          <div>
            <Alert
              message="Critical Value Read-Back Required"
              description="By acknowledging, you confirm you have reviewed this critical result and completed the read-back protocol."
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Value">
                <Text strong style={{ color: '#ff4d4f' }}>
                  {ackResult.value} {ackResult.unit}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Flag">
                <Tag color="red">{ackResult.flag?.replace('_', ' ').toUpperCase()}</Tag>
              </Descriptions.Item>
              {ackResult.referenceRange && (
                <Descriptions.Item label="Ref Range">{ackResult.referenceRange}</Descriptions.Item>
              )}
              <Descriptions.Item label="Resulted At">
                {new Date(ackResult.resultedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Text>Acknowledgment Note (optional):</Text>
              <Input.TextArea
                rows={3}
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                placeholder="Add any clinical notes about this critical value..."
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* New Imaging Order Drawer */}
      <Drawer
        title="New Imaging Order"
        placement="right"
        width={520}
        open={imagingDrawerOpen}
        onClose={() => setImagingDrawerOpen(false)}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setImagingDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={submittingImaging} onClick={handleSubmitImaging}>
              Submit Order
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading && patients.length === 0}>
          <Form form={imagingForm} layout="vertical">
            <Form.Item
              name="patientId"
              label="Patient"
              rules={[{ required: true, message: 'Please select a patient' }]}
            >
              <Select
                showSearch
                placeholder="Select patient..."
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                }
                options={patients.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName} (${p.mrn})`,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="providerId"
              label="Ordering Provider"
              rules={[{ required: true, message: 'Please select a provider' }]}
            >
              <Select
                showSearch
                placeholder="Select provider..."
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                }
                options={providers.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}${p.specialization ? ` — ${p.specialization}` : ''}`,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="modality"
              label="Modality"
              rules={[{ required: true, message: 'Select modality' }]}
            >
              <Select
                placeholder="Select imaging modality..."
                options={[
                  { value: 'xray', label: 'X-Ray' },
                  { value: 'mri', label: 'MRI' },
                  { value: 'ct', label: 'CT Scan' },
                  { value: 'ultrasound', label: 'Ultrasound' },
                  { value: 'mammogram', label: 'Mammogram' },
                  { value: 'dexa', label: 'DEXA Scan' },
                  { value: 'other', label: 'Other' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="studyName"
              label="Study Name"
              rules={[{ required: true, message: 'Enter study name' }]}
            >
              <Input placeholder="e.g. Chest X-Ray PA and Lateral" />
            </Form.Item>

            <Form.Item
              name="bodyPart"
              label="Body Part"
              rules={[{ required: true, message: 'Enter body part' }]}
            >
              <Input placeholder="e.g. Chest" />
            </Form.Item>

            <Form.Item name="cptCode" label="CPT Code">
              <Input placeholder="e.g. 71046" />
            </Form.Item>

            <Form.Item name="priority" label="Priority">
              <Select
                placeholder="Select priority"
                options={[
                  { value: 'routine', label: 'Routine' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'stat', label: 'STAT' },
                ]}
              />
            </Form.Item>

            <Form.Item name="scheduledDate" label="Scheduled Date">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="notes" label="Clinical Notes">
              <TextArea rows={3} placeholder="Clinical indication / reason for study..." />
            </Form.Item>
          </Form>
        </Spin>
      </Drawer>

      {/* Imaging Findings Modal */}
      <Drawer
        title="Imaging Findings"
        open={findingsModalOpen}
        size={700}
        onClose={() => {
          setFindingsModalOpen(false);
          setImagingDetail(null);
          findingsForm.resetFields();
        }}
        footer={
          <Space>
            <Button
              onClick={() => {
                setFindingsModalOpen(false);
                setImagingDetail(null);
                findingsForm.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              loading={submittingFindings}
              onClick={handleSubmitFindings}
            >
              Submit Findings
            </Button>
          </Space>
        }
      >
        {imagingDetail && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Patient">{imagingDetail.patientName}</Descriptions.Item>
              <Descriptions.Item label="Modality">
                <Tag color="purple">{imagingDetail.modality?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Study">{imagingDetail.studyName}</Descriptions.Item>
              <Descriptions.Item label="Body Part">{imagingDetail.bodyPart}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[imagingDetail.status] || 'default'}>
                  {imagingDetail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ordered">
                {imagingDetail.orderedDate ? new Date(imagingDetail.orderedDate).toLocaleString() : '—'}
              </Descriptions.Item>
            </Descriptions>

            {imagingDetail.findings && (
              <Card size="small" title="Current Findings" style={{ marginBottom: 16 }}>
                <Paragraph>{imagingDetail.findings}</Paragraph>
                {imagingDetail.impression && (
                  <>
                    <Text strong>Impression: </Text>
                    <Paragraph>{imagingDetail.impression}</Paragraph>
                  </>
                )}
              </Card>
            )}

            <Form form={findingsForm} layout="vertical">
              <Form.Item
                name="findings"
                label="Findings"
                rules={[{ required: true, message: 'Enter findings' }]}
              >
                <TextArea rows={4} placeholder="Enter radiology findings..." />
              </Form.Item>
              <Form.Item name="impression" label="Impression">
                <TextArea rows={3} placeholder="Radiologist impression..." />
              </Form.Item>
              <Form.Item name="radiologyReportUrl" label="Report URL">
                <Input placeholder="https://..." />
              </Form.Item>
            </Form>
          </div>
        )}
      </Drawer>

      {/* AI Natural Language Query Results Modal */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#0D7C8A' }} />
            AI Query Results
          </Space>
        }
        open={nlModalOpen}
        onCancel={() => setNlModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setNlModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {nlLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="AI is processing your query..." />
          </div>
        ) : nlResults ? (
          <div>
            <Alert
              message="AI-Generated Results"
              description={nlResults.summary}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              {nlResults.interpretation}
            </Text>
            {nlResults.matchedOrders && nlResults.matchedOrders.length > 0 ? (
              <Table
                columns={[
                  {
                    title: 'Patient',
                    dataIndex: 'patientName',
                    key: 'patientName',
                    width: 150,
                  },
                  {
                    title: 'Test',
                    dataIndex: 'testName',
                    key: 'testName',
                    width: 180,
                  },
                  {
                    title: 'Value',
                    dataIndex: 'value',
                    key: 'value',
                    width: 100,
                    render: (v: string, r: any) => (
                      <Text strong style={r.flag?.startsWith('critical') ? { color: '#ff4d4f' } : undefined}>
                        {v}
                      </Text>
                    ),
                  },
                  {
                    title: 'Flag',
                    dataIndex: 'flag',
                    key: 'flag',
                    width: 120,
                    render: (flag: string) =>
                      flag && flag !== 'normal' && flag !== 'pending' ? (
                        <Tag color={flag.startsWith('critical') ? 'red' : 'orange'}>
                          {flag.replace('_', ' ').toUpperCase()}
                        </Tag>
                      ) : (
                        <Tag color={flag === 'pending' ? 'default' : 'green'}>
                          {flag === 'pending' ? 'Pending' : 'Normal'}
                        </Tag>
                      ),
                  },
                  {
                    title: 'Order Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 100,
                    render: (status: string) => (
                      <Tag>{(status || '').replace('_', ' ')}</Tag>
                    ),
                  },
                  {
                    title: 'Action',
                    key: 'action',
                    width: 100,
                    render: (_: unknown, r: any) => (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setNlModalOpen(false);
                          navigate(`/laboratory/${r.orderId}`);
                        }}
                      >
                        View Order
                      </Button>
                    ),
                  },
                ]}
                dataSource={nlResults.matchedOrders}
                rowKey={(r) => `${r.orderId}-${r.testName}`}
                pagination={{ pageSize: 10 }}
                size="small"
                scroll={{ x: 800 }}
              />
            ) : (
              <Card>
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Text type="secondary">No matching results found.</Text>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Text type="secondary">No results.</Text>
        )}
      </Modal>
    </div>
  );
};

export default LaboratoryPage;
