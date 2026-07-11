import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Row,
  Col,
  Typography,
  message,
  Popconfirm,
  Tabs,
  Statistic,
  Progress,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEligibilityStore } from '../../store/dataStore';
import EligibilityStatusBadge from '../../components/eligibility/EligibilityStatusBadge';
import EligibilityVerificationDrawer from '../../components/eligibility/EligibilityVerificationDrawer';
import CreateEligibilityVerificationModal from '../../components/eligibility/CreateEligibilityVerificationModal';
import type {
  EligibilityVerification,
  EligibilityVerificationStatus,
  CreateEligibilityVerificationDto,
  EligibilityQuery,
} from '../../types';

const { Title, Text } = Typography;

// Status tab mapping (frontend-only grouping)
type TabKey = 'all' | 'active' | 'pending' | 'denied' | 'expired' | 'issues';

const TAB_TO_STATUS: Record<TabKey, EligibilityVerificationStatus | undefined> = {
  all: undefined,
  active: 'active',
  pending: 'pending',
  denied: 'failed',
  expired: 'inactive',
  issues: 'error',
};

const EligibilityPage: React.FC = () => {
  const [query, setQuery] = useState<EligibilityQuery>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<EligibilityVerification | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const {
    verifications,
    total,
    counts,
    loading,
    fetchVerifications,
    fetchCounts,
    createVerification,
    rerunVerification,
    deleteVerification,
    batchVerify,
  } = useEligibilityStore();

  useEffect(() => {
    fetchVerifications(query);
    fetchCounts();
  }, [query, fetchVerifications, fetchCounts]);

  const handleSearch = () => {
    setQuery((q) => ({ ...q, page: 1, search: search.trim() || undefined }));
  };

  const handleTabChange = (key: string) => {
    const tab = key as TabKey;
    setActiveTab(tab);
    setQuery((q) => ({ ...q, page: 1, status: TAB_TO_STATUS[tab] }));
  };

  const handleTableChange = (pagination: any) => {
    setQuery((q) => ({
      ...q,
      page: pagination.current,
      limit: pagination.pageSize,
    }));
  };

  const openDrawer = (record: EligibilityVerification) => {
    setSelected(record);
    setDrawerOpen(true);
  };

  const handleCreate = async (dto: CreateEligibilityVerificationDto) => {
    setConfirmLoading(true);
    const created = await createVerification(dto);
    setConfirmLoading(false);
    if (created) {
      message.success('Eligibility verification created');
      setModalOpen(false);
      fetchCounts();
    } else {
      message.error('Failed to create verification');
    }
  };

  const handleRerun = async (record: EligibilityVerification) => {
    const updated = await rerunVerification(record.id);
    if (updated) {
      message.success('Verification re-run successfully');
      fetchCounts();
    } else {
      message.error('Failed to re-run verification');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteVerification(id);
    message.success('Verification deleted');
    fetchCounts();
  };

  const handleBatchVerify = async () => {
    const patientIds = verifications
      .filter((v) => v.status === 'pending' || v.status === 'error')
      .map((v) => v.patientId)
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, 20);

    if (patientIds.length === 0) {
      message.info('No pending/errored patients to batch verify');
      return;
    }

    message.loading({ content: `Running batch verification for ${patientIds.length} patients...`, key: 'batch' });
    const results = await batchVerify(patientIds);
    message.destroy('batch');
    if (results.length > 0) {
      message.success(`Batch verification complete: ${results.length} verifications processed`);
      fetchCounts();
    } else {
      message.warning('Batch verification returned no results');
    }
  };

  // Dashboard stat cards
  const statCards = useMemo(() => [
    { title: 'Total', value: counts.total, icon: <ThunderboltOutlined />, color: '#1890ff' },
    { title: 'Active', value: counts.active, icon: <CheckCircleOutlined />, color: '#52c41a' },
    { title: 'Pending', value: counts.pending, icon: <ClockCircleOutlined />, color: '#faad14' },
    { title: 'Denied', value: counts.failed, icon: <CloseCircleOutlined />, color: '#ff4d4f' },
    { title: 'Expired', value: counts.inactive, icon: <StopOutlined />, color: '#fa8c16' },
    { title: 'Issues', value: counts.error, icon: <ExclamationCircleOutlined />, color: '#cf1322' },
  ], [counts]);

  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 200,
      render: (_: unknown, record: EligibilityVerification) => (
        <EligibilityStatusBadge status={record.status} coverageStatus={record.coverageStatus} />
      ),
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 160,
      render: (text: string | null, record: EligibilityVerification) =>
        text || record.patientId.substring(0, 8) + '...',
    },
    {
      title: 'Plan',
      key: 'plan',
      width: 200,
      render: (_: unknown, record: EligibilityVerification) => (
        <Space direction="vertical" size={0}>
          <Text>{record.planName || record.payerName || '—'}</Text>
          {record.planType && <Text type="secondary" style={{ fontSize: 12 }}>{record.planType}</Text>}
        </Space>
      ),
    },
    {
      title: 'Network',
      dataIndex: 'network',
      key: 'network',
      width: 120,
      render: (text: string | null) => {
        if (!text) return '—';
        const color = text.includes('In') || text.includes('Participating') ? 'green' : 'orange';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: 'Policy',
      dataIndex: 'policyNumber',
      key: 'policyNumber',
      width: 140,
      render: (text: string | null) => text || '—',
    },
    {
      title: 'Copay',
      dataIndex: 'copayAmount',
      key: 'copayAmount',
      width: 90,
      render: (amount: number | null) =>
        amount != null ? `$${Number(amount).toFixed(0)}` : '—',
    },
    {
      title: 'Deductible',
      key: 'deductible',
      width: 150,
      render: (_: unknown, record: EligibilityVerification) => {
        if (record.deductibleIndividual == null) return '—';
        const used = Number(record.deductibleIndividual) - Number(record.deductibleRemaining || 0);
        const pct = Math.min(100, (used / Number(record.deductibleIndividual)) * 100);
        return (
          <Tooltip title={`$${used.toFixed(0)} / $${Number(record.deductibleIndividual).toFixed(0)}`}>
            <Progress percent={Math.round(pct)} size="small" strokeColor={pct >= 100 ? '#52c41a' : '#1890ff'} />
          </Tooltip>
        );
      },
    },
    {
      title: 'Auth',
      dataIndex: 'authorizationRequired',
      key: 'authorizationRequired',
      width: 70,
      render: (required: boolean) => (
        <Tag color={required ? 'red' : 'default'}>{required ? 'Yes' : 'No'}</Tag>
      ),
    },
    {
      title: 'Verified',
      dataIndex: 'verifiedAt',
      key: 'verifiedAt',
      width: 130,
      render: (date: string | null) =>
        date ? dayjs(date).format('MM/DD/YY h:mm A') : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      fixed: 'right' as const,
      render: (_: unknown, record: EligibilityVerification) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDrawer(record)} />
          </Tooltip>
          <Tooltip title="Re-run">
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => handleRerun(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete verification?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: 'all', label: `All (${counts.total})` },
    { key: 'active', label: `Active (${counts.active})` },
    { key: 'pending', label: `Pending (${counts.pending})` },
    { key: 'denied', label: `Denied (${counts.failed})` },
    { key: 'expired', label: `Expired (${counts.inactive})` },
    { key: 'issues', label: `Issues (${counts.error})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <Row justify="space-between" align="middle">
        <Col>
          <Title level={3} style={{ margin: 0 }}>Insurance Eligibility</Title>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={handleBatchVerify}
              loading={loading}
            >
              Batch Verify
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              Verify Eligibility
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Dashboard Stats */}
      <Row gutter={[16, 16]}>
        {statCards.map((stat) => (
          <Col xs={12} sm={8} md={4} key={stat.title}>
            <Card size="small" hoverable style={{ textAlign: 'center' }}>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.icon}
                valueStyle={{ color: stat.color, fontSize: 20 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main Content */}
      <Card>
        {/* Search */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12} lg={10}>
            <Input.Search
              placeholder="Search by patient, payer, plan, policy, or subscriber"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={handleSearch}
              allowClear
              enterButton={<SearchOutlined />}
            />
          </Col>
        </Row>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          style={{ marginBottom: 8 }}
        />

        {/* Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={verifications}
          loading={loading}
          pagination={{
            current: query.page,
            pageSize: query.limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `${t} verifications`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1300 }}
          size="middle"
        />
      </Card>

      <EligibilityVerificationDrawer
        open={drawerOpen}
        verification={selected}
        onClose={() => setDrawerOpen(false)}
      />

      <CreateEligibilityVerificationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        confirmLoading={confirmLoading}
      />
    </div>
  );
};

export default EligibilityPage;
