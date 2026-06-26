import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Select,
  DatePicker,
  Row,
  Col,
  Tabs,
  Statistic,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SnippetsOutlined,
  HeartOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
  MedicineBoxOutlined,
  BulbOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Encounter } from '../../types';
import { clinicalTemplates } from '../../data/mockData';
import { useEncounterStore, usePatientStore, useProviderStore } from '../../store/dataStore';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const statusColors: Record<string, string> = {
  planned: 'blue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'default',
};

const typeColors: Record<string, string> = {
  office_visit: 'geekblue',
  telehealth: 'cyan',
  emergency: 'red',
  inpatient: 'purple',
  procedure: 'orange',
};

const templateIcons: Record<string, React.ReactNode> = {
  HeartOutlined: <HeartOutlined />,
  SyncOutlined: <SyncOutlined />,
  ThunderboltOutlined: <ThunderboltOutlined />,
  VideoCameraOutlined: <VideoCameraOutlined />,
  MedicineBoxOutlined: <MedicineBoxOutlined />,
  BulbOutlined: <BulbOutlined />,
};

const ClinicalPage: React.FC = () => {
  const { encounters: mockEncounters } = useEncounterStore();
  const { patients: mockPatients } = usePatientStore();
  const { providers: mockProviders } = useProviderStore();
  const navigate = useNavigate();
  const [encounters] = useState<Encounter[]>(mockEncounters);
  const [activeTab, setActiveTab] = useState('active');
  const [providerFilter, setProviderFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // ── Helper: get patient name by ID ──
  const getPatientName = (patientId: string) => {
    const p = mockPatients.find((pt) => pt.id === patientId);
    return p ? `${p.firstName} ${p.lastName}` : 'Unknown';
  };

  const getProviderName = (providerId: string) => {
    const p = mockProviders.find((pr) => pr.id === providerId);
    return p ? `Dr. ${p.firstName} ${p.lastName}` : 'Unknown';
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const active = encounters.filter((e) => e.status === 'in_progress' || e.status === 'planned').length;
    const completedToday = encounters.filter(
      (e) => e.status === 'completed' && dayjs(e.endTime).isSame(dayjs(), 'day'),
    ).length;
    return { active, completedToday, templates: clinicalTemplates.length };
  }, [encounters]);

  // ── Filter by tab + filters ──
  const filtered = useMemo(() => {
    return encounters.filter((e) => {
      // Tab filter
      if (activeTab === 'active' && e.status !== 'in_progress' && e.status !== 'planned') return false;
      if (activeTab === 'completed' && e.status !== 'completed') return false;
      // activeTab === 'all' passes all

      const matchProvider = !providerFilter || e.providerId === providerFilter;
      const matchStatus = !statusFilter || e.status === statusFilter;
      const matchType = !typeFilter || e.type === typeFilter;
      const matchDate =
        !dateRange ||
        !dateRange[0] ||
        !dateRange[1] ||
        (dayjs(e.startTime).isAfter(dateRange[0].startOf('day')) &&
          dayjs(e.startTime).isBefore(dateRange[1].endOf('day')));

      return matchProvider && matchStatus && matchType && matchDate;
    });
  }, [encounters, activeTab, providerFilter, statusFilter, typeFilter, dateRange]);

  // ── Table columns ──
  const columns: ColumnsType<Encounter> = [
    {
      title: 'Date',
      key: 'date',
      width: 150,
      sorter: (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      defaultSortOrder: 'descend',
      render: (_: unknown, r: Encounter) => (
        <div>
          <Text strong>{dayjs(r.startTime).format('MMM DD, YYYY')}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(r.startTime).format('h:mm A')}
            {r.endTime ? ` - ${dayjs(r.endTime).format('h:mm A')}` : ' - ongoing'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Patient',
      key: 'patient',
      render: (_: unknown, r: Encounter) => <Text>{getPatientName(r.patientId)}</Text>,
    },
    {
      title: 'Provider',
      key: 'provider',
      render: (_: unknown, r: Encounter) => <Text>{getProviderName(r.providerId)}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (type: string) => (
        <Tag color={typeColors[type]} style={{ textTransform: 'capitalize' }}>
          {type.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Badge
          status={
            status === 'completed'
              ? 'success'
              : status === 'in_progress'
              ? 'processing'
              : status === 'planned'
              ? 'default'
              : 'error'
          }
          text={
            <Tag color={statusColors[status]} style={{ textTransform: 'capitalize' }}>
              {status.replace(/_/g, ' ')}
            </Tag>
          }
        />
      ),
    },
    {
      title: 'SOAP Notes',
      key: 'soap',
      width: 250,
      ellipsis: true,
      render: (_: unknown, r: Encounter) => {
        if (!r.soapNote) return <Text type="secondary">No notes yet</Text>;
        const preview = r.soapNote.subjective || r.soapNote.assessment || '';
        return (
          <Tooltip title={preview}>
            <Paragraph
              ellipsis={{ rows: 2 }}
              style={{ margin: 0, fontSize: 12, color: '#64748b' }}
            >
              <Text strong style={{ fontSize: 11 }}>S: </Text>
              {r.soapNote.subjective ? r.soapNote.subjective.substring(0, 100) + '...' : 'Empty'}
            </Paragraph>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Encounter) => (
        <Tooltip title="View / Edit">
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/clinical/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Clinical
          </Title>
          <Text type="secondary">Manage encounters and clinical documentation</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/clinical/new')}
        >
          New Encounter
        </Button>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small" hoverable>
            <Statistic
              title="Active Encounters"
              value={stats.active}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" hoverable>
            <Statistic
              title="Completed Today"
              value={stats.completedToday}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" hoverable>
            <Statistic
              title="Templates Available"
              value={stats.templates}
              prefix={<SnippetsOutlined />}
              valueStyle={{ color: '#0D7C8A' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card bodyStyle={{ padding: 16 }} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Provider"
              allowClear
              style={{ width: '100%' }}
              value={providerFilter}
              onChange={setProviderFilter}
              options={mockProviders.map((p) => ({
                label: `Dr. ${p.firstName} ${p.lastName}`,
                value: p.id,
              }))}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Status"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: 'Planned', value: 'planned' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Type"
              allowClear
              style={{ width: '100%' }}
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: 'Office Visit', value: 'office_visit' },
                { label: 'Telehealth', value: 'telehealth' },
                { label: 'Emergency', value: 'emergency' },
                { label: 'Inpatient', value: 'inpatient' },
                { label: 'Procedure', value: 'procedure' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) =>
                setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)
              }
            />
          </Col>
        </Row>
      </Card>

      {/* Encounters Table with Tabs */}
      <Card bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 8 }}
          items={[
            {
              key: 'active',
              label: (
                <Space>
                  <ClockCircleOutlined />
                  Active Encounters
                  <Badge
                    count={
                      encounters.filter(
                        (e) => e.status === 'in_progress' || e.status === 'planned',
                      ).length
                    }
                    style={{ backgroundColor: '#fa8c16' }}
                    size="small"
                  />
                </Space>
              ),
            },
            {
              key: 'completed',
              label: (
                <Space>
                  <CheckCircleOutlined />
                  Completed
                </Space>
              ),
            },
            {
              key: 'all',
              label: (
                <Space>
                  <FileTextOutlined />
                  All
                </Space>
              ),
            },
          ]}
        />
        <Table<Encounter>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/clinical/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </Card>

      {/* Clinical Templates */}
      <div style={{ marginTop: 32 }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          <SnippetsOutlined style={{ marginRight: 8 }} />
          Clinical Templates
        </Title>
        <Row gutter={[16, 16]}>
          {clinicalTemplates.map((tmpl) => (
            <Col xs={24} sm={12} md={8} lg={6} key={tmpl.id}>
              <Card
                hoverable
                size="small"
                style={{ height: '100%' }}
                actions={[
                  <Button type="link" key="use" size="small">
                    Use Template
                  </Button>,
                ]}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: '#e6f7f8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      color: '#0D7C8A',
                    }}
                  >
                    {templateIcons[tmpl.icon] || <FileTextOutlined />}
                  </div>
                  <Text strong>{tmpl.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {tmpl.description}
                  </Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default ClinicalPage;
