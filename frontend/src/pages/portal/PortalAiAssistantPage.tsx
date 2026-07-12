import React, { useState } from 'react';
import {
  Card,
  Typography,
  Tabs,
  Form,
  Input,
  Button,
  Select,
  Spin,
  Alert,
  Tag,
  List,
  Space,
  Divider,
  Row,
  Col,
  Collapse,
  message,
} from 'antd';
import {
  ExperimentOutlined,
  MedicineBoxOutlined,
  HeartOutlined,
  BulbOutlined,
  RobotOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import patientAiService from '../../services/patientAiService';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const PortalAiAssistantPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('lab-explainer');

  return (
    <div>
      <Card
        style={{
          background: 'linear-gradient(135deg, #0D7C8A 0%, #064E57 100%)',
          marginBottom: 24,
          border: 'none',
        }}
      >
        <Space>
          <RobotOutlined style={{ fontSize: 32, color: '#36CFC9' }} />
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              AI Health Assistant
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
              Powered by AI · Educational information only — not medical advice
            </Text>
          </div>
        </Space>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'lab-explainer',
              label: <span><ExperimentOutlined /> Lab Result Explainer</span>,
              children: <LabExplainerTab />,
            },
            {
              key: 'symptom-checker',
              label: <span><HeartOutlined /> Symptom Checker</span>,
              children: <SymptomCheckerTab />,
            },
            {
              key: 'interactions',
              label: <span><MedicineBoxOutlined /> Drug Interactions</span>,
              children: <InteractionsTab />,
            },
            {
              key: 'education',
              label: <span><BulbOutlined /> Health Education</span>,
              children: <EducationTab />,
            },
            {
              key: 'visit-prep',
              label: <span><CheckCircleOutlined /> Visit Prep</span>,
              children: <VisitPrepTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

// ─── Lab Result Explainer Tab ──────────────────────────────────────

const LabExplainerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setResult(null);
      const data = await patientAiService.explainLabResult(values);
      setResult(data);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to explain lab result');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="This tool explains lab results in plain language"
        description="Enter your lab test details to get a simple explanation. This is educational only — always discuss results with your doctor."
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="testName" label="Test Name" rules={[{ required: true }]}>
              <Input placeholder="e.g., Glucose, Hemoglobin, Cholesterol" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="value" label="Result Value" rules={[{ required: true }]}>
              <Input placeholder="e.g., 105" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="unit" label="Unit">
              <Input placeholder="e.g., mg/dL" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="referenceRange" label="Reference Range">
              <Input placeholder="e.g., 70-99 mg/dL" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="flag" label="Flag">
              <Select allowClear placeholder="Select flag">
                <Select.Option value="normal">Normal</Select.Option>
                <Select.Option value="abnormal">Abnormal</Select.Option>
                <Select.Option value="critical">Critical</Select.Option>
                <Select.Option value="high">High</Select.Option>
                <Select.Option value="low">Low</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="patientAge" label="Your Age">
              <Input type="number" placeholder="e.g., 45" />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" icon={<RobotOutlined />} loading={loading} onClick={handleSubmit}>
          Explain My Result
        </Button>
      </Form>

      {loading && <div style={{ textAlign: 'center', marginTop: 24 }}><Spin size="large" /></div>}

      {result && (
        <Card style={{ marginTop: 24 }} title={<Space><ExperimentOutlined /> AI Explanation</Space>}>
          <Row gutter={16}>
            <Col span={24}>
              <Paragraph>
                <Text strong>What this test measures: </Text>
                {result.explanation}
              </Paragraph>
              <Paragraph>
                <Text strong>What your result means: </Text>
                {result.whatItMeans}
              </Paragraph>
              <Space style={{ marginBottom: 16 }}>
                <Tag color={
                  result.severity === 'critical' ? 'red' :
                  result.severity === 'high' ? 'orange' :
                  result.severity === 'low' ? 'blue' : 'green'
                }>
                  {result.severity?.toUpperCase()}
                </Tag>
                {result.isAbnormal && <Tag color="orange">Abnormal</Tag>}
              </Space>
              {result.recommendations?.length > 0 && (
                <>
                  <Title level={5}>Recommendations:</Title>
                  <List
                    size="small"
                    dataSource={result.recommendations}
                    renderItem={(item: string) => <List.Item><CheckCircleOutlined style={{ color: '#52c41a' }} /> {item}</List.Item>}
                  />
                </>
              )}
              <Divider />
              <Paragraph>
                <Text strong>Follow-up: </Text>{result.followUp}
              </Paragraph>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

// ─── Symptom Checker Tab ───────────────────────────────────────────

const SymptomCheckerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setResult(null);
      const data = await patientAiService.assessSymptoms(values);
      setResult(data);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to assess symptoms');
    } finally {
      setLoading(false);
    }
  };

  const urgencyConfig: Record<string, { color: string; icon: any; title: string }> = {
    self_care: { color: 'green', icon: <CheckCircleOutlined />, title: 'Self-Care Recommended' },
    schedule_appointment: { color: 'blue', icon: <ExclamationCircleOutlined />, title: 'Schedule an Appointment' },
    urgent_care: { color: 'orange', icon: <WarningOutlined />, title: 'Urgent Care Recommended' },
    emergency: { color: 'red', icon: <WarningOutlined />, title: 'Seek Emergency Care' },
  };

  return (
    <div>
      <Alert
        type="warning"
        showIcon
        message="Symptom Checker — Not a substitute for medical care"
        description="Describe your symptoms and get guidance on the appropriate level of care. If you're experiencing a medical emergency, call 911 immediately."
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item name="symptoms" label="Describe your symptoms" rules={[{ required: true }]}>
          <TextArea rows={4} placeholder="e.g., I've had a headache for 3 days, mostly in the morning, with some nausea..." />
        </Form.Item>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="duration" label="Duration">
              <Input placeholder="e.g., 3 days" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="severity" label="Severity">
              <Select placeholder="Select severity">
                <Select.Option value="mild">Mild</Select.Option>
                <Select.Option value="moderate">Moderate</Select.Option>
                <Select.Option value="severe">Severe</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="patientAge" label="Your Age">
              <Input type="number" placeholder="e.g., 45" />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" icon={<RobotOutlined />} loading={loading} onClick={handleSubmit}>
          Assess My Symptoms
        </Button>
      </Form>

      {loading && <div style={{ textAlign: 'center', marginTop: 24 }}><Spin size="large" /></div>}

      {result && (
        <Card style={{ marginTop: 24 }}>
          {(() => {
            const cfg = urgencyConfig[result.urgencyLevel] || urgencyConfig.schedule_appointment;
            return (
              <Alert
                type={result.urgencyLevel === 'emergency' ? 'error' : result.urgencyLevel === 'urgent_care' ? 'warning' : 'info'}
                showIcon
                icon={cfg.icon}
                message={<Text strong style={{ fontSize: 16 }}>{cfg.title}</Text>}
                description={result.urgencyReason}
                style={{ marginBottom: 16 }}
              />
            );
          })()}

          {result.recommendedAction && (
            <Paragraph>
              <Text strong>Recommended Action: </Text>{result.recommendedAction}
            </Paragraph>
          )}

          {result.possibleCauses?.length > 0 && (
            <>
              <Title level={5}>Possible Causes (non-diagnostic):</Title>
              <List size="small" dataSource={result.possibleCauses} renderItem={(item: string) => <List.Item>{item}</List.Item>} />
            </>
          )}

          {result.selfCareAdvice?.length > 0 && (
            <>
              <Title level={5}>Self-Care Advice:</Title>
              <List size="small" dataSource={result.selfCareAdvice} renderItem={(item: string) => <List.Item><CheckCircleOutlined style={{ color: '#52c41a' }} /> {item}</List.Item>} />
            </>
          )}

          {result.redFlagSymptoms?.length > 0 && (
            <>
              <Alert type="error" style={{ marginTop: 16, marginBottom: 16 }} message="Red Flag Symptoms — Seek Immediate Care If:" />
              <List size="small" dataSource={result.redFlagSymptoms} renderItem={(item: string) => <List.Item><WarningOutlined style={{ color: '#cf1322' }} /> {item}</List.Item>} />
            </>
          )}

          {result.questionsToAskDoctor?.length > 0 && (
            <>
              <Title level={5}>Questions to Ask Your Doctor:</Title>
              <List size="small" dataSource={result.questionsToAskDoctor} renderItem={(item: string) => <List.Item>• {item}</List.Item>} />
            </>
          )}

          <Divider />
          <Text type="secondary" italic>{result.disclaimer}</Text>
        </Card>
      )}
    </div>
  );
};

// ─── Drug Interactions Tab ─────────────────────────────────────────

const InteractionsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [medications, setMedications] = useState<string[]>(['']);

  const handleSubmit = async () => {
    const meds = medications.filter((m) => m.trim());
    if (meds.length === 0) {
      message.warning('Please enter at least one medication');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await patientAiService.checkInteractions({
        medications: meds.map((name) => ({ name })),
      });
      setResult(data);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to check interactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="Medication Interaction Checker"
        description="Enter all your medications (including over-the-counter and supplements) to check for potential interactions."
        style={{ marginBottom: 16 }}
      />

      <div style={{ marginBottom: 16 }}>
        <Text strong>Your Medications:</Text>
        {medications.map((med, i) => (
          <Row key={i} gutter={8} style={{ marginTop: 8 }}>
            <Col span={20}>
              <Input
                value={med}
                placeholder={`Medication ${i + 1} (e.g., Lisinopril 10mg)`}
                onChange={(e) => {
                  const newMeds = [...medications];
                  newMeds[i] = e.target.value;
                  setMedications(newMeds);
                }}
              />
            </Col>
            <Col span={4}>
              {medications.length > 1 && (
                <Button danger onClick={() => setMedications(medications.filter((_, idx) => idx !== i))}>
                  Remove
                </Button>
              )}
            </Col>
          </Row>
        ))}
        <Button type="dashed" style={{ marginTop: 8 }} onClick={() => setMedications([...medications, ''])}>
          + Add Medication
        </Button>
      </div>

      <Button type="primary" icon={<RobotOutlined />} loading={loading} onClick={handleSubmit}>
        Check Interactions
      </Button>

      {loading && <div style={{ textAlign: 'center', marginTop: 24 }}><Spin size="large" /></div>}

      {result && (
        <Card style={{ marginTop: 24 }} title={<Space><MedicineBoxOutlined /> Interaction Analysis</Space>}>
          {result.hasInteractions ? (
            <>
              <Alert type="warning" showIcon message={`${result.interactions.length} potential interaction(s) found`} style={{ marginBottom: 16 }} />
              {result.interactions.map((interaction: any, i: number) => {
                const severityColor: Record<string, string> = {
                  minor: 'blue',
                  moderate: 'orange',
                  severe: 'red',
                  contraindicated: 'red',
                };
                return (
                  <Card key={i} size="small" style={{ marginBottom: 8 }}>
                    <Space style={{ marginBottom: 8 }}>
                      <Tag color={severityColor[interaction.severity]}>{interaction.severity.toUpperCase()}</Tag>
                      <Text strong>{interaction.medications.join(' + ')}</Text>
                    </Space>
                    <Paragraph style={{ margin: 0 }}><Text strong>Interaction: </Text>{interaction.description}</Paragraph>
                    <Paragraph style={{ margin: 0 }}><Text strong>Recommendation: </Text>{interaction.recommendation}</Paragraph>
                  </Card>
                );
              })}
            </>
          ) : (
            <Alert type="success" showIcon message="No significant interactions detected" />
          )}

          {result.warnings?.length > 0 && (
            <>
              <Title level={5} style={{ marginTop: 16 }}>Warnings:</Title>
              <List size="small" dataSource={result.warnings} renderItem={(item: string) => <List.Item><WarningOutlined style={{ color: '#faad14' }} /> {item}</List.Item>} />
            </>
          )}

          {result.recommendations?.length > 0 && (
            <>
              <Title level={5}>General Recommendations:</Title>
              <List size="small" dataSource={result.recommendations} renderItem={(item: string) => <List.Item><CheckCircleOutlined style={{ color: '#52c41a' }} /> {item}</List.Item>} />
            </>
          )}
        </Card>
      )}
    </div>
  );
};

// ─── Health Education Tab ──────────────────────────────────────────

const EducationTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setArticles([]);
      const data = await patientAiService.generateHealthEducation({
        conditions: values.conditions ? values.conditions.split(',').map((s: string) => s.trim()) : undefined,
        interests: values.interests ? values.interests.split(',').map((s: string) => s.trim()) : undefined,
      });
      setArticles(data.articles || []);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to generate education');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="Personalized Health Education"
        description="Get educational articles tailored to your health conditions and interests."
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item name="conditions" label="Your Health Conditions (comma-separated)">
          <Input placeholder="e.g., Type 2 Diabetes, Hypertension" />
        </Form.Item>
        <Form.Item name="interests" label="Health Interests (comma-separated)">
          <Input placeholder="e.g., Nutrition, Exercise, Sleep" />
        </Form.Item>
        <Button type="primary" icon={<RobotOutlined />} loading={loading} onClick={handleSubmit}>
          Generate Articles
        </Button>
      </Form>

      {loading && <div style={{ textAlign: 'center', marginTop: 24 }}><Spin size="large" /></div>}

      {articles.length > 0 && (
        <Collapse
          style={{ marginTop: 24 }}
          items={articles.map((article, i) => ({
            key: i,
            label: (
              <Space>
                <Text strong>{article.title}</Text>
                <Tag color="blue">{article.category}</Tag>
                <Text type="secondary">{article.readTime}</Text>
              </Space>
            ),
            children: (
              <div>
                <Paragraph type="secondary">{article.summary}</Paragraph>
                <Divider />
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{article.content}</Paragraph>
              </div>
            ),
          }))}
        />
      )}
    </div>
  );
};

