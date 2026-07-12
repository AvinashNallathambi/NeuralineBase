import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Statistic,
  Row,
  Col,
  Button,
  Modal,
  Input,
  InputNumber,
  message,
  Space,
  Form,
  Tabs,
} from 'antd';
import {
  DollarOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import underpaymentsService, {
  PayerContract,
  UnderpaymentRecord,
  UnderpaymentStats,
} from '../../services/underpaymentsService';

const { Text } = Typography;

const statusColors: Record<string, string> = {
  detected: 'red',
  investigating: 'orange',
  disputed: 'volcano',
  recovered: 'green',
  written_off: 'default',
  false_positive: 'default',
};

const UnderpaymentsPage: React.FC = () => {
  const [records, setRecords] = useState<UnderpaymentRecord[]>([]);
  const [contracts, setContracts] = useState<PayerContract[]>([]);
  const [stats, setStats] = useState<UnderpaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [contractModal, setContractModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selected, setSelected] = useState<UnderpaymentRecord | null>(null);
  const [recoveredAmount, setRecoveredAmount] = useState<number>(0);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, ctrs, sts] = await Promise.all([
        underpaymentsService.findAll(),
        underpaymentsService.findAllContracts(),
        underpaymentsService.getStats(),
      ]);
      setRecords(recs);
      setContracts(ctrs);
      setStats(sts);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to load underpayment data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateContract = async () => {
    try {
      const values = await form.validateFields();
      await underpaymentsService.createContract(values);
      message.success('Contract rate added');
      setContractModal(false);
      form.resetFields();
      loadData();
    } catch (err: any) {
      if (err.errorFields) return; // form validation error
      message.error(err.response?.data?.message || 'Failed to create contract');
    }
  };

  const handleView = (record: UnderpaymentRecord) => {
    setSelected(record);
    setRecoveredAmount(record.recoveredAmount || 0);
    setResolutionNotes(record.resolutionNotes || '');
    setDetailModal(true);
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selected) return;
    try {
      await underpaymentsService.updateStatus(selected.id, {
        status,
        recoveredAmount: status === 'recovered' ? recoveredAmount : undefined,
        notes: resolutionNotes,
      });
      message.success(`Status updated to ${status}`);
      setDetailModal(false);
      loadData();
    } catch {
      message.error('Failed to update status');
    }
  };

  const recordColumns: ColumnsType<UnderpaymentRecord> = [
    { title: 'Claim', dataIndex: 'claimNumber', key: 'claimNumber', render: (t: string) => t || '-' },
    { title: 'Patient', dataIndex: 'patientName', key: 'patientName' },
    { title: 'Payer', dataIndex: 'payerName', key: 'payerName' },
    { title: 'CPT', dataIndex: 'cptCode', key: 'cptCode' },
    {
      title: 'Expected',
      dataIndex: 'expectedAmount',
      key: 'expectedAmount',
      align: 'right',
      render: (v: number) => `$${(v || 0).toFixed(2)}`,
    },
    {
      title: 'Actual Paid',
      dataIndex: 'actualPaidAmount',
      key: 'actualPaidAmount',
      align: 'right',
      render: (v: number) => `$${(v || 0).toFixed(2)}`,
    },
    {
      title: 'Variance',
      dataIndex: 'varianceAmount',
      key: 'varianceAmount',
      align: 'right',
      sorter: (a, b) => a.varianceAmount - b.varianceAmount,
      render: (v: number) => <Text type="danger">${(v || 0).toFixed(2)}</Text>,
    },
    {
      title: '% Short',
      dataIndex: 'variancePercentage',
      key: 'variancePercentage',
      align: 'center',
      render: (v: number) => (v != null ? `${v.toFixed(1)}%` : '-'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s]}>{s.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, r: UnderpaymentRecord) => (
        <Button size="small" onClick={() => handleView(r)}>View</Button>
      ),
    },
  ];

  const contractColumns: ColumnsType<PayerContract> = [
    { title: 'Payer', dataIndex: 'payerName', key: 'payerName' },
    { title: 'CPT', dataIndex: 'cptCode', key: 'cptCode' },
    { title: 'Description', dataIndex: 'cptDescription', key: 'cptDescription', ellipsis: true },
    {
      title: 'Contracted Rate',
      dataIndex: 'contractedRate',
      key: 'contractedRate',
      align: 'right',
      render: (v: number) => `$${(v || 0).toFixed(2)}`,
    },
    { title: 'Rate Type', dataIndex: 'rateType', key: 'rateType' },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => (v ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <Text type="secondary">No</Text>),
    },
  ];

  return (
    <div>
      <Typography.Title level={3}>Underpayment Detection</Typography.Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="Total Underpayments" value={stats?.totalUnderpayments || 0} prefix={<WarningOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Total Variance" value={stats?.totalVariance || 0} prefix={<DollarOutlined />} precision={2} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Recovered" value={stats?.totalRecovered || 0} prefix={<DollarOutlined />} precision={2} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Detected" value={stats?.detectedCount || 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Disputed" value={stats?.disputedCount || 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Recovered Count" value={stats?.recoveredCount || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="records"
        items={[
          {
            key: 'records',
            label: 'Underpayment Records',
            children: <Table columns={recordColumns} dataSource={records} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'contracts',
            label: 'Payer Contracts',
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setContractModal(true)}>
                    Add Contract Rate
                  </Button>
                </div>
                <Table columns={contractColumns} dataSource={contracts} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />
              </div>
            ),
          },
          {
            key: 'byPayer',
            label: 'By Payer',
            children: (
              <Card title="Underpayment Variance by Payer">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="payer"
                  dataSource={stats?.byPayer || []}
                  columns={[
                    { title: 'Payer', dataIndex: 'payer', key: 'payer' },
                    { title: 'Count', dataIndex: 'count', key: 'count', align: 'center' as const },
                    {
                      title: 'Variance',
                      dataIndex: 'variance',
                      key: 'variance',
                      align: 'right' as const,
                      render: (v: number) => <Text type="danger">${(v || 0).toFixed(2)}</Text>,
                    },
                    {
                      title: 'Recovered',
                      dataIndex: 'recovered',
                      key: 'recovered',
                      align: 'right' as const,
                      render: (v: number) => <Text type="success">${(v || 0).toFixed(2)}</Text>,
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Contract Modal */}
      <Modal
        title="Add Payer Contract Rate"
        open={contractModal}
        onOk={handleCreateContract}
        onCancel={() => setContractModal(false)}
        okText="Add"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="payerName" label="Payer Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., UnitedHealthcare" />
          </Form.Item>
          <Form.Item name="cptCode" label="CPT Code" rules={[{ required: true }]}>
            <Input placeholder="e.g., 99213" />
          </Form.Item>
          <Form.Item name="cptDescription" label="Description">
            <Input placeholder="e.g., Office visit, established patient" />
          </Form.Item>
          <Form.Item name="contractedRate" label="Contracted Rate ($)" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="e.g., 85.00" />
          </Form.Item>
          <Form.Item name="rateType" label="Rate Type" initialValue="flat">
            <Input placeholder="flat, medicare_percentage, rvu" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`Underpayment: ${selected?.cptCode || ''}`}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModal(false)}>Close</Button>,
          <Button key="dispute" onClick={() => handleUpdateStatus('disputed')}>Mark Disputed</Button>,
          <Button key="false" onClick={() => handleUpdateStatus('false_positive')}>False Positive</Button>,
          <Button key="recover" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a', color: 'white' }} onClick={() => handleUpdateStatus('recovered')}>
            Mark Recovered
          </Button>,
        ]}
        width={600}
      >
        {selected && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Expected: </Text>
                <Text>${selected.expectedAmount.toFixed(2)}</Text>
              </Col>
              <Col span={12}>
                <Text strong>Actual Paid: </Text>
                <Text>${selected.actualPaidAmount.toFixed(2)}</Text>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Text strong>Variance: </Text>
                <Text type="danger">${selected.varianceAmount.toFixed(2)}</Text>
              </Col>
              <Col span={12}>
                <Text strong>% Short: </Text>
                <Text type="danger">{selected.variancePercentage?.toFixed(1)}%</Text>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Text strong>Contracted Rate: </Text>
                <Text>${(selected.contractedRate || 0).toFixed(2)}</Text>
              </Col>
              <Col span={12}>
                <Text strong>Payer: </Text>
                <Text>{selected.payerName}</Text>
              </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <Text strong>Recovered Amount:</Text>
              <InputNumber
                min={0}
                precision={2}
                value={recoveredAmount}
                onChange={(v) => setRecoveredAmount(v || 0)}
                style={{ width: '100%', marginTop: 8 }}
                prefix="$"
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Text strong>Resolution Notes:</Text>
              <Input.TextArea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UnderpaymentsPage;
