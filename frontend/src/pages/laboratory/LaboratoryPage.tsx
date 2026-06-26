import React, { useState, useMemo } from 'react';
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
} from '@ant-design/icons';
import type { LabOrder, LabTest } from '../../types';
import { labPanels } from '../../data/mockData';
import type { ImagingOrder } from '../../data/mockData';
import { useLabStore, usePatientStore, useProviderStore } from '../../store/dataStore';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
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
  const { labOrders: mockLabOrders, imagingOrders: mockImagingOrders } = useLabStore();
  const { patients: mockPatients } = usePatientStore();
  const { providers: mockProviders } = useProviderStore();
  const [activeTab, setActiveTab] = useState('orders');
  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  // Stats
  const pendingOrders = mockLabOrders.filter(
    (o) => o.status === 'ordered' || o.status === 'in_progress'
  ).length;
  const completedToday = mockLabOrders.filter(
    (o) => o.completedDate === new Date().toISOString().split('T')[0]
  ).length;
  const abnormalResults = mockLabOrders
    .flatMap((o) => o.tests)
    .filter((t) => t.status === 'abnormal').length;

  // Filtered lab orders
  const filteredOrders = useMemo(() => {
    if (!searchText) return mockLabOrders;
    const lower = searchText.toLowerCase();
    return mockLabOrders.filter(
      (o) =>
        o.patientName.toLowerCase().includes(lower) ||
        o.id.toLowerCase().includes(lower) ||
        o.tests.some((t) => t.name.toLowerCase().includes(lower))
    );
  }, [searchText]);

  // Submit new lab order
  const handleSubmitOrder = () => {
    form.validateFields().then((values) => {
      message.success('Lab order submitted successfully!');
      setDrawerOpen(false);
      form.resetFields();
    });
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
      width: 100,
      render: (_: unknown, record: LabOrder) => (
        <Space>
          <Tooltip title="View Details">
            <Button type="text" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="Print">
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={() => message.info('Printing lab order...')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ─── Results Tab ────────────────────────────────────────────────────────

  const completedOrders = mockLabOrders.filter((o) => o.status === 'completed');

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

  const imagingColumns: ColumnsType<ImagingOrder> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text strong style={{ color: '#0D7C8A' }}>{id}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'orderedDate',
      key: 'orderedDate',
      width: 110,
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 150,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag color="purple">{type}</Tag>,
    },
    {
      title: 'Body Part',
      dataIndex: 'bodyPart',
      key: 'bodyPart',
      width: 200,
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
            <Text>{findings}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary">Pending</Text>
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
      key: 'imaging',
      label: (
        <Space>
          <EyeOutlined />
          Imaging
        </Space>
      ),
      children: (
        <Table
          columns={imagingColumns}
          dataSource={mockImagingOrders}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} imaging orders` }}
          scroll={{ x: 1000 }}
        />
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
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
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
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
            <Button type="primary" onClick={handleSubmitOrder}>
              Submit Order
            </Button>
          </Space>
        }
      >
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
              options={mockPatients.map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName} (${p.mrn})`,
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
                value: p.code,
                label: p.name,
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
      </Drawer>
    </div>
  );
};

export default LaboratoryPage;
