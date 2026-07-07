import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Divider,
  InputNumber,
  Tag,
  Table,
  Alert,
  Tooltip,
  Descriptions,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  WarningOutlined,
  MedicineBoxOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  PrinterOutlined,
  CloseOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  encounterService,
  Encounter,
  EncounterDiagnosis,
  EncounterMedication,
  EncounterAllergy,
} from '../../services/encounterService';
import { patientService } from '../../services/patientService';
import { billingService, PatientInsurance } from '../../services/billingService';
import { aiService } from '../../services/aiService';
import VitalsFormSection from '../../components/clinical/VitalsFormSection';
import { clinicalTemplateService } from '../../services/clinicalTemplateService';
import type { ClinicalTemplate } from '../../types';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const PROVIDERS = [
  { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Dr. Sarah Chen', specialty: 'Internal Medicine' },
  { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Dr. Michael Ross', specialty: 'Family Medicine' },
  { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Dr. Emily Park', specialty: 'Pediatrics' },
  { id: '550e8400-e29b-41d4-a716-446655440004', name: 'Dr. James Wilson', specialty: 'Cardiology' },
];

const DEPARTMENTS = [
  { id: '660e8400-e29b-41d4-a716-446655440001', name: 'Primary Care' },
  { id: '660e8400-e29b-41d4-a716-446655440002', name: 'Cardiology' },
  { id: '660e8400-e29b-41d4-a716-446655440003', name: 'Pediatrics' },
  { id: '660e8400-e29b-41d4-a716-446655440004', name: 'Orthopedics' },
  { id: '660e8400-e29b-41d4-a716-446655440005', name: 'Neurology' },
  { id: '660e8400-e29b-41d4-a716-446655440006', name: 'Dermatology' },
];

const severityColors: Record<string, string> = {
  mild: 'green',
  moderate: 'orange',
  severe: 'red',
  life_threatening: 'purple',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 0,
};

const NewEncounterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [diagnoses, setDiagnoses] = useState<EncounterDiagnosis[]>([]);
  const [diagCode, setDiagCode] = useState('');
  const [diagDesc, setDiagDesc] = useState('');
  const [diagIsPrimary, setDiagIsPrimary] = useState(false);
  const [diagType, setDiagType] = useState<'chronic' | 'acute' | 'rule_out'>('acute');
  const [diagStatus, setDiagStatus] = useState<'active' | 'resolved' | 'ruled_out'>('active');

  const [medications, setMedications] = useState<EncounterMedication[]>([]);

  const [procedures, setProcedures] = useState<Array<{ name: string; cptCode: string; description: string; status: string }>>([]);
  const [procName, setProcName] = useState('');
  const [procCpt, setProcCpt] = useState('');
  const [procDesc, setProcDesc] = useState('');

  const [patientInsurances, setPatientInsurances] = useState<PatientInsurance[]>([]);

  const [allergies, setAllergies] = useState<EncounterAllergy[]>([]);
  const [allergenName, setAllergenName] = useState('');
  const [allergenReaction, setAllergenReaction] = useState('');
  const [allergenSeverity, setAllergenSeverity] = useState<EncounterAllergy['severity']>('mild');
  const [allergenType, setAllergenType] = useState<EncounterAllergy['type']>('drug');

  const [labs, setLabs] = useState<Array<{ name: string; priority: string; notes: string }>>([]);
  const [labName, setLabName] = useState('');
  const [labPriority, setLabPriority] = useState('routine');

  const [imagingOrders, setImagingOrders] = useState<Array<{ name: string; modality: string; bodyPart: string; priority: string }>>([]);
  const [imagingName, setImagingName] = useState('');
  const [imagingModality, setImagingModality] = useState('');
  const [imagingBodyPart, setImagingBodyPart] = useState('');

  const [referrals, setReferrals] = useState<Array<{ specialty: string; reason: string; urgency: string }>>([]);
  const [refSpecialty, setRefSpecialty] = useState('');
  const [refReason, setRefReason] = useState('');

  const preselectedPatientId = searchParams.get('patientId');

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (preselectedPatientId && patients.length > 0) {
      const p = patients.find((pt) => pt.id === preselectedPatientId);
      if (p) {
        form.setFieldsValue({ patientId: preselectedPatientId });
        setSelectedPatient(p);
        if (p.allergies && Array.isArray(p.allergies)) {
          setAllergies(
            p.allergies.map((a: any) => ({
              allergen: a.allergen || a.name || '',
              reaction: a.reaction || '',
              severity: a.severity || 'mild',
              type: a.type || 'drug',
            })),
          );
        }
        fetchPatientInsurances(preselectedPatientId);
      }
    }
  }, [preselectedPatientId, patients, form]);

  const fetchPatients = async () => {
    try {
      const data = await patientService.findAll({ page: 1, limit: 200 });
      setPatients(data.data);
    } catch {
      message.error('Failed to load patients');
    }
  };

  const fetchPatientInsurances = async (patientId: string) => {
    try {
      const ins = await billingService.findPatientInsurances(patientId);
      setPatientInsurances(ins || []);
    } catch {
      setPatientInsurances([]);
    }
  };

  const handlePatientSelect = async (patientId: string) => {
    const p = patients.find((pt) => pt.id === patientId) || null;
    setSelectedPatient(p);
    if (p?.allergies && Array.isArray(p.allergies)) {
      setAllergies(
        p.allergies.map((a: any) => ({
          allergen: a.allergen || a.name || '',
          reaction: a.reaction || '',
          severity: a.severity || 'mild',
          type: a.type || 'drug',
        })),
      );
    }
    fetchPatientInsurances(patientId);
  };

  const markDirty = useCallback(() => {
    setIsDirty(true);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, []);

  const handleAddDiagnosis = () => {
    if (!diagCode.trim() || !diagDesc.trim()) {
      message.warning('ICD code and description are required');
      return;
    }
    if (diagIsPrimary && diagnoses.some((d) => d.isPrimary)) {
      message.warning('A primary diagnosis already exists. Unmark the current primary first.');
      return;
    }
    setDiagnoses([
      ...diagnoses,
      { code: diagCode.trim().toUpperCase(), description: diagDesc.trim(), isPrimary: diagIsPrimary, type: diagType, status: diagStatus },
    ]);
    setDiagCode('');
    setDiagDesc('');
    setDiagIsPrimary(false);
    setDiagType('acute');
    setDiagStatus('active');
    markDirty();
  };

  const handleRemoveDiagnosis = (index: number) => {
    setDiagnoses(diagnoses.filter((_, i) => i !== index));
    markDirty();
  };

  const handleAddMedication = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: '', route: 'oral', refills: 0, isNew: true }]);
    markDirty();
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
    markDirty();
  };

  const handleUpdateMedication = (index: number, field: keyof EncounterMedication, value: string | number | boolean) => {
    const updated = [...medications];
    (updated[index] as any)[field] = value;
    setMedications(updated);
    markDirty();
  };

  const handleAddProcedure = () => {
    if (!procName.trim()) {
      message.warning('Procedure name is required');
      return;
    }
    setProcedures([...procedures, { name: procName.trim(), cptCode: procCpt.trim(), description: procDesc.trim(), status: 'ordered' }]);
    setProcName('');
    setProcCpt('');
    setProcDesc('');
    markDirty();
  };

  const handleRemoveProcedure = (index: number) => {
    setProcedures(procedures.filter((_, i) => i !== index));
    markDirty();
  };

  const handleAddAllergy = () => {
    if (!allergenName.trim()) {
      message.warning('Allergen name is required');
      return;
    }
    setAllergies([
      ...allergies,
      { allergen: allergenName.trim(), reaction: allergenReaction, severity: allergenSeverity, type: allergenType },
    ]);
    setAllergenName('');
    setAllergenReaction('');
    setAllergenSeverity('mild');
    setAllergenType('drug');
    markDirty();
  };

  const handleRemoveAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
    markDirty();
  };

  const handleAddLab = () => {
    if (!labName.trim()) return;
    setLabs([...labs, { name: labName.trim(), priority: labPriority, notes: '' }]);
    setLabName('');
    setLabPriority('routine');
    markDirty();
  };

  const handleAddImaging = () => {
    if (!imagingName.trim()) return;
    setImagingOrders([...imagingOrders, { name: imagingName.trim(), modality: imagingModality, bodyPart: imagingBodyPart, priority: 'routine' }]);
    setImagingName('');
    setImagingModality('');
    setImagingBodyPart('');
    markDirty();
  };

  const handleAddReferral = () => {
    if (!refSpecialty.trim() || !refReason.trim()) {
      message.warning('Specialty and reason are required');
      return;
    }
    setReferrals([...referrals, { specialty: refSpecialty.trim(), reason: refReason.trim(), urgency: 'routine' }]);
    setRefSpecialty('');
    setRefReason('');
    markDirty();
  };

  const templateId = searchParams.get('templateId');

  const applyTemplate = useCallback((template: ClinicalTemplate) => {
    const setIf = (field: string, value: any) => {
      if (value === undefined || value === null || value === '') return;
      form.setFieldsValue({ [field]: value });
    };

    if (template.encounterType) setIf('type', template.encounterType);
    if (template.visitReason) setIf('visitReason', template.visitReason);
    if (template.chiefComplaint) setIf('chiefComplaint', template.chiefComplaint);

    const soap = template.soapTemplate || {};
    setIf('subjective', soap.subjective);
    setIf('objective', soap.objective);
    setIf('assessment', soap.assessment);
    setIf('plan', soap.plan);

    const vitals = template.vitalsTemplate || {};
    setIf('bloodPressure', vitals.bloodPressure);
    setIf('heartRate', vitals.heartRate);
    setIf('temperature', vitals.temperature);
    setIf('temperatureRoute', vitals.temperatureRoute);
    setIf('weight', vitals.weight);
    setIf('weightUnit', vitals.weightUnit);
    setIf('height', vitals.height);
    setIf('heightUnit', vitals.heightUnit);
    setIf('bmi', vitals.bmi);
    setIf('oxygenSaturation', vitals.oxygenSaturation);
    setIf('respiratoryRate', vitals.respiratoryRate);
    setIf('painScore', vitals.painScore);
    setIf('painLocation', vitals.painLocation);
    setIf('bloodGlucose', vitals.bloodGlucose);
    setIf('bloodGlucoseContext', vitals.bloodGlucoseContext);

    const tp = template.treatmentPlanTemplate || {};
    setIf('followUp', tp.followUp);
    if (tp.followUpDate) setIf('followUpDate', dayjs(tp.followUpDate));
    setIf('followUpProviderName', tp.followUpProviderName);
    setIf('homeInstructions', tp.homeInstructions);
    setIf('restrictions', tp.restrictions);
    setIf('recallReminder', tp.recallReminder);
    if (tp.goals && tp.goals.length) setIf('goals', tp.goals.join('\n'));
    if (tp.interventions && tp.interventions.length) setIf('interventions', tp.interventions.join('\n'));

    if (template.diagnosisTemplate && template.diagnosisTemplate.length) {
      setDiagnoses(template.diagnosisTemplate.map((d) => ({ ...d })));
    }
    if (template.medicationTemplate && template.medicationTemplate.length) {
      setMedications(template.medicationTemplate.map((m) => ({ ...m, isNew: true })));
    }
    const orders = template.ordersTemplate || {};
    if (orders.labs && orders.labs.length) {
      setLabs(orders.labs.map((l) => ({ name: l.name, priority: l.priority || 'routine', notes: l.notes || '' })));
    }
    if (orders.imaging && orders.imaging.length) {
      setImagingOrders(orders.imaging.map((i) => ({ name: i.name, modality: i.modality || '', bodyPart: i.bodyPart || '', priority: i.priority || 'routine' })));
    }
    if (orders.referrals && orders.referrals.length) {
      setReferrals(orders.referrals.map((r) => ({ specialty: r.specialty, reason: r.reason, urgency: r.urgency || 'routine' })));
    }
    if (tp.procedures && tp.procedures.length) {
      setProcedures(tp.procedures.map((p) => ({ name: p.name, cptCode: p.cptCode || '', description: p.description, status: 'ordered' })));
    }

    markDirty();
  }, [form, setDiagnoses, setMedications, setLabs, setImagingOrders, setReferrals, setProcedures, markDirty]);

  useEffect(() => {
    if (templateId && patients.length > 0) {
      clinicalTemplateService
        .apply(templateId)
        .then(({ template }) => {
          applyTemplate(template);
          if (template.encounterType && form.getFieldValue('type') === 'office_visit') {
            form.setFieldsValue({ type: template.encounterType });
          }
          message.success(`Template "${template.name}" loaded. Select a patient and save the encounter.`);
        })
        .catch((err: unknown) => {
          const error = err as { response?: { data?: { message?: string } } };
          message.error(error?.response?.data?.message || 'Failed to load template');
        });
    }
  }, [templateId, patients.length, applyTemplate, form]);

  const buildPayload = (values: any, status: string): Partial<Encounter> => {
    const today = dayjs().toISOString();
    return {
      patientId: values.patientId,
      providerId: values.providerId,
      appointmentId: values.appointmentId || undefined,
      departmentId: values.departmentId || undefined,
      clinicalTemplateId: templateId || undefined,
      location: values.location || undefined,
      room: values.room || undefined,
      type: values.type || 'office_visit',
      status: status as any,
      priority: values.priority || undefined,
      visitCategory: values.visitCategory || undefined,
      visitReason: values.visitReason || undefined,
      chiefComplaint: values.chiefComplaint || undefined,
      arrivalTime: values.arrivalTime ? values.arrivalTime.toISOString() : undefined,
      startTime: values.startTime ? values.startTime.toISOString() : today,
      endTime: values.endTime ? values.endTime.toISOString() : undefined,
      durationMinutes: values.durationMinutes ?? undefined,
      soapNote: {
        subjective: values.subjective || undefined,
        objective: values.objective || undefined,
        assessment: values.assessment || undefined,
        plan: values.plan || undefined,
      },
      vitals: {
        bloodPressure: values.bloodPressure || undefined,
        heartRate: values.heartRate || undefined,
        temperature: values.temperature || undefined,
        temperatureRoute: values.temperatureRoute || undefined,
        weight: values.weight ? String(values.weight) : undefined,
        weightUnit: values.weightUnit || 'lbs',
        height: values.height ? String(values.height) : undefined,
        heightUnit: values.heightUnit || 'in',
        bmi: values.bmi ? String(values.bmi) : undefined,
        oxygenSaturation: values.oxygenSaturation || undefined,
        respiratoryRate: values.respiratoryRate || undefined,
        painScore: values.painScore !== undefined ? Number(values.painScore) : undefined,
        painLocation: values.painLocation || undefined,
        bloodGlucose: values.bloodGlucose || undefined,
        bloodGlucoseContext: values.bloodGlucoseContext || undefined,
        recordedDate: values.recordedDate ? values.recordedDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      },
      diagnoses,
      treatmentPlan: {
        medications,
        procedures: procedures.map((p) => ({
          name: p.name,
          cptCode: p.cptCode || undefined,
          description: p.description,
          status: p.status as any,
        })),
        followUp: values.followUp || undefined,
        followUpDate: values.followUpDate ? values.followUpDate.format('YYYY-MM-DD') : undefined,
        followUpProviderName: values.followUpProviderName || undefined,
        goals: values.goals ? values.goals.split('\n').filter(Boolean) : undefined,
        interventions: values.interventions ? values.interventions.split('\n').filter(Boolean) : undefined,
        homeInstructions: values.homeInstructions || undefined,
        restrictions: values.restrictions || undefined,
        recallReminder: values.recallReminder || undefined,
        referrals: referrals.map((r) => ({ ...r })),
      },
      allergies,
      orders: {
        labs: labs.map((l) => ({
          name: l.name,
          status: 'ordered' as const,
          priority: l.priority as 'routine' | 'stat' | 'asap',
          orderedDate: today,
          notes: l.notes || undefined,
        })),
        imaging: imagingOrders.map((i) => ({
          name: i.name,
          modality: i.modality || undefined,
          bodyPart: i.bodyPart || undefined,
          status: 'ordered' as const,
          priority: 'routine' as const,
          orderedDate: today,
        })),
        referrals: referrals.map((r) => ({
          specialty: r.specialty,
          reason: r.reason,
          urgency: (r.urgency || 'routine') as 'routine' | 'urgent' | 'emergent',
          status: 'pending' as const,
        })),
      },
      clinicalNotes: values.clinicalNotes || undefined,
      notes: values.notes || undefined,
    };
  };

  const handleAiAssist = async () => {
    const values = form.getFieldsValue();
    const transcript = [values.subjective, values.objective, values.assessment, values.plan]
      .filter(Boolean).join('\n\n');
    if (!transcript.trim()) {
      message.warning('Please enter some clinical notes first');
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiService.generateSoap({
        transcript,
        patientContext: {
          name: selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : undefined,
          chiefComplaint: values.chiefComplaint,
        },
      });
      const soap = res.data;
      form.setFieldsValue({
        subjective: soap.subjective,
        objective: soap.objective,
        assessment: soap.assessment,
        plan: soap.plan,
      });
      setIsDirty(true);
      message.success('AI-generated SOAP note applied');
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || 'AI Assist failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) {
      message.error('Please fill in all required fields before saving');
      return;
    }
    if (!values.patientId) {
      message.error('Patient is required');
      return;
    }
    setLoading(true);
    try {
      const encounter = await encounterService.create(buildPayload(values, 'scheduled'));
      setIsDirty(false);
      message.success('Draft saved successfully');
      navigate(`/clinical/${encounter.id}`);
    } catch {
      message.error('Failed to save draft. Please check all required fields.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) {
      message.error('Please fill in all required fields before completing');
      return;
    }
    if (!values.patientId) {
      message.error('Patient is required');
      return;
    }
    setCompleting(true);
    try {
      const encounter = await encounterService.create(buildPayload(values, 'in_progress'));
      await encounterService.transitionStatus(encounter.id, 'completed');
      setIsDirty(false);
      message.success('Encounter completed successfully');
      navigate(`/clinical/${encounter.id}`);
    } catch {
      message.error('Failed to complete encounter. Please check all required fields.');
    } finally {
      setCompleting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const patientAge = selectedPatient?.dateOfBirth
    ? dayjs().diff(dayjs(selectedPatient.dateOfBirth), 'year')
    : null;

  const hasCriticalAllergy = allergies.some(
    (a) => a.severity === 'severe' || a.severity === 'life_threatening',
  );

  const diagnosisColumns: ColumnsType<EncounterDiagnosis> = [
    {
      title: 'ICD-10',
      dataIndex: 'code',
      width: 110,
      render: (code, record) => (
        <Space>
          <Tag color={record.isPrimary ? 'red' : 'blue'}>{code}</Tag>
          {record.isPrimary && <Tag color="red">Primary</Tag>}
        </Space>
      ),
    },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 100,
      render: (t) => t && <Tag>{t.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (s) => s && <Tag color={s === 'active' ? 'green' : 'default'}>{s.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: '',
      width: 48,
      render: (_: unknown, __: EncounterDiagnosis, index: number) => (
        <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveDiagnosis(index)} />
      ),
    },
  ];

  const allergyColumns: ColumnsType<EncounterAllergy> = [
    { title: 'Allergen', dataIndex: 'allergen', ellipsis: true },
    { title: 'Reaction', dataIndex: 'reaction', ellipsis: true },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 130,
      render: (s) => <Tag color={severityColors[s]}>{s.replace(/_/g, ' ')}</Tag>,
    },
    { title: 'Type', dataIndex: 'type', width: 110, render: (t) => t && <Tag>{t}</Tag> },
    {
      title: '',
      width: 48,
      render: (_: unknown, __: EncounterAllergy, index: number) => (
        <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveAllergy(index)} />
      ),
    },
  ];

  return (
    <div style={{ margin: '0 auto', paddingBottom: 80 }}>
      {/* ─── Header ─── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clinical')}>
            Back
          </Button>
        </Col>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            New Encounter
          </Title>
        </Col>
        <Col>
          {isDirty && <Text type="secondary" style={{ fontSize: 12 }}>Unsaved changes</Text>}
        </Col>
      </Row>

      {hasCriticalAllergy && (
        <Alert
          type="error"
          icon={<WarningOutlined />}
          message="Critical Allergy Alert"
          description={`Patient has ${allergies.filter((a) => a.severity === 'severe' || a.severity === 'life_threatening').map((a) => a.allergen).join(', ')} allergy recorded.`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onValuesChange={markDirty}
        initialValues={{
          type: 'office_visit',
          weightUnit: 'lbs',
          heightUnit: 'in',
          startTime: dayjs(),
        }}
      >
        {/* ─── Section 1: Encounter Metadata + Patient Profile ─── */}
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Card
              title={<span style={sectionTitleStyle}><FileTextOutlined /> Encounter Information</span>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="patientId" label="Patient" rules={[{ required: true, message: 'Patient is required' }]}>
                    <Select
                      showSearch
                      placeholder="Search patient by name or MRN"
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                      }
                      options={patients.map((p) => ({
                        value: p.id,
                        label: `${p.firstName} ${p.lastName} · ${p.mrn}`,
                      }))}
                      onChange={handlePatientSelect}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="providerId" label="Attending Provider" rules={[{ required: true, message: 'Provider is required' }]}>
                    <Select placeholder="Select provider">
                      {PROVIDERS.map((p) => (
                        <Option key={p.id} value={p.id}>
                          {p.name} · {p.specialty}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={12} md={6}>
                  <Form.Item name="type" label="Encounter Type" rules={[{ required: true }]}>
                    <Select>
                      <Option value="office_visit">Office Visit</Option>
                      <Option value="telehealth">Telehealth</Option>
                      <Option value="hospital">Hospital</Option>
                      <Option value="emergency">Emergency</Option>
                      <Option value="home_health">Home Health</Option>
                      <Option value="nursing_facility">Nursing Facility</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="visitCategory" label="Visit Category">
                    <Select allowClear placeholder="Select">
                      <Option value="new_patient">New Patient</Option>
                      <Option value="established">Established Patient</Option>
                      <Option value="follow_up">Follow-up</Option>
                      <Option value="annual_wellness">Annual Wellness</Option>
                      <Option value="preventive">Preventive Care</Option>
                      <Option value="urgent_care">Urgent Care</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="priority" label="Priority">
                    <Select allowClear placeholder="Select priority">
                      <Option value="routine">Routine</Option>
                      <Option value="urgent">Urgent</Option>
                      <Option value="emergency">Emergency</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="departmentId" label="Department">
                    <Select allowClear placeholder="Select department">
                      {DEPARTMENTS.map((d) => (
                        <Option key={d.id} value={d.id}>{d.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={12} md={8}>
                  <Form.Item name="location" label="Location / Clinic">
                    <Input placeholder="e.g., Main Campus" />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item name="room" label="Room / Exam Room">
                    <Input placeholder="e.g., Room 4B" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="appointmentId" label="Appointment ID">
                    <Input placeholder="Linked appointment (optional)" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="visitReason" label="Visit Reason">
                    <TextArea rows={2} placeholder="Reason for this visit..." />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="chiefComplaint" label="Chief Complaint">
                    <TextArea rows={2} placeholder="Chief complaint in patient's own words..." />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '8px 0 16px' }} />

              <Row gutter={16}>
                <Col xs={12} md={6}>
                  <Form.Item name="arrivalTime" label="Arrival Time">
                    <DatePicker showTime format="MM/DD/YYYY HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="startTime" label="Start Time" rules={[{ required: true }]}>
                    <DatePicker showTime format="MM/DD/YYYY HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="endTime" label="End Time">
                    <DatePicker showTime format="MM/DD/YYYY HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="durationMinutes" label="Duration (min)">
                    <InputNumber min={0} max={480} style={{ width: '100%' }} placeholder="e.g. 30" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Patient Profile Card — inline next to metadata */}
          <Col xs={24} lg={8}>
            <Card
              size="small"
              title={<span style={sectionTitleStyle}><UserOutlined /> Patient Profile</span>}
              extra={
                selectedPatient && (
                  <Button type="link" size="small" onClick={() => navigate(`/patients/${selectedPatient.id}`)}>
                    View Full
                  </Button>
                )
              }
              style={{ marginBottom: 16 }}
            >
              {selectedPatient ? (
                <>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Name">
                      <Text strong>
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="MRN">{selectedPatient.mrn}</Descriptions.Item>
                    {patientAge !== null && (
                      <Descriptions.Item label="Age / DOB">
                        {patientAge} y/o · {dayjs(selectedPatient.dateOfBirth).format('MM/DD/YYYY')}
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Gender">{selectedPatient.gender}</Descriptions.Item>
                    {selectedPatient.bloodType && (
                      <Descriptions.Item label="Blood Type">{selectedPatient.bloodType}</Descriptions.Item>
                    )}
                    {selectedPatient.phone && (
                      <Descriptions.Item label="Phone">{selectedPatient.phone}</Descriptions.Item>
                    )}
                  </Descriptions>

                  {patientInsurances.length > 0 && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>INSURANCE</Text>
                      <div style={{ marginTop: 4 }}>
                        {patientInsurances
                          .filter((ins) => ins.status === 'active')
                          .slice(0, 2)
                          .map((ins) => (
                            <div key={ins.id} style={{ marginBottom: 4 }}>
                              <Tag color={ins.priority === 'primary' ? 'blue' : 'default'}>
                                {ins.priority.toUpperCase()}
                              </Tag>
                              <Text style={{ fontSize: 12 }}>
                                {ins.payer?.name || 'Unknown Payer'}
                                {ins.policyNumber ? ` · #${ins.policyNumber}` : ''}
                              </Text>
                            </div>
                          ))}
                      </div>
                    </>
                  )}

                  {allergies.length > 0 && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>ALLERGIES</Text>
                      <div style={{ marginTop: 4 }}>
                        {allergies.map((a, i) => (
                          <Tag key={i} color={severityColors[a.severity]} style={{ marginBottom: 4 }}>
                            {a.allergen}
                          </Tag>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <Text type="secondary">Select a patient to view their profile summary.</Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* ─── Section 2: Vitals Grid ─── */}
        <VitalsFormSection titleStyle={sectionTitleStyle} onWeightHeightChange={markDirty} />

        {/* ─── Section 3: SOAP Notes ─── */}
        <Card
          title={<span style={sectionTitleStyle}><FileTextOutlined /> SOAP Notes</span>}
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Tooltip title="AI will analyze current notes and generate structured SOAP">
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleAiAssist}
                loading={aiLoading}
                style={{ borderColor: '#722ed1', color: '#722ed1' }}
                size="small"
              >
                AI Assist
              </Button>
            </Tooltip>
          }
        >
          <Form.Item name="subjective" label="Subjective (S) — Patient History & Complaints">
            <TextArea rows={4} placeholder="History of present illness, review of systems, patient's subjective complaints..." showCount />
          </Form.Item>
          <Form.Item name="objective" label="Objective (O) — Physical Examination Findings">
            <TextArea rows={4} placeholder="Vital signs, physical exam findings, diagnostic results, observations..." showCount />
          </Form.Item>
          <Form.Item name="assessment" label="Assessment (A) — Clinical Impression & Diagnoses">
            <TextArea rows={4} placeholder="Clinical diagnoses, differential diagnoses, clinical reasoning..." showCount />
          </Form.Item>
          <Form.Item name="plan" label="Plan (P) — Treatment Plan">
            <TextArea rows={4} placeholder="Medications prescribed, procedures, referrals, patient education, follow-up..." showCount />
          </Form.Item>
        </Card>

        {/* ─── Section 4a: Diagnoses (ICD-10) ─── */}
        <Card
          title={<span style={sectionTitleStyle}><ExperimentOutlined /> Diagnoses (ICD-10)</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={8} style={{ marginBottom: 12 }}>
            <Col xs={24} md={4}>
              <Input
                placeholder="ICD-10 Code (e.g. J06.9)"
                value={diagCode}
                onChange={(e) => setDiagCode(e.target.value.toUpperCase())}
                onPressEnter={handleAddDiagnosis}
                style={{ textTransform: 'uppercase' }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Input
                placeholder="Description"
                value={diagDesc}
                onChange={(e) => setDiagDesc(e.target.value)}
                onPressEnter={handleAddDiagnosis}
              />
            </Col>
            <Col xs={12} md={3}>
              <Select value={diagType} onChange={setDiagType} style={{ width: '100%' }}>
                <Option value="acute">Acute</Option>
                <Option value="chronic">Chronic</Option>
                <Option value="rule_out">Rule Out</Option>
              </Select>
            </Col>
            <Col xs={12} md={3}>
              <Select value={diagStatus} onChange={setDiagStatus} style={{ width: '100%' }}>
                <Option value="active">Active</Option>
                <Option value="resolved">Resolved</Option>
                <Option value="ruled_out">Ruled Out</Option>
              </Select>
            </Col>
            <Col xs={12} md={3}>
              <Select
                value={diagIsPrimary ? 'true' : 'false'}
                onChange={(v) => setDiagIsPrimary(v === 'true')}
                style={{ width: '100%' }}
              >
                <Option value="false">Secondary</Option>
                <Option value="true">Primary</Option>
              </Select>
            </Col>
            <Col xs={24} md={3}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDiagnosis} block>
                Add
              </Button>
            </Col>
          </Row>
          <Table
            columns={diagnosisColumns}
            dataSource={diagnoses}
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={false}
            locale={{ emptyText: 'No diagnoses added yet' }}
          />
        </Card>

        {/* ─── Section 4b: Procedures ─── */}
        <Card
          title={<span style={sectionTitleStyle}><ExperimentOutlined /> Procedures</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={8} style={{ marginBottom: 8 }}>
            <Col xs={24} md={6}>
              <Input placeholder="Procedure name" value={procName} onChange={(e) => setProcName(e.target.value)} />
            </Col>
            <Col xs={12} md={4}>
              <Input
                placeholder="CPT Code"
                value={procCpt}
                onChange={(e) => setProcCpt(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
              />
            </Col>
            <Col xs={24} md={10}>
              <Input placeholder="Description" value={procDesc} onChange={(e) => setProcDesc(e.target.value)} />
            </Col>
            <Col xs={24} md={4}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddProcedure} block>
                Add Procedure
              </Button>
            </Col>
          </Row>
          {procedures.length > 0 && (
            <Table
              size="small"
              pagination={false}
              rowKey={(_, i) => String(i)}
              dataSource={procedures}
              columns={[
                { title: 'CPT', dataIndex: 'cptCode', width: 90, render: (c) => c && <Tag color="blue">{c}</Tag> },
                { title: 'Procedure', dataIndex: 'name', ellipsis: true },
                { title: 'Description', dataIndex: 'description', ellipsis: true },
                {
                  title: '',
                  width: 48,
                  render: (_: unknown, __: any, index: number) => (
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveProcedure(index)} />
                  ),
                },
              ]}
            />
          )}
        </Card>

        {/* ─── Section 4c: Medications ─── */}
        <Card
          title={<span style={sectionTitleStyle}><MedicineBoxOutlined /> Prescribed Medications</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {medications.map((med, index) => (
            <Card
              key={index}
              size="small"
              style={{ marginBottom: 8 }}
              extra={
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  onClick={() => handleRemoveMedication(index)}
                />
              }
              title={`Medication ${index + 1}${med.isNew ? ' (New Rx)' : ''}`}
            >
              <Row gutter={8}>
                <Col xs={24} md={8}>
                  <Form.Item label="Drug Name" style={{ marginBottom: 8 }}>
                    <Input
                      placeholder="e.g., Amoxicillin"
                      value={med.name}
                      onChange={(e) => handleUpdateMedication(index, 'name', e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="Dosage" style={{ marginBottom: 8 }}>
                    <Input
                      placeholder="e.g., 500mg"
                      value={med.dosage}
                      onChange={(e) => handleUpdateMedication(index, 'dosage', e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="Frequency" style={{ marginBottom: 8 }}>
                    <Select
                      value={med.frequency}
                      onChange={(v) => handleUpdateMedication(index, 'frequency', v)}
                      placeholder="Select"
                    >
                      <Option value="once_daily">Once Daily</Option>
                      <Option value="twice_daily">Twice Daily (BID)</Option>
                      <Option value="three_times_daily">Three Times Daily (TID)</Option>
                      <Option value="four_times_daily">Four Times Daily (QID)</Option>
                      <Option value="every_4_hours">Every 4 Hours</Option>
                      <Option value="every_6_hours">Every 6 Hours</Option>
                      <Option value="every_8_hours">Every 8 Hours</Option>
                      <Option value="as_needed">As Needed (PRN)</Option>
                      <Option value="weekly">Weekly</Option>
                      <Option value="monthly">Monthly</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="Route" style={{ marginBottom: 8 }}>
                    <Select
                      value={med.route}
                      onChange={(v) => handleUpdateMedication(index, 'route', v)}
                      placeholder="Route"
                      allowClear
                    >
                      <Option value="oral">Oral (PO)</Option>
                      <Option value="sublingual">Sublingual (SL)</Option>
                      <Option value="topical">Topical</Option>
                      <Option value="iv">IV</Option>
                      <Option value="im">IM</Option>
                      <Option value="subcutaneous">Subcutaneous (SQ)</Option>
                      <Option value="inhaled">Inhaled</Option>
                      <Option value="nasal">Nasal</Option>
                      <Option value="ophthalmic">Ophthalmic</Option>
                      <Option value="rectal">Rectal</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="Duration" style={{ marginBottom: 8 }}>
                    <Input
                      placeholder="e.g., 10 days"
                      value={med.duration}
                      onChange={(e) => handleUpdateMedication(index, 'duration', e.target.value)}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col xs={12} md={4}>
                  <Form.Item label="Refills" style={{ marginBottom: 4 }}>
                    <InputNumber
                      min={0}
                      max={12}
                      value={med.refills}
                      onChange={(v) => handleUpdateMedication(index, 'refills', v || 0)}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={20}>
                  <Form.Item label="Instructions / Sig" style={{ marginBottom: 4 }}>
                    <Input
                      placeholder="e.g., Take with food, avoid alcohol"
                      value={med.instructions}
                      onChange={(e) => handleUpdateMedication(index, 'instructions', e.target.value)}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddMedication}
            block
          >
            Add Medication / Prescription
          </Button>
        </Card>

        {/* ─── Section 4d: Allergies ─── */}
        <Card
          title={<span style={sectionTitleStyle}><WarningOutlined /> Allergies</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={8} style={{ marginBottom: 12 }}>
            <Col xs={24} md={5}>
              <Input
                placeholder="Allergen (e.g., Penicillin)"
                value={allergenName}
                onChange={(e) => setAllergenName(e.target.value)}
                onPressEnter={handleAddAllergy}
              />
            </Col>
            <Col xs={24} md={5}>
              <Input
                placeholder="Reaction (e.g., Hives)"
                value={allergenReaction}
                onChange={(e) => setAllergenReaction(e.target.value)}
                onPressEnter={handleAddAllergy}
              />
            </Col>
            <Col xs={12} md={4}>
              <Select value={allergenSeverity} onChange={setAllergenSeverity} style={{ width: '100%' }}>
                <Option value="mild">Mild</Option>
                <Option value="moderate">Moderate</Option>
                <Option value="severe">Severe</Option>
                <Option value="life_threatening">Life Threatening</Option>
              </Select>
            </Col>
            <Col xs={12} md={4}>
              <Select value={allergenType} onChange={setAllergenType} style={{ width: '100%' }}>
                <Option value="drug">Drug</Option>
                <Option value="food">Food</Option>
                <Option value="environmental">Environmental</Option>
                <Option value="other">Other</Option>
              </Select>
            </Col>
            <Col xs={24} md={4}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAllergy} block>
                Add
              </Button>
            </Col>
          </Row>
          <Table
            columns={allergyColumns}
            dataSource={allergies}
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={false}
            locale={{ emptyText: 'No allergies recorded' }}
          />
          {allergies.length === 0 && (
            <Button
              type="link"
              size="small"
              style={{ marginTop: 8 }}
              onClick={() => {
                setAllergies([{ allergen: 'NKDA', reaction: 'No known drug allergies', severity: 'mild', type: 'drug' }]);
                markDirty();
              }}
            >
              + Mark as NKDA (No Known Drug Allergies)
            </Button>
          )}
        </Card>

        {/* ─── Section 4e: Orders (Labs, Imaging, Referrals) ─── */}
        <Card
          title={<span style={sectionTitleStyle}><ExperimentOutlined /> Orders</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Divider orientation="left" style={{ fontSize: 13 }}>Laboratory Orders</Divider>
          <Row gutter={8} style={{ marginBottom: 8 }}>
            <Col xs={24} md={10}>
              <Input
                placeholder="Lab name (e.g., CBC with differential)"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                onPressEnter={handleAddLab}
              />
            </Col>
            <Col xs={12} md={4}>
              <Select value={labPriority} onChange={setLabPriority} style={{ width: '100%' }}>
                <Option value="routine">Routine</Option>
                <Option value="stat">STAT</Option>
                <Option value="asap">ASAP</Option>
              </Select>
            </Col>
            <Col xs={12} md={4}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddLab} block>
                Add Lab
              </Button>
            </Col>
          </Row>
          {labs.map((l, i) => (
            <Tag
              key={i}
              closable
              onClose={() => setLabs(labs.filter((_, idx) => idx !== i))}
              color={l.priority === 'stat' ? 'red' : l.priority === 'asap' ? 'orange' : 'blue'}
              style={{ marginBottom: 6 }}
            >
              {l.name} ({l.priority.toUpperCase()})
            </Tag>
          ))}

          <Divider orientation="left" style={{ fontSize: 13 }}>Imaging Orders</Divider>
          <Row gutter={8} style={{ marginBottom: 8 }}>
            <Col xs={24} md={6}>
              <Input
                placeholder="Study name (e.g., Chest X-ray)"
                value={imagingName}
                onChange={(e) => setImagingName(e.target.value)}
              />
            </Col>
            <Col xs={12} md={4}>
              <Select value={imagingModality} onChange={setImagingModality} style={{ width: '100%' }} placeholder="Modality">
                <Option value="xray">X-Ray</Option>
                <Option value="ct">CT</Option>
                <Option value="mri">MRI</Option>
                <Option value="ultrasound">Ultrasound</Option>
                <Option value="pet">PET</Option>
                <Option value="nuclear">Nuclear</Option>
                <Option value="echo">Echocardiogram</Option>
              </Select>
            </Col>
            <Col xs={12} md={4}>
              <Input
                placeholder="Body part"
                value={imagingBodyPart}
                onChange={(e) => setImagingBodyPart(e.target.value)}
              />
            </Col>
            <Col xs={24} md={4}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddImaging} block>
                Add
              </Button>
            </Col>
          </Row>
          {imagingOrders.map((img, i) => (
            <Tag
              key={i}
              closable
              onClose={() => setImagingOrders(imagingOrders.filter((_, idx) => idx !== i))}
              color="geekblue"
              style={{ marginBottom: 6 }}
            >
              {img.name}
              {img.modality ? ` · ${img.modality.toUpperCase()}` : ''}
              {img.bodyPart ? ` · ${img.bodyPart}` : ''}
            </Tag>
          ))}

          <Divider orientation="left" style={{ fontSize: 13 }}>Referrals</Divider>
          <Row gutter={8} style={{ marginBottom: 8 }}>
            <Col xs={24} md={6}>
              <Input
                placeholder="Specialty (e.g., Cardiology)"
                value={refSpecialty}
                onChange={(e) => setRefSpecialty(e.target.value)}
              />
            </Col>
            <Col xs={24} md={10}>
              <Input
                placeholder="Referral reason"
                value={refReason}
                onChange={(e) => setRefReason(e.target.value)}
              />
            </Col>
            <Col xs={24} md={4}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddReferral} block>
                Add
              </Button>
            </Col>
          </Row>
          {referrals.map((r, i) => (
            <Tag
              key={i}
              closable
              onClose={() => setReferrals(referrals.filter((_, idx) => idx !== i))}
              color="purple"
              style={{ marginBottom: 6 }}
            >
              {r.specialty}: {r.reason}
            </Tag>
          ))}
        </Card>

        {/* ─── Section 5: Treatment Plan ─── */}
        <Card
          title={<span style={sectionTitleStyle}><FileTextOutlined /> Treatment Plan</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="followUp" label="Follow-up Instructions">
                <TextArea rows={2} placeholder="Return in 2 weeks if symptoms persist..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="followUpDate" label="Follow-up Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="followUpProviderName" label="Follow-up Provider">
                <Input placeholder="Provider name or specialty" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="homeInstructions" label="Home Care Instructions">
                <TextArea rows={3} placeholder="Patient home care instructions..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="restrictions" label="Activity / Dietary Restrictions">
                <TextArea rows={3} placeholder="e.g., No strenuous activity for 2 weeks, low-sodium diet..." />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="goals" label="Treatment Goals (one per line)">
                <TextArea rows={3} placeholder="e.g., Reduce blood pressure to < 130/80..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="interventions" label="Interventions (one per line)">
                <TextArea rows={3} placeholder="e.g., Start antihypertensive therapy..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="recallReminder" label="Recall Reminder">
            <Input placeholder="e.g., Annual physical due in 12 months" />
          </Form.Item>
        </Card>

        {/* ─── Section 6: Clinical Notes ─── */}
        <Card
          title={<span style={sectionTitleStyle}><FileTextOutlined /> Clinical Notes</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="clinicalNotes" label="Clinical Notes (internal)">
            <TextArea
              rows={4}
              placeholder="Additional clinical observations, notes for the care team..."
              showCount
            />
          </Form.Item>
          <Form.Item name="notes" label="General Notes">
            <TextArea rows={3} placeholder="Administrative or general notes..." showCount />
          </Form.Item>
        </Card>
      </Form>

      {/* ─── Sticky Footer Action Bar ─── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          padding: '12px 24px',
          zIndex: 1000,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {isDirty && <Text type="warning" style={{ fontSize: 12 }}>● Unsaved changes</Text>}
          </Space>
          <Space size="middle">
            <Button icon={<CloseOutlined />} onClick={() => navigate('/clinical')}>
              Cancel
            </Button>
            <Tooltip title="Print form">
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                Print
              </Button>
            </Tooltip>
            <Button
              icon={<SaveOutlined />}
              loading={loading}
              onClick={handleSaveDraft}
            >
              Save Draft
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={completing}
              onClick={handleComplete}
              size="large"
            >
              Complete Encounter
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default NewEncounterPage;