// ─── Visit Prep Tab ────────────────────────────────────────────────

const VisitPrepTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      setResult(null);
      const data = await patientAiService.generateVisitQuestions({
        conditions: values.conditions ? values.conditions.split(',').map((s: string) => s.trim()) : undefined,
        medications: values.medications ? values.medications.split(',').map((s: string) => s.trim()) : undefined,
        upcomingAppointmentReason: values.upcomingAppointmentReason,
      });
      setResult(data);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const priorityColors: Record<string, string> = { high: 'red', medium: 'orange', low: 'blue' };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="Prepare for Your Doctor Visit"
        description="Get personalized questions to ask your doctor based on your health profile."
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item name="upcomingAppointmentReason" label="Reason for Upcoming Visit">
          <Input placeholder="e.g., Annual physical, Diabetes follow-up, New symptoms" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="conditions" label="Your Conditions (comma-separated)">
              <Input placeholder="e.g., Type 2 Diabetes, Hypertension" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="medications" label="Current Medications (comma-separated)">
              <Input placeholder="e.g., Metformin, Lisinopril" />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" icon={<RobotOutlined />} loading={loading} onClick={handleSubmit}>
          Generate Questions
        </Button>
      </Form>

      {loading && <div style={{ textAlign: 'center', marginTop: 24 }}><Spin size="large" /></div>}

      {result && (
        <Card style={{ marginTop: 24 }} title={<Space><CheckCircleOutlined /> Questions for Your Doctor</Space>}>
          {result.questions?.length > 0 && (
            <List
              dataSource={result.questions}
              renderItem={(q: any, i: number) => (
                <List.Item>
                  <Space>
                    <Tag color={priorityColors[q.priority]}>{q.priority}</Tag>
                    <Tag>{q.category}</Tag>
                    <Text>{q.question}</Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
          {result.preparationTips?.length > 0 && (
            <>
              <Divider />
              <Title level={5}>Tips for Your Visit:</Title>
              <List size="small" dataSource={result.preparationTips} renderItem={(tip: string) => <List.Item><BulbOutlined style={{ color: '#faad14' }} /> {tip}</List.Item>} />
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export default PortalAiAssistantPage;
