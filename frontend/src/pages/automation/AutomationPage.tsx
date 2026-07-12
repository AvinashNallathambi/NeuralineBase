import React, { useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  message,
  Space,
  Alert,
  Steps,
  Statistic,
  Row,
  Col,
  Tag,
  List,
  Progress,
  Spin,
  Divider,
} from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import automationService, {
  PipelineResult,
  DenialRiskAssessment,
  PreSubmissionClaim,
} from '../../services/automationService';

const { Text, Title, Paragraph } = Typography;

const AutomationPage: React.FC = () => {
  const [pipelineForm] = Form.useForm();
  const [riskForm] = Form.useForm();
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<DenialRiskAssessment | null>(null);
  const [quickCheck, setQuickCheck] = useState<{ riskScore: number; flags: string[] } | null>(null);

  const handleRunPipeline = async () => {
    try {
      const values = await pipelineForm.validateFields();
      setPipelineRunning(true);
      setPipelineResult(null);
      const result = await automationService.runPipeline({
        remittanceId: values.remittanceId,
        autoPost: values.autoPost ?? true,
        generateDenials: values.generateDenials ?? true,
        detectUnderpayments: values.detectUnderpayments ?? true,
        aiScoreDenials: values.aiScoreDenials ?? true,
        autoCreateAppeals: values.autoCreateAppeals ?? true,
        appealThreshold: values.appealThreshold || 500,
      });
      setPipelineResult(result);
      message.success('RCM automation pipeline completed');
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Pipeline failed — is Ollama running?');
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleAssessRisk = async () => {
    try {
      const values = await riskForm.validateFields();
      setAssessing(true);
      setRiskAssessment(null);
      const claim: PreSubmissionClaim = {
        payerName: values.payerName,
        cptCodes: values.cptCodes ? values.cptCodes.split(',').map((s: string) => s.trim()) : [],
        diagnosisCodes: values.diagnosisCodes ? values.diagnosisCodes.split(',').map((s: string) => s.trim()) : [],
        billedAmount: values.billedAmount || 0,
        placeOfService: values.placeOfService,
        priorAuthorizationNumber: values.priorAuth,
        eligibilityVerified: values.eligibilityVerified,
        hasMedicalNecessity: values.medicalNecessity,
        hasReferral: values.referral,
      };
      const result = await automationService.assessClaimRisk(claim);
      setRiskAssessment(result);
      message.success('AI risk assessment completed');
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Risk assessment failed — is Ollama running?');
    } finally {
      setAssessing(false);
    }
  };

  const handleQuickCheck = async () => {
    try {
      const values = await riskForm.validateFields();
      const claim: PreSubmissionClaim = {
        payerName: values.payerName,
        cptCodes: values.cptCodes ? values.cptCodes.split(',').map((s: string) => s.trim()) : [],
        diagnosisCodes: values.diagnosisCodes ? values.diagnosisCodes.split(',').map((s: string) => s.trim()) : [],
        billedAmount: values.billedAmount || 0,
        placeOfService: values.placeOfService,
        priorAuthorizationNumber: values.priorAuth,
        eligibilityVerified: values.eligibilityVerified,
        hasMedicalNecessity: values.medicalNecessity,
        hasReferral: values.referral,
      };
      const result = await automationService.quickRiskCheck(claim);
      setQuickCheck(result);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Quick check failed');
    }
  };

  const riskLevelColors: Record<string, string> = {
    low: 'green',
    medium: 'gold',
    high: 'orange',
    critical: 'red',
  };

  return (
    <div>
      <Title level={3}>
        <RobotOutlined /> RCM Automation & AI
      </Title>
      <Paragraph type="secondary">
        Agentic AI workflows for automated denial management and predictive denial prevention.
      </Paragraph>

      <Row gutter={24}>
        {/* Pipeline Runner */}
        <Col span={12}>
          <Card title={<><PlayCircleOutlined /> Automated RCM Pipeline</>} style={{ marginBottom: 24 }}>
            <Alert
              message="Agentic AI Workflow"
              description="Runs the full pipeline: ERA Import → Payment Posting → Denial Generation → Underpayment Detection → AI Recovery Scoring → Auto-create Appeals"
              type="info"
              style={{ marginBottom: 16 }}
            />
            <Form form={pipelineForm} layout="vertical" initialValues={{
              autoPost: true,
              generateDenials: true,
              detectUnderpayments: true,
              aiScoreDenials: true,
              autoCreateAppeals: true,
              appealThreshold: 500,
            }}>
              <Form.Item name="remittanceId" label="Remittance ID" rules={[{ required: true }]}>
                <Input placeholder="Enter remittance ID to process" />
              </Form.Item>
              <Form.Item name="appealThreshold" label="Auto-Appeal Threshold ($)">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
              <Space direction="vertical">
                <Form.Item name="autoPost" valuePropName="checked" noStyle>
                  <Switch checkedChildren="Auto-Post" unCheckedChildren="Skip" /> <Text>Post Payments</Text>
                </Form.Item>
                <Form.Item name="generateDenials" valuePropName="checked" noStyle>
                  <Switch checkedChildren="Gen" unCheckedChildren="Skip" /> <Text>Generate Denial Records</Text>
                </Form.Item>
                <Form.Item name="detectUnderpayments" valuePropName="checked" noStyle>
                  <Switch checkedChildren="Detect" unCheckedChildren="Skip" /> <Text>Detect Underpayments</Text>
                </Form.Item>
                <Form.Item name="aiScoreDenials" valuePropName="checked" noStyle>
                  <Switch checkedChildren="AI" unCheckedChildren="Skip" /> <Text>AI Score Denials</Text>
                </Form.Item>
                <Form.Item name="autoCreateAppeals" valuePropName="checked" noStyle>
                  <Switch checkedChildren="Auto" unCheckedChildren="Skip" /> <Text>Auto-Create Appeals</Text>
                </Form.Item>
              </Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={pipelineRunning}
                onClick={handleRunPipeline}
                style={{ marginTop: 16, width: '100%' }}
                size="large"
              >
                Run Full Pipeline
              </Button>
            </Form>

            {pipelineResult && (
              <div style={{ marginTop: 24 }}>
                <Divider>Pipeline Results</Divider>
                <Steps
                  size="small"
                  direction="vertical"
                  current={5}
                  items={[
                    {
                      title: 'ERA Imported',
                      status: 'finish',
                      icon: <CheckCircleOutlined />,
                    },
                    {
                      title: `Payments Posted — ${pipelineResult.steps.paymentsPosted.postedCount} claims, $${pipelineResult.steps.paymentsPosted.postedAmount.toFixed(2)}`,
                      status: 'finish',
                      icon: <CheckCircleOutlined />,
                    },
                    {
                      title: `Denials Generated — ${pipelineResult.steps.denialsGenerated}`,
                      status: pipelineResult.steps.denialsGenerated > 0 ? 'finish' : 'wait',
                      icon: <CheckCircleOutlined />,
                    },
                    {
                      title: `Underpayments Detected — ${pipelineResult.steps.underpaymentsDetected.detectedCount} ($${pipelineResult.steps.underpaymentsDetected.totalVariance.toFixed(2)})`,
                      status: pipelineResult.steps.underpaymentsDetected.detectedCount > 0 ? 'finish' : 'wait',
                      icon: <CheckCircleOutlined />,
                    },
                    {
                      title: `AI Scored — ${pipelineResult.steps.denialsScored} denials`,
                      status: pipelineResult.steps.denialsScored > 0 ? 'finish' : 'wait',
                      icon: <RobotOutlined />,
                    },
                    {
                      title: `Appeals Auto-Created — ${pipelineResult.steps.highValueAppealsCreated}`,
                      status: pipelineResult.steps.highValueAppealsCreated > 0 ? 'finish' : 'wait',
                      icon: <ThunderboltOutlined />,
                    },
                  ]}
                />
                {pipelineResult.errors.length > 0 && (
                  <Alert
                    style={{ marginTop: 16 }}
                    type="warning"
                    message={`${pipelineResult.errors.length} errors occurred`}
                    description={
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {pipelineResult.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    }
                  />
                )}
              </div>
            )}
          </Card>
        </Col>

        {/* Pre-Submission Denial Prevention */}
        <Col span={12}>
          <Card title={<><SafetyOutlined /> Pre-Submission Denial Prevention</>}>
            <Alert
              message="Predictive AI"
              description="Assess denial risk BEFORE submitting a claim. Get AI-powered recommendations to prevent denials."
              type="info"
              style={{ marginBottom: 16 }}
            />
            <Form form={riskForm} layout="vertical">
              <Form.Item name="payerName" label="Payer Name" rules={[{ required: true }]}>
                <Input placeholder="e.g., UnitedHealthcare" />
              </Form.Item>
              <Form.Item name="cptCodes" label="CPT Codes (comma-separated)">
                <Input placeholder="e.g., 99213, 93000" />
              </Form.Item>
              <Form.Item name="diagnosisCodes" label="ICD-10 Codes (comma-separated)">
                <Input placeholder="e.g., I10, E78.5" />
              </Form.Item>
              <Form.Item name="billedAmount" label="Billed Amount ($)">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="placeOfService" label="Place of Service">
                <Select
                  allowClear
                  placeholder="Select POS"
                  options={[
                    { value: '11', label: '11 - Office' },
                    { value: '22', label: '22 - On-campus outpatient hospital' },
                    { value: '23', label: '23 - Emergency room' },
                    { value: '21', label: '21 - Inpatient hospital' },
                    { value: '24', label: '24 - Ambulatory surgical center' },
                  ]}
                />
              </Form.Item>
              <Space>
                <Form.Item name="eligibilityVerified" valuePropName="checked" noStyle>
                  <Switch /> <Text>Eligibility Verified</Text>
                </Form.Item>
                <Form.Item name="medicalNecessity" valuePropName="checked" noStyle>
                  <Switch /> <Text>Med Necessity</Text>
                </Form.Item>
                <Form.Item name="referral" valuePropName="checked" noStyle>
                  <Switch /> <Text>Referral</Text>
                </Form.Item>
              </Space>
              <Form.Item name="priorAuth" label="Prior Auth #">
                <Input placeholder="Prior authorization number (if any)" />
              </Form.Item>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button icon={<ThunderboltOutlined />} onClick={handleQuickCheck}>
                  Quick Check (No AI)
                </Button>
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  loading={assessing}
                  onClick={handleAssessRisk}
                >
                  AI Risk Assessment
                </Button>
              </Space>
            </Form>

            {/* Quick Check Results */}
            {quickCheck && (
              <Card size="small" style={{ marginTop: 16 }} title="Quick Check Results">
                <Statistic
                  title="Risk Score"
                  value={quickCheck.riskScore}
                  suffix="/ 100"
                  valueStyle={{ color: quickCheck.riskScore > 50 ? '#cf1322' : quickCheck.riskScore > 25 ? '#faad14' : '#3f8600' }}
                />
                {quickCheck.flags.length > 0 ? (
                  <List
                    size="small"
                    dataSource={quickCheck.flags}
                    renderItem={(flag) => (
                      <List.Item>
                        <Text type="warning"><WarningOutlined /> {flag}</Text>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Alert type="success" message="No risk flags detected" style={{ marginTop: 8 }} />
                )}
              </Card>
            )}

            {/* AI Assessment Results */}
            {riskAssessment && (
              <Card size="small" style={{ marginTop: 16 }} title="AI Risk Assessment">
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Risk Score"
                      value={riskAssessment.riskScore}
                      suffix="/ 100"
                      valueStyle={{ color: riskAssessment.riskScore > 60 ? '#cf1322' : riskAssessment.riskScore > 30 ? '#faad14' : '#3f8600' }}
                    />
                  </Col>
                  <Col span={8}>
                    <div style={{ marginTop: 8 }}>
                      <Text>Level: </Text>
                      <Tag color={riskLevelColors[riskAssessment.riskLevel]}>
                        {riskAssessment.riskLevel.toUpperCase()}
                      </Tag>
                    </div>
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Est. Denial Cost"
                      value={riskAssessment.estimatedDenialCost}
                      prefix="$"
                      precision={2}
                    />
                  </Col>
                </Row>

                {riskAssessment.predictedDenialReasons.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text strong>Predicted Denial Reasons:</Text>
                    {riskAssessment.predictedDenialReasons.map((r, i) => (
                      <Card key={i} size="small" type="inner" style={{ marginTop: 8 }}>
                        <Space>
                          {r.carcCode && <Tag color="red">CARC {r.carcCode}</Tag>}
                          <Text strong>{r.reason}</Text>
                          {r.preventable ? (
                            <Tag color="green">Preventable</Tag>
                          ) : (
                            <Tag color="default">Not Preventable</Tag>
                          )}
                        </Space>
                        <div style={{ marginTop: 4 }}>
                          <Progress percent={r.probability} size="small" status="exception" />
                        </div>
                        {r.preventionAction && (
                          <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
                            <SafetyOutlined /> {r.preventionAction}
                          </Paragraph>
                        )}
                      </Card>
                    ))}
                  </div>
                )}

                {riskAssessment.recommendations.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text strong>Recommendations:</Text>
                    <List
                      size="small"
                      dataSource={riskAssessment.recommendations}
                      renderItem={(rec) => (
                        <List.Item>
                          <Text><CheckCircleOutlined style={{ color: '#52c41a' }} /> {rec}</Text>
                        </List.Item>
                      )}
                    />
                  </div>
                )}
              </Card>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AutomationPage;
