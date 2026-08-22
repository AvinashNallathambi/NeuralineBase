import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Alert,
  Table,
  Divider,
  Row,
  Col,
  Statistic,
  Modal,
  Select,
  Form,
  InputNumber,
  Input,
  message,
  Tooltip,
  Badge,
  Descriptions,
  Timeline,
  Progress,
} from 'antd';
import {
  FileTextOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  RobotOutlined,
  SendOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { GoodFaithEstimate, GfeStatus, DeliveryMethod } from '../../types';
import { nsaService } from '../../services/nsaService';

const { Text, Title, Paragraph } = Typography;

interface GfePanelProps {
  superbillId: string;
  patientId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  delivered: 'processing',
  acknowledged: 'success',
  disputed: 'error',
  expired: 'warning',
  superseded: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  delivered: 'Delivered',
  acknowledged: 'Acknowledged',
  disputed: 'Disputed',
  expired: 'Expired',
  superseded: 'Superseded',
};

const GfePanel: React.FC<GfePanelProps> = ({ superbillId, patientId }) => {
  const [loading, setLoading] = useState(false);
  const [gfe, setGfe] = useState<GoodFaithEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [varianceModalOpen, setVarianceModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [deliverForm] = Form.useForm();
  const [varianceForm] = Form.useForm();

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await nsaService.generateGfeFromSuperbill({ superbillId });
      setGfe(result);
      message.success('GFE generated and saved successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to generate GFE');
      message.error('Failed to generate GFE');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingGfe = useCallback(async () => {
    if (!patientId) return;
    try {
      const gfes = await nsaService.listGfes({ patientId });
      const matching = gfes.find((g) => g.superbillId === superbillId && g.status !== 'superseded');
      if (matching) setGfe(matching);
    } catch {
      // ignore - no existing GFE
    }
  }, [patientId, superbillId]);

  useEffect(() => {
    loadExistingGfe();
  }, [loadExistingGfe]);

  // ── Delivery ──────────────────────────────────────────────────────
  const handleDeliver = async () => {
    if (!gfe?.id) return;
    try {
      const values = await deliverForm.validateFields();
      setAiLoading('delivering');
      const result = await nsaService.deliverGfe(gfe.id, {
        deliveryMethod: values.deliveryMethod as DeliveryMethod,
        deliveredBy: values.deliveredBy,
      });
      setGfe(result);
      message.success(`GFE marked as delivered via ${values.deliveryMethod}. On-time: ${result.isCompliant ? 'Yes' : 'No'}`);
      setDeliverModalOpen(false);
    } catch (err: any) {
      if (err.errorFields) return; // validation error
      message.error(err.message || 'Failed to deliver GFE');
    } finally {
      setAiLoading(null);
    }
  };

  const handleAcknowledge = async () => {
    if (!gfe?.id) return;
    try {
      const result = await nsaService.acknowledgeGfe(gfe.id);
      setGfe(result);
      message.success('Patient acknowledgment recorded');
    } catch (err: any) {
      message.error(err.message || 'Failed to record acknowledgment');
    }
  };

  // ── AI Features ───────────────────────────────────────────────────
  const handlePredictAccuracy = async () => {
    if (!gfe?.id) return;
    setAiLoading('accuracy');
    try {
      const result = await nsaService.predictAccuracy(gfe.id);
      setGfe(result);
      message.success('AI accuracy prediction complete');
    } catch (err: any) {
      message.error(err.message || 'AI prediction failed');
    } finally {
      setAiLoading(null);
    }
  };

  const handleGenerateExplanation = async () => {
    if (!gfe?.id) return;
    setAiLoading('explanation');
    try {
      const result = await nsaService.generatePatientExplanation(gfe.id);
      setGfe(result);
      message.success('Patient-friendly explanation generated');
    } catch (err: any) {
      message.error(err.message || 'Failed to generate explanation');
    } finally {
      setAiLoading(null);
    }
  };

  // ── Variance Detection ────────────────────────────────────────────
  const handleDetectVariance = async () => {
    if (!gfe?.id) return;
    try {
      const values = await varianceForm.validateFields();
      setAiLoading('variance');
      const actualLineItems = values.actualLineItems
        ? (JSON.parse(values.actualLineItems) as Array<{ cptCode: string; actualAmount: number }>)
        : undefined;
      const result = await nsaService.detectVariance(gfe.id, {
        finalBilledAmount: values.finalBilledAmount,
        finalPaidAmount: values.finalPaidAmount,
        actualLineItems,
      });
      message.success(
        result.exceedsThreshold
          ? `Variance of $${result.varianceAmount.toFixed(2)} EXCEEDS $400 threshold — dispute may be warranted`
          : `Variance of $${result.varianceAmount.toFixed(2)} is under $400 threshold`,
      );
      setVarianceModalOpen(false);
      // Reload GFE to get updated variance status
      const updated = await nsaService.getGfe(gfe.id);
      setGfe(updated);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || 'Variance detection failed');
    } finally {
      setAiLoading(null);
    }
  };

  const columns = [
    { title: 'Service', dataIndex: 'service', key: 'service' },
    {
      title: 'CPT Code',
      dataIndex: 'cptCode',
      key: 'cptCode',
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Charge',
      dataIndex: 'charge',
      key: 'charge',
      render: (v: number | string) => `$${Number(v || 0).toFixed(2)}`,
    },
    {
      title: 'Insurance Est.',
      dataIndex: 'insuranceEstimate',
      key: 'insuranceEstimate',
      render: (v: number | string) => `$${Number(v || 0).toFixed(2)}`,
    },
    {
      title: 'Patient Est.',
      dataIndex: 'patientEstimate',
      key: 'patientEstimate',
      render: (v: number | string) => `$${Number(v || 0).toFixed(2)}`,
    },
  ];

  return (
    <Card
      title={
        <span>
          <FileTextOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          Good Faith Estimate (No Surprises Act)
          {gfe?.status && (
            <Tag color={STATUS_COLORS[gfe.status]} style={{ marginLeft: 8 }}>
              {STATUS_LABELS[gfe.status]}
            </Tag>
          )}
          {gfe?.isCompliant === true && (
            <Tooltip title="Delivered on time per NSA 3-business-day rule">
              <Badge count={<CheckCircleOutlined style={{ color: '#52c41a' }} />} offset={[2, -2]}>
              </Badge>
            </Tooltip>
          )}
          {gfe?.isCompliant === false && gfe.status === 'delivered' && (
            <Tooltip title="Delivered late — NSA compliance violation">
              <WarningOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />
            </Tooltip>
          )}
        </span>
      }
      size="small"
      style={{ marginTop: 16 }}
      extra={
        <Space>
          {!gfe && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              loading={loading}
              size="small"
              style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
            >
              Generate GFE
            </Button>
          )}
          {gfe && (
            <Button icon={<ReloadOutlined />} onClick={handleGenerate} size="small">
              Regenerate
            </Button>
          )}
        </Space>
      }
    >
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

      {!gfe && !loading && !error && (
        <Alert
          type="info"
          message="Generate a Good Faith Estimate compliant with the No Surprises Act."
          description="Covers both insured out-of-network and self-pay/uninsured patients. The GFE will be persisted with delivery tracking and $400 variance detection."
          showIcon
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="AI is generating Good Faith Estimate..." />
        </div>
      )}

      {gfe && (
        <>
          {/* Delivery deadline warning */}
          {gfe.deliveryDeadline && gfe.status === 'draft' && (
            <Alert
              type={new Date(gfe.deliveryDeadline) < new Date() ? 'error' : 'warning'}
              message={
                new Date(gfe.deliveryDeadline) < new Date()
                  ? 'Delivery deadline OVERDUE — NSA compliance violation risk'
                  : `Delivery deadline: ${new Date(gfe.deliveryDeadline).toLocaleDateString()}`
              }
              showIcon
              icon={<ClockCircleOutlined />}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* Variance alert */}
          {gfe.varianceStatus === 'over_threshold' && (
            <Alert
              type="error"
              message={`Variance of $${gfe.varianceAmount?.toFixed(2)} exceeds $400 NSA threshold`}
              description="Patient may initiate a dispute under the No Surprises Act. Consider creating an IDR case."
              showIcon
              icon={<ExclamationCircleOutlined />}
              style={{ marginBottom: 12 }}
            />
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Statistic title="Total Charge" value={gfe.totalCharge} prefix="$" precision={2} />
            </Col>
            <Col span={8}>
              <Statistic title="Insurance Estimate" value={gfe.insuranceEstimate} prefix="$" precision={2} valueStyle={{ color: '#1890ff' }} />
            </Col>
            <Col span={8}>
              <Statistic title="Patient Estimate" value={gfe.patientEstimate} prefix="$" precision={2} valueStyle={{ color: '#cf1322' }} />
            </Col>
          </Row>

          <Table columns={columns} dataSource={gfe.items} rowKey={(record: any) => record.cptCode} pagination={false} size="small" />

          {/* AI Accuracy Score */}
          {gfe.aiAccuracyScore !== null && gfe.aiAccuracyScore !== undefined && (
            <>
              <Divider />
              <Card size="small" title={<span><RobotOutlined style={{ marginRight: 8 }} />AI Estimate Accuracy Prediction</span>}>
                <Row gutter={16}>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <Progress
                        type="circle"
                        percent={gfe.aiAccuracyScore}
                        size={80}
                        strokeColor={gfe.aiAccuracyScore > 70 ? '#52c41a' : gfe.aiAccuracyScore > 40 ? '#faad14' : '#ff4d4f'}
                      />
                      <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>Accuracy Score</div>
                    </div>
                  </Col>
                  <Col span={16}>
                    {gfe.aiAccuracyFlags?.highRisk && (
                      <Alert type="error" message="High Risk: Final bill likely to exceed estimate by $400+" style={{ marginBottom: 8 }} showIcon />
                    )}
                    {gfe.aiAccuracyFlags?.riskFactors && gfe.aiAccuracyFlags.riskFactors.length > 0 && (
                      <div>
                        <Text strong>Risk Factors:</Text>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {gfe.aiAccuracyFlags.riskFactors.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    )}
                  </Col>
                </Row>
              </Card>
            </>
          )}

          {/* Patient-friendly explanation */}
          {gfe.patientFriendlyExplanation && (
            <>
              <Divider />
              <Card size="small" title={<span><InfoCircleOutlined style={{ marginRight: 8 }} />Patient-Friendly Explanation</span>}>
                <Paragraph>{gfe.patientFriendlyExplanation}</Paragraph>
              </Card>
            </>
          )}

          {/* Reconciliation data */}
          {gfe.reconciliationData && (
            <>
              <Divider />
              <Card size="small" title={<span><CheckCircleOutlined style={{ marginRight: 8 }} />GFE-to-Claim Reconciliation</span>}>
                <Descriptions size="small" column={3}>
                  <Descriptions.Item label="Final Billed">${gfe.reconciliationData.finalBilledAmount.toFixed(2)}</Descriptions.Item>
                  <Descriptions.Item label="Final Paid">${gfe.reconciliationData.finalPaidAmount.toFixed(2)}</Descriptions.Item>
                  <Descriptions.Item label="Accuracy Score">{gfe.reconciliationData.accuracyScore}%</Descriptions.Item>
                </Descriptions>
                {gfe.reconciliationData.perItemVariance.length > 0 && (
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={gfe.reconciliationData.perItemVariance}
                    columns={[
                      { title: 'CPT', dataIndex: 'cptCode', key: 'cptCode' },
                      { title: 'Estimated', dataIndex: 'estimated', key: 'estimated', render: (v: number) => `$${v.toFixed(2)}` },
                      { title: 'Actual', dataIndex: 'actual', key: 'actual', render: (v: number) => `$${v.toFixed(2)}` },
                      {
                        title: 'Variance',
                        dataIndex: 'variance',
                        key: 'variance',
                        render: (v: number) => <span style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>${v.toFixed(2)}</span>,
                      },
                    ]}
                  />
                )}
              </Card>
            </>
          )}

          <Divider />

          {/* Disclaimers */}
          <Alert
            type="warning"
            message="No Surprises Act Disclaimers"
            description={<ul style={{ margin: 0, paddingLeft: 16 }}>{gfe.disclaimers.map((item, i) => <li key={i}>{item}</li>)}</ul>}
            showIcon
            icon={<InfoCircleOutlined />}
          />

          <Divider />

          {/* Compliance Notes */}
          <Alert
            type="info"
            message="Compliance Notes"
            description={<ul style={{ margin: 0, paddingLeft: 16 }}>{gfe.complianceNotes.map((item, i) => <li key={i}>{item}</li>)}</ul>}
            showIcon
            icon={<SafetyOutlined />}
          />

          <Divider />

          {/* Action buttons */}
          <Space wrap>
            {gfe.status === 'draft' && (
              <Button type="primary" icon={<SendOutlined />} onClick={() => setDeliverModalOpen(true)}>
                Mark Delivered
              </Button>
            )}
            {gfe.status === 'delivered' && (
              <Button icon={<CheckCircleOutlined />} onClick={handleAcknowledge}>
                Record Acknowledgment
              </Button>
            )}
            <Button icon={<RobotOutlined />} onClick={handlePredictAccuracy} loading={aiLoading === 'accuracy'}>
              AI Accuracy Check
            </Button>
            <Button icon={<InfoCircleOutlined />} onClick={handleGenerateExplanation} loading={aiLoading === 'explanation'}>
              Patient Explanation
            </Button>
            <Button icon={<DollarOutlined />} onClick={() => setVarianceModalOpen(true)}>
              Detect Variance
            </Button>
          </Space>

          {/* Delivery info */}
          {gfe.deliveredAt && (
            <Descriptions size="small" column={2} style={{ marginTop: 12 }}>
              <Descriptions.Item label="Delivered At">{new Date(gfe.deliveredAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Method">{gfe.deliveryMethod}</Descriptions.Item>
              {gfe.acknowledgedAt && (
                <Descriptions.Item label="Acknowledged At">{new Date(gfe.acknowledgedAt).toLocaleString()}</Descriptions.Item>
              )}
              {gfe.acknowledgedBy && <Descriptions.Item label="Acknowledged By">{gfe.acknowledgedBy}</Descriptions.Item>}
            </Descriptions>
          )}

          {/* Delivery Modal */}
          <Modal
            title="Mark GFE as Delivered"
            open={deliverModalOpen}
            onOk={handleDeliver}
            onCancel={() => setDeliverModalOpen(false)}
            confirmLoading={aiLoading === 'delivering'}
          >
            <Form form={deliverForm} layout="vertical">
              <Form.Item name="deliveryMethod" label="Delivery Method" rules={[{ required: true }]}>
                <Select placeholder="Select delivery method">
                  <Select.Option value="portal">Patient Portal</Select.Option>
                  <Select.Option value="email">Email</Select.Option>
                  <Select.Option value="mail">US Mail</Select.Option>
                  <Select.Option value="in_person">In Person</Select.Option>
                  <Select.Option value="verbal_witness">Verbal (with witness)</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="deliveredBy" label="Delivered By (optional)">
                <Input placeholder="Staff member name" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Variance Modal */}
          <Modal
            title="Detect $400 Variance (NSA)"
            open={varianceModalOpen}
            onOk={handleDetectVariance}
            onCancel={() => setVarianceModalOpen(false)}
            confirmLoading={aiLoading === 'variance'}
          >
            <Form form={varianceForm} layout="vertical">
              <Form.Item name="finalBilledAmount" label="Final Billed Amount" rules={[{ required: true }]}>
                <InputNumber prefix="$" style={{ width: '100%' }} step={0.01} />
              </Form.Item>
              <Form.Item name="finalPaidAmount" label="Final Paid Amount" rules={[{ required: true }]}>
                <InputNumber prefix="$" style={{ width: '100%' }} step={0.01} />
              </Form.Item>
              <Form.Item name="actualLineItems" label="Actual Line Items (JSON, optional)" tooltip='e.g. [{"cptCode":"99213","actualAmount":150}]'>
                <Input.TextArea rows={3} placeholder='[{"cptCode":"99213","actualAmount":150}]' />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </Card>
  );
};

export default GfePanel;
