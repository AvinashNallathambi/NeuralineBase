import React, { useState } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Steps,
  Button,
  Input,
  Select,
  Tag,
  Spin,
  Alert,
  Divider,
  Table,
  Space,
  message,
  Descriptions,
} from 'antd';
import {
  AudioOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  SendOutlined,
  EditOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AudioRecorder from '../../components/AudioRecorder';
import { useProviderStore } from '../../store/dataStore';
import { usePatientStore } from '../../store/dataStore';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface CodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  type: 'icd10' | 'cpt';
}

const AiEncounterPage: React.FC = () => {
  const navigate = useNavigate();
  const { providers } = useProviderStore();
  const { patients } = usePatientStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0: Setup
  const [selectedPatient, setSelectedPatient] = useState<string | undefined>();
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>();
  const [chiefComplaint, setChiefComplaint] = useState('');

  // Step 1: Recording + Transcription
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [transcriptDuration, setTranscriptDuration] = useState(0);

  // Step 2: SOAP Note
  const [soapNote, setSoapNote] = useState<SOAPNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  // Step 3: Medical Codes
  const [diagnosisCodes, setDiagnosisCodes] = useState<CodeSuggestion[]>([]);
  const [procedureCodes, setProcedureCodes] = useState<CodeSuggestion[]>([]);

  const patient = patients.find((p) => p.id === selectedPatient);
  const provider = providers.find((p) => p.id === selectedProvider);

  // ── API helpers ─────────────────────────────────────────────────────
  const apiBase = '/api/v1/ai';

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('neuraline_token');
    if (!token) throw new Error('Not authenticated — please log in again');
    return `Bearer ${token}`;
  };

  const handleApiError = (res: Response) => {
    if (res.status === 401) throw new Error('Session expired — please log in again');
    if (res.status === 504) throw new Error('AI is taking too long — try a shorter transcript or try again');
    throw new Error(`Server error (${res.status})`);
  };

  const handleTranscribe = async () => {
    if (!audioBlob) {
      message.warning('Please record audio first');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'encounter.webm');

      const res = await fetch(`${apiBase}/transcribe`, {
        method: 'POST',
        headers: { Authorization: getAuthHeader() },
        body: formData,
      });

      if (!res.ok) handleApiError(res);
      const data = await res.json();
      setTranscript(data.text || '');
      setTranscriptDuration(data.duration || 0);
      message.success('Transcription complete');
      setCurrentStep(2);
    } catch (err: any) {
      message.error(err.message || 'Transcription failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSOAP = async () => {
    if (!transcript.trim()) {
      message.warning('Please provide a transcript first');
      return;
    }
    setLoading(true);
    try {
      const patientContext = patient
        ? {
            name: `${patient.firstName} ${patient.lastName}`,
            gender: patient.gender,
            chiefComplaint,
          }
        : { chiefComplaint };

      const res = await fetch(`${apiBase}/generate-soap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({ transcript, patientContext }),
      });

      if (!res.ok) handleApiError(res);
      const data = await res.json();
      setSoapNote(data);
      message.success('SOAP note generated');
      setCurrentStep(3);
    } catch (err: any) {
      message.error(err.message || 'SOAP generation failed');
      setCurrentStep(3);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestCodes = async () => {
    if (!soapNote.assessment && !soapNote.plan) {
      message.warning('Please complete the SOAP note first');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/suggest-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify(soapNote),
      });

      if (!res.ok) handleApiError(res);
      const data = await res.json();
      setDiagnosisCodes(data.diagnoses || []);
      setProcedureCodes(data.procedures || []);
      message.success('Coding suggestions ready');
      setCurrentStep(4);
    } catch (err: any) {
      message.error(err.message || 'Code suggestion failed');
      setCurrentStep(4);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuperbill = () => {
    message.success('Superbill draft created — redirecting...');
    navigate('/superbills/new');
  };

  // ── Render step content ────────────────────────────────────────────
  const renderSetup = () => (
    <Card title="Encounter Setup" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Text strong>Patient</Text>
          <Select
            showSearch
            placeholder="Select patient"
            value={selectedPatient}
            onChange={setSelectedPatient}
            style={{ width: '100%', marginTop: 4 }}
            optionFilterProp="label"
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.firstName} ${p.lastName} (${p.mrn || 'No MRN'})`,
            }))}
          />
        </Col>
        <Col xs={24} md={12}>
          <Text strong>Provider</Text>
          <Select
            showSearch
            placeholder="Select provider"
            value={selectedProvider}
            onChange={setSelectedProvider}
            style={{ width: '100%', marginTop: 4 }}
            optionFilterProp="label"
            options={providers
              .filter((p) => p.role === 'doctor')
              .map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName} — ${p.specialization || p.department}`,
              }))}
          />
        </Col>
        <Col xs={24}>
          <Text strong>Chief Complaint</Text>
          <Input
            placeholder="e.g. Follow-up for diabetes management"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            style={{ marginTop: 4 }}
          />
        </Col>
      </Row>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button
          type="primary"
          onClick={() => setCurrentStep(1)}
          disabled={!selectedPatient || !selectedProvider}
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
        >
          Start Encounter
        </Button>
      </div>
    </Card>
  );

  const renderRecording = () => (
    <Card
      title={
        <span>
          <AudioOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          Voice Recording &amp; Transcription
        </span>
      }
      style={{ marginBottom: 16 }}
    >
      {patient && provider && (
        <Descriptions size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Patient">
            {patient.firstName} {patient.lastName}
          </Descriptions.Item>
          <Descriptions.Item label="Provider">
            {provider.firstName} {provider.lastName}
          </Descriptions.Item>
          {chiefComplaint && (
            <Descriptions.Item label="Chief Complaint" span={2}>
              {chiefComplaint}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}

      <AudioRecorder
        onRecordingComplete={(blob, dur) => {
          setAudioBlob(blob);
          setTranscriptDuration(dur);
        }}
        disabled={loading}
      />

      <Divider />

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleTranscribe}
          loading={loading}
          disabled={!audioBlob}
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
        >
          Transcribe with Whisper AI
        </Button>
        <Button onClick={() => setCurrentStep(2)}>Skip — Enter Manually</Button>
      </div>

      {transcript && (
        <Alert
          type="success"
          message={`Transcription (${Math.round(transcriptDuration)}s audio)`}
          description={transcript}
          showIcon
        />
      )}
    </Card>
  );

  const renderTranscript = () => (
    <Card
      title={
        <span>
          <FileTextOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          Transcript Review
        </span>
      }
      style={{ marginBottom: 16 }}
    >
      <TextArea
        rows={6}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Paste or type the encounter transcript here..."
      />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button
          type="primary"
          icon={<RobotOutlined />}
          onClick={handleGenerateSOAP}
          loading={loading}
          disabled={!transcript.trim()}
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
        >
          Generate SOAP Note with AI
        </Button>
        <Button onClick={() => setCurrentStep(3)}>Skip — Write SOAP Manually</Button>
      </div>
    </Card>
  );

  const renderSOAP = () => (
    <Card
      title={
        <span>
          <EditOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          SOAP Note
          {soapNote.subjective && <Tag color="blue" style={{ marginLeft: 8 }}>AI Generated</Tag>}
        </span>
      }
      style={{ marginBottom: 16 }}
    >
      <Alert
        type="info"
        message="Review and edit the AI-generated SOAP note. All content must be verified by the provider."
        style={{ marginBottom: 16 }}
        showIcon
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Text strong>Subjective</Text>
          <TextArea
            rows={4}
            value={soapNote.subjective}
            onChange={(e) => setSoapNote((s) => ({ ...s, subjective: e.target.value }))}
            placeholder="Patient's reported symptoms, history..."
            style={{ marginTop: 4 }}
          />
        </Col>
        <Col xs={24} md={12}>
          <Text strong>Objective</Text>
          <TextArea
            rows={4}
            value={soapNote.objective}
            onChange={(e) => setSoapNote((s) => ({ ...s, objective: e.target.value }))}
            placeholder="Vitals, exam findings..."
            style={{ marginTop: 4 }}
          />
        </Col>
        <Col xs={24} md={12}>
          <Text strong>Assessment</Text>
          <TextArea
            rows={4}
            value={soapNote.assessment}
            onChange={(e) => setSoapNote((s) => ({ ...s, assessment: e.target.value }))}
            placeholder="Clinical assessment, diagnoses..."
            style={{ marginTop: 4 }}
          />
        </Col>
        <Col xs={24} md={12}>
          <Text strong>Plan</Text>
          <TextArea
            rows={4}
            value={soapNote.plan}
            onChange={(e) => setSoapNote((s) => ({ ...s, plan: e.target.value }))}
            placeholder="Treatment plan, meds, follow-up..."
            style={{ marginTop: 4 }}
          />
        </Col>
      </Row>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button
          type="primary"
          icon={<MedicineBoxOutlined />}
          onClick={handleSuggestCodes}
          loading={loading}
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
        >
          Suggest Medical Codes with AI
        </Button>
        <Button onClick={() => setCurrentStep(4)}>Skip — Add Codes Manually</Button>
      </div>
    </Card>
  );

  const renderCoding = () => (
    <Card
      title={
        <span>
          <MedicineBoxOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          Medical Coding Suggestions
        </span>
      }
      style={{ marginBottom: 16 }}
    >
      <Alert
        type="warning"
        message="AI-suggested codes require provider review. Verify accuracy before submitting."
        style={{ marginBottom: 16 }}
        showIcon
      />

      <Title level={5}>ICD-10 Diagnosis Codes</Title>
      {diagnosisCodes.length > 0 ? (
        <Table
          size="small"
          pagination={false}
          dataSource={diagnosisCodes.map((c, i) => ({ ...c, key: i }))}
          columns={[
            {
              title: 'Code',
              dataIndex: 'code',
              render: (code: string) => <Tag color="blue">{code}</Tag>,
            },
            { title: 'Description', dataIndex: 'description' },
            {
              title: 'Confidence',
              dataIndex: 'confidence',
              render: (c: number) => (
                <Tag color={c >= 0.8 ? 'success' : c >= 0.6 ? 'warning' : 'default'}>
                  {Math.round(c * 100)}%
                </Tag>
              ),
            },
          ]}
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Paragraph type="secondary">No diagnosis codes suggested. Add codes manually or re-run AI.</Paragraph>
      )}

      <Title level={5}>CPT Procedure Codes</Title>
      {procedureCodes.length > 0 ? (
        <Table
          size="small"
          pagination={false}
          dataSource={procedureCodes.map((c, i) => ({ ...c, key: i }))}
          columns={[
            {
              title: 'Code',
              dataIndex: 'code',
              render: (code: string) => <Tag color="green">{code}</Tag>,
            },
            { title: 'Description', dataIndex: 'description' },
            {
              title: 'Confidence',
              dataIndex: 'confidence',
              render: (c: number) => (
                <Tag color={c >= 0.8 ? 'success' : c >= 0.6 ? 'warning' : 'default'}>
                  {Math.round(c * 100)}%
                </Tag>
              ),
            },
          ]}
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Paragraph type="secondary">No procedure codes suggested. Add codes manually or re-run AI.</Paragraph>
      )}

      <Divider />
      <Space>
        <Button
          type="primary"
          icon={<AuditOutlined />}
          onClick={handleCreateSuperbill}
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
          size="large"
        >
          Generate Superbill
        </Button>
        <Button icon={<SendOutlined />} size="large">
          Submit Claim Directly
        </Button>
      </Space>
    </Card>
  );

  const steps = [
    { title: 'Setup', icon: <CheckCircleOutlined /> },
    { title: 'Record', icon: <AudioOutlined /> },
    { title: 'Transcript', icon: <FileTextOutlined /> },
    { title: 'SOAP Note', icon: <EditOutlined /> },
    { title: 'Coding', icon: <MedicineBoxOutlined /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <RobotOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
            AI-Assisted Encounter
          </Title>
          <Text type="secondary">
            Voice recording → Transcription → SOAP Note → Medical Coding → Superbill
          </Text>
        </Col>
      </Row>

      <Steps
        current={currentStep}
        items={steps}
        onChange={(step) => setCurrentStep(step)}
        style={{ marginBottom: 24 }}
        size="small"
      />

      <Spin spinning={loading} tip="AI is processing...">
        {currentStep === 0 && renderSetup()}
        {currentStep === 1 && renderRecording()}
        {currentStep === 2 && renderTranscript()}
        {currentStep === 3 && renderSOAP()}
        {currentStep === 4 && renderCoding()}
      </Spin>
    </div>
  );
};

export default AiEncounterPage;
