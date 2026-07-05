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
  InputNumber,
  DatePicker,
  List,
  message,
  Tooltip,
  Divider,
  Spin,
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
import { billingService, EncounterClaim, ClaimLineItem } from '../../services/billingService';
import { patientService } from '../../services/patientService';
import {
  commonDiagnosisCodes,
  commonCPTCodes,
} from '../../data/mockData';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const claimStatusColors: Record<string, string> = {
  draft: 'default',
  ready_to_bill: 'gold',
  submitted: 'processing',
  partially_paid: 'blue',
  paid: 'cyan',
  denied: 'red',
  appealed: 'purple',
  cancelled: 'default',
};

const BillingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claims, setClaims] = useState<EncounterClaim[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [serviceLines, setServiceLines] = useState<Array<{
    codeType?: string;
    code?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
  }>>([{}]);

  useEffect(() => {
    fetchClaims();
    fetchPatients();
  }, []);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const data = await billingService.findAllClaims();
      setClaims(data);
    } catch (error) {
      message.error('Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const data = await patientService.findAll();
      setPatients(data);
    } catch (error) {
      message.error('Failed to load patients');
    }
  };

  // Stats
  const totalClaims = claims.reduce((sum, c) => sum + c.totalBilled, 0);
  const pendingCount = claims.filter(
    (c) => c.status === 'ready_to_bill' || c.status === 'submitted'
  ).length;
  const paidCount = claims.filter((c) => c.status === 'paid').length;
  const deniedCount = claims.filter((c) => c.status === 'denied').length;
  const paidAmount = claims
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + c.totalPaid, 0);

  // Filtered claims
  const filteredClaims = useMemo(() => {
    let data = [...claims];

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
          (c.insurancePayerName || '').toLowerCase().includes(lower)
      );
    }

    return data;
  }, [activeTab, searchText]);

  // Service line total
  const calculatedTotal = serviceLines.reduce(
    (sum, line) => sum + (line.quantity || 0) * (line.unitPrice || 0),
    0
  );

  const handleCPTSelect = (index: number, code: string) => {
    const cpt = commonCPTCodes.find((c) => c.code === code);
    const updated = [...serviceLines];
    updated[index] = {
      ...updated[index],
      codeType: 'CPT',
      code,
      description: cpt?.description || '',
      unitPrice: cpt?.price || 0,
      quantity: updated[index].quantity || 1,
    };
    setServiceLines(updated);
  };

  const handleSubmitClaim = async () => {
    try {
      const values = await form.validateFields();
      const claimData = {
        tenantId: 'default-tenant-id',
        patientId: values.patientId,
        patientName: patients.find((p) => p.id === values.patientId)?.fullName || '',
        providerId: values.providerId,
        providerName: 'Dr. Sarah Chen',
        providerNPI: '1234567890',
        serviceDate: values.serviceDate.format('YYYY-MM-DD'),
        lineItems: serviceLines.filter((line) => line.code).map((line) => ({
          codeType: line.codeType || 'CPT',
          code: line.code!,
          description: line.description || '',
          quantity: line.quantity || 1,
          unitPrice: line.unitPrice || 0,
        })),
      };

      await billingService.createClaim(claimData);
      message.success('Claim created successfully!');
      setDrawerOpen(false);
      form.resetFields();
      setServiceLines([{}]);
      fetchClaims();
    } catch (error) {
      message.error('Failed to create claim');
    }
  };

  const handlePatientSelect = async (patientId: string) => {
    try {
      const insurances = await billingService.findPatientInsurances(patientId);
      if (insurances.length > 0) {
        form.setFieldsValue({
          insurancePayerId: insurances[0].insurancePayerId,
          insurancePayerName: insurances[0].payer.name,
          policyNumber: insurances[0].policyNumber,
          groupNumber: insurances[0].groupNumber,
        });
      }
    } catch (error) {
      console.error('Failed to load patient insurance');
    }
  };

  const columns: ColumnsType<EncounterClaim> = [
    {
      title: 'Claim #',
      dataIndex: 'claimNumber',
      key: 'claimNumber',
      width: 170,
      render: (num: string, record: EncounterClaim) => (
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
      dataIndex: 'insurancePayerName',
      key: 'insurancePayerName',
      width: 170,
      render: (name: string) => name || 'Self-Pay',
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalBilled',
      key: 'totalBilled',
      width: 130,
      render: (amount: number) => (
        <Text strong>${amount.toFixed(2)}</Text>
      ),
      sorter: (a, b) => a.totalBilled - b.totalBilled,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={claimStatusColors[status] || 'default'}>
          {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: EncounterClaim) => (
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
    { key: 'draft', label: 'Draft' },
    { key: 'ready_to_bill', label: 'Ready to Bill' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'paid', label: 'Paid' },
    { key: 'denied', label: 'Denied' },
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
              title="Paid"
              value={paidCount}
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

      {/* Split View: Claims Ledger */}
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
          loading={loading}
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
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName} (${p.mrn})`,
              }))}
              onChange={handlePatientSelect}
            />
          </Form.Item>

          <Form.Item name="insurancePayerName" label="Insurance Provider">
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
            initialValue="default-provider-id"
          >
            <Select
              placeholder="Select provider..."
              options={[{ value: 'default-provider-id', label: 'Dr. Sarah Chen' }]}
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
                      value={line.code}
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
            onClick={() => setServiceLines([...serviceLines, { codeType: 'CPT' }])}
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
