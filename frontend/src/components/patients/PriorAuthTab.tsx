import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  message,
  Tooltip,
  Drawer,
  Descriptions,
  Empty,
  Spin,
  Alert,
  Progress,
  Collapse,
  List,
  Divider,
  Badge,
  Popconfirm,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  EyeOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type {
  PriorAuthRequest,
  PriorAuthStatus,
  PriorAuthCode,
  PriorAuthDiagnosis,
  PriorAuthSubmissionMethod,
  PriorAuthAttachment,
  RequirementCheckResult,
  AutoTriggerPaResult,
} from '../../types';
import { priorAuthService } from '../../services/priorAuthService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Props {
  patientId: string;
}

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

const PriorAuthTab: React.FC<Props> = ({ patientId }) => {
  const [paList, setPaList] = useState<PriorAuthRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState<PriorAuthRequest | null>(null);
  const [attachments, setAttachments] = useState<PriorAuthAttachment[]>([]);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [payerResponseModal, setPayerResponseModal] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [autoTriggerModal, setAutoTriggerModal] = useState(false);
  const [autoTriggerResult, setAutoTriggerResult] = useState<AutoTriggerPaResult | null>(null);
  const [authLetterModal, setAuthLetterModal] = useState(false);
  const [authLetterText, setAuthLetterText] = useState('');
  const [p2pResult, setP2pResult] = useState<any | null>(null);
  const [p2pModalOpen, setP2pModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [autoTriggerForm] = Form.useForm();
  const [payerResponseForm] = Form.useForm();
  const [submitForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await priorAuthService.list({ patientId });
      setPaList(data);
    } catch (err: any) {
      message.error('Failed to load prior authorizations: ' + (err?.response?.data?.message || err?.message));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadAttachments = async (paId: string) => {
    try {
      const atts = await priorAuthService.getAttachments(paId);
      setAttachments(atts);
    } catch {
      setAttachments([]);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const procedureCodes: PriorAuthCode[] = (values.procedureCodes || []).map((p: any) => ({
        code: p.code,
        description: p.description,
        quantity: p.quantity,
      }));
      const diagnosisCodes: PriorAuthDiagnosis[] = (values.diagnosisCodes || []).map((d: any) => ({
        code: d.code,
        description: d.description,
        isPrimary: d.isPrimary || false,
      }));
      await priorAuthService.create({
        patientId,
        payerName: values.payerName,
        planName: values.planName,
        policyNumber: values.policyNumber,
        providerName: values.providerName,
        urgency: values.urgency || 'standard',
        benefitType: values.benefitType || 'medical',
        procedureCodes,
        diagnosisCodes,
        clinicalNotes: values.clinicalNotes,
        serviceDate: values.serviceDate?.format('YYYY-MM-DD'),
        estimatedCost: values.estimatedCost,
        priority: values.priority || 3,
      });
      message.success('Prior authorization request created');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return; // form validation error
      message.error('Failed to create PA: ' + (err?.response?.data?.message || err?.message));
    }
  };

  const handleSubmit = async () => {
    if (!detailDrawer) return;
    try {
      const values = await submitForm.validateFields();
      await priorAuthService.submit(detailDrawer.id!, {
        submissionMethod: values.submissionMethod,
        authLetter: values.authLetter,
      });
      message.success('PA submitted to payer');
      setSubmitModal(false);
      submitForm.resetFields();
      fetchData();
      setDetailDrawer(null);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Failed to submit: ' + (err?.response?.data?.message || err?.message));
    }
  };

  const handlePayerResponse = async () => {
    if (!detailDrawer) return;
    try {
      const values = await payerResponseForm.validateFields();
      await priorAuthService.recordPayerResponse(detailDrawer.id!, {
        status: values.status,
        authNumber: values.authNumber,
        approvedStartDate: values.approvedStartDate?.format('YYYY-MM-DD'),
        approvedEndDate: values.approvedEndDate?.format('YYYY-MM-DD'),
        visitCountApproved: values.visitCountApproved,
        denialReason: values.denialReason,
        denialCode: values.denialCode,
        payerDecisionNotes: values.payerDecisionNotes,
        p2pScheduledAt: values.p2pScheduledAt?.toISOString(),
      });
      message.success('Payer response recorded');
      setPayerResponseModal(false);
      payerResponseForm.resetFields();
      fetchData();
      setDetailDrawer(null);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Failed to record response: ' + (err?.response?.data?.message || err?.message));
    }
  };

  const handleAutoTrigger = async () => {
    try {
      const values = await autoTriggerForm.validateFields();
      setAiLoading('auto-trigger');
      const procedureCodes: PriorAuthCode[] = (values.procedureCodes || []).map((p: any) => ({
        code: p.code,
        description: p.description,
      }));
      const result = await priorAuthService.autoTriggerPa({
        patientId,
        payerName: values.payerName,
        procedureCodes,
        clinicalNotes: values.clinicalNotes,
        serviceDate: values.serviceDate?.format('YYYY-MM-DD'),
      });
      setAutoTriggerResult(result);
      if (result.triggered) {
        message.success('PA auto-triggered — draft created with AI letter');
      } else {
        message.info(result.reason);
      }
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Auto-trigger failed: ' + (err?.response?.data?.message || err?.message));
    } finally {
      setAiLoading(null);
    }
  };

  const runAiFeature = async (feature: string, paId: string) => {
    setAiLoading(feature);
    try {
      let updated: PriorAuthRequest;
      switch (feature) {
        case 'requirement':
          updated = await priorAuthService.runRequirementPrediction(paId);
          message.success('Requirement prediction completed');
          break;
        case 'approval':
          updated = await priorAuthService.runApprovalPrediction(paId);
          message.success('Approval prediction completed');
          break;
        case 'expiration':
          updated = await priorAuthService.runExpirationPrediction(paId);
          message.success('Expiration prediction completed');
          break;
        case 'p2p':
          const result = await priorAuthService.prepareP2P(paId);
          setP2pResult(result);
          setP2pModalOpen(true);
          return;
        case 'learn':
          const learnResult = await priorAuthService.learnFromDenial(paId);
          message.success(`Learned from denial${learnResult.registryUpdate ? ' — registry updated' : ''}`);
          fetchData();
          return;
        default:
          return;
      }
      setDetailDrawer(updated);
      fetchData();
    } catch (err: any) {
      message.error(`AI feature failed: ${err?.response?.data?.message || err?.message}`);
    } finally {
      setAiLoading(null);
    }
  };

  const handleNewVersion = async (paId: string) => {
    try {
      await priorAuthService.createNewVersion(paId);
      message.success('New version created (re-authorization)');
      fetchData();
    } catch (err: any) {
      message.error('Failed to create new version: ' + (err?.message));
    }
  };

  const handleCancel = async (paId: string) => {
    try {
      await priorAuthService.cancel(paId, 'Cancelled by user');
      message.success('PA cancelled');
      fetchData();
      setDetailDrawer(null);
    } catch (err: any) {
      message.error('Failed to cancel: ' + (err?.message));
    }
  };

  const showDetail = async (pa: PriorAuthRequest) => {
    setDetailDrawer(pa);
    if (pa.id) await loadAttachments(pa.id);
  };

  // ── Table columns ──────────────────────────────────────────────────
  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: PriorAuthStatus) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: 'Payer',
      dataIndex: 'payerName',
      key: 'payerName',
      width: 150,
      render: (v: string) => v || '—',
    },
    {
      title: 'Procedures',
      dataIndex: 'procedureCodes',
      key: 'procedureCodes',
      render: (codes: PriorAuthCode[]) => (
        <Space direction="vertical" size={0}>
          {codes.map((c, i) => (
            <Text key={i} style={{ fontSize: 12 }}>
              <Text strong>{c.code}</Text> {c.description}
            </Text>
          ))}
        </Space>
      ),
    },
    {
      title: 'Auth #',
      dataIndex: 'authNumber',
      key: 'authNumber',
      width: 120,
      render: (v: string) => v ? <Text code copyable>{v}</Text> : '—',
    },
    {
      title: 'Expires',
      dataIndex: 'expirationDate',
      key: 'expirationDate',
      width: 110,
      render: (v: string) => {
        if (!v) return '—';
        const exp = new Date(v);
        const days = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days < 0) return <Tag color="red">Expired</Tag>;
        if (days < 7) return <Tag color="orange">{days}d left</Tag>;
        return <Text style={{ fontSize: 12 }}>{exp.toLocaleDateString()}</Text>;
      },
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p: number) => {
        const colors = ['#f5222d', '#fa8c16', '#faad14', '#52c41a', '#1890ff'];
        return <Tag color={colors[p - 1] || '#1890ff'}>P{p}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: PriorAuthRequest) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
          View
        </Button>
      ),
    },
  ];

  // ── AI Prediction Display ──────────────────────────────────────────
  const renderAiPredictions = (pa: PriorAuthRequest) => {
    if (!pa.aiRequirementPrediction && !pa.aiApprovalPrediction && !pa.aiExpirationPrediction) {
      return (
        <Alert
          message="No AI predictions yet"
          description="Run AI predictions to assess requirement probability, approval likelihood, and expiration risk."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }

    return (
      <Row gutter={16}>
        {pa.aiRequirementPrediction && (
          <Col span={8}>
            <Card size="small" title={<span><RobotOutlined /> Requirement Prediction</span>}>
              <Statistic
                title="PA Required Probability"
                value={pa.aiRequirementPrediction.probability}
                suffix="%"
                valueStyle={{ color: pa.aiRequirementPrediction.isRequired ? '#cf1322' : '#3f8600' }}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Confidence: {pa.aiRequirementPrediction.confidence}%
                </Text>
              </div>
              <Paragraph style={{ marginTop: 8, fontSize: 12 }}>
                {pa.aiRequirementPrediction.rationale}
              </Paragraph>
            </Card>
          </Col>
        )}
        {pa.aiApprovalPrediction && (
          <Col span={8}>
            <Card size="small" title={<span><RobotOutlined /> Approval Probability</span>}>
              <Statistic
                title="Likelihood of Approval"
                value={pa.aiApprovalPrediction.approvalProbability}
                suffix="%"
                valueStyle={{
                  color: pa.aiApprovalPrediction.approvalProbability >= 80 ? '#3f8600' :
                         pa.aiApprovalPrediction.approvalProbability >= 50 ? '#faad14' : '#cf1322',
                }}
              />
              <Tag color={pa.aiApprovalPrediction.riskLevel === 'low' ? 'success' :
                          pa.aiApprovalPrediction.riskLevel === 'medium' ? 'warning' : 'error'}
                   style={{ marginTop: 8 }}>
                {pa.aiApprovalPrediction.riskLevel.toUpperCase()} RISK
              </Tag>
              {pa.aiApprovalPrediction.missingDocumentation.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text type="warning" style={{ fontSize: 12 }}>
                    <WarningOutlined /> Missing: {pa.aiApprovalPrediction.missingDocumentation.join(', ')}
                  </Text>
                </div>
              )}
            </Card>
          </Col>
        )}
        {pa.aiExpirationPrediction && (
          <Col span={8}>
            <Card size="small" title={<span><RobotOutlined /> Expiration Prediction</span>}>
              <Statistic
                title="Days Until Expiration"
                value={pa.aiExpirationPrediction.daysUntilExpiration}
                suffix="days"
                valueStyle={{
                  color: pa.aiExpirationPrediction.expirationRisk === 'high' ? '#cf1322' :
                         pa.aiExpirationPrediction.expirationRisk === 'medium' ? '#faad14' : '#3f8600',
                }}
              />
              <Tag color={pa.aiExpirationPrediction.expirationRisk === 'low' ? 'success' :
                          pa.aiExpirationPrediction.expirationRisk === 'medium' ? 'warning' : 'error'}
                   style={{ marginTop: 8 }}>
                {pa.aiExpirationPrediction.expirationRisk.toUpperCase()} RISK
              </Tag>
              <Paragraph style={{ marginTop: 8, fontSize: 12 }}>
                {pa.aiExpirationPrediction.recommendation}
              </Paragraph>
            </Card>
          </Col>
        )}
      </Row>
    );
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>Prior Authorization</span>
            <Badge count={paList.length} style={{ backgroundColor: '#1890ff' }} />
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => { setAutoTriggerModal(true); setAutoTriggerResult(null); autoTriggerForm.resetFields(); }}
            >
              Auto-Trigger PA (AI)
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setCreateModalOpen(true); createForm.resetFields(); }}
            >
              New PA Request
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} />
          </Space>
        }
      >
        {paList.length === 0 && !loading ? (
          <Empty description="No prior authorization requests for this patient">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Create First PA Request
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={paList}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {/* ── Detail Drawer ────────────────────────────────────────────── */}
      <Drawer
        title={detailDrawer ? `PA Request — ${detailDrawer.payerName || 'Unknown Payer'}` : ''}
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        width={800}
      >
        {detailDrawer && (
          <div>
            {/* Status bar */}
            <Space style={{ marginBottom: 16 }}>
              <Tag color={STATUS_COLORS[detailDrawer.status!]} style={{ fontSize: 14, padding: '4px 12px' }}>
                {STATUS_LABELS[detailDrawer.status!]}
              </Tag>
              {detailDrawer.autoTriggered && (
                <Tag color="purple" icon={<ThunderboltOutlined />}>Auto-Triggered</Tag>
              )}
              {detailDrawer.urgency === 'expedited' && (
                <Tag color="red" icon={<ExclamationCircleOutlined />}>Expedited</Tag>
              )}
            </Space>

            {/* AI Predictions */}
            {renderAiPredictions(detailDrawer)}

            <Divider />

            {/* AI Action Buttons */}
            <Card size="small" title={<span><RobotOutlined /> AI Features</span>} style={{ marginBottom: 16 }}>
              <Space wrap>
                <Button
                  icon={<RobotOutlined />}
                  loading={aiLoading === 'requirement'}
                  onClick={() => detailDrawer.id && runAiFeature('requirement', detailDrawer.id)}
                >
                  Predict Requirement (A1)
                </Button>
                <Button
                  icon={<RobotOutlined />}
                  loading={aiLoading === 'approval'}
                  onClick={() => detailDrawer.id && runAiFeature('approval', detailDrawer.id)}
                >
                  Predict Approval (A4)
                </Button>
                <Button
                  icon={<RobotOutlined />}
                  loading={aiLoading === 'expiration'}
                  onClick={() => detailDrawer.id && runAiFeature('expiration', detailDrawer.id)}
                >
                  Predict Expiration (A6)
                </Button>
                {detailDrawer.status === 'denied' && (
                  <>
                    <Button
                      icon={<RobotOutlined />}
                      loading={aiLoading === 'p2p'}
                      onClick={() => detailDrawer.id && runAiFeature('p2p', detailDrawer.id)}
                    >
                      P2P Prep Coach (A5)
                    </Button>
                    <Button
                      icon={<RobotOutlined />}
                      loading={aiLoading === 'learn'}
                      onClick={() => detailDrawer.id && runAiFeature('learn', detailDrawer.id)}
                    >
                      Learn from Denial (A7)
                    </Button>
                  </>
                )}
              </Space>
            </Card>

            {/* Details */}
            <Descriptions title="Request Details" bordered column={2} size="small">
              <Descriptions.Item label="Payer">{detailDrawer.payerName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Plan">{detailDrawer.planName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Policy #">{detailDrawer.policyNumber || '—'}</Descriptions.Item>
              <Descriptions.Item label="Auth #">{detailDrawer.authNumber ? <Text code copyable>{detailDrawer.authNumber}</Text> : '—'}</Descriptions.Item>
              <Descriptions.Item label="Service Date">{detailDrawer.serviceDate || '—'}</Descriptions.Item>
              <Descriptions.Item label="Estimated Cost">{detailDrawer.estimatedCost ? `$${detailDrawer.estimatedCost}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Submitted">{detailDrawer.submittedAt ? new Date(detailDrawer.submittedAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Payer Response">{detailDrawer.payerResponseAt ? new Date(detailDrawer.payerResponseAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Approved Start">{detailDrawer.approvedStartDate || '—'}</Descriptions.Item>
              <Descriptions.Item label="Approved End">{detailDrawer.approvedEndDate || '—'}</Descriptions.Item>
              <Descriptions.Item label="Visits Approved">{detailDrawer.visitCountApproved ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Visits Used">{detailDrawer.visitsUsed ?? 0}</Descriptions.Item>
              <Descriptions.Item label="Assigned To">{detailDrawer.assignedTo || '—'}</Descriptions.Item>
              <Descriptions.Item label="Priority">P{detailDrawer.priority}</Descriptions.Item>
              <Descriptions.Item label="Version">v{detailDrawer.version}</Descriptions.Item>
              <Descriptions.Item label="Created">{detailDrawer.createdAt ? new Date(detailDrawer.createdAt).toLocaleString() : '—'}</Descriptions.Item>
            </Descriptions>

            {/* Procedure & Diagnosis Codes */}
            <Card size="small" title="Procedure Codes" style={{ marginTop: 16 }}>
              <List
                size="small"
                dataSource={detailDrawer.procedureCodes}
                renderItem={(c) => (
                  <List.Item>
                    <Text strong>{c.code}</Text> — {c.description}
                    {c.quantity && <Tag style={{ marginLeft: 8 }}>Qty: {c.quantity}</Tag>}
                  </List.Item>
                )}
              />
            </Card>

            {detailDrawer.diagnosisCodes && detailDrawer.diagnosisCodes.length > 0 && (
              <Card size="small" title="Diagnosis Codes" style={{ marginTop: 16 }}>
                <List
                  size="small"
                  dataSource={detailDrawer.diagnosisCodes}
                  renderItem={(d) => (
                    <List.Item>
                      <Text strong>{d.code}</Text> — {d.description}
                      {d.isPrimary && <Tag color="blue" style={{ marginLeft: 8 }}>Primary</Tag>}
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {/* Clinical Notes */}
            {detailDrawer.clinicalNotes && (
              <Card size="small" title="Clinical Notes" style={{ marginTop: 16 }}>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{detailDrawer.clinicalNotes}</Paragraph>
              </Card>
            )}

            {/* Auth Letter */}
            {detailDrawer.authLetter && (
              <Card
                size="small"
                title="PA Letter"
                style={{ marginTop: 16 }}
                extra={
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => { setAuthLetterText(detailDrawer.authLetter!); setAuthLetterModal(true); }}
                  >
                    View Full Letter
                  </Button>
                }
              >
                <Paragraph ellipsis={{ rows: 3 }} style={{ whiteSpace: 'pre-wrap' }}>
                  {detailDrawer.authLetter}
                </Paragraph>
              </Card>
            )}

            {/* Denial Info */}
            {detailDrawer.status === 'denied' && (
              <Alert
                style={{ marginTop: 16 }}
                type="error"
                message={`Denied${detailDrawer.denialCode ? ` — ${detailDrawer.denialCode}` : ''}`}
                description={detailDrawer.denialReason || 'No denial reason provided'}
                showIcon
              />
            )}

            {/* Attachments */}
            <Card
              size="small"
              title={`Attachments (${attachments.length})`}
              style={{ marginTop: 16 }}
            >
              <List
                size="small"
                dataSource={attachments}
                locale={{ emptyText: 'No attachments' }}
                renderItem={(att) => (
                  <List.Item
                    actions={[
                      att.content && (
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => {
                            Modal.info({
                              title: att.title,
                              width: 700,
                              content: <Paragraph style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>{att.content}</Paragraph>,
                            });
                          }}
                        >
                          View
                        </Button>
                      ),
                    ].filter(Boolean) as any}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text>{att.title}</Text>
                          <Tag>{att.attachmentType}</Tag>
                          {att.isAiGenerated && <Tag color="purple" icon={<RobotOutlined />}>AI</Tag>}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          {att.description && <Text type="secondary" style={{ fontSize: 12 }}>{att.description}</Text>}
                          {att.satisfiesCriterion && <Text type="success" style={{ fontSize: 12 }}>Satisfies: {att.satisfiesCriterion}</Text>}
                          {att.evidenceDate && <Text type="secondary" style={{ fontSize: 12 }}>Date: {att.evidenceDate}</Text>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>

            {/* Action Buttons */}
            <Divider />
            <Space wrap>
              {detailDrawer.status === 'draft' && (
                <>
                  <Button type="primary" icon={<SendOutlined />} onClick={() => { setSubmitModal(true); submitForm.resetFields(); }}>
                    Submit to Payer
                  </Button>
                  <Popconfirm title="Cancel this PA request?" onConfirm={() => detailDrawer.id && handleCancel(detailDrawer.id)}>
                    <Button danger>Cancel</Button>
                  </Popconfirm>
                </>
              )}
              {['pending', 'submitted', 'p2p_scheduled'].includes(detailDrawer.status!) && (
                <Button icon={<CheckCircleOutlined />} onClick={() => { setPayerResponseModal(true); payerResponseForm.resetFields(); }}>
                  Record Payer Response
                </Button>
              )}
              {['approved', 'denied', 'expired'].includes(detailDrawer.status!) && (
                <Button icon={<ReloadOutlined />} onClick={() => detailDrawer.id && handleNewVersion(detailDrawer.id)}>
                  New Version (Re-auth)
                </Button>
              )}
            </Space>
          </div>
        )}
      </Drawer>

      {/* ── Create Modal ─────────────────────────────────────────────── */}
      <Modal
        title="New Prior Authorization Request"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
        width={700}
        okText="Create"
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payerName" label="Payer Name" rules={[{ required: true }]}>
                <Input placeholder="e.g., Aetna, Cigna, UHC" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="planName" label="Plan Name">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="policyNumber" label="Policy Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="urgency" label="Urgency" initialValue="standard">
                <Select options={[{ value: 'standard', label: 'Standard (7 days)' }, { value: 'expedited', label: 'Expedited (72h)' }]} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="benefitType" label="Benefit Type" initialValue="medical">
                <Select options={[{ value: 'medical', label: 'Medical' }, { value: 'pharmacy', label: 'Pharmacy' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="providerName" label="Provider Name">
            <Input />
          </Form.Item>
          <Form.Item label="Procedure Codes (CPT/HCPCS)" required>
            <Form.List name="procedureCodes" initialValue={[{}]}>
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                      <Col span={6}>
                        <Form.Item name={[field.name, 'code']} fieldKey={[field.fieldKey, 'code']} noStyle rules={[{ required: true }]}>
                          <Input placeholder="CPT code" />
                        </Form.Item>
                      </Col>
                      <Col span={14}>
                        <Form.Item name={[field.name, 'description']} fieldKey={[field.fieldKey, 'description']} noStyle>
                          <Input placeholder="Description" />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Form.Item name={[field.name, 'quantity']} fieldKey={[field.fieldKey, 'quantity']} noStyle>
                          <InputNumber placeholder="Qty" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={1}>
                        <Button type="text" danger icon={<CloseCircleOutlined />} onClick={() => remove(field.name)} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>Add Procedure</Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item label="Diagnosis Codes (ICD-10)">
            <Form.List name="diagnosisCodes">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                      <Col span={6}>
                        <Form.Item name={[field.name, 'code']} fieldKey={[field.fieldKey, 'code']} noStyle>
                          <Input placeholder="ICD-10" />
                        </Form.Item>
                      </Col>
                      <Col span={15}>
                        <Form.Item name={[field.name, 'description']} fieldKey={[field.fieldKey, 'description']} noStyle>
                          <Input placeholder="Description" />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Form.Item name={[field.name, 'isPrimary']} fieldKey={[field.fieldKey, 'isPrimary']} noStyle valuePropName="checked">
                          <Select size="small" options={[{ value: true, label: 'Primary' }, { value: false, label: 'Secondary' }]} />
                        </Form.Item>
                      </Col>
                      <Col span={1}>
                        <Button type="text" danger icon={<CloseCircleOutlined />} onClick={() => remove(field.name)} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>Add Diagnosis</Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item name="clinicalNotes" label="Clinical Notes / Medical Necessity">
            <TextArea rows={4} placeholder="Document the clinical justification for this procedure..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="serviceDate" label="Service Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="estimatedCost" label="Estimated Cost ($)">
                <InputNumber style={{ width: '100%' }} prefix="$" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="Priority" initialValue={3}>
                <Select options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: `P${n} ${n <= 2 ? '(High)' : n >= 4 ? '(Low)' : ''}` }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Submit Modal ─────────────────────────────────────────────── */}
      <Modal
        title="Submit PA to Payer"
        open={submitModal}
        onOk={handleSubmit}
        onCancel={() => setSubmitModal(false)}
        okText="Submit"
      >
        <Form form={submitForm} layout="vertical">
          <Form.Item name="submissionMethod" label="Submission Method" rules={[{ required: true }]} initialValue="electronic">
            <Select options={[
              { value: 'electronic', label: 'Electronic (X12 278 / FHIR PAS)' },
              { value: 'portal', label: 'Payer Portal' },
              { value: 'fax', label: 'Fax' },
              { value: 'phone', label: 'Phone' },
              { value: 'mail', label: 'Mail' },
            ]} />
          </Form.Item>
          <Form.Item name="authLetter" label="PA Letter (optional — auto-generated if using Auto-Trigger)">
            <TextArea rows={6} placeholder="Paste or edit the PA letter..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Payer Response Modal ─────────────────────────────────────── */}
      <Modal
        title="Record Payer Response"
        open={payerResponseModal}
        onOk={handlePayerResponse}
        onCancel={() => setPayerResponseModal(false)}
        okText="Save Response"
        width={600}
      >
        <Form form={payerResponseForm} layout="vertical">
          <Form.Item name="status" label="Payer Decision" rules={[{ required: true }]}>
            <Select options={[
              { value: 'approved', label: 'Approved' },
              { value: 'denied', label: 'Denied' },
              { value: 'p2p_scheduled', label: 'P2P Review Scheduled' },
              { value: 'pending', label: 'Still Pending' },
            ]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="authNumber" label="Authorization Number">
                <Input placeholder="Payer-assigned auth number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="visitCountApproved" label="Visits Approved">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="approvedStartDate" label="Approved Start Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="approvedEndDate" label="Approved End Date (Expiration)">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="denialCode" label="Denial Code (if denied)">
            <Input placeholder="e.g., CARC-197" />
          </Form.Item>
          <Form.Item name="denialReason" label="Denial Reason (if denied)">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="payerDecisionNotes" label="Payer Decision Notes">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Auto-Trigger Modal ───────────────────────────────────────── */}
      <Modal
        title={<span><ThunderboltOutlined /> Auto-Trigger PA at Order Entry (A2)</span>}
        open={autoTriggerModal}
        onCancel={() => setAutoTriggerModal(false)}
        footer={autoTriggerResult ? [
          <Button key="close" onClick={() => setAutoTriggerModal(false)}>Close</Button>,
        ] : [
          <Button key="cancel" onClick={() => setAutoTriggerModal(false)}>Cancel</Button>,
          <Button key="run" type="primary" icon={<RobotOutlined />} loading={aiLoading === 'auto-trigger'} onClick={handleAutoTrigger}>
            Check & Auto-Draft
          </Button>,
        ]}
        width={700}
      >
        {!autoTriggerResult ? (
          <Form form={autoTriggerForm} layout="vertical">
            <Alert
              message="AI will check if PA is required for the ordered procedures and auto-draft the request + letter."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item name="payerName" label="Payer Name" rules={[{ required: true }]}>
              <Input placeholder="e.g., Aetna" />
            </Form.Item>
            <Form.Item label="Procedure Codes to Check" required>
              <Form.List name="procedureCodes" initialValue={[{}]}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                        <Col span={6}>
                          <Form.Item name={[field.name, 'code']} fieldKey={[field.fieldKey, 'code']} noStyle rules={[{ required: true }]}>
                            <Input placeholder="CPT" />
                          </Form.Item>
                        </Col>
                        <Col span={17}>
                          <Form.Item name={[field.name, 'description']} fieldKey={[field.fieldKey, 'description']} noStyle>
                            <Input placeholder="Description" />
                          </Form.Item>
                        </Col>
                        <Col span={1}>
                          <Button type="text" danger icon={<CloseCircleOutlined />} onClick={() => remove(field.name)} />
                        </Col>
                      </Row>
                    ))}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>Add Procedure</Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
            <Form.Item name="clinicalNotes" label="Clinical Notes">
              <TextArea rows={3} placeholder="Chief complaint, symptoms, history..." />
            </Form.Item>
            <Form.Item name="serviceDate" label="Planned Service Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        ) : (
          <div>
            <Alert
              message={autoTriggerResult.triggered ? 'PA Required — Draft Created' : 'PA Not Required'}
              type={autoTriggerResult.triggered ? 'success' : 'info'}
              showIcon
              style={{ marginBottom: 16 }}
              description={autoTriggerResult.reason}
            />
            {autoTriggerResult.createdRequestId && (
              <message.success />
            )}
            {autoTriggerResult.requirements.length > 0 && (
              <Card size="small" title="Requirement Check Results" style={{ marginBottom: 16 }}>
                {autoTriggerResult.requirements.map((r, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <Space>
                      <Text strong>{r.procedureCode}</Text>
                      <Tag color={r.isRequired ? 'error' : 'success'}>
                        {r.isRequired ? 'PA Required' : 'Not Required'}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.requirementType} (confidence: {r.confidence}%)
                      </Text>
                    </Space>
                    {r.aiPrediction && (
                      <div style={{ marginLeft: 16, marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{r.aiPrediction.rationale}</Text>
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
            {autoTriggerResult.authLetter && (
              <Card size="small" title="Auto-Generated PA Letter" extra={<Button size="small" icon={<EyeOutlined />} onClick={() => { setAuthLetterText(autoTriggerResult.authLetter!); setAuthLetterModal(true); }}>View Full</Button>}>
                <Paragraph ellipsis={{ rows: 5 }} style={{ whiteSpace: 'pre-wrap' }}>
                  {autoTriggerResult.authLetter}
                </Paragraph>
              </Card>
            )}
          </div>
        )}
      </Modal>

      {/* ── Auth Letter Modal ────────────────────────────────────────── */}
      <Modal
        title="Prior Authorization Letter"
        open={authLetterModal}
        onCancel={() => setAuthLetterModal(false)}
        footer={[
          <Button key="close" onClick={() => setAuthLetterModal(false)}>Close</Button>,
          <Button key="copy" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(authLetterText); message.success('Letter copied to clipboard'); }}>
            Copy
          </Button>,
        ]}
        width={700}
      >
        <Paragraph style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
          {authLetterText}
        </Paragraph>
      </Modal>

      {/* ── P2P Prep Modal ───────────────────────────────────────────── */}
      <Modal
        title={<span><RobotOutlined /> P2P Review Preparation (A5)</span>}
        open={p2pModalOpen}
        onCancel={() => setP2pModalOpen(false)}
        footer={[<Button key="close" onClick={() => setP2pModalOpen(false)}>Close</Button>]}
        width={700}
      >
        {p2pResult && (
          <div>
            <Alert
              message="Likely Denial Rationale"
              type="warning"
              description={p2pResult.likelyDenialRationale}
              showIcon
              style={{ marginBottom: 16 }}
            />
            {p2pResult.counterArguments?.length > 0 && (
              <Card size="small" title="Counter-Arguments" style={{ marginBottom: 16 }}>
                {p2pResult.counterArguments.map((ca: any, i: number) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <Text strong>{ca.point}</Text>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>{ca.supportingEvidence}</Text></div>
                  </div>
                ))}
              </Card>
            )}
            {p2pResult.talkingPoints?.length > 0 && (
              <Card size="small" title="Talking Points for the Call" style={{ marginBottom: 16 }}>
                <List
                  size="small"
                  dataSource={p2pResult.talkingPoints}
                  renderItem={(tp: string, i: number) => (
                    <List.Item>{i + 1}. {tp}</List.Item>
                  )}
                />
              </Card>
            )}
            {p2pResult.recommendedStrategy && (
              <Card size="small" title="Recommended Strategy">
                <Paragraph>{p2pResult.recommendedStrategy}</Paragraph>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PriorAuthTab;
