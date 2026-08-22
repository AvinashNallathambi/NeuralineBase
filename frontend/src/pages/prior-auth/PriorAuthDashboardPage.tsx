import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Progress,
  Alert,
  message,
  Tooltip,
  Empty,
  Spin,
} from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  RobotOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { PriorAuthDashboard } from '../../types';
import { priorAuthService } from '../../services/priorAuthService';

const { Title, Text } = Typography;

const PriorAuthDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<PriorAuthDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await priorAuthService.getDashboard();
      setDashboard(data);
    } catch (err: any) {
      message.error('Failed to load PA dashboard: ' + (err?.response?.data?.message || err?.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !dashboard) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" tip="Loading PA dashboard..." />
      </div>
    );
  }

  if (!dashboard) {
    return <Card><Empty description="No prior authorization data available" /></Card>;
  }

  const approvalRate = dashboard.approvedCount + dashboard.deniedCount > 0
    ? Math.round((dashboard.approvedCount / (dashboard.approvedCount + dashboard.deniedCount)) * 100)
    : 0;

  // Status breakdown for progress visualization
  const statusEntries = Object.entries(dashboard.byStatus).filter(([_, v]) => v > 0);

  const payerColumns = [
    {
      title: 'Payer',
      dataIndex: 'payer',
      key: 'payer',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'PA Count',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (v: number) => <Tag>{v}</Tag>,
    },
    {
      title: 'Approval Rate',
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      width: 200,
      render: (rate: number) => (
        <Space>
          <Progress
            percent={rate}
            size="small"
            strokeColor={rate >= 80 ? '#52c41a' : rate >= 60 ? '#faad14' : '#f5222d'}
            style={{ width: 120 }}
          />
          <Text style={{ fontSize: 12 }}>{rate}%</Text>
        </Space>
      ),
      sorter: (a: any, b: any) => b.approvalRate - a.approvalRate,
    },
  ];

  const denialColumns = [
    {
      title: 'Denial Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      render: (v: number) => <Tag color="error">{v}</Tag>,
      sorter: (a: any, b: any) => b.count - a.count,
    },
  ];

  return (
    <div>
      <Title level={3}>
        <Space>
          <DashboardOutlined />
          Prior Authorization Dashboard
        </Space>
      </Title>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => navigate('/prior-auth')}>View Worklist</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
      </Space>

      {/* Top Metrics Row */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total PAs"
              value={dashboard.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Pending"
              value={dashboard.pendingCount}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Approved"
              value={dashboard.approvedCount}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Denied"
              value={dashboard.deniedCount}
              prefix={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Approval Rate"
              value={approvalRate}
              suffix="%"
              valueStyle={{ color: approvalRate >= 80 ? '#3f8600' : approvalRate >= 60 ? '#faad14' : '#cf1322' }}
            />
            <Progress
              percent={approvalRate}
              size="small"
              strokeColor={approvalRate >= 80 ? '#52c41a' : approvalRate >= 60 ? '#faad14' : '#f5222d'}
              style={{ marginTop: 4 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Avg Turnaround"
              value={dashboard.avgTurnaroundHours}
              suffix="h"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* AI + Expiration Row */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Auto-Triggered (A2)"
              value={dashboard.autoTriggeredCount}
              prefix={<ThunderboltOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dashboard.total > 0 ? `${Math.round((dashboard.autoTriggeredCount / dashboard.total) * 100)}% of total` : ''}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Expiring Soon (7d)"
              value={dashboard.expiringSoon}
              prefix={<WarningOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
            {dashboard.expiringSoon > 0 && (
              <Button size="small" type="link" onClick={() => navigate('/prior-auth')}>View in worklist</Button>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Expired"
              value={dashboard.expired}
              prefix={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
            {dashboard.expired > 0 && (
              <Text type="danger" style={{ fontSize: 12 }}>Re-authorization needed</Text>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Top Denial Reason"
              value={dashboard.topDeniedReasons[0]?.reason?.substring(0, 30) || 'None'}
              prefix={<RobotOutlined />}
              valueStyle={{ fontSize: 14 }}
            />
            {dashboard.topDeniedReasons[0] && (
              <Text type="secondary" style={{ fontSize: 12 }}>{dashboard.topDeniedReasons[0].count} occurrences</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Status Breakdown */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="Status Breakdown" size="small">
            {statusEntries.length === 0 ? (
              <Empty description="No PAs" />
            ) : (
              statusEntries.map(([status, count]) => {
                const pct = dashboard.total > 0 ? Math.round((count / dashboard.total) * 100) : 0;
                const colors: Record<string, string> = {
                  draft: '#bfbfbf', submitted: '#1890ff', pending: '#faad14',
                  approved: '#52c41a', denied: '#f5222d', p2p_scheduled: '#722ed1',
                  appealed: '#fa8c16', expired: '#ff4d4f', cancelled: '#bfbfbf', superseded: '#d9d9d9',
                };
                return (
                  <div key={status} style={{ marginBottom: 8 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Text style={{ textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</Text>
                      <Text type="secondary">{count} ({pct}%)</Text>
                    </Space>
                    <Progress percent={pct} size="small" strokeColor={colors[status] || '#1890ff'} />
                  </div>
                );
              })
            )}
          </Card>
        </Col>

        {/* Top Denial Reasons */}
        <Col span={12}>
          <Card title="Top Denial Reasons" size="small">
            {dashboard.topDeniedReasons.length === 0 ? (
              <Empty description="No denials" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                dataSource={dashboard.topDeniedReasons}
                columns={denialColumns}
                rowKey="reason"
                size="small"
                pagination={false}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Payer Scorecard */}
      <Card title="Payer Scorecard" size="small">
        {dashboard.byPayer.length === 0 ? (
          <Empty description="No payer data" />
        ) : (
          <Table
            dataSource={dashboard.byPayer}
            columns={payerColumns}
            rowKey="payer"
            size="small"
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
};

export default PriorAuthDashboardPage;
