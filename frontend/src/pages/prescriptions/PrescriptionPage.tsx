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
  List,
  message,
  Tooltip,
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
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Prescription, PrescriptionItem } from '../../types';
import { mockPrescriptions, mockRefillRequests } from '../../data/mockData';
import type { RefillRequest } from '../../data/mockData';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  active: 'green',
  draft: 'gold',
  completed: 'blue',
  cancelled: 'default',
  expired: 'red',
};

const PrescriptionPage: React.FC = () => {
  const { prescriptions: mockPrescriptions, refillRequests: mockRefillRequests } = usePrescriptionStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [refillRequests, setRefillRequests] = useState<RefillRequest[]>(mockRefillRequests);

  const filteredPrescriptions = useMemo(() => {
    let data = [...mockPrescriptions];

    if (activeTab !== 'all') {
      data = data.filter((rx) => rx.status === activeTab);
    }

    if (searchText) {
      const lower = searchText.toLowerCase();
      data = data.filter(
        (rx) =>
          rx.patientName.toLowerCase().includes(lower) ||
          rx.medications.some((m) => m.medication.toLowerCase().includes(lower))
      );
    }

    return data;
  }, [activeTab, searchText]);

  const activePrescriptions = mockPrescriptions.filter((rx) => rx.status === 'active').length;
  const pendingRefills = refillRequests.filter((r) => r.status === 'pending').length;
  const prescribedToday = mockPrescriptions.filter(
    (rx) => rx.prescribedDate === new Date().toISOString().split('T')[0]
  ).length;

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
      sorter: (a, b) => a.prescribedDate.localeCompare(b.prescribedDate),
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
            <Tooltip title="Refill">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => message.info('Refill request initiated')}
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
          dataSource={filteredPrescriptions}
          rowKey="id"
          expandable={{ expandedRowRender }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} prescriptions` }}
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
                      Rx: {item.prescriptionId} | Requested: {item.requestDate}
                    </Text>
                    {item.notes && <Text type="secondary" italic>{item.notes}</Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default PrescriptionPage;
