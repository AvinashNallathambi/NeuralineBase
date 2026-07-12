import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Modal,
  Input,
  message,
  Progress,
  Tooltip,
  Spin,
  Timeline,
  Descriptions,
} from 'antd';
import {
  RobotOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  SendOutlined,
  EyeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import appealsService, { Appeal, AppealStats } from '../../services/appealsService';

const { Text, Paragraph } = Typography;

const statusColors: Record<string, string> = {
  draft: 'default',
  submitted: 'blue',
  under_review: 'orange',
  approved: 'green',
  denied: 'red',
  partially_approved: 'gold',
  escalated: 'volcano',
  withdrawn: 'default',
};

const AppealsPage: React.FC = () => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [stats, setStats] = useState<AppealStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<{ probability: number; rationale: string } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        appealsService.findAll(),
        appealsService.getStats(),
      ]);
      setAppeals(a);
      setStats(s);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to load appeals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleView = async (id: string) => {
    try {
      const appeal = await appealsService.findOne(id);
      setSelectedAppeal(appeal);
      setResolutionNotes(appeal.resolutionNotes || '');
      setPrediction(null);
      setDetailModal(true);
    } catch {
      message.error('Failed to load appeal');
    }
  };

  const handleGenerateLetter = async () => {
    if (!selectedAppeal) return;
    setGeneratingLetter(true);
    try {
      const updated = await appealsService.generateLetter(selectedAppeal.id);
      setSelectedAppeal(updated);
      message.success('AI appeal letter generated successfully');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'AI generation failed — is Ollama running?');
    } finally {
      setGeneratingLetter(false);
    }
  };

  const handlePredictSuccess = async () => {
    if (!selectedAppeal) return;
    setPredicting(true);
    try {
      const result = await appealsService.predictSuccess(selectedAppeal.id);
      setPrediction(result);
    } catch (err: any) {
      message.error('Prediction failed — is Ollama running?');
    } finally {
      setPredicting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAppeal) return;
    try {
      const updated = await appealsService.submit(selectedAppeal.id);
      setSelectedAppeal(updated);
      message.success('Appeal submitted to payer');
      loadData();
    } catch {
      message.error('Failed to submit appeal');
    }
  };

  const handleUpdateStatus = async (status: string, outcome?: string) => {
    if (!selectedAppeal) return;
    try {
      await appealsService.updateStatus(selectedAppeal.id, {
        status,
        outcome,
        notes: resolutionNotes,
      });
      message.success(`Appeal marked as ${status}`);
      setDetailModal(false);
      loadData();
    } catch {
      message.error('Failed to update status');
    }
  };

  const columns: ColumnsType<Appeal> = [
    {
      title: 'Appeal #',
      dataIndex: 'appealNumber',
      key: 'appealNumber',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Claim',
      dataIndex: 'claimNumber',
      key: 'claimNumber',
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
    },
    {
      title: 'CARC',
      dataIndex: 'carcCode',
      key: 'carcCode',
      render: (code: string) => code ? <Tag color="red">{code}</Tag> : '-',
    },
    {
      title: 'Denied $',
      dataIndex: 'deniedAmount',
      key: 'deniedAmount',
      align: 'right',
      render: (amt: number) => `$${(amt || 0).toFixed(2)}`,
    },
    {
      title: 'AI Success %',
      dataIndex: 'successProbability',
      key: 'successProbability',
      align: 'center',
      render: (prob: number) =>
        prob != null ? <Progress percent={prob} size="small" /> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={statusColors[s]}>{s.replace(/_/g, ' ').toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Letter',
      key: 'letter',
      align: 'center',
      render: (_: unknown, r: Appeal) =>
        r.appealLetter ? (
          <Tooltip title="Letter generated">
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          </Tooltip>
        ) : (
          <Tooltip title="No letter yet">
            <CloseCircleOutlined style={{ color: '#d9d9d9' }} />
          </Tooltip>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: Appeal) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(r.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={3}>Appeal Management</Typography.Title>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={3}>
          <Card>
            <Statistic title="Total Appeals" value={stats?.totalAppeals || 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic title="Pending" value={stats?.pendingCount || 0} />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic title="Submitted" value={stats?.submittedCount || 0} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic title="Approved" value={stats?.approvedCount || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic title="Denied" value={stats?.deniedCount || 0} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic title="Recovered" value={stats?.totalRecovered || 0} prefix={<DollarOutlined />} precision={2} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic title="Success Rate" value={stats?.successRate || 0} suffix="%" />
          </Card>
        </Col>
        <Col span={3}>
          <Card>
            <Statistic title="Avg AI Prob" value={stats?.avgSuccessProbability || 0} suffix="%" prefix={<RobotOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table columns={columns} dataSource={appeals} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={`Appeal: ${selectedAppeal?.appealNumber || ''}`}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setDetailModal(false)}>Close</Button>,
          selectedAppeal?.status === 'draft' && (
            <Button key="submit" type="primary" icon={<SendOutlined />} onClick={handleSubmit}>
              Submit to Payer
            </Button>
          ),
          selectedAppeal?.status === 'submitted' && (
            <>
              <Button key="approve" style={{ background: '#52c41a', borderColor: '#52c41a', color: 'white' }} onClick={() => handleUpdateStatus('approved', 'overturned')}>
                Mark Approved
              </Button>
              <Button key="deny" danger onClick={() => handleUpdateStatus('denied', 'upheld')}>
                Mark Denied
              </Button>
            </>
          ),
        ]}
      >
        {selectedAppeal && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Claim">{selectedAppeal.claimNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="Patient">{selectedAppeal.patientName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Payer">{selectedAppeal.payerName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Denied Amount">${selectedAppeal.deniedAmount.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="CARC">
                <Tag color="red">{selectedAppeal.carcCode || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[selectedAppeal.status]}>
                  {selectedAppeal.status.replace(/_/g, ' ').toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Deadline">
                {selectedAppeal.deadlineDate ? new Date(selectedAppeal.deadlineDate).toLocaleDateString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Recovered">
                {selectedAppeal.recoveredAmount != null ? `$${selectedAppeal.recoveredAmount.toFixed(2)}` : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* AI Actions */}
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={generatingLetter}
                onClick={handleGenerateLetter}
              >
                Generate AI Appeal Letter
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                loading={predicting}
                onClick={handlePredictSuccess}
              >
                Predict Success
              </Button>
            </Space>

            {/* AI Prediction */}
            {prediction && (
              <Card size="small" style={{ marginBottom: 16, background: '#f6ffed' }}>
                <Text strong>AI Success Prediction: </Text>
                <Progress
                  percent={prediction.probability}
                  status={prediction.probability > 60 ? 'success' : prediction.probability > 30 ? 'normal' : 'exception'}
                  style={{ width: 200, display: 'inline-block', marginLeft: 12 }}
                />
                <Paragraph style={{ marginTop: 8 }} type="secondary">
                  {prediction.rationale}
                </Paragraph>
              </Card>
            )}

            {/* Appeal Letter */}
            {selectedAppeal.appealLetter ? (
              <Card
                title={
                  <Space>
                    <FileTextOutlined />
                    <Text>{selectedAppeal.appealSubject || 'Appeal Letter'}</Text>
                  </Space>
                }
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Paragraph style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
                  {selectedAppeal.appealLetter}
                </Paragraph>
              </Card>
            ) : (
              <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
                <Text type="secondary">
                  No appeal letter generated yet. Click "Generate AI Appeal Letter" to create one.
                </Text>
              </Card>
            )}

            {/* AI Rationale */}
            {selectedAppeal.aiRationale && (
              <Card title="AI Analysis" size="small" style={{ marginBottom: 16 }}>
                <Paragraph type="secondary">{selectedAppeal.aiRationale}</Paragraph>
                {selectedAppeal.successProbability != null && (
                  <div>
                    <Text strong>Predicted Success: </Text>
                    <Progress
                      percent={selectedAppeal.successProbability}
                      status={selectedAppeal.successProbability > 60 ? 'success' : 'normal'}
                      style={{ width: 200, display: 'inline-block', marginLeft: 12 }}
                    />
                  </div>
                )}
              </Card>
            )}

            {/* Status History */}
            {selectedAppeal.statusHistory && selectedAppeal.statusHistory.length > 0 && (
              <Card title="Status History" size="small" style={{ marginBottom: 16 }}>
                <Timeline
                  items={selectedAppeal.statusHistory
                    .slice()
                    .reverse()
                    .map((h) => ({
                      color: statusColors[h.status] === 'green' ? 'green' : statusColors[h.status] === 'red' ? 'red' : 'blue',
                      children: (
                        <div>
                          <Tag color={statusColors[h.status]}>{h.status.replace(/_/g, ' ').toUpperCase()}</Tag>
                          <Text type="secondary"> by {h.changedByName || 'System'} — {new Date(h.createdAt).toLocaleString()}</Text>
                          {h.notes && <div><Text type="secondary">{h.notes}</Text></div>}
                        </div>
                      ),
                    }))}
                />
              </Card>
            )}

            {/* Resolution Notes */}
            <div>
              <Text strong>Resolution Notes:</Text>
              <Input.TextArea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add resolution notes..."
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AppealsPage;
