import React, { useState } from 'react';
import {
  Card,
  Form,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Select,
  DatePicker,
  Input,
  InputNumber,
  message,
  Steps,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HeartOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Encounter, SOAPNote, Vitals, Diagnosis } from '../../types';
import { usePatientStore, useProviderStore } from '../../store/dataStore';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const encounterTypes = [
  { label: 'Office Visit', value: 'office_visit' },
  { label: 'Telehealth', value: 'telehealth' },
  { label: 'Emergency', value: 'emergency' },
  { label: 'Inpatient', value: 'inpatient' },
  { label: 'Procedure', value: 'procedure' },
];

const icdCodes = [
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications' },
  { code: 'I10', desc: 'Essential (primary) hypertension' },
  { code: 'J45.30', desc: 'Mild persistent asthma, uncomplicated' },
  { code: 'M54.5', desc: 'Low back pain' },
  { code: 'F41.1', desc: 'Generalized anxiety disorder' },
  { code: 'F33.0', desc: 'Major depressive disorder, recurrent, mild' },
  { code: 'I50.9', desc: 'Heart failure, unspecified' },
  { code: 'N18.3', desc: 'Chronic kidney disease, stage 3' },
];

const NewEncounterPage: React.FC = () => {
  const navigate = useNavigate();
  const { patients } = usePatientStore();
  const { providers } = useProviderStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

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

  const steps = [
    {
      title: 'Patient & Provider',
      description: 'Select patient and provider',
    },
    {
      title: 'Encounter Details',
      description: 'Set encounter type and time',
    },
    {
      title: 'Clinical Data',
      description: 'Add vitals and SOAP notes',
    },
  ];

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

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const values = await form.validateFields();
      
      const encounterData: Partial<Encounter> = {
        patientId: values.patientId,
        providerId: values.providerId,
        type: values.type,
        status: 'planned',
        startTime: values.startTime.toISOString(),
        soapNote: Object.values(soapNote).some(v => v) ? soapNote : undefined,
        vitals: Object.values(vitals).some(v => v !== undefined) ? {
          ...vitals,
          bmi: vitals.weight && vitals.height ? ((vitals.weight / (vitals.height * vitals.height)) * 703) : undefined,
          recordedAt: new Date().toISOString(),
        } as Vitals : undefined,
        diagnoses: diagnoses.length > 0 ? diagnoses : undefined,
      };

      // Call API to create encounter
      const res = await fetch('/api/v1/clinical/encounters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('neuraline_token')}`,
        },
        body: JSON.stringify(encounterData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create encounter');
      }

      const data = await res.json();
      message.success('Encounter created successfully');
      navigate(`/clinical/${data.id}`);
    } catch (error: any) {
      message.error(error.message || 'Failed to create encounter');
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    form.validateFields().then(() => {
      setCurrentStep(currentStep + 1);
    });
  };

  const prev = () => {
    setCurrentStep(currentStep - 1);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/clinical')}
          style={{ marginBottom: 16 }}
        >
          Back to Clinical
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          New Encounter
        </Title>
        <Text type="secondary">Create a new clinical encounter</Text>
      </div>

      {/* Steps */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={steps} />
      </Card>

      <Form form={form} layout="vertical">
        {/* Step 1: Patient & Provider */}
        {currentStep === 0 && (
          <Card title={<Space><UserOutlined /> Patient & Provider</Space>}>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="patientId"
                  label="Patient"
                  rules={[{ required: true, message: 'Please select a patient' }]}
                >
                  <Select
                    placeholder="Search patient..."
                    showSearch
                    optionFilterProp="label"
                    options={patients.map((p) => ({
                      label: `${p.firstName} ${p.lastName} (MRN: ${p.mrn})`,
                      value: p.id,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="providerId"
                  label="Provider"
                  rules={[{ required: true, message: 'Please select a provider' }]}
                >
                  <Select
                    placeholder="Select provider..."
                    options={providers.map((p) => ({
                      label: `Dr. ${p.firstName} ${p.lastName}`,
                      value: p.id,
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        )}

        {/* Step 2: Encounter Details */}
        {currentStep === 1 && (
          <Card title={<Space><CalendarOutlined /> Encounter Details</Space>}>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="type"
                  label="Encounter Type"
                  rules={[{ required: true, message: 'Please select encounter type' }]}
                >
                  <Select
                    placeholder="Select type..."
                    options={encounterTypes}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="startTime"
                  label="Start Time"
                  rules={[{ required: true, message: 'Please select start time' }]}
                  initialValue={dayjs()}
                >
                  <DatePicker
                    showTime
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD HH:mm"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        )}

        {/* Step 3: Clinical Data */}
        {currentStep === 2 && (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            {/* Vitals */}
            <Card title={<Space><HeartOutlined /> Vitals</Space>} size="small">
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>BP Systolic</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    value={vitals.bloodPressureSystolic}
                    onChange={(v) => setVitals({ ...vitals, bloodPressureSystolic: v ?? undefined })}
                    placeholder="120"
                  />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>BP Diastolic</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    value={vitals.bloodPressureDiastolic}
                    onChange={(v) => setVitals({ ...vitals, bloodPressureDiastolic: v ?? undefined })}
                    placeholder="80"
                  />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Heart Rate</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    value={vitals.heartRate}
                    onChange={(v) => setVitals({ ...vitals, heartRate: v ?? undefined })}
                    placeholder="72"
                  />
                </Col>
                <Col xs={12} sm={8} md={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Temperature</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    value={vitals.temperature}
                    onChange={(v) => setVitals({ ...vitals, temperature: v ?? undefined })}
                    placeholder="98.6"
                    step={0.1}
                  />
                </Col>
              </Row>
            </Card>

            {/* SOAP Notes */}
            <Card title={<Space><FileTextOutlined /> SOAP Notes</Space>} size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ color: '#0D7C8A', fontSize: 12 }}>Subjective</Text>
                  <TextArea
                    rows={3}
                    value={soapNote.subjective}
                    onChange={(e) => setSoapNote({ ...soapNote, subjective: e.target.value })}
                    placeholder="Patient's reported symptoms..."
                  />
                </div>
                <div>
                  <Text strong style={{ color: '#0D7C8A', fontSize: 12 }}>Objective</Text>
                  <TextArea
                    rows={3}
                    value={soapNote.objective}
                    onChange={(e) => setSoapNote({ ...soapNote, objective: e.target.value })}
                    placeholder="Physical examination findings..."
                  />
                </div>
                <div>
                  <Text strong style={{ color: '#0D7C8A', fontSize: 12 }}>Assessment</Text>
                  <TextArea
                    rows={2}
                    value={soapNote.assessment}
                    onChange={(e) => setSoapNote({ ...soapNote, assessment: e.target.value })}
                    placeholder="Clinical impression..."
                  />
                </div>
                <div>
                  <Text strong style={{ color: '#0D7C8A', fontSize: 12 }}>Plan</Text>
                  <TextArea
                    rows={3}
                    value={soapNote.plan}
                    onChange={(e) => setSoapNote({ ...soapNote, plan: e.target.value })}
                    placeholder="Treatment plan..."
                  />
                </div>
              </Space>
            </Card>

            {/* Diagnoses */}
            <Card
              title={<Space><MedicineBoxOutlined /> Diagnoses</Space>}
              size="small"
              extra={<Button type="dashed" size="small" onClick={addDiagnosis}>Add Diagnosis</Button>}
            >
              {diagnoses.length === 0 ? (
                <Text type="secondary">No diagnoses added</Text>
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {diagnoses.map((dx) => (
                    <Card key={dx.id} size="small">
                      <Row gutter={16}>
                        <Col xs={24} sm={8}>
                          <Select
                            style={{ width: '100%' }}
                            value={dx.icdCode || undefined}
                            placeholder="ICD-10 Code"
                            onChange={(v) => updateDiagnosis(dx.id, 'icdCode', v)}
                            options={icdCodes.map((c) => ({
                              label: `${c.code} - ${c.desc}`,
                              value: c.code,
                            }))}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Input
                            value={dx.description}
                            onChange={(e) => updateDiagnosis(dx.id, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </Col>
                        <Col xs={12} sm={4}>
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
                        <Col xs={12} sm={4}>
                          <Button danger type="text" onClick={() => removeDiagnosis(dx.id)}>
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Space>
        )}

        {/* Navigation Buttons */}
        <Card style={{ marginTop: 24 }}>
          <Row justify="space-between">
            <Col>
              {currentStep > 0 && (
                <Button onClick={prev}>
                  Previous
                </Button>
              )}
            </Col>
            <Col>
              <Space>
                {currentStep < steps.length - 1 && (
                  <Button type="primary" onClick={next}>
                    Next
                  </Button>
                )}
                {currentStep === steps.length - 1 && (
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSubmit}
                    loading={loading}
                  >
                    Create Encounter
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      </Form>
    </div>
  );
};

export default NewEncounterPage;
