import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Statistic,
  Row,
  Col,
  Tag,
  Space,
  Typography,
  Select,
  DatePicker,
  Tabs,
  Tooltip,
  Button,
  Modal,
  Input,
  message,
  Progress,
  Descriptions,
} from 'antd';
import {
  DollarOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  BarChartOutlined,
  TeamOutlined,
  FileSearchOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import denialsService, {
  DenialRecord,
  DenialStats,
  DenialAnalytics,
  ClaimAging,
  PayerPerformance,
  DenialCluster,
  WorklistPriority,
} from '../../services/denialsService';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const priorityColors: Record<string, string> = {
  low: 'default',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

const statusColors: Record<string, string> = {
  new: 'blue',
  in_progress: 'orange',
  appealed: 'purple',
  resolved: 'green',
  written_off: 'default',
  escalated: 'red',
};

const rootCauseColors: Record<string, string> = {
  eligibility: 'cyan',
  prior_authorization: 'volcano',
  medical_necessity: 'red',
  coding_error: 'orange',
  missing_information: 'gold',
  duplicate: 'default',
  timely_filing: 'magenta',
  coordination_of_benefits: 'geekblue',
  non_covered_service: 'red',
  bundling: 'lime',
  fee_schedule: 'green',
  benefit_maximum: 'blue',
  frequency_limit: 'purple',
  wrong_payer: 'cyan',
  patient_responsibility: 'default',
  other: 'default',
};

const DenialsPage: React.FC = () => {
  const [worklist, setWorklist] = useState<DenialRecord[]>([]);
  const [stats, setStats] = useState<DenialStats | null>(null);
  const [analytics, setAnalytics] = useState<DenialAnalytics | null>(null);
  const [aging, setAging] = useState<ClaimAging | null>(null);
  const [payerPerf, setPayerPerf] = useState<PayerPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>();
  const [priorityFilter, setPriorityFilter] = useState<string>();
  const [rootCauseFilter, setRootCauseFilter] = useState<string>();
  const [selectedDenial, setSelectedDenial] = useState<DenialRecord | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [clusters, setClusters] = useState<DenialCluster[]>([]);
  const [priorities, setPriorities] = useState<WorklistPriority[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wl, st, an, ag, pp] = await Promise.all([
        denialsService.getWorklist({
          status: statusFilter,
          priority: priorityFilter,
          rootCause: rootCauseFilter,
        }),
        denialsService.getStats(),
        denialsService.getAnalytics(),
        denialsService.getClaimAging(),
        denialsService.getPayerPerformance(),
      ]);
      setWorklist(wl);
      setStats(st);
      setAnalytics(an);
      setAging(ag);
      setPayerPerf(pp);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to load denial data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, rootCauseFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleViewDetail = async (id: string) => {
    try {
      const denial = await denialsService.findOne(id);
      setSelectedDenial(denial);
      setResolutionNotes(denial.resolutionNotes || '');
      setDetailModal(true);
    } catch {
      message.error('Failed to load denial detail');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedDenial) return;
    try {
      await denialsService.updateStatus(selectedDenial.id, status, resolutionNotes);
      message.success(`Status updated to ${status}`);
      setDetailModal(false);
      loadData();
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleAiScore = async (id: string) => {
    setAiLoading(true);
    try {
      await denialsService.aiScoreRecovery(id);
      message.success('AI recovery score generated');
      loadData();
    } catch (err: any) {
      message.error('AI scoring failed — is Ollama running?');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiCluster = async () => {
    setAiLoading(true);
    try {
      const result = await denialsService.aiCluster(100);
      setClusters(result);
      message.success(`AI identified ${result.length} denial pattern clusters`);
    } catch (err: any) {
      message.error('AI clustering failed — is Ollama running?');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiPrioritize = async () => {
    setAiLoading(true);
    try {
      const result = await denialsService.aiPrioritize();
      setPriorities(result);
      message.success(`AI prioritized ${result.length} denials by expected recovery value`);
    } catch (err: any) {
      message.error('AI prioritization failed');
    } finally {
      setAiLoading(false);
    }
  };

  const worklistColumns: ColumnsType<DenialRecord> = [
    {
      title: 'Claim #',
      dataIndex: 'claimNumber',
      key: 'claimNumber',
      render: (text: string) => text || '-',
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
    },
    {
      title: 'Payer',
      dataIndex: 'payerName',
      key: 'payerName',
      render: (text: string) => text || '-',
    },
    {
      title: 'CARC',
      dataIndex: 'carcCode',
      key: 'carcCode',
      render: (code: string, r: DenialRecord) => (
        <Tooltip title={r.carcDescription}>
          <Tag color={r.groupCode === 'PR' ? 'blue' : 'red'}>
            {r.groupCode}-{code}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Root Cause',
      dataIndex: 'rootCauseCategory',
      key: 'rootCauseCategory',
      render: (cat: string) => (
        <Tag color={rootCauseColors[cat] || 'default'}>
          {cat.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Denied $',
      dataIndex: 'deniedAmount',
      key: 'deniedAmount',
      align: 'right',
      sorter: (a, b) => a.deniedAmount - b.deniedAmount,
      render: (amt: number) => `$${(amt || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (p: string) => (
        <Tag color={priorityColors[p]}>
          {p.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={statusColors[s]}>
          {s.replace(/_/g, ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Deadline',
      dataIndex: 'filingDeadline',
      key: 'filingDeadline',
      render: (d: string) => {
        if (!d) return '-';
        const days = Math.floor((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const color = days <= 7 ? 'red' : days <= 30 ? 'orange' : 'default';
        return <Tag color={color}>{days > 0 ? `${days}d left` : 'OVERDUE'}</Tag>;
      },
    },
    {
      title: 'Recovery %',
      dataIndex: 'recoveryProbability',
      key: 'recoveryProbability',
      align: 'center',
      render: (prob: number) =>
        prob != null ? (
          <Progress percent={prob} size="small" />
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: DenialRecord) => (
        <Space>
          <Button size="small" onClick={() => handleViewDetail(r.id)}>
            View
          </Button>
          <Tooltip title="AI Score Recovery">
            <Button size="small" icon={<RobotOutlined />} loading={aiLoading} onClick={() => handleAiScore(r.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const agingColumns: ColumnsType<{ bucket: string; count: number; amount: number }> = [
    { title: 'Age Bucket', dataIndex: 'bucket', key: 'bucket' },
    { title: 'Count', dataIndex: 'count', key: 'count', align: 'center' },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amt: number) => `$${(amt || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
  ];

  const payerPerfColumns: ColumnsType<PayerPerformance> = [
    { title: 'Payer', dataIndex: 'payer', key: 'payer' },
    { title: 'Denials', dataIndex: 'totalDenials', key: 'totalDenials', align: 'center' },
    {
      title: 'Denied Amount',
      dataIndex: 'deniedAmount',
      key: 'deniedAmount',
      align: 'right',
      render: (amt: number) => `$${(amt || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    { title: 'Resolved', dataIndex: 'resolvedCount', key: 'resolvedCount', align: 'center' },
    {
      title: 'Avg Days',
      dataIndex: 'avgDaysToResolve',
      key: 'avgDaysToResolve',
      align: 'center',
      render: (d: number) => (d > 0 ? `${d.toFixed(0)}d` : '-'),
    },
    { title: 'Top Root Cause', dataIndex: 'topRootCause', key: 'topRootCause' },
  ];

  return (
    <div>
      <Title level={3}>Denial Analysis & Management</Title>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={3}>
          <Card>
            <Statistic
              title="Total Denials"
              value={stats?.totalDenials || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic
              title="Denied $"
              value={stats?.totalDeniedAmount || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic
              title="New"
              value={stats?.newCount || 0}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic
              title="In Progress"
              value={stats?.inProgressCount || 0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic
              title="Appealed"
              value={stats?.appealedCount || 0}
              prefix={<FileSearchOutlined />}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic
              title="Resolved"
              value={stats?.resolvedCount || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic
              title="Critical"
              value={stats?.criticalCount || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic
              title="Deadline <7d"
              value={stats?.approachingDeadlineCount || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="worklist"
        items={[
          {
            key: 'worklist',
            label: 'Denial Worklist',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    placeholder="Filter by status"
                    allowClear
                    style={{ width: 180 }}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: 'new', label: 'New' },
                      { value: 'in_progress', label: 'In Progress' },
                      { value: 'appealed', label: 'Appealed' },
                      { value: 'resolved', label: 'Resolved' },
                      { value: 'written_off', label: 'Written Off' },
                      { value: 'escalated', label: 'Escalated' },
                    ]}
                  />
                  <Select
                    placeholder="Filter by priority"
                    allowClear
                    style={{ width: 150 }}
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                      { value: 'critical', label: 'Critical' },
                    ]}
                  />
                  <Select
                    placeholder="Filter by root cause"
                    allowClear
                    style={{ width: 220 }}
                    value={rootCauseFilter}
                    onChange={setRootCauseFilter}
                    options={[
                      { value: 'eligibility', label: 'Eligibility' },
                      { value: 'prior_authorization', label: 'Prior Authorization' },
                      { value: 'medical_necessity', label: 'Medical Necessity' },
                      { value: 'coding_error', label: 'Coding Error' },
                      { value: 'missing_information', label: 'Missing Information' },
                      { value: 'duplicate', label: 'Duplicate' },
                      { value: 'timely_filing', label: 'Timely Filing' },
                      { value: 'coordination_of_benefits', label: 'Coordination of Benefits' },
                      { value: 'non_covered_service', label: 'Non-Covered Service' },
                      { value: 'bundling', label: 'Bundling' },
                      { value: 'fee_schedule', label: 'Fee Schedule' },
                      { value: 'benefit_maximum', label: 'Benefit Maximum' },
                      { value: 'patient_responsibility', label: 'Patient Responsibility' },
                    ]}
                  />
                </Space>
                <Table
                  columns={worklistColumns}
                  dataSource={worklist}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                />
              </div>
            ),
          },
          {
            key: 'analytics',
            label: 'Analytics Dashboard',
            children: (
              <div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="Denials by Root Cause">
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="category"
                        dataSource={analytics?.byRootCause || []}
                        columns={[
                          { title: 'Root Cause', dataIndex: 'category', key: 'category' },
                          { title: 'Count', dataIndex: 'count', key: 'count', align: 'center' as const },
                          {
                            title: 'Amount',
                            dataIndex: 'amount',
                            key: 'amount',
                            align: 'right' as const,
                            render: (a: number) => `$${(a || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="Top Denial Codes (CARC)">
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="code"
                        dataSource={analytics?.topCarcCodes || []}
                        columns={[
                          { title: 'Code', dataIndex: 'code', key: 'code' },
                          { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
                          { title: 'Count', dataIndex: 'count', key: 'count', align: 'center' as const },
                          {
                            title: 'Amount',
                            dataIndex: 'amount',
                            key: 'amount',
                            align: 'right' as const,
                            render: (a: number) => `$${(a || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Card title="Denials by Month">
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="month"
                        dataSource={analytics?.byMonth || []}
                        columns={[
                          { title: 'Month', dataIndex: 'month', key: 'month' },
                          { title: 'Count', dataIndex: 'count', key: 'count', align: 'center' as const },
                          {
                            title: 'Amount',
                            dataIndex: 'amount',
                            key: 'amount',
                            align: 'right' as const,
                            render: (a: number) => `$${(a || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="Key Metrics">
                      <Row gutter={16}>
                        <Col span={12}>
                          <Statistic
                            title="Appeal Success Rate"
                            value={analytics?.appealSuccessRate || 0}
                            suffix="%"
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="Recovery Rate"
                            value={analytics?.recoveryRate || 0}
                            suffix="%"
                          />
                        </Col>
                        <Col span={12} style={{ marginTop: 16 }}>
                          <Statistic
                            title="Avg Days to Resolve"
                            value={analytics?.avgDaysToResolve || 0}
                            suffix="days"
                          />
                        </Col>
                        <Col span={12} style={{ marginTop: 16 }}>
                          <Statistic
                            title="Total Denied"
                            value={analytics?.totalDeniedAmount || 0}
                            prefix="$"
                            precision={2}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'aging',
            label: 'Claim Aging',
            children: (
              <Card title="A/R Aging Buckets">
                <Table
                  columns={agingColumns}
                  dataSource={aging?.buckets || []}
                  rowKey="bucket"
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'payer',
            label: 'Payer Performance',
            children: (
              <Card title="Payer Performance Scorecard">
                <Table
                  columns={payerPerfColumns}
                  dataSource={payerPerf}
                  rowKey="payer"
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'ai',
            label: 'AI Insights',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<RobotOutlined />} loading={aiLoading} onClick={handleAiCluster}>
                    Cluster Denials (AI)
                  </Button>
                  <Button icon={<ThunderboltOutlined />} loading={aiLoading} onClick={handleAiPrioritize}>
                    Prioritize Worklist (AI)
                  </Button>
                </Space>

                {clusters.length > 0 && (
                  <Card title="Denial Pattern Clusters" style={{ marginBottom: 16 }}>
                    <Row gutter={[16, 16]}>
                      {clusters.map((c) => (
                        <Col span={8} key={c.clusterId}>
                          <Card size="small" type="inner" title={c.label}>
                            <Descriptions column={1} size="small">
                              <Descriptions.Item label="Count">{c.count}</Descriptions.Item>
                              <Descriptions.Item label="Total $">${(c.totalAmount || 0).toFixed(2)}</Descriptions.Item>
                              <Descriptions.Item label="Avg Recovery">
                                <Progress percent={c.avgRecoveryProbability || 0} size="small" />
                              </Descriptions.Item>
                              <Descriptions.Item label="CARC Codes">
                                {c.commonCarcCodes.map((code) => <Tag key={code} color="red">{code}</Tag>)}
                              </Descriptions.Item>
                              <Descriptions.Item label="Payers">
                                {c.commonPayers.slice(0, 3).map((p) => <Tag key={p}>{p}</Tag>)}
                              </Descriptions.Item>
                              <Descriptions.Item label="Action">{c.recommendedAction}</Descriptions.Item>
                            </Descriptions>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                )}

                {priorities.length > 0 && (
                  <Card title="AI-Prioritized Worklist (by Expected Recovery Value)">
                    <Table
                      size="small"
                      rowKey="denialId"
                      pagination={{ pageSize: 20 }}
                      dataSource={priorities}
                      columns={[
                        { title: 'Rank', dataIndex: 'rank', key: 'rank', align: 'center' as const, render: (r: number) => <Text strong>#{r}</Text> },
                        { title: 'Denial ID', dataIndex: 'denialId', key: 'denialId', ellipsis: true },
                        {
                          title: 'Expected Value',
                          dataIndex: 'expectedValue',
                          key: 'expectedValue',
                          align: 'right' as const,
                          sorter: (a: WorklistPriority, b: WorklistPriority) => b.expectedValue - a.expectedValue,
                          render: (v: number) => <Text strong style={{ color: '#3f8600' }}>${(v || 0).toFixed(2)}</Text>,
                        },
                        { title: 'Reasoning', dataIndex: 'reasoning', key: 'reasoning' },
                      ]}
                    />
                  </Card>
                )}

                {clusters.length === 0 && priorities.length === 0 && (
                  <Card>
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                      <p style={{ marginTop: 16, color: '#999' }}>
                        Click the buttons above to run AI-powered denial clustering and worklist prioritization.
                        Requires Ollama to be running.
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Detail Modal */}
      <Modal
        title={`Denial Detail — ${selectedDenial?.carcCode || ''}`}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setDetailModal(false)}>Cancel</Button>,
          <Button key="appeal" type="primary" onClick={() => handleUpdateStatus('appealed')}>
            Mark as Appealed
          </Button>,
          <Button key="resolve" style={{ background: '#52c41a', borderColor: '#52c41a', color: 'white' }} onClick={() => handleUpdateStatus('resolved')}>
            Mark Resolved
          </Button>,
          <Button key="writeoff" danger onClick={() => handleUpdateStatus('written_off')}>
            Write Off
          </Button>,
        ]}
        width={700}
      >
        {selectedDenial && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Claim: </Text>
                <Text>{selectedDenial.claimNumber || 'N/A'}</Text>
              </Col>
              <Col span={12}>
                <Text strong>Patient: </Text>
                <Text>{selectedDenial.patientName || 'N/A'}</Text>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Text strong>CARC: </Text>
                <Tag color="red">{selectedDenial.groupCode}-{selectedDenial.carcCode}</Tag>
              </Col>
              <Col span={12}>
                <Text strong>Root Cause: </Text>
                <Tag color={rootCauseColors[selectedDenial.rootCauseCategory]}>
                  {selectedDenial.rootCauseCategory.replace(/_/g, ' ')}
                </Tag>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={24}>
                <Text strong>Denial Reason: </Text>
                <Text>{selectedDenial.carcDescription || selectedDenial.denialReasonText}</Text>
              </Col>
            </Row>
            {selectedDenial.rarcCode && (
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={24}>
                  <Text strong>RARC: </Text>
                  <Tag>{selectedDenial.rarcCode}</Tag>
                  <Text type="secondary"> {selectedDenial.rarcDescription}</Text>
                </Col>
              </Row>
            )}
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={8}>
                <Text strong>Denied: </Text>
                <Text type="danger">${selectedDenial.deniedAmount.toFixed(2)}</Text>
              </Col>
              <Col span={8}>
                <Text strong>Billed: </Text>
                <Text>${selectedDenial.billedAmount.toFixed(2)}</Text>
              </Col>
              <Col span={8}>
                <Text strong>Paid: </Text>
                <Text>${selectedDenial.paidAmount.toFixed(2)}</Text>
              </Col>
            </Row>
            {selectedDenial.filingDeadline && (
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={24}>
                  <Text strong>Appeal Deadline: </Text>
                  <Text>
                    {new Date(selectedDenial.filingDeadline).toLocaleDateString()} (
                    {Math.floor((new Date(selectedDenial.filingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days)
                  </Text>
                </Col>
              </Row>
            )}
            <div style={{ marginTop: 16 }}>
              <Text strong>Resolution Notes:</Text>
              <Input.TextArea
                rows={4}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add notes about resolution or appeal action..."
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DenialsPage;
