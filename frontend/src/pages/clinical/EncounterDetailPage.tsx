import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Input,
  InputNumber,
  Select,
  Alert,
  Divider,
  Steps,
  List,
  DatePicker,
  message,
  Spin,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  UserOutlined,
  AlertOutlined,
  HeartOutlined,
  ExperimentOutlined,
  MedicineBoxOutlined,
  DeleteOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Encounter, Diagnosis, SOAPNote, Vitals } from '../../types';
import { useEncounterStore, usePatientStore } from '../../store/dataStore';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColors: Record<string, string> = {
  planned: 'blue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'default',
};

// ── Mock ICD-10 codes for search ──
const icdCodes = [
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications' },
  { code: 'I10', desc: 'Essential (primary) hypertension' },
  { code: 'J45.30', desc: 'Mild persistent asthma, uncomplicated' },
  { code: 'M54.5', desc: 'Low back pain' },
  { code: 'F41.1', desc: 'Generalized anxiety disorder' },
  { code: 'F33.0', desc: 'Major depressive disorder, recurrent, mild' },
  { code: 'I50.9', desc: 'Heart failure, unspecified' },
  { code: 'N18.3', desc: 'Chronic kidney disease, stage 3' },
  { code: 'G43.009', desc: 'Migraine without aura, not intractable' },
  { code: 'E03.9', desc: 'Hypothyroidism, unspecified' },
  { code: 'J44.1', desc: 'COPD with acute exacerbation' },
  { code: 'I25.10', desc: 'Atherosclerotic heart disease of native coronary artery' },
  { code: 'I48.91', desc: 'Unspecified atrial fibrillation' },
  { code: 'K21.0', desc: 'GERD with esophagitis' },
  { code: 'M17.11', desc: 'Primary osteoarthritis, right knee' },
  { code: 'D50.9', desc: 'Iron deficiency anemia, unspecified' },
  { code: 'N40.0', desc: 'Benign prostatic hyperplasia without LUTS' },
  { code: 'E78.5', desc: 'Hyperlipidemia, unspecified' },
];

// ── Mock AI-generated SOAP content ──
const mockAiSoap: SOAPNote = {
  subjective:
    'Patient presents today for scheduled follow-up. Reports overall improvement in symptoms since last visit. Denies any new complaints. Medication compliance has been good. Mild fatigue noted but otherwise feeling well. Sleep and appetite are normal. No recent hospitalizations or ER visits.',
  objective:
    'General: Alert, oriented, in no acute distress. Vital signs stable (see vitals section). HEENT: PERRL, EOMI, oropharynx clear. Neck: Supple, no lymphadenopathy. Cardiac: Regular rate and rhythm, no murmurs/gallops/rubs. Lungs: Clear to auscultation bilaterally. Abdomen: Soft, non-tender, non-distended, normal bowel sounds. Extremities: No edema, good peripheral pulses.',
  assessment:
    '1. Primary condition - stable on current management\n2. Review of recent lab results within acceptable range\n3. No new acute findings on examination\n4. Patient demonstrating good medication adherence and lifestyle modifications',
  plan:
    '1. Continue current medication regimen without changes\n2. Order routine follow-up labs (CMP, CBC)\n3. Continue lifestyle modifications - diet and exercise\n4. Return to clinic in 3 months for follow-up\n5. Patient to call if any new or worsening symptoms\n6. Discussed warning signs to watch for with patient',
};

