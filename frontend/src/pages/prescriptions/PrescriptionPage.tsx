import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  Popconfirm,
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
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  prescriptionService,
  type PaginatedPrescriptions,
  type Prescription,
  type RefillRequest,
} from '../../services/prescriptionService';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table/interface';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  active: 'green',
  draft: 'gold',
  sent: 'cyan',
  completed: 'blue',
  cancelled: 'default',
  discontinued: 'volcano',
  expired: 'red',
};

const refillStatusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  denied: 'red',
  completed: 'blue',
};

const PrescriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [refillRequests, setRefillRequests] = useState<RefillRequest[]>([]);
  const [refillLoading, setRefillLoading] = useState(false);
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
  const [refillSubmitting, setRefillSubmitting] = useState(false);

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

  const loadPrescriptions = useCallback(async (page = 1, limit = 10) => {
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
  }, [searchText, activeTab]);

  const loadRefills = useCallback(async () => {
    setRefillLoading(true);
    try {
      const refills = await prescriptionService.findAllRefills();
      setRefillRequests(refills);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load refill requests');
    } finally {
      setRefillLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrescriptions(1, data.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchText]);

  useEffect(() => {
    void loadRefills();
  }, [loadRefills]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    void loadPrescriptions(pagination.current || 1, pagination.pageSize || 10);
  };

  const activePrescriptions = useMemo(
    () => data.data.filter((rx) => rx.status === 'active').length,
    [data],
  );
  const pendingRefills = useMemo(
    () => refillRequests.filter((r) => r.status === 'pending').length,
    [refillRequests],
  );
  const todayStr = new Date().toISOString().split('T')[0];
  const prescribedToday = useMemo(
    () => data.data.filter((rx) => (rx.prescribedDate || '').split('T')[0] === todayStr).length,
    [data, todayStr],
  );

  const handleApproveRefill = async (prescriptionId: string, refillId: string) => {
    try {
      await prescriptionService.updateRefill(prescriptionId, refillId, { status: 'approved' });
      message.success('Refill request approved');
      await loadRefills();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to approve refill');
    }
  };

  const handleDenyRefill = async (prescriptionId: string, refillId: string) => {
    try {
      await prescriptionService.updateRefill(prescriptionId, refillId, { status: 'denied' });
      message.warning('Refill request denied');
      await loadRefills();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to deny refill');
    }
  };

  const handleCompleteRefill = async (prescriptionId: string, refillId: string) => {
    try {
      await prescriptionService.updateRefill(prescriptionId, refillId, { status: 'completed' });
      message.success('Refill completed');
      await loadRefills();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to complete refill');
    }
  };

  const handleDeleteRefill = async (prescriptionId: string, refillId: string) => {
    try {
      await prescriptionService.deleteRefill(prescriptionId, refillId);
      message.success('Refill request deleted');
      await loadRefills();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to delete refill');
    }
  };

  const handleRequestRefill = async () => {
    if (!refillPrescription) return;
    setRefillSubmitting(true);
    try {
      await prescriptionService.createRefill(refillPrescription.id, {
        notes: refillNotes || undefined,
      });
      message.success('Refill request submitted');
      setRefillModalOpen(false);
      setRefillNotes('');
      await loadRefills();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to submit refill request');
    } finally {
      setRefillSubmitting(false);
    }
  };

  const expandedRowRender = (record: Prescription) => {
    const medColumns: ColumnsType<any> = [
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
          {(record.status === 'active' || record.status === 'sent') && (
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
    { key: 'sent', label: 'Sent' },
    { key: 'completed', label: 'Completed' },
    { key: 'discontinued', label: 'Discontinued' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'expired', label: 'Expired' },
  ];

  const renderRefillActions = (item: RefillRequest) => {
    if (item.status === 'pending') {
      return [
        <Button
          key="approve"
          type="primary"
          size="small"
          onClick={() => handleApproveRefill(item.prescriptionId, item.id)}
        >
          Approve
        </Button>,
        <Button
          key="deny"
          danger
          size="small"
          onClick={() => handleDenyRefill(item.prescriptionId, item.id)}
        >
          Deny
        </Button>,
        <Popconfirm
          key="delete"
          title="Delete this refill request?"
          onConfirm={() => handleDeleteRefill(item.prescriptionId, item.id)}
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>,
      ];
    }
    if (item.status === 'approved') {
      return [
        <Button
          key="complete"
          size="small"
          onClick={() => handleCompleteRefill(item.prescriptionId, item.id)}
        >
          Complete
        </Button>,
        <Tag key="status" color={refillStatusColors[item.status]}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Tag>,
      ];
    }
    return [
      <Tag key="status" color={refillStatusColors[item.status] || 'default'}>
        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
      </Tag>,
    ];
  };

  return (
    <div>
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
          loading={refillLoading}
          locale={{ emptyText: 'No refill requests' }}
          renderItem={(item) => (
            <List.Item actions={renderRefillActions(item)}>
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
                    <Text>{item.medication} {item.dosage}</Text>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">
                      Rx: {item.prescriptionId} | {relativeTime(item.createdAt)}
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
        onOk={handleRequestRefill}
        confirmLoading={refillSubmitting}
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
