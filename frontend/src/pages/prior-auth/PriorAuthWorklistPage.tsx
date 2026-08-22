import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Select,
  Input,
  message,
  Tooltip,
  Row,
  Col,
  Statistic,
  Badge,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { PriorAuthRequest, PriorAuthStatus } from '../../types';
import { priorAuthService } from '../../services/priorAuthService';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<PriorAuthStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  pending: 'warning',
  approved: 'success',
  denied: 'error',
  p2p_scheduled: 'purple',
  appealed: 'orange',
  expired: 'red',
  cancelled: 'default',
  superseded: 'default',
};

const STATUS_LABELS: Record<PriorAuthStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  p2p_scheduled: 'P2P Scheduled',
  appealed: 'Appealed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  superseded: 'Superseded',
};

const PriorAuthWorklistPage: React.FC = () => {
  const navigate = useNavigate();
  const [paList, setPaList] = useState<PriorAuthRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PriorAuthStatus | undefined>(undefined);
  const [payerFilter, setPayerFilter] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, denied: 0, expiring: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await priorAuthService.getWorklist({
        status: statusFilter,
        payerName: payerFilter,
      });
      setPaList(data);

      // Calculate quick counts
      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setCounts({
        pending: data.filter((p) => p.status === 'pending').length,
        approved: data.filter((p) => p.status === 'approved').length,
        denied: data.filter((p) => p.status === 'denied').length,
        expiring: data.filter(
          (p) => p.status === 'approved' && p.expirationDate &&
            new Date(p.expirationDate) > now && new Date(p.expirationDate) <= sevenDays,
        ).length,
      });
    } catch (err: any) {
      message.error('Failed to load worklist: ' + (err?.response?.data?.message || err?.message));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, payerFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredList = searchText
    ? paList.filter((pa) =>
        pa.patientName?.toLowerCase().includes(searchText.toLowerCase()) ||
        pa.payerName?.toLowerCase().includes(searchText.toLowerCase()) ||
        pa.procedureCodes.some((c) => c.code.toLowerCase().includes(searchText.toLowerCase())) ||
        pa.authNumber?.toLowerCase().includes(searchText.toLowerCase()),
      )
    : paList;

  const columns = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      render: (p: number) => {
        const colors = ['#f5222d', '#fa8c16', '#faad14', '#52c41a', '#1890ff'];
        return <Tag color={colors[p - 1] || '#1890ff'}>P{p}</Tag>;
      },
      sorter: (a: PriorAuthRequest, b: PriorAuthRequest) => (a.priority ?? 3) - (b.priority ?? 3),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: PriorAuthStatus) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
      sorter: (a: PriorAuthRequest, b: PriorAuthRequest) => (a.status || '').localeCompare(b.status || ''),
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 150,
      render: (name: string, record: PriorAuthRequest) => (
        <Button type="link" size="small" onClick={() => navigate(`/patients/${record.patientId}`)}>
          {name || record.patientId}
        </Button>
      ),
    },
    {
      title: 'Payer',
      dataIndex: 'payerName',
      key: 'payerName',
      width: 130,
      render: (v: string) => v || '—',
    },
    {
      title: 'Procedures',
      dataIndex: 'procedureCodes',
      key: 'procedureCodes',
      render: (codes: any[]) => (
        <Space direction="vertical" size={0}>
          {codes.map((c, i) => (
            <Text key={i} style={{ fontSize: 12 }}>
              <Text strong>{c.code}</Text> {c.description?.substring(0, 40)}
            </Text>
          ))}
        </Space>
      ),
    },
    {
      title: 'Auth #',
      dataIndex: 'authNumber',
      key: 'authNumber',
      width: 110,
      render: (v: string) => v ? <Text code copyable style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    {
      title: 'Expires',
      dataIndex: 'expirationDate',
      key: 'expirationDate',
      width: 110,
      render: (v: string, record: PriorAuthRequest) => {
        if (!v) return '—';
        const exp = new Date(v);
        const days = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days < 0) return <Tag color="red">Expired</Tag>;
        if (days < 7) return <Tag color="orange">{days}d left</Tag>;
        if (days < 14) return <Tag color="yellow">{days}d left</Tag>;
        return <Text style={{ fontSize: 12 }}>{exp.toLocaleDateString()}</Text>;
      },
      sorter: (a: PriorAuthRequest, b: PriorAuthRequest) =>
        new Date(a.expirationDate || 0).getTime() - new Date(b.expirationDate || 0).getTime(),
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 110,
      render: (v: string) => {
        if (!v) return '—';
        const due = new Date(v);
        const overdue = due < new Date();
        return <Text type={overdue ? 'danger' : undefined} style={{ fontSize: 12 }}>{due.toLocaleDateString()}</Text>;
      },
    },
    {
      title: 'Assigned',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 100,
      render: (v: string) => v || <Text type="secondary">Unassigned</Text>,
    },
    {
      title: 'AI',
      key: 'ai',
      width: 60,
      render: (_: any, record: PriorAuthRequest) => (
        <Space size={4}>
          {record.autoTriggered && <Tooltip title="Auto-triggered"><ThunderboltOutlined style={{ color: '#722ed1' }} /></Tooltip>}
          {record.aiApprovalPrediction && (
            <Tooltip title={`Approval: ${record.aiApprovalPrediction.approvalProbability}%`}>
              <Tag style={{ fontSize: 10, padding: '0 4px' }} color={
                record.aiApprovalPrediction.approvalProbability >= 80 ? 'success' :
                record.aiApprovalPrediction.approvalProbability >= 50 ? 'warning' : 'error'
              }>
                {record.aiApprovalPrediction.approvalProbability}%
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>
        <Space>
          <FileTextOutlined />
          Prior Authorization Worklist
        </Space>
      </Title>

      {/* Quick Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pending"
              value={counts.pending}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Approved"
              value={counts.approved}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Denied"
              value={counts.denied}
              prefix={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Expiring Soon"
              value={counts.expiring}
              prefix={<WarningOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {/* Filters */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input
            placeholder="Filter by payer"
            allowClear
            style={{ width: 180 }}
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value || undefined)}
          />
          <Input
            placeholder="Search patient, payer, CPT, auth #"
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
          <Button type="primary" onClick={() => navigate('/prior-auth/dashboard')}>Dashboard</Button>
        </Space>

        <Table
          dataSource={filteredList}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} PA requests` }}
          onRow={(record) => ({
            onClick: () => navigate(`/patients/${record.patientId}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  );
};

export default PriorAuthWorklistPage;