const EncounterDetailPage: React.FC = () => {
  const { encounters: mockEncounters } = useEncounterStore();
  const { patients: mockPatients } = usePatientStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const encounter = useMemo(() => mockEncounters.find((e) => e.id === id), [id]);
  const patient = useMemo(
    () => (encounter ? mockPatients.find((p) => p.id === encounter.patientId) : null),
    [encounter],
  );

  // ── State ──
  const [soapNote, setSoapNote] = useState<SOAPNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const [vitals, setVitals] = useState<Partial<Vitals>>({
    bloodPressureSystolic: undefined,
    bloodPressureDiastolic: undefined,
    heartRate: undefined,
    temperature: undefined,
    respiratoryRate: undefined,
    oxygenSaturation: undefined,
    weight: undefined,
    height: undefined,
  });

  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [interventions, setInterventions] = useState<string[]>([]);
  const [followUpDate, setFollowUpDate] = useState<dayjs.Dayjs | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [encounterStatus, setEncounterStatus] = useState(encounter?.status || 'planned');

  // ── Populate existing data ──
  useEffect(() => {
    if (encounter) {
      if (encounter.soapNote) setSoapNote(encounter.soapNote);
      if (encounter.vitals) {
        setVitals(encounter.vitals);
      }
      if (encounter.diagnoses?.length) setDiagnoses(encounter.diagnoses);
      if (encounter.treatmentPlan) {
        setGoals(encounter.treatmentPlan.goals || []);
        setInterventions(encounter.treatmentPlan.interventions || []);
        if (encounter.treatmentPlan.followUpDate) {
          setFollowUpDate(dayjs(encounter.treatmentPlan.followUpDate));
        }
      }
      setEncounterStatus(encounter.status);
    }
  }, [encounter]);

  // ── Calculated BMI ──
  const bmi = useMemo(() => {
    if (vitals.weight && vitals.height) {
      return ((vitals.weight / (vitals.height * vitals.height)) * 703).toFixed(1);
    }
    return '--';
  }, [vitals.weight, vitals.height]);

  // ── AI Assist ──
  const handleAiAssist = () => {
    setAiLoading(true);
    setTimeout(() => {
      setSoapNote(mockAiSoap);
      setAiLoading(false);
      message.success('AI has populated SOAP note fields');
    }, 2000);
  };

  // ── Add / Remove diagnosis ──
  const addDiagnosis = () => {
    setDiagnoses([
      ...diagnoses,
      {
        id: `dx-new-${Date.now()}`,
        icdCode: '',
        description: '',
        type: diagnoses.length === 0 ? 'primary' : 'secondary',
        status: 'active',
      },
    ]);
  };

  const removeDiagnosis = (dxId: string) => {
    setDiagnoses(diagnoses.filter((d) => d.id !== dxId));
  };

  const updateDiagnosis = (dxId: string, field: keyof Diagnosis, value: string) => {
    setDiagnoses(
      diagnoses.map((d) => {
        if (d.id !== dxId) return d;
        if (field === 'icdCode') {
          const found = icdCodes.find((c) => c.code === value);
          return { ...d, icdCode: value, description: found?.desc || d.description };
        }
        return { ...d, [field]: value };
      }),
    );
  };

  // ── Save handlers ──
  const handleSaveDraft = () => {
    message.success('Encounter saved as draft');
  };

  const handleSignComplete = () => {
    setEncounterStatus('completed');
    message.success('Encounter signed and completed');
  };

  // ── Not found ──
  if (!encounter || !patient) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Title level={4}>Encounter not found</Title>
        <Button type="primary" onClick={() => navigate('/clinical')}>
          Back to Clinical
        </Button>
      </div>
    );
  }

  // ── Encounter status timeline ──
  const statusSteps = [
    { title: 'Planned', status: 'planned' },
    { title: 'In Progress', status: 'in_progress' },
    { title: 'Completed', status: 'completed' },
  ];
  const currentStep = statusSteps.findIndex((s) => s.status === encounterStatus);

  return (
    <div>
      {/* Back button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/clinical')}
        style={{ marginBottom: 16 }}
      >
        Back to Clinical
      </Button>

      {/* Patient Info Header */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle" justify="space-between">
          <Col flex="auto">
            <Space size={16} align="start">
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: '#0D7C8A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 24,
                }}
              >
                <UserOutlined />
              </div>
              <div>
                <Space align="center">
                  <Title level={4} style={{ margin: 0 }}>
                    {patient.firstName} {patient.lastName}
                  </Title>
                  <Tag color={statusColors[encounterStatus]} style={{ textTransform: 'capitalize' }}>
                    {encounterStatus.replace(/_/g, ' ')}
                  </Tag>
                  <Tag>{encounter.type.replace(/_/g, ' ')}</Tag>
                </Space>
                <Space split={<Divider type="vertical" />} style={{ marginTop: 4 }}>
                  <Text type="secondary">MRN: {patient.mrn}</Text>
                  <Text type="secondary">
                    DOB: {dayjs(patient.dateOfBirth).format('MM/DD/YYYY')}
                  </Text>
                  <Text type="secondary">
                    {dayjs(encounter.startTime).format('MMM DD, YYYY h:mm A')}
                  </Text>
                </Space>
              </div>
            </Space>
          </Col>
          <Col flex="none">
            <Space>
              <Button icon={<SaveOutlined />} onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSignComplete}
                disabled={encounterStatus === 'completed'}
              >
                Sign & Complete
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Allergies alert */}
        {patient.allergies.length > 0 && (
          <Alert
            type="error"
            showIcon
            icon={<AlertOutlined />}
            style={{ marginTop: 16 }}
            message={
              <Space size={8} wrap>
                <Text strong>ALLERGIES:</Text>
                {patient.allergies.map((a) => (
                  <Tag
                    key={a.id}
                    color={
                      a.severity === 'life-threatening'
                        ? '#8B0000'
                        : a.severity === 'severe'
                        ? 'red'
                        : a.severity === 'moderate'
                        ? 'orange'
                        : 'blue'
                    }
                  >
                    {a.allergen} ({a.severity})
                  </Tag>
                ))}
              </Space>
            }
          />
        )}
      </Card>

      <Row gutter={24}>
        {/* Main Content - Left */}
        <Col xs={24} lg={18}>
          {/* Vitals Section */}
          <Card
            title={
              <Space>
                <HeartOutlined />
                <span>Vitals</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
            size="small"
          >
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  BP Systolic (mmHg)
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={vitals.bloodPressureSystolic}
                  onChange={(v) =>
                    setVitals({ ...vitals, bloodPressureSystolic: v ?? undefined })
                  }
                  min={60}
                  max={250}
                  placeholder="120"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  BP Diastolic (mmHg)
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={vitals.bloodPressureDiastolic}
                  onChange={(v) =>
                    setVitals({ ...vitals, bloodPressureDiastolic: v ?? undefined })
                  }
                  min={30}
                  max={150}
                  placeholder="80"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Heart Rate (bpm)
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={vitals.heartRate}
                  onChange={(v) => setVitals({ ...vitals, heartRate: v ?? undefined })}
                  min={30}
                  max={250}
                  placeholder="72"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Temperature (°F)
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={vitals.temperature}
                  onChange={(v) => setVitals({ ...vitals, temperature: v ?? undefined })}
                  min={90}
                  max={110}
                  step={0.1}
                  placeholder="98.6"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Respiratory Rate
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={vitals.respiratoryRate}
                  onChange={(v) => setVitals({ ...vitals, respiratoryRate: v ?? undefined })}
                  min={5}
                  max={60}
                  placeholder="16"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  SpO2 (%)
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={vitals.oxygenSaturation}
                  onChange={(v) =>
                    setVitals({ ...vitals, oxygenSaturation: v ?? undefined })
                  }
                  min={50}
                  max={100}
                  placeholder="98"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Weight (lbs)
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={vitals.weight}
                  onChange={(v) => setVitals({ ...vitals, weight: v ?? undefined })}
                  min={1}
                  max={1000}
                  placeholder="150"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Height (in)
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={vitals.height}
                  onChange={(v) => setVitals({ ...vitals, height: v ?? undefined })}
                  min={10}
                  max={100}
                  placeholder="70"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  BMI (auto)
                </Text>
                <div
                  style={{
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 11px',
                    background: '#f5f5f5',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9',
                  }}
                >
                  <Text strong style={{ color: bmi !== '--' ? '#0D7C8A' : '#8c8c8c' }}>
                    {bmi}
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>

          {/* SOAP Notes */}
          <Card
            title={
              <Space>
                <span>SOAP Note</span>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  (Supports rich text formatting)
                </Text>
              </Space>
            }
            extra={
              <Tooltip title="AI will analyze patient data and suggest SOAP note content">
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={handleAiAssist}
                  loading={aiLoading}
                  style={{
                    borderColor: '#722ed1',
                    color: '#722ed1',
                  }}
                >
                  AI Assist
                </Button>
              </Tooltip>
            }
            style={{ marginBottom: 24 }}
          >
            <Spin spinning={aiLoading} tip="AI is analyzing patient data...">
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ color: '#0D7C8A', marginBottom: 4, display: 'block' }}>
                    Subjective
                  </Text>
                  <TextArea
                    rows={4}
                    value={soapNote.subjective}
                    onChange={(e) => setSoapNote({ ...soapNote, subjective: e.target.value })}
                    placeholder="Patient's reported symptoms, history of present illness, review of systems..."
                  />
                </div>
                <div>
                  <Text strong style={{ color: '#0D7C8A', marginBottom: 4, display: 'block' }}>
                    Objective
                  </Text>
                  <TextArea
                    rows={4}
                    value={soapNote.objective}
                    onChange={(e) => setSoapNote({ ...soapNote, objective: e.target.value })}
                    placeholder="Physical examination findings, vital signs, lab results..."
                  />
                </div>
                <div>
                  <Text strong style={{ color: '#0D7C8A', marginBottom: 4, display: 'block' }}>
                    Assessment
                  </Text>
                  <TextArea
                    rows={3}
                    value={soapNote.assessment}
                    onChange={(e) => setSoapNote({ ...soapNote, assessment: e.target.value })}
                    placeholder="Clinical impression, differential diagnoses..."
                  />
                </div>
                <div>
                  <Text strong style={{ color: '#0D7C8A', marginBottom: 4, display: 'block' }}>
                    Plan
                  </Text>
                  <TextArea
                    rows={4}
                    value={soapNote.plan}
                    onChange={(e) => setSoapNote({ ...soapNote, plan: e.target.value })}
                    placeholder="Treatment plan, medications, follow-up, patient education..."
                  />
                </div>
              </Space>
            </Spin>
          </Card>

          {/* Diagnoses */}
          <Card
            title="Diagnoses"
            extra={
              <Button type="dashed" icon={<PlusOutlined />} onClick={addDiagnosis}>
                Add Diagnosis
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            {diagnoses.length === 0 ? (
              <Text type="secondary">No diagnoses added. Click "Add Diagnosis" to begin.</Text>
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {diagnoses.map((dx, idx) => (
                  <Card
                    key={dx.id}
                    size="small"
                    style={{
                      border: dx.type === 'primary' ? '1px solid #0D7C8A' : '1px solid #f0f0f0',
                      background: dx.type === 'primary' ? '#f0fafb' : '#fff',
                    }}
                  >
                    <Row gutter={16} align="middle">
                      <Col xs={24} sm={8}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          ICD-10 Code
                        </Text>
                        <Select
                          showSearch
                          style={{ width: '100%' }}
                          value={dx.icdCode || undefined}
                          placeholder="Search ICD-10..."
                          optionFilterProp="label"
                          onChange={(v) => updateDiagnosis(dx.id, 'icdCode', v)}
                          options={icdCodes.map((c) => ({
                            label: `${c.code} - ${c.desc}`,
                            value: c.code,
                          }))}
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Description
                        </Text>
                        <Input
                          value={dx.description}
                          onChange={(e) =>
                            updateDiagnosis(dx.id, 'description', e.target.value)
                          }
                          placeholder="Diagnosis description"
                        />
                      </Col>
                      <Col xs={12} sm={4}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Type
                        </Text>
                        <Select
                          style={{ width: '100%' }}
                          value={dx.type}
                          onChange={(v) => updateDiagnosis(dx.id, 'type', v)}
                          options={[
                            { label: 'Primary', value: 'primary' },
                            { label: 'Secondary', value: 'secondary' },
                          ]}
                        />
                      </Col>
                      <Col xs={12} sm={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => removeDiagnosis(dx.id)}
                          style={{ marginTop: 18 }}
                        >
                          Remove
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Space>
            )}
          </Card>

          {/* Treatment Plan */}
          <Card title="Treatment Plan" style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Goals
                </Text>
                <List
                  size="small"
                  bordered
                  dataSource={goals}
                  locale={{ emptyText: 'No goals added' }}
                  renderItem={(item, idx) => (
                    <List.Item
                      actions={[
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          key="del"
                          onClick={() => setGoals(goals.filter((_, i) => i !== idx))}
                        />,
                      ]}
                    >
                      <Text>{item}</Text>
                    </List.Item>
                  )}
                  footer={
                    <Input
                      placeholder="Add a goal and press Enter"
                      onPressEnter={(e) => {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          setGoals([...goals, val]);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      prefix={<PlusOutlined style={{ color: '#bfbfbf' }} />}
                    />
                  }
                />
              </Col>
              <Col xs={24} md={12}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Interventions
                </Text>
                <List
                  size="small"
                  bordered
                  dataSource={interventions}
                  locale={{ emptyText: 'No interventions added' }}
                  renderItem={(item, idx) => (
                    <List.Item
                      actions={[
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          key="del"
                          onClick={() => setInterventions(interventions.filter((_, i) => i !== idx))}
                        />,
                      ]}
                    >
                      <Text>{item}</Text>
                    </List.Item>
                  )}
                  footer={
                    <Input
                      placeholder="Add an intervention and press Enter"
                      onPressEnter={(e) => {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          setInterventions([...interventions, val]);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      prefix={<PlusOutlined style={{ color: '#bfbfbf' }} />}
                    />
                  }
                />
              </Col>
            </Row>
            <Divider />
            <Space>
              <Text strong>Follow-up Date:</Text>
              <DatePicker
                value={followUpDate}
                onChange={setFollowUpDate}
                style={{ width: 200 }}
              />
            </Space>
          </Card>

          {/* Orders Section */}
          <Card title="Orders" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Card
                  hoverable
                  size="small"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => navigate('/prescriptions')}
                >
                  <MedicineBoxOutlined
                    style={{ fontSize: 32, color: '#0D7C8A', marginBottom: 8 }}
                  />
                  <br />
                  <Text strong>Create Prescription</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Order medications for this patient
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card
                  hoverable
                  size="small"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => navigate('/laboratory')}
                >
                  <ExperimentOutlined
                    style={{ fontSize: 32, color: '#0D7C8A', marginBottom: 8 }}
                  />
                  <br />
                  <Text strong>Create Lab Order</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Order laboratory tests for this patient
                  </Text>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Right Sidebar - Encounter Status Timeline */}
        <Col xs={24} lg={6}>
          <Card title="Encounter Status" size="small" style={{ marginBottom: 24 }}>
            <Steps
              direction="vertical"
              current={currentStep}
              size="small"
              items={statusSteps.map((step, idx) => ({
                title: step.title,
                status:
                  idx < currentStep
                    ? 'finish'
                    : idx === currentStep
                    ? encounterStatus === 'cancelled'
                      ? 'error'
                      : 'process'
                    : 'wait',
                description:
                  idx === 0 && encounter.createdAt
                    ? dayjs(encounter.createdAt).format('MMM DD, h:mm A')
                    : idx === 1 && encounter.startTime
                    ? dayjs(encounter.startTime).format('MMM DD, h:mm A')
                    : idx === 2 && encounter.endTime
                    ? dayjs(encounter.endTime).format('MMM DD, h:mm A')
                    : undefined,
              }))}
            />
          </Card>

          <Card title="Quick Info" size="small" style={{ marginBottom: 24 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Encounter Type
                </Text>
                <br />
                <Tag style={{ textTransform: 'capitalize' }}>
                  {encounter.type.replace(/_/g, ' ')}
                </Tag>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Diagnoses
                </Text>
                <br />
                <Text strong>{diagnoses.length}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  SOAP Progress
                </Text>
                <br />
                <Space direction="vertical" size={4}>
                  {(['subjective', 'objective', 'assessment', 'plan'] as const).map((key) => (
                    <Space key={key} size={4}>
                      {soapNote[key] ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <CheckCircleOutlined style={{ color: '#d9d9d9' }} />
                      )}
                      <Text
                        type={soapNote[key] ? undefined : 'secondary'}
                        style={{ textTransform: 'capitalize', fontSize: 13 }}
                      >
                        {key}
                      </Text>
                    </Space>
                  ))}
                </Space>
              </div>
            </Space>
          </Card>

          {/* Bottom action buttons (also in sidebar) */}
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              block
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              size="large"
            >
              Save Draft
            </Button>
            <Button
              block
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleSignComplete}
              disabled={encounterStatus === 'completed'}
              size="large"
            >
              Sign & Complete
            </Button>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default EncounterDetailPage;
