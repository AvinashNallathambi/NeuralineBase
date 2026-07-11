import React, { useEffect, useState, useMemo } from 'react';
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
  List,
  message,
  Tooltip,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  PrinterOutlined,
  ReloadOutlined,
  MedicineBoxOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Prescription, PrescriptionItem } from '../../types';
import type { RefillRequest } from '../../data/mockData';
import { usePrescriptionStore } from '../../store/dataStore';
import { useIntegrations } from '../../hooks/useIntegrations';
import { prescriptionService, type PaginatedPrescriptions } from '../../services/prescriptionService';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table/interface';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  active: 'green',
  draft: 'gold',
  completed: 'blue',
  cancelled: 'default',
  expired: 'red',
};

const PrescriptionPage: React.FC = () => {
  const { refillRequests: storeRefillRequests, addRefillRequest } = usePrescriptionStore();
  const navigate = useNavigate();
  const { isEnabled } = useIntegrations();
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [refillRequests, setRefillRequests] = useState<RefillRequest[]>(storeRefillRequests);
  const [data, setData] = useState<PaginatedPrescriptions>({
    data: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refillModalOpen, setRefillModalOpen] = useState(false);
  const [refillPrescription, setRefillPrescription] = useState<Prescription | null>(null);
  const [refillNotes, setRefillNotes] = useState('');

  const relativeTime = (dateStr: string) => {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const loadPrescriptions = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const result = await prescriptionService.findAll({
        page,
        limit,
        search: searchText || undefined,
        status: activeTab !== 'all' ? activeTab : undefined,
      });
      setData(result);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPrescriptions(1, data.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchText]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    void loadPrescriptions(pagination.current || 1, pagination.pageSize || 10);
  };

  const activePrescriptions = useMemo(
    () => data.data.filter((rx) => rx.status === 'active').length,
    [data],
  );
  const pendingRefills = refillRequests.filter((r) => r.status === 'pending').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const prescribedToday = useMemo(
    () => data.data.filter((rx) => (rx.prescribedDate || '').split('T')[0] === todayStr).length,
    [data, todayStr],
  );

  const handleApproveRefill = (id: string) => {
    setRefillRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r))
    );
    message.success('Refill request approved');
  };

  const handleDenyRefill = (id: string) => {
    setRefillRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'denied' as const } : r))
    );
    message.warning('Refill request denied');
  };

  const expandedRowRender = (record: Prescription) => {
    const medColumns: ColumnsType<PrescriptionItem> = [
      { title: 'Medication', dataIndex: 'medication', key: 'medication', width: 180 },
      { title: 'Dosage', dataIndex: 'dosage', key: 'dosage', width: 100 },
      { title: 'Frequency', dataIndex: 'frequency', key: 'frequency', width: 140 },
      { title: 'Route', dataIndex: 'route', key: 'route', width: 100 },
      { title: 'Duration', dataIndex: 'duration', key: 'duration', width: 100 },
      { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 80 },
      { title: 'Refills', dataIndex: 'refills', key: 'refills', width: 80 },
      {
        title: 'Instructions',
        dataIndex: 'instructions',
        key: 'instructions',
        ellipsis: true,
        render: (text: string) => text || '-',
      },
    ];

    return (
      <Table
        columns={medColumns}
        dataSource={record.medications}
        rowKey="id"
        pagination={false}
        size="small"
      />
    );
  };

  const columns: ColumnsType<Prescription> = [
    {
      title: 'Rx ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string) => <Text strong style={{ color: '#0D7C8A' }}>{id}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'prescribedDate',
      key: 'prescribedDate',
      width: 120,
      render: (date: string) => (date ? date.split('T')[0] : '-'),
      sorter: (a, b) => (a.prescribedDate || '').localeCompare(b.prescribedDate || ''),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 160,
    },
    {
      title: 'Provider',
      dataIndex: 'providerName',
      key: 'providerName',
      width: 160,
    },
    {
      title: 'Medications',
      key: 'medications',
      width: 220,
      render: (_: unknown, record: Prescription) => {
        const first = record.medications[0];
        const count = record.medications.length;
        return (
          <Space direction="vertical" size={0}>
            <Text>{first?.medication} {first?.dosage}</Text>
            {count > 1 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                +{count - 1} more medication{count - 1 > 1 ? 's' : ''}
              </Text>
            )}
          </Space>
        );
      },
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
      title: 'Pharmacy',
      dataIndex: 'pharmacy',
      key: 'pharmacy',
      width: 180,
      render: (pharmacy: string) => pharmacy || <Text type="secondary">Not assigned</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: Prescription) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/prescriptions/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Print">
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={() => message.info('Printing prescription...')}
            />
          </Tooltip>
          {record.status === 'active' && (
            <Tooltip title="Request Refill">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => {
                  setRefillPrescription(record);
                  setRefillNotes('');
                  setRefillModalOpen(true);
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
    { key: 'completed', label: 'Completed' },
    { key: 'expired', label: 'Expired' },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            E-Prescriptions
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate('/prescriptions/new')}
          >
            New Prescription
          </Button>
        </Col>
      </Row>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Prescriptions"
              value={activePrescriptions}
              prefix={<MedicineBoxOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Pending Refills"
              value={pendingRefills}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Prescribed Today"
              value={prescribedToday}
              prefix={<CheckCircleOutlined style={{ color: '#0D7C8A' }} />}
              valueStyle={{ color: '#0D7C8A' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters & Table */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        <Input
          placeholder="Search by patient name or medication..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ marginBottom: 16, maxWidth: 400 }}
        />

        <Table
          columns={columns}
          dataSource={data.data}
          rowKey="id"
          expandable={{ expandedRowRender }}
          loading={loading}
          pagination={{
            current: data.page,
            pageSize: data.limit,
            total: data.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} prescriptions`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Refill Requests */}
      <Card
        title={
          <Space>
            <ReloadOutlined />
            <span>Refill Requests</span>
            {pendingRefills > 0 && (
              <Tag color="orange">{pendingRefills} Pending</Tag>
            )}
          </Space>
        }
        style={{ marginTop: 24 }}
      >
        <List
          dataSource={refillRequests}
          renderItem={(item) => (
            <List.Item
              actions={
                item.status === 'pending'
                  ? [
                      <Button
                        key="approve"
                        type="primary"
                        size="small"
                        onClick={() => handleApproveRefill(item.id)}
                      >
                        Approve
                      </Button>,
                      <Button
                        key="deny"
                        danger
                        size="small"
                        onClick={() => handleDenyRefill(item.id)}
                      >
                        Deny
                      </Button>,
                    ]
                  : [
                      <Tag
                        key="status"
                        color={item.status === 'approved' ? 'green' : 'red'}
                      >
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Tag>,
                    ]
              }
            >
              <List.Item.Meta
                avatar={
                  <MedicineBoxOutlined
                    style={{
                      fontSize: 24,
                      color: item.status === 'pending' ? '#faad14' : '#8c8c8c',
                    }}
                  />
                }
                title={
                  <Space>
                    <Text strong>{item.patientName}</Text>
                    <Text type="secondary">-</Text>
                    <Text>{item.medication}</Text>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">
                      Rx: {item.prescriptionId} | {relativeTime(item.requestedDate)}
                    </Text>
                    {item.notes && <Text type="secondary" italic>{item.notes}</Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="Request Refill"
        open={refillModalOpen}
        onOk={() => {
          if (!refillPrescription) return;
          const newRequest: RefillRequest = {
            id: `rr-${Date.now()}`,
            prescriptionId: refillPrescription.id,
            patientName: refillPrescription.patientName,
            medication: refillPrescription.medications[0]?.medication || '',
            dosage: refillPrescription.medications[0]?.dosage || '',
            requestedDate: new Date().toISOString(),
            status: 'pending',
            notes: refillNotes || undefined,
          };
          addRefillRequest(newRequest);
          setRefillRequests((prev) => [newRequest, ...prev]);
          message.success('Refill request submitted');
          setRefillModalOpen(false);
        }}
        onCancel={() => setRefillModalOpen(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            Request a refill for prescription <Text strong>{refillPrescription?.id}</Text>?
          </Text>
          <Text type="secondary">Patient: {refillPrescription?.patientName}</Text>
          <Text type="secondary">
            Medication: {refillPrescription?.medications[0]?.medication} {refillPrescription?.medications[0]?.dosage}
          </Text>
          <Input.TextArea
            placeholder="Add notes (optional)..."
            value={refillNotes}
            onChange={(e) => setRefillNotes(e.target.value)}
            rows={3}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default PrescriptionPage;
