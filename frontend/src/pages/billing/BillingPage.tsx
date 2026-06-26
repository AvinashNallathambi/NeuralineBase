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
  InputNumber,
  DatePicker,
  List,
  message,
  Tooltip,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  FileDoneOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Claim, ClaimItem } from '../../types';
import {
  commonDiagnosisCodes,
  commonCPTCodes,
} from '../../data/mockData';
import type { Payment } from '../../data/mockData';
import { useBillingStore, usePatientStore, useProviderStore } from '../../store/dataStore';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const claimStatusColors: Record<string, string> = {
  draft: 'default',
  submitted: 'processing',
  pending: 'gold',
  approved: 'green',
  denied: 'red',
  paid: 'cyan',
  appealed: 'purple',
};

const BillingPage: React.FC = () => {
  const { claims: mockClaims, payments: mockPayments } = useBillingStore();
  const { patients: mockPatients } = usePatientStore();
  const { providers: mockProviders } = useProviderStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [serviceLines, setServiceLines] = useState<Array<{
    cptCode?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
  }>>([{}]);

  // Stats
  const totalClaims = mockClaims.reduce((sum, c) => sum + c.totalAmount, 0);
  const pendingCount = mockClaims.filter(
    (c) => c.status === 'pending' || c.status === 'submitted'
  ).length;
  const approvedCount = mockClaims.filter((c) => c.status === 'approved').length;
  const deniedCount = mockClaims.filter((c) => c.status === 'denied').length;
  const paidAmount = mockClaims
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + (c.paidAmount || 0), 0);

  // Filtered claims
  const filteredClaims = useMemo(() => {
    let data = [...mockClaims];

    if (activeTab !== 'all') {
      data = data.filter((c) => c.status === activeTab);
    }

    if (searchText) {
      const lower = searchText.toLowerCase();
      data = data.filter(
        (c) =>
          c.patientName.toLowerCase().includes(lower) ||
          c.claimNumber.toLowerCase().includes(lower) ||
          c.providerName.toLowerCase().includes(lower) ||
          c.insuranceProvider.toLowerCase().includes(lower)
      );
    }

    return data;
  }, [activeTab, searchText]);

  // Service line total
  const calculatedTotal = serviceLines.reduce(
    (sum, line) => sum + (line.quantity || 0) * (line.unitPrice || 0),
    0
  );

  const handleCPTSelect = (index: number, cptCode: string) => {
    const cpt = commonCPTCodes.find((c) => c.code === cptCode);
    const updated = [...serviceLines];
    updated[index] = {
      ...updated[index],
      cptCode,
      description: cpt?.description || '',
      unitPrice: cpt?.price || 0,
      quantity: updated[index].quantity || 1,
    };
    setServiceLines(updated);
  };

  const handleSubmitClaim = () => {
    form.validateFields().then(() => {
      message.success('Claim submitted successfully!');
      setDrawerOpen(false);
      form.resetFields();
      setServiceLines([{}]);
    });
  };

  const handlePatientSelect = (patientId: string) => {
    const patient = mockPatients.find((p) => p.id === patientId);
    if (patient && patient.insurance.length > 0) {
      form.setFieldsValue({
        insuranceProvider: patient.insurance[0].provider,
      });
    }
  };

  const columns: ColumnsType<Claim> = [
    {
      title: 'Claim #',
      dataIndex: 'claimNumber',
      key: 'claimNumber',
      width: 170,
      render: (num: string, record: Claim) => (
        <Button
          type="link"
          style={{ padding: 0, color: '#0D7C8A', fontWeight: 600 }}
          onClick={() => navigate(`/billing/${record.id}`)}
        >
          {num}
        </Button>
      ),
    },
    {
      title: 'Date of Service',
      dataIndex: 'serviceDate',
      key: 'serviceDate',
      width: 130,
      sorter: (a, b) => a.serviceDate.localeCompare(b.serviceDate),
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
      title: 'Insurance',
      dataIndex: 'insuranceProvider',
      key: 'insuranceProvider',
      width: 170,
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 130,
      render: (amount: number) => (
        <Text strong>${amount.toFixed(2)}</Text>
      ),
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={claimStatusColors[status] || 'default'}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Claim) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/billing/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  const tabItems = [
    { key: 'all', label: 'All Claims' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'approved', label: 'Approved' },
    { key: 'denied', label: 'Denied' },
    { key: 'paid', label: 'Paid' },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Billing & Claims
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => setDrawerOpen(true)}
          >
            New Claim
          </Button>
        </Col>
      </Row>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={4} lg={4}>
          <Card>
            <Statistic
              title="Total Claims"
              value={totalClaims}
              prefix={<DollarOutlined style={{ color: '#0D7C8A' }} />}
              precision={2}
              valueStyle={{ color: '#0D7C8A', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={5} lg={5}>
          <Card>
            <Statistic
              title="Pending"
              value={pendingCount}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={5} lg={5}>
          <Card>
            <Statistic
              title="Approved"
              value={approvedCount}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={5} lg={5}>
          <Card>
            <Statistic
              title="Denied"
              value={deniedCount}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} md={5} lg={5}>
          <Card>
            <Statistic
              title="Paid Amount"
              value={paidAmount}
              prefix={<CreditCardOutlined style={{ color: '#0D7C8A' }} />}
              precision={2}
              valueStyle={{ color: '#0D7C8A', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Claims Table */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        <Input
          placeholder="Search by patient, claim number, provider, or insurance..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ marginBottom: 16, maxWidth: 450 }}
        />

        <Table
          columns={columns}
          dataSource={filteredClaims}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} claims`,
          }}
          scroll={{ x: 1100 }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/billing/${record.id}`),
          })}
        />
      </Card>

      {/* Recent Payments */}
      <Card
        title={
          <Space>
            <CreditCardOutlined />
            <span>Recent Payments</span>
          </Space>
        }
        style={{ marginTop: 24 }}
      >
        <List
          dataSource={mockPayments.slice(0, 5)}
          renderItem={(payment: Payment) => (
            <List.Item
              extra={
                <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                  +${payment.amount.toFixed(2)}
                </Text>
              }
            >
              <List.Item.Meta
                avatar={
                  <DollarOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                }
                title={
                  <Space>
                    <Text strong>{payment.patientName}</Text>
                    <Text type="secondary">-</Text>
                    <Text type="secondary">{payment.claimId}</Text>
                  </Space>
                }
                description={
                  <Space>
                    <Tag
                      color={
                        payment.method === 'Insurance'
                          ? 'blue'
                          : payment.method === 'Cash'
                          ? 'green'
                          : 'orange'
                      }
                    >
                      {payment.method}
                    </Tag>
                    <Text type="secondary">{payment.date}</Text>
                    <Text type="secondary">Ref: {payment.reference}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* New Claim Drawer */}
      <Drawer
        title="New Claim"
        placement="right"
        width={640}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          form.resetFields();
          setServiceLines([{}]);
        }}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSubmitClaim} icon={<FileDoneOutlined />}>
              Submit Claim
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
              onChange={handlePatientSelect}
            />
          </Form.Item>

          <Form.Item name="insuranceProvider" label="Insurance Provider">
            <Input placeholder="Auto-filled from patient record" readOnly />
          </Form.Item>

          <Form.Item
            name="serviceDate"
            label="Service Date"
            rules={[{ required: true, message: 'Select service date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="providerId"
            label="Provider"
            rules={[{ required: true, message: 'Select provider' }]}
          >
            <Select
              placeholder="Select provider..."
              options={mockProviders.map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="diagnosisCodes"
            label="Diagnosis Codes (ICD-10)"
            rules={[{ required: true, message: 'Select at least one diagnosis code' }]}
          >
            <Select
              mode="multiple"
              showSearch
              placeholder="Search ICD-10 codes..."
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
              options={commonDiagnosisCodes.map((d) => ({
                value: d.code,
                label: `${d.code} - ${d.description}`,
              }))}
            />
          </Form.Item>

          <Divider>Procedure Codes (CPT)</Divider>

          {serviceLines.map((line, index) => (
            <Card
              key={index}
              size="small"
              style={{ marginBottom: 12 }}
              extra={
                serviceLines.length > 1 && (
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    size="small"
                    onClick={() =>
                      setServiceLines(serviceLines.filter((_, i) => i !== index))
                    }
                  />
                )
              }
            >
              <Row gutter={8}>
                <Col span={10}>
                  <Form.Item label="CPT Code" style={{ marginBottom: 8 }}>
                    <Select
                      showSearch
                      placeholder="Select CPT..."
                      value={line.cptCode}
                      onChange={(val) => handleCPTSelect(index, val)}
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                      }
                      options={commonCPTCodes.map((c) => ({
                        value: c.code,
                        label: `${c.code} - ${c.description}`,
                      }))}
                      size="small"
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Qty" style={{ marginBottom: 8 }}>
                    <InputNumber
                      min={1}
                      value={line.quantity || 1}
                      onChange={(val) => {
                        const updated = [...serviceLines];
                        updated[index] = { ...updated[index], quantity: val || 1 };
                        setServiceLines(updated);
                      }}
                      size="small"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item label="Unit Price" style={{ marginBottom: 8 }}>
                    <InputNumber
                      min={0}
                      prefix="$"
                      value={line.unitPrice}
                      onChange={(val) => {
                        const updated = [...serviceLines];
                        updated[index] = { ...updated[index], unitPrice: val || 0 };
                        setServiceLines(updated);
                      }}
                      size="small"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item label="Total" style={{ marginBottom: 8 }}>
                    <Text strong>
                      ${((line.quantity || 1) * (line.unitPrice || 0)).toFixed(2)}
                    </Text>
                  </Form.Item>
                </Col>
              </Row>
              {line.description && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {line.description}
                </Text>
              )}
            </Card>
          ))}

          <Button
            type="dashed"
            onClick={() => setServiceLines([...serviceLines, {}])}
            icon={<PlusOutlined />}
            block
            size="small"
            style={{ marginBottom: 16 }}
          >
            Add Procedure Code
          </Button>

          <Card size="small" style={{ background: '#f6ffed', marginBottom: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text strong style={{ fontSize: 16 }}>Total Amount:</Text>
              </Col>
              <Col>
                <Text strong style={{ fontSize: 20, color: '#0D7C8A' }}>
                  ${calculatedTotal.toFixed(2)}
                </Text>
              </Col>
            </Row>
          </Card>
        </Form>
      </Drawer>
    </div>
  );
};

export default BillingPage;
