import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Alert,
  Divider,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Table,
  Descriptions,
  message,
  Tooltip,
  Timeline,
  Upload,
  Empty,
  Avatar,
  Progress,
  Statistic,
  Dropdown,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  EditOutlined,
  UserOutlined,
  WarningOutlined,
  PrinterOutlined,
  FileDoneOutlined,
  ExportOutlined,
  HistoryOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  HeartOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  PlusOutlined,
  CloseOutlined,
  PhoneOutlined,
  AlertOutlined,
  FileProtectOutlined,
  CheckOutlined,
  EllipsisOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
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
import IcdSearchInput from '../../components/icd/IcdSearchInput';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const statusColors: Record<string, string> = {
  scheduled: 'blue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'default',
  no_show: 'red',
};

const severityColors: Record<string, string> = {
  mild: 'green',
  moderate: 'orange',
  severe: 'red',
  life_threatening: 'purple',
};

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

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 0,
};

const EncounterDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [patient, setPatient] = useState<any | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [diagnoses, setDiagnoses] = useState<EncounterDiagnosis[]>([]);
  const [diagCode, setDiagCode] = useState('');
  const [diagDesc, setDiagDesc] = useState('');
  const [diagCodeSystem, setDiagCodeSystem] = useState<EncounterDiagnosis['codeSystem']>('ICD-10-CM');
  const [diagProblemListId, setDiagProblemListId] = useState<string | undefined>();
  const [diagIsPrimary, setDiagIsPrimary] = useState(false);
  const [diagType, setDiagType] = useState<'chronic' | 'acute' | 'rule_out'>('acute');
  const [diagStatus, setDiagStatus] = useState<'active' | 'resolved' | 'ruled_out' | 'inactive'>('active');
  const [diagIsBillable, setDiagIsBillable] = useState(false);

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

  const [labs, setLabs] = useState<Array<{ name: string; priority: string; status: string; notes?: string }>>([]);
  const [labName, setLabName] = useState('');
  const [labPriority, setLabPriority] = useState('routine');
  const [imagingOrders, setImagingOrders] = useState<Array<{ name: string; modality?: string; bodyPart?: string; status: string }>>([]);
  const [imagingName, setImagingName] = useState('');
  const [imagingModality, setImagingModality] = useState('');
  const [imagingBodyPart, setImagingBodyPart] = useState('');
  const [referrals, setReferrals] = useState<Array<{ specialty: string; reason: string; urgency: string; status: string }>>([]);
  const [refSpecialty, setRefSpecialty] = useState('');
  const [refReason, setRefReason] = useState('');

  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; size?: string; uploadedAt?: string }>>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (id) fetchEncounter(id);
  }, [id]);

  const fetchEncounter = async (encounterId: string) => {
    setLoading(true);
    try {
      const data = await encounterService.findOne(encounterId);
      setEncounter(data);
      populateForm(data);
      if (data.patientId) {
        try {
          const patientData = await patientService.findOne(data.patientId);
          setPatient(patientData);
        } catch {
          // patient load is non-blocking
        }
        try {
          const ins = await billingService.findPatientInsurances(data.patientId);
          setPatientInsurances(ins || []);
        } catch {
          setPatientInsurances([]);
        }
      }
    } catch {
      message.error('Failed to load encounter');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: Encounter) => {
    form.setFieldsValue({
      type: data.type,
      visitCategory: data.visitCategory,
      priority: data.priority,
      departmentId: data.departmentId,
      location: data.location,
      room: data.room,
      visitReason: data.visitReason,
      chiefComplaint: data.chiefComplaint,
      arrivalTime: data.arrivalTime ? dayjs(data.arrivalTime) : undefined,
      startTime: data.startTime ? dayjs(data.startTime) : undefined,
      endTime: data.endTime ? dayjs(data.endTime) : undefined,
      durationMinutes: data.durationMinutes,
      subjective: data.soapNote?.subjective,
      objective: data.soapNote?.objective,
      assessment: data.soapNote?.assessment,
      plan: data.soapNote?.plan,
      bloodPressure: data.vitals?.bloodPressure,
      heartRate: data.vitals?.heartRate,
      temperature: data.vitals?.temperature,
      temperatureRoute: data.vitals?.temperatureRoute,
      weight: data.vitals?.weight,
      weightUnit: data.vitals?.weightUnit || 'lbs',
      height: data.vitals?.height,
      heightUnit: data.vitals?.heightUnit || 'in',
      bmi: data.vitals?.bmi,
      oxygenSaturation: data.vitals?.oxygenSaturation,
      respiratoryRate: data.vitals?.respiratoryRate,
      painScore: data.vitals?.painScore,
      painLocation: data.vitals?.painLocation,
      bloodGlucose: data.vitals?.bloodGlucose,
      bloodGlucoseContext: data.vitals?.bloodGlucoseContext,
      headCircumference: data.vitals?.headCircumference,
      waistCircumference: data.vitals?.waistCircumference,
      recordedDate: data.vitals?.recordedDate ? dayjs(data.vitals.recordedDate) : undefined,
      followUp: data.treatmentPlan?.followUp,
      followUpDate: data.treatmentPlan?.followUpDate ? dayjs(data.treatmentPlan.followUpDate) : undefined,
      followUpProviderName: data.treatmentPlan?.followUpProviderName,
      homeInstructions: data.treatmentPlan?.homeInstructions,
      restrictions: data.treatmentPlan?.restrictions,
      goals: data.treatmentPlan?.goals?.join('\n'),
      interventions: data.treatmentPlan?.interventions?.join('\n'),
      recallReminder: data.treatmentPlan?.recallReminder,
      clinicalNotes: data.clinicalNotes,
      notes: data.notes,
    });

    setDiagnoses(data.diagnoses || []);
    setMedications(data.treatmentPlan?.medications || []);
    setProcedures(
      (data.treatmentPlan?.procedures || []).map((p) => ({
        name: p.name,
        cptCode: p.cptCode || '',
        description: p.description,
        status: p.status || 'ordered',
      })),
    );
    setAllergies(data.allergies || []);
    setLabs(
      (data.orders?.labs || []).map((l) => ({
        name: l.name,
        priority: l.priority || 'routine',
        status: l.status,
        notes: l.notes,
      })),
    );
    setImagingOrders(
      (data.orders?.imaging || []).map((i) => ({
        name: i.name,
        modality: i.modality,
        bodyPart: i.bodyPart,
        status: i.status,
      })),
    );
    setReferrals(
      (data.orders?.referrals || []).map((r) => ({
        specialty: r.specialty,
        reason: r.reason,
        urgency: r.urgency || 'routine',
        status: r.status,
      })),
    );
    setAttachments((data.attachments || []) as any);
  };

  const markDirty = useCallback(() => {
    setIsDirty(true);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      handleSave(true);
    }, 30000);
  }, []);

  const buildPayload = (values: any): Partial<Encounter> => ({
    type: values.type,
    visitCategory: values.visitCategory,
    priority: values.priority,
    departmentId: values.departmentId,
    location: values.location,
    room: values.room,
    visitReason: values.visitReason,
    chiefComplaint: values.chiefComplaint,
    arrivalTime: values.arrivalTime ? values.arrivalTime.toISOString() : undefined,
    startTime: values.startTime ? values.startTime.toISOString() : undefined,
    endTime: values.endTime ? values.endTime.toISOString() : undefined,
    durationMinutes: values.durationMinutes,
    soapNote: {
      subjective: values.subjective,
      objective: values.objective,
      assessment: values.assessment,
      plan: values.plan,
    },
    vitals: {
      bloodPressure: values.bloodPressure,
      heartRate: values.heartRate,
      temperature: values.temperature,
      temperatureRoute: values.temperatureRoute,
      weight: values.weight ? String(values.weight) : undefined,
      weightUnit: values.weightUnit,
      height: values.height ? String(values.height) : undefined,
      heightUnit: values.heightUnit,
      bmi: values.bmi ? String(values.bmi) : undefined,
      oxygenSaturation: values.oxygenSaturation,
      respiratoryRate: values.respiratoryRate,
      painScore: values.painScore !== undefined ? Number(values.painScore) : undefined,
      painLocation: values.painLocation,
      bloodGlucose: values.bloodGlucose,
      bloodGlucoseContext: values.bloodGlucoseContext,
      headCircumference: values.headCircumference,
      waistCircumference: values.waistCircumference,
      recordedDate: values.recordedDate ? values.recordedDate.format('YYYY-MM-DD') : undefined,
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
      followUp: values.followUp,
      followUpDate: values.followUpDate ? values.followUpDate.format('YYYY-MM-DD') : undefined,
      followUpProviderName: values.followUpProviderName,
      goals: values.goals ? values.goals.split('\n').filter(Boolean) : undefined,
      interventions: values.interventions ? values.interventions.split('\n').filter(Boolean) : undefined,
      homeInstructions: values.homeInstructions,
      restrictions: values.restrictions,
      recallReminder: values.recallReminder,
    },
    allergies,
    orders: {
      labs: labs.map((l) => ({
        name: l.name,
        status: l.status as any,
        priority: (l.priority || 'routine') as any,
        orderedDate: dayjs().toISOString(),
        notes: l.notes,
      })),
      imaging: imagingOrders.map((i) => ({
        name: i.name,
        modality: i.modality,
        bodyPart: i.bodyPart,
        status: i.status as any,
        orderedDate: dayjs().toISOString(),
      })),
      referrals: referrals.map((r) => ({
        specialty: r.specialty,
        reason: r.reason,
        urgency: (r.urgency || 'routine') as any,
        status: r.status as any,
      })),
    },
    clinicalNotes: values.clinicalNotes,
    notes: values.notes,
    attachments: attachments as any,
  });

  const handleSave = async (silent = false) => {
    if (!encounter) return;
    if (encounter.isLocked) {
      if (!silent) message.warning('Encounter is locked. Reopen it to make changes.');
      return;
    }
    if (!silent) setSaving(true);
    try {
      const values = await form.validateFields();
      const updated = await encounterService.update(encounter.id, buildPayload(values));
      setEncounter(updated);
      setIsDirty(false);
      if (!silent) message.success('Encounter saved');
    } catch {
      if (!silent) message.error('Failed to save encounter');
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleTransition = async (status: string) => {
    if (!encounter) return;
    setTransitioning(true);
    try {
      await handleSave(true);
      const updated = await encounterService.transitionStatus(encounter.id, status);
      setEncounter(updated);
      populateForm(updated);
      message.success(`Encounter status updated to ${status.replace(/_/g, ' ')}`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setTransitioning(false);
    }
  };

  const handleSign = async () => {
    if (!encounter) return;
    Modal.confirm({
      title: 'Sign Encounter',
      content: 'By signing, you attest that the clinical documentation in this encounter is accurate and complete.',
      okText: 'Sign Encounter',
      onOk: async () => {
        try {
          const updated = await encounterService.sign(encounter.id);
          setEncounter(updated);
          message.success('Encounter signed');
        } catch (err: any) {
          message.error(err?.response?.data?.message || 'Failed to sign encounter');
        }
      },
    });
  };

  const handleLock = async () => {
    if (!encounter) return;
    Modal.confirm({
      title: 'Lock Encounter',
      content: 'Locking the encounter will prevent further edits. You can reopen it later if needed.',
      okText: 'Lock Encounter',
      onOk: async () => {
        try {
          const updated = await encounterService.lock(encounter.id);
          setEncounter(updated);
          message.success('Encounter locked');
        } catch (err: any) {
          message.error(err?.response?.data?.message || 'Failed to lock encounter');
        }
      },
    });
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
          name: patient ? `${patient.firstName} ${patient.lastName}` : undefined,
          chiefComplaint: encounter?.chiefComplaint || values.chiefComplaint,
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

  const handleReopen = async () => {
    if (!encounter) return;
    let reason = '';
    Modal.confirm({
      title: 'Reopen Encounter',
      content: (
        <div>
          <p>Please provide a reason for reopening this locked encounter:</p>
          <Input
            placeholder="Reason for amendment"
            onChange={(e) => {
              reason = e.target.value;
            }}
          />
        </div>
      ),
      okText: 'Reopen',
      onOk: async () => {
        if (!reason.trim()) {
          message.warning('A reason is required to reopen a locked encounter.');
          return;
        }
        try {
          const updated = await encounterService.reopen(encounter.id, reason);
          setEncounter(updated);
          message.success('Encounter reopened for amendment');
        } catch (err: any) {
          message.error(err?.response?.data?.message || 'Failed to reopen encounter');
        }
      },
    });
  };

  const handleDelete = () => {
    if (!encounter) return;
    Modal.confirm({
      title: 'Delete Encounter',
      content: 'This action cannot be undone. Are you sure you want to delete this encounter?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await encounterService.delete(encounter.id);
          message.success('Encounter deleted');
          navigate('/clinical');
        } catch {
          message.error('Failed to delete encounter');
        }
      },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddDiagnosis = () => {
    if (!diagCode.trim() || !diagDesc.trim()) {
      message.warning('Diagnosis code and description are required');
      return;
    }
    if (diagIsPrimary && diagnoses.some((d) => d.isPrimary)) {
      message.warning('A primary diagnosis already exists. Unmark the current primary first.');
      return;
    }
    setDiagnoses([
      ...diagnoses,
      {
        problemListId: diagProblemListId,
        code: diagCode.trim().toUpperCase(),
        codeSystem: diagCodeSystem,
        description: diagDesc.trim(),
        isPrimary: diagIsPrimary,
        type: diagType,
        status: diagStatus,
        isBillable: diagIsBillable,
      },
    ]);
    setDiagCode('');
    setDiagDesc('');
    setDiagCodeSystem('ICD-10-CM');
    setDiagProblemListId(undefined);
    setDiagIsPrimary(false);
    setDiagType('acute');
    setDiagStatus('active');
    setDiagIsBillable(false);
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

  const handleExport = () => {
    if (!encounter) return;
    const blob = new Blob([JSON.stringify(encounter, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encounter-${encounter.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Encounter exported');
  };

  const handleAddAllergy = () => {
    if (!allergenName.trim()) {
      message.warning('Allergen name is required');
      return;
    }
    setAllergies([...allergies, { allergen: allergenName.trim(), reaction: allergenReaction, severity: allergenSeverity, type: allergenType }]);
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
    setLabs([...labs, { name: labName.trim(), priority: labPriority, status: 'ordered' }]);
    setLabName('');
    setLabPriority('routine');
    markDirty();
  };

  const handleAddImaging = () => {
    if (!imagingName.trim()) return;
    setImagingOrders([...imagingOrders, { name: imagingName.trim(), modality: imagingModality, bodyPart: imagingBodyPart, status: 'ordered' }]);
    setImagingName('');
    setImagingModality('');
    setImagingBodyPart('');
    markDirty();
  };

  const handleAddReferral = () => {
    if (!refSpecialty.trim() || !refReason.trim()) return;
    setReferrals([...referrals, { specialty: refSpecialty.trim(), reason: refReason.trim(), urgency: 'routine', status: 'pending' }]);
    setRefSpecialty('');
    setRefReason('');
    markDirty();
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
    markDirty();
  };

  const totalOrders = labs.length + imagingOrders.length + referrals.length;

  const providerName = useMemo(() => {
    if (!encounter) return 'Unassigned';
    const p = PROVIDERS.find((p) => p.id === encounter.providerId);
    return p ? p.name : 'Unassigned';
  }, [encounter]);

  const departmentName = useMemo(() => {
    if (!encounter) return '—';
    const d = DEPARTMENTS.find((d) => d.id === encounter.departmentId);
    return d ? d.name : '—';
  }, [encounter]);

  const primaryInsurance = patientInsurances.find((i) => i.priority === 'primary' && i.status === 'active') || patientInsurances.find((i) => i.status === 'active');

  const docProgress = useMemo(() => {
    const items = [
      { key: 'subjective', label: 'Subjective', filled: !!(encounter?.soapNote?.subjective?.trim()) },
      { key: 'objective', label: 'Objective', filled: !!(encounter?.soapNote?.objective?.trim()) },
      { key: 'assessment', label: 'Assessment', filled: !!(encounter?.soapNote?.assessment?.trim()) },
      { key: 'plan', label: 'Plan', filled: !!(encounter?.soapNote?.plan?.trim()) },
      { key: 'diagnosis', label: 'Diagnosis', filled: diagnoses.length > 0 },
      { key: 'orders', label: 'Orders', filled: totalOrders > 0 },
      { key: 'medications', label: 'Medications', filled: medications.length > 0 },
      { key: 'followup', label: 'Follow-up', filled: !!(encounter?.treatmentPlan?.followUp?.trim()) },
    ];
    const completed = items.filter((i) => i.filled).length;
    return { items, completed, total: items.length, percent: Math.round((completed / items.length) * 100) };
  }, [encounter, diagnoses, medications, totalOrders]);

  const isSigned = !!encounter?.signedAt;
  const isLocked = !!encounter?.isLocked;

  const workflowSteps = useMemo(() => {
    if (!encounter) return [];
    const statusOrder = ['scheduled', 'in_progress', 'completed'];
    const currentIdx = statusOrder.indexOf(encounter.status);

    const steps = [
      {
        key: 'planned',
        title: 'Planned',
        done: true,
        timestamp: encounter.createdAt,
        provider: providerName,
      },
      {
        key: 'checked_in',
        title: 'Checked In',
        done: !!encounter.arrivalTime || currentIdx >= 1,
        timestamp: encounter.arrivalTime,
        provider: providerName,
      },
      {
        key: 'in_progress',
        title: 'In Progress',
        done: encounter.status === 'in_progress' || currentIdx >= 2,
        timestamp: encounter.startTime,
        provider: providerName,
      },
      {
        key: 'documentation',
        title: 'Documentation',
        done: docProgress.percent === 100,
        timestamp: docProgress.percent === 100 ? encounter.updatedAt : undefined,
        provider: providerName,
      },
      {
        key: 'signed',
        title: 'Signed',
        done: isSigned,
        timestamp: encounter.signedAt,
        provider: encounter.signedBy || providerName,
      },
      {
        key: 'completed',
        title: 'Completed',
        done: encounter.status === 'completed' && isSigned,
        timestamp: encounter.endTime,
        provider: providerName,
      },
    ];
    return steps;
  }, [encounter, isSigned, providerName, docProgress.percent]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!encounter) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clinical')} style={{ marginBottom: 24 }}>
          Back to Encounters
        </Button>
        <Alert message="Encounter not found" type="error" />
      </div>
    );
  }

  const isCompleted = encounter.status === 'completed';
  const canEdit = !isLocked;
  const patientAge = patient?.dateOfBirth ? dayjs().diff(dayjs(patient.dateOfBirth), 'year') : null;
  const hasCriticalAllergy = allergies.some((a) => a.severity === 'severe' || a.severity === 'life_threatening');

  const diagnosisColumns: ColumnsType<EncounterDiagnosis> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 140,
      render: (code, record) => (
        <Space>
          <Tag color={record.isPrimary ? 'red' : 'blue'}>{code}</Tag>
          {record.isPrimary && <Tag color="red">Primary</Tag>}
          {record.problemListId && <Tag color="blue">Problem</Tag>}
        </Space>
      ),
    },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'System', dataIndex: 'codeSystem', width: 100, render: (s) => <Tag>{s || 'ICD-10-CM'}</Tag> },
    { title: 'Type', dataIndex: 'type', width: 100, render: (t) => t && <Tag>{t.replace(/_/g, ' ')}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 90, render: (s) => s && <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
    canEdit
      ? {
          title: '',
          width: 48,
          render: (_: unknown, __: EncounterDiagnosis, index: number) => (
            <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveDiagnosis(index)} />
          ),
        }
      : {},
  ].filter((c) => Object.keys(c).length > 0);

  const allergyColumns: ColumnsType<EncounterAllergy> = [
    { title: 'Allergen', dataIndex: 'allergen', ellipsis: true },
    { title: 'Reaction', dataIndex: 'reaction', ellipsis: true },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 140,
      render: (s) => <Tag color={severityColors[s]}>{s.replace(/_/g, ' ')}</Tag>,
    },
    { title: 'Type', dataIndex: 'type', width: 110, render: (t) => t && <Tag>{t}</Tag> },
    canEdit
      ? {
          title: '',
          width: 48,
          render: (_: unknown, __: EncounterAllergy, index: number) => (
            <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveAllergy(index)} />
          ),
        }
      : {},
  ].filter((c) => Object.keys(c).length > 0);

  const moreActionsMenu = {
    items: [
      { key: 'print', label: 'Print', icon: <PrinterOutlined />, onClick: handlePrint },
      { key: 'export', label: 'Export JSON', icon: <ExportOutlined />, onClick: handleExport },
      ...(isSigned && !isLocked ? [{ key: 'lock', label: 'Lock Encounter', icon: <LockOutlined />, onClick: handleLock }] : []),
      ...(isLocked ? [{ key: 'reopen', label: 'Reopen', icon: <UnlockOutlined />, onClick: handleReopen }] : []),
      { type: 'divider' as const },
      ...(encounter.status === 'scheduled' || encounter.status === 'cancelled'
        ? [{ key: 'delete', label: 'Delete Encounter', icon: <DeleteOutlined />, danger: true, onClick: handleDelete }]
        : []),
    ],
  };

  const encounterTypeLabel = encounter.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const priorityColor = encounter.priority === 'emergency' ? 'red' : encounter.priority === 'urgent' ? 'orange' : 'blue';

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* ─── Top Bar ─── */}
      <div style={{ marginBottom: 12 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clinical')}>Back</Button>
              <Text type="secondary" style={{ fontSize: 12 }}>Encounters / Detail</Text>
            </Space>
          </Col>
          <Col>
            <Space size="middle">
              {isDirty && <Text type="warning" style={{ fontSize: 12 }}>● Unsaved changes</Text>}
              {canEdit && (
                <Button icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(false)}>
                  Save Draft
                </Button>
              )}
              {isCompleted && !isSigned && (
                <Button type="primary" icon={<FileDoneOutlined />} onClick={handleSign}>
                  Sign & Complete
                </Button>
              )}
              {encounter.status === 'scheduled' && (
                <Button type="primary" icon={<EditOutlined />} onClick={() => handleTransition('in_progress')} loading={transitioning}>
                  Start Encounter
                </Button>
              )}
              {encounter.status === 'in_progress' && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleTransition('completed')} loading={transitioning}>
                  Complete
                </Button>
              )}
              <Dropdown menu={moreActionsMenu} placement="bottomRight">
                <Button icon={<EllipsisOutlined />}>More</Button>
              </Dropdown>
            </Space>
          </Col>
        </Row>
      </div>

      {/* ─── Clinical Header Card ─── */}
      <Card
        size="small"
        style={{ marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 16 }}
      >
        <Row gutter={16} align="top">
          {/* Patient Identity */}
          <Col xs={24} md={8}>
            <Space size="middle" align="start">
              <Avatar
                size={56}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#1890ff', flexShrink: 0 }}
              />
              <div>
                {patient ? (
                  <>
                    <div style={{ marginBottom: 2 }}>
                      <Text strong style={{ fontSize: 18 }}>{patient.firstName} {patient.lastName}</Text>
                    </div>
                    <Space size={4} wrap style={{ marginBottom: 4 }}>
                      {patient.mrn && <Text type="secondary" style={{ fontSize: 12 }}>MRN: {patient.mrn}</Text>}
                      {patientAge !== null && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          · {patientAge} y/o · {dayjs(patient.dateOfBirth).format('MM/DD/YYYY')}
                        </Text>
                      )}
                    </Space>
                    <Space size={4} wrap style={{ marginBottom: 4 }}>
                      <Tag style={{ fontSize: 11 }}>{patient.gender}</Tag>
                      {patient.bloodType && <Tag color="volcano" style={{ fontSize: 11 }}>Blood: {patient.bloodType}</Tag>}
                    </Space>
                    {patient.phone && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <PhoneOutlined /> {patient.phone}
                        </Text>
                      </div>
                    )}
                    {primaryInsurance && (
                      <div style={{ marginTop: 4 }}>
                        <Tag color="blue" style={{ fontSize: 10 }}>PRIMARY</Tag>
                        <Text style={{ fontSize: 11 }}>
                          {primaryInsurance.payer?.name || 'Unknown'}
                          {primaryInsurance.policyNumber ? ` · #${primaryInsurance.policyNumber}` : ''}
                        </Text>
                      </div>
                    )}
                  </>
                ) : (
                  <Text type="secondary">Loading patient...</Text>
                )}
              </div>
            </Space>
          </Col>

          {/* Encounter Summary */}
          <Col xs={24} md={10}>
            <div style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: 16, minHeight: 80 }}>
              <Space size={6} wrap style={{ marginBottom: 8 }}>
                <Tag color={statusColors[encounter.status]} style={{ fontSize: 12, fontWeight: 600 }}>
                  {encounter.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Tag>
                <Tag style={{ fontSize: 11 }}>{encounterTypeLabel}</Tag>
                {encounter.priority && <Tag color={priorityColor} style={{ fontSize: 11 }}>{encounter.priority.toUpperCase()}</Tag>}
                {isSigned && <Tag color="green" icon={<FileDoneOutlined />} style={{ fontSize: 11 }}>Signed</Tag>}
                {isLocked && <Tag color="orange" icon={<LockOutlined />} style={{ fontSize: 11 }}>Locked</Tag>}
              </Space>

              <Row gutter={[12, 4]}>
                <Col xs={12}><Text type="secondary" style={{ fontSize: 11 }}>Encounter ID</Text><div><Text style={{ fontSize: 12 }} copyable>{encounter.id.substring(0, 8)}…</Text></div></Col>
                <Col xs={12}><Text type="secondary" style={{ fontSize: 11 }}>Provider</Text><div><Text style={{ fontSize: 12 }}>{providerName}</Text></div></Col>
                <Col xs={12}><Text type="secondary" style={{ fontSize: 11 }}>Department</Text><div><Text style={{ fontSize: 12 }}>{departmentName}</Text></div></Col>
                <Col xs={12}><Text type="secondary" style={{ fontSize: 11 }}>Location / Room</Text><div><Text style={{ fontSize: 12 }}>{encounter.location || '—'}{encounter.room ? ` / ${encounter.room}` : ''}</Text></div></Col>
                <Col xs={12}><Text type="secondary" style={{ fontSize: 11 }}>Appointment</Text><div><Text style={{ fontSize: 12 }}>{dayjs(encounter.startTime).format('MM/DD/YYYY h:mm A')}</Text></div></Col>
                <Col xs={12}><Text type="secondary" style={{ fontSize: 11 }}>Check-in / Duration</Text><div><Text style={{ fontSize: 12 }}>{encounter.arrivalTime ? dayjs(encounter.arrivalTime).format('h:mm A') : '—'}{encounter.durationMinutes ? ` · ${encounter.durationMinutes}m` : ''}</Text></div></Col>
              </Row>

              {encounter.visitReason && (
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Reason: </Text>
                  <Text style={{ fontSize: 12 }}>{encounter.visitReason}</Text>
                </div>
              )}
            </div>
          </Col>

          {/* Quick Actions */}
          <Col xs={24} md={6}>
            <div style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: 16, minHeight: 80 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>QUICK ACTIONS</Text>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Button size="small" icon={<PrinterOutlined />} onClick={handlePrint} block style={{ textAlign: 'left' }}>Print</Button>
                <Button size="small" icon={<ExportOutlined />} onClick={handleExport} block style={{ textAlign: 'left' }}>Export PDF</Button>
                <Button size="small" icon={<UserOutlined />} onClick={() => patient && navigate(`/patients/${patient.id}`)} block style={{ textAlign: 'left' }}>View Patient</Button>
                {(encounter.status === 'scheduled' || encounter.status === 'cancelled') && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={handleDelete} block style={{ textAlign: 'left' }}>Delete</Button>
                )}
              </Space>
            </div>
          </Col>
        </Row>

        {/* Clinical Alert Badges */}
        {(hasCriticalAllergy || allergies.length > 0 || isLocked) && (
          <Divider style={{ margin: '12px 0 8px' }} />
        )}
        <Space size={6} wrap>
          {hasCriticalAllergy && (
            <Tag color="red" icon={<AlertOutlined />} style={{ fontSize: 11, fontWeight: 600 }}>
              CRITICAL ALLERGY: {allergies.filter((a) => a.severity === 'severe' || a.severity === 'life_threatening').map((a) => a.allergen).join(', ')}
            </Tag>
          )}
          {allergies.length > 0 && !hasCriticalAllergy && (
            <Tag color="orange" icon={<WarningOutlined />} style={{ fontSize: 11 }}>
              Allergies ({allergies.length}): {allergies.map((a) => a.allergen).join(', ')}
            </Tag>
          )}
          {isLocked && (
            <Tag color="orange" icon={<LockOutlined />} style={{ fontSize: 11 }}>LOCKED</Tag>
          )}
          {isSigned && (
            <Tag color="green" icon={<FileProtectOutlined />} style={{ fontSize: 11 }}>SIGNED by {encounter.signedBy}</Tag>
          )}
        </Space>
      </Card>

      {/* ─── Alerts ─── */}
      {isLocked && (
        <Alert
          type="warning"
          icon={<LockOutlined />}
          message="Encounter Locked"
          description="This encounter is locked. To make changes, use the Reopen action from the More menu."
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

      {hasCriticalAllergy && (
        <Alert
          type="error"
          icon={<WarningOutlined />}
          message="Critical Allergy Alert"
          description={allergies
            .filter((a) => a.severity === 'severe' || a.severity === 'life_threatening')
            .map((a) => `${a.allergen} (${a.severity.replace(/_/g, ' ')})`)
            .join(', ')}
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

      {/* ─── Main Layout: Content + Sidebar ─── */}
      <Row gutter={16}>
        {/* Main Content */}
        <Col xs={24} xl={17}>
          <Form form={form} layout="vertical" onValuesChange={markDirty} disabled={isLocked}>
            {/* ─── Section 1: Encounter Info ─── */}
            <Card
              title={<span style={sectionTitleStyle}><FileTextOutlined /> Encounter Information</span>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="type" label="Encounter Type">
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
                <Col xs={24} md={8}>
                  <Form.Item name="visitCategory" label="Visit Category">
                    <Select allowClear>
                      <Option value="new_patient">New Patient</Option>
                      <Option value="established">Established Patient</Option>
                      <Option value="follow_up">Follow-up</Option>
                      <Option value="annual_wellness">Annual Wellness</Option>
                      <Option value="preventive">Preventive Care</Option>
                      <Option value="urgent_care">Urgent Care</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="priority" label="Priority">
                    <Select allowClear>
                      <Option value="routine">Routine</Option>
                      <Option value="urgent">Urgent</Option>
                      <Option value="emergency">Emergency</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="departmentId" label="Department">
                    <Select allowClear>
                      {DEPARTMENTS.map((d) => (
                        <Option key={d.id} value={d.id}>{d.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="location" label="Location / Clinic"><Input /></Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="room" label="Room / Exam Room"><Input /></Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="visitReason" label="Visit Reason"><TextArea rows={2} /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="chiefComplaint" label="Chief Complaint"><TextArea rows={2} /></Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={12} md={6}>
                  <Form.Item name="arrivalTime" label="Arrival Time">
                    <DatePicker showTime format="MM/DD/YYYY HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="startTime" label="Start Time">
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
                    <InputNumber min={0} max={480} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* ─── Section 2: Vitals Grid ─── */}
        <VitalsFormSection titleStyle={sectionTitleStyle} onWeightHeightChange={markDirty} />

        {/* ─── Section 3: SOAP Notes ─── */}
        <Card
          title={<span style={sectionTitleStyle}><FileTextOutlined /> SOAP Notes</span>}
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Tooltip title="AI will analyze current notes and improve SOAP format">
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleAiAssist}
                loading={aiLoading}
                disabled={!canEdit}
                style={{ borderColor: '#722ed1', color: '#722ed1' }}
                size="small"
              >
                AI Assist
              </Button>
            </Tooltip>
          }
        >
          <Form.Item name="subjective" label="Subjective (S) — Patient History & Complaints">
            <TextArea rows={4} showCount placeholder="History of present illness, review of systems, patient's subjective complaints..." />
          </Form.Item>
          <Form.Item name="objective" label="Objective (O) — Physical Examination Findings">
            <TextArea rows={4} showCount placeholder="Vital signs, physical exam findings, diagnostic results, observations..." />
          </Form.Item>
          <Form.Item name="assessment" label="Assessment (A) — Clinical Impression & Diagnoses">
            <TextArea rows={4} showCount placeholder="Clinical diagnoses, differential diagnoses, clinical reasoning..." />
          </Form.Item>
          <Form.Item name="plan" label="Plan (P) — Treatment Plan">
            <TextArea rows={4} showCount placeholder="Medications prescribed, procedures, referrals, patient education, follow-up..." />
          </Form.Item>
        </Card>

        {/* ─── Section 4a: Diagnoses ─── */}
        <Card
          title={<span style={sectionTitleStyle}><ExperimentOutlined /> Diagnoses (ICD-10) — {diagnoses.length}</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {canEdit && (
            <Row gutter={8} style={{ marginBottom: 12 }}>
              <Col xs={24} md={12}>
                <IcdSearchInput
                  value={diagCode}
                  description={diagDesc}
                  onSelect={(selection) => {
                    setDiagCode(selection.code);
                    setDiagDesc(selection.description);
                    setDiagCodeSystem((selection.codeSystem as EncounterDiagnosis['codeSystem']) || 'ICD-10-CM');
                    setDiagProblemListId(selection.problemListId);
                    setDiagIsBillable(!!selection.isBillable);
                  }}
                  placeholder="Search ICD-10 code, problem, or diagnosis description"
                  patientId={encounter?.patientId}
                  providerId={encounter?.providerId}
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
                <Select value={diagIsPrimary ? 'true' : 'false'} onChange={(v) => setDiagIsPrimary(v === 'true')} style={{ width: '100%' }}>
                  <Option value="false">Secondary</Option>
                  <Option value="true">Primary</Option>
                </Select>
              </Col>
              <Col xs={24} md={3}>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDiagnosis} block>Add</Button>
              </Col>
            </Row>
          )}
          <Table columns={diagnosisColumns} dataSource={diagnoses} rowKey={(_, i) => String(i)} size="small" pagination={false} locale={{ emptyText: 'No diagnoses recorded' }} />
        </Card>

        {/* ─── Section 4b: Procedures ─── */}
        <Card
          title={<span style={sectionTitleStyle}><ExperimentOutlined /> Procedures — {procedures.length}</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {canEdit && (
            <Row gutter={8} style={{ marginBottom: 8 }}>
              <Col xs={24} md={6}><Input placeholder="Procedure name" value={procName} onChange={(e) => setProcName(e.target.value)} /></Col>
              <Col xs={12} md={4}><Input placeholder="CPT Code" value={procCpt} onChange={(e) => setProcCpt(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} /></Col>
              <Col xs={24} md={10}><Input placeholder="Description" value={procDesc} onChange={(e) => setProcDesc(e.target.value)} /></Col>
              <Col xs={24} md={4}><Button type="primary" icon={<PlusOutlined />} onClick={handleAddProcedure} block>Add Procedure</Button></Col>
            </Row>
          )}
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
                  render: (_: unknown, __: any, index: number) =>
                    canEdit ? (
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveProcedure(index)} />
                    ) : null,
                },
              ]}
            />
          )}
        </Card>

        {/* ─── Section 4c: Medications ─── */}
        <Card
          title={<span style={sectionTitleStyle}><MedicineBoxOutlined /> Prescribed Medications — {medications.length}</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {medications.map((med, index) => (
            <Card
              key={index}
              size="small"
              style={{ marginBottom: 8 }}
              extra={
                canEdit && (
                  <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveMedication(index)} />
                )
              }
              title={`Medication ${index + 1}${med.isNew ? ' (New Rx)' : ''}`}
            >
              <Row gutter={8}>
                <Col xs={24} md={8}><Form.Item label="Drug Name" style={{ marginBottom: 8 }}><Input value={med.name} disabled={!canEdit} onChange={(e) => handleUpdateMedication(index, 'name', e.target.value)} /></Form.Item></Col>
                <Col xs={12} md={4}><Form.Item label="Dosage" style={{ marginBottom: 8 }}><Input value={med.dosage} disabled={!canEdit} onChange={(e) => handleUpdateMedication(index, 'dosage', e.target.value)} /></Form.Item></Col>
                <Col xs={12} md={4}>
                  <Form.Item label="Frequency" style={{ marginBottom: 8 }}>
                    <Select value={med.frequency} disabled={!canEdit} onChange={(v) => handleUpdateMedication(index, 'frequency', v)} placeholder="Select">
                      <Option value="once_daily">Once Daily</Option>
                      <Option value="twice_daily">BID</Option>
                      <Option value="three_times_daily">TID</Option>
                      <Option value="four_times_daily">QID</Option>
                      <Option value="every_4_hours">Q4H</Option>
                      <Option value="every_6_hours">Q6H</Option>
                      <Option value="every_8_hours">Q8H</Option>
                      <Option value="as_needed">PRN</Option>
                      <Option value="weekly">Weekly</Option>
                      <Option value="monthly">Monthly</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="Route" style={{ marginBottom: 8 }}>
                    <Select value={med.route} disabled={!canEdit} allowClear onChange={(v) => handleUpdateMedication(index, 'route', v)} placeholder="Route">
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
                <Col xs={12} md={4}><Form.Item label="Duration" style={{ marginBottom: 8 }}><Input value={med.duration} disabled={!canEdit} onChange={(e) => handleUpdateMedication(index, 'duration', e.target.value)} /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col xs={12} md={4}><Form.Item label="Refills" style={{ marginBottom: 4 }}><InputNumber min={0} max={12} value={med.refills} disabled={!canEdit} onChange={(v) => handleUpdateMedication(index, 'refills', v || 0)} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={20}><Form.Item label="Instructions / Sig" style={{ marginBottom: 4 }}><Input value={med.instructions} disabled={!canEdit} onChange={(e) => handleUpdateMedication(index, 'instructions', e.target.value)} /></Form.Item></Col>
              </Row>
            </Card>
          ))}
          {canEdit && (
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddMedication} block>
              Add Medication / Prescription
            </Button>
          )}
        </Card>

        {/* ─── Section 4d: Allergies ─── */}
        <Card
          title={<span style={sectionTitleStyle}><WarningOutlined /> Allergies — {allergies.length}</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {canEdit && (
            <Row gutter={8} style={{ marginBottom: 12 }}>
              <Col xs={24} md={5}><Input placeholder="Allergen" value={allergenName} onChange={(e) => setAllergenName(e.target.value)} onPressEnter={handleAddAllergy} /></Col>
              <Col xs={24} md={5}><Input placeholder="Reaction" value={allergenReaction} onChange={(e) => setAllergenReaction(e.target.value)} onPressEnter={handleAddAllergy} /></Col>
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
              <Col xs={24} md={4}><Button type="primary" icon={<PlusOutlined />} onClick={handleAddAllergy} block>Add</Button></Col>
            </Row>
          )}
          <Table columns={allergyColumns} dataSource={allergies} rowKey={(_, i) => String(i)} size="small" pagination={false} locale={{ emptyText: 'No allergies recorded' }} />
        </Card>

        {/* ─── Section 4e: Orders ─── */}
        <Card
          title={<span style={sectionTitleStyle}><ExperimentOutlined /> Orders</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Divider orientation="left" style={{ fontSize: 13 }}>Laboratory Orders ({labs.length})</Divider>
          {canEdit && (
            <Row gutter={8} style={{ marginBottom: 8 }}>
              <Col xs={24} md={10}><Input placeholder="Lab name (e.g., CBC with differential)" value={labName} onChange={(e) => setLabName(e.target.value)} onPressEnter={handleAddLab} /></Col>
              <Col xs={12} md={4}>
                <Select value={labPriority} onChange={setLabPriority} style={{ width: '100%' }}>
                  <Option value="routine">Routine</Option>
                  <Option value="stat">STAT</Option>
                  <Option value="asap">ASAP</Option>
                </Select>
              </Col>
              <Col xs={12} md={4}><Button type="primary" icon={<PlusOutlined />} onClick={handleAddLab} block>Add Lab</Button></Col>
            </Row>
          )}
          {labs.map((l, i) => (
            <Tag key={i} closable={canEdit} onClose={() => { setLabs(labs.filter((_, idx) => idx !== i)); markDirty(); }} color={l.priority === 'stat' ? 'red' : l.priority === 'asap' ? 'orange' : 'blue'} style={{ marginBottom: 6 }}>
              {l.name} · {l.priority.toUpperCase()} · {l.status}
            </Tag>
          ))}

          <Divider orientation="left" style={{ fontSize: 13 }}>Imaging Orders ({imagingOrders.length})</Divider>
          {canEdit && (
            <Row gutter={8} style={{ marginBottom: 8 }}>
              <Col xs={24} md={6}><Input placeholder="Study name (e.g., Chest X-ray)" value={imagingName} onChange={(e) => setImagingName(e.target.value)} /></Col>
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
              <Col xs={12} md={4}><Input placeholder="Body part" value={imagingBodyPart} onChange={(e) => setImagingBodyPart(e.target.value)} /></Col>
              <Col xs={24} md={4}><Button type="primary" icon={<PlusOutlined />} onClick={handleAddImaging} block>Add</Button></Col>
            </Row>
          )}
          {imagingOrders.map((img, i) => (
            <Tag key={i} closable={canEdit} onClose={() => { setImagingOrders(imagingOrders.filter((_, idx) => idx !== i)); markDirty(); }} color="geekblue" style={{ marginBottom: 6 }}>
              {img.name}{img.modality ? ` · ${img.modality.toUpperCase()}` : ''}{img.bodyPart ? ` · ${img.bodyPart}` : ''} · {img.status}
            </Tag>
          ))}

          <Divider orientation="left" style={{ fontSize: 13 }}>Referrals ({referrals.length})</Divider>
          {canEdit && (
            <Row gutter={8} style={{ marginBottom: 8 }}>
              <Col xs={24} md={6}><Input placeholder="Specialty (e.g., Cardiology)" value={refSpecialty} onChange={(e) => setRefSpecialty(e.target.value)} /></Col>
              <Col xs={24} md={10}><Input placeholder="Referral reason" value={refReason} onChange={(e) => setRefReason(e.target.value)} /></Col>
              <Col xs={24} md={4}><Button type="primary" icon={<PlusOutlined />} onClick={handleAddReferral} block>Add</Button></Col>
            </Row>
          )}
          {referrals.map((r, i) => (
            <Tag key={i} closable={canEdit} onClose={() => { setReferrals(referrals.filter((_, idx) => idx !== i)); markDirty(); }} color="purple" style={{ marginBottom: 6 }}>
              {r.specialty}: {r.reason} · {r.urgency} · {r.status}
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
            <Col xs={24} md={12}><Form.Item name="followUp" label="Follow-up Instructions"><TextArea rows={2} placeholder="Return in 2 weeks if symptoms persist..." /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="followUpDate" label="Follow-up Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="followUpProviderName" label="Follow-up Provider"><Input placeholder="Provider name or specialty" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="homeInstructions" label="Home Care Instructions"><TextArea rows={3} placeholder="Patient home care instructions..." /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="restrictions" label="Activity / Dietary Restrictions"><TextArea rows={3} placeholder="e.g., No strenuous activity for 2 weeks, low-sodium diet..." /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="goals" label="Treatment Goals (one per line)"><TextArea rows={3} placeholder="e.g., Reduce blood pressure to < 130/80..." /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="interventions" label="Interventions (one per line)"><TextArea rows={3} placeholder="e.g., Start antihypertensive therapy..." /></Form.Item></Col>
          </Row>
          <Form.Item name="recallReminder" label="Recall Reminder"><Input placeholder="e.g., Annual physical due in 12 months" /></Form.Item>
        </Card>

        {/* ─── Section 6: Clinical Notes ─── */}
        <Card
          title={<span style={sectionTitleStyle}><FileTextOutlined /> Clinical Notes</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="clinicalNotes" label="Clinical Notes (internal)">
            <TextArea rows={4} showCount placeholder="Additional clinical observations, notes for the care team..." />
          </Form.Item>
          <Form.Item name="notes" label="General Notes">
            <TextArea rows={3} showCount placeholder="Administrative or general notes..." />
          </Form.Item>
        </Card>

        {/* ─── Section 7: Attachments ─── */}
        <Card
          title={<span style={sectionTitleStyle}><PaperClipOutlined /> Attachments — {attachments.length}</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {attachments.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(_, i) => String(i)}
              dataSource={attachments}
              columns={[
                { title: 'File Name', dataIndex: 'name', ellipsis: true, render: (n) => <Space><PaperClipOutlined /> {n}</Space> },
                { title: 'Type', dataIndex: 'type', width: 120, render: (t) => t && <Tag>{t}</Tag> },
                { title: 'Size', dataIndex: 'size', width: 90 },
                { title: 'Uploaded', dataIndex: 'uploadedAt', width: 160, render: (d) => d ? dayjs(d).format('MM/DD/YYYY HH:mm') : '—' },
                canEdit
                  ? {
                      title: '',
                      width: 48,
                      render: (_: unknown, __: any, index: number) => (
                        <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveAttachment(index)} />
                      ),
                    }
                  : {},
              ].filter((c) => Object.keys(c).length > 0)}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No attachments" style={{ margin: '12px 0' }}>
              {canEdit && (
                <Upload
                  showUploadList={false}
                  beforeUpload={(file) => {
                    setAttachments([...attachments, {
                      name: file.name,
                      type: file.type || 'file',
                      size: `${(file.size / 1024).toFixed(1)} KB`,
                      uploadedAt: new Date().toISOString(),
                    }]);
                    markDirty();
                    return false;
                  }}
                >
                  <Button type="dashed" icon={<PlusOutlined />}>Upload Attachment</Button>
                </Upload>
              )}
            </Empty>
          )}
          {attachments.length > 0 && canEdit && (
            <div style={{ marginTop: 12 }}>
              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  setAttachments([...attachments, {
                    name: file.name,
                    type: file.type || 'file',
                    size: `${(file.size / 1024).toFixed(1)} KB`,
                    uploadedAt: new Date().toISOString(),
                  }]);
                  markDirty();
                  return false;
                }}
              >
                <Button type="dashed" icon={<PlusOutlined />}>Add Another Attachment</Button>
              </Upload>
            </div>
          )}
        </Card>

        {/* ─── Section 8: Audit Trail ─── */}
        <Card
          title={<span style={sectionTitleStyle}><HistoryOutlined /> Audit Trail</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {encounter.auditTrail && encounter.auditTrail.length > 0 ? (
            <Timeline
              mode="left"
              items={[...encounter.auditTrail].reverse().map((entry) => ({
                label: dayjs(entry.performedAt).format('MM/DD/YYYY HH:mm'),
                children: (
                  <div>
                    <Text strong style={{ textTransform: 'capitalize' }}>
                      {entry.action.replace(/_/g, ' ')}
                    </Text>
                    {entry.note && <div><Text type="secondary">{entry.note}</Text></div>}
                    {entry.previousStatus && entry.newStatus && (
                      <div>
                        <Tag>{entry.previousStatus}</Tag>
                        <Text> → </Text>
                        <Tag color="blue">{entry.newStatus}</Tag>
                      </div>
                    )}
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        By: {entry.performedBy}
                      </Text>
                    </div>
                  </div>
                ),
                color: entry.action === 'signed' ? 'green' : entry.action === 'locked' ? 'orange' : entry.action === 'status_changed' ? 'blue' : 'gray',
              }))}
            />
          ) : (
            <Text type="secondary">No audit events recorded</Text>
          )}

          {(isSigned || isLocked) && (
            <>
              <Divider />
              <Descriptions size="small" column={2}>
                {encounter.signedAt && (
                  <>
                    <Descriptions.Item label="Signed">
                      {dayjs(encounter.signedAt).format('MM/DD/YYYY HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Signed By">{encounter.signedBy}</Descriptions.Item>
                  </>
                )}
                {encounter.lockedAt && (
                  <>
                    <Descriptions.Item label="Locked">
                      {dayjs(encounter.lockedAt).format('MM/DD/YYYY HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Locked By">{encounter.lockedBy}</Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </>
          )}
        </Card>
      </Form>
        </Col>

        {/* ─── Encounter Status Sidebar ─── */}
        <Col xs={24} xl={7}>
          <div style={{ position: 'sticky', top: 16 }}>
            {/* Workflow Timeline */}
            <Card
              size="small"
              title={<span style={sectionTitleStyle}><HistoryOutlined /> Workflow Status</span>}
              style={{ marginBottom: 16 }}
            >
              <Timeline
                items={workflowSteps.map((step) => ({
                  color: step.done ? 'green' : 'gray',
                  dot: step.done ? <CheckOutlined style={{ fontSize: 12, color: '#52c41a' }} /> : undefined,
                  children: (
                    <div>
                      <Space size={6}>
                        <Text strong style={{ fontSize: 13 }}>{step.title}</Text>
                        {step.done && <Tag color="green" style={{ fontSize: 10, lineHeight: '16px' }}>Done</Tag>}
                      </Space>
                      {step.timestamp && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(step.timestamp).format('MM/DD/YYYY h:mm A')}
                          </Text>
                        </div>
                      )}
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{step.provider}</Text>
                      </div>
                    </div>
                  ),
                }))}
              />
            </Card>

            {/* Encounter Metrics */}
            <Card
              size="small"
              title={<span style={sectionTitleStyle}><ExperimentOutlined /> Encounter Metrics</span>}
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[8, 12]}>
                <Col xs={12}><Statistic title={<Text type="secondary" style={{ fontSize: 11 }}>Duration</Text>} value={encounter.durationMinutes || 0} suffix="min" valueStyle={{ fontSize: 16 }} /></Col>
                <Col xs={12}><Statistic title={<Text type="secondary" style={{ fontSize: 11 }}>Diagnoses</Text>} value={diagnoses.length} valueStyle={{ fontSize: 16 }} /></Col>
                <Col xs={12}><Statistic title={<Text type="secondary" style={{ fontSize: 11 }}>Procedures</Text>} value={procedures.length} valueStyle={{ fontSize: 16 }} /></Col>
                <Col xs={12}><Statistic title={<Text type="secondary" style={{ fontSize: 11 }}>Medications</Text>} value={medications.length} valueStyle={{ fontSize: 16 }} /></Col>
                <Col xs={12}><Statistic title={<Text type="secondary" style={{ fontSize: 11 }}>Orders</Text>} value={totalOrders} valueStyle={{ fontSize: 16 }} /></Col>
                <Col xs={12}><Statistic title={<Text type="secondary" style={{ fontSize: 11 }}>Attachments</Text>} value={attachments.length} valueStyle={{ fontSize: 16 }} /></Col>
              </Row>
            </Card>

            {/* Documentation Progress */}
            <Card
              size="small"
              title={<span style={sectionTitleStyle}><FileTextOutlined /> Documentation Progress</span>}
              style={{ marginBottom: 16 }}
            >
              <div style={{ marginBottom: 12 }}>
                <Row justify="space-between" align="middle">
                  <Col><Text type="secondary" style={{ fontSize: 11 }}>Overall</Text></Col>
                  <Col><Text strong style={{ fontSize: 13 }}>{docProgress.completed}/{docProgress.total}</Text></Col>
                </Row>
                <Progress percent={docProgress.percent} size="small" status={docProgress.percent === 100 ? 'success' : 'active'} style={{ marginBottom: 0, marginTop: 4 }} />
              </div>
              <Divider style={{ margin: '8px 0' }} />
              {docProgress.items.map((item) => (
                <Row key={item.key} justify="space-between" align="middle" style={{ marginBottom: 6 }}>
                  <Col>
                    <Space size={6}>
                      {item.filled
                        ? <CheckOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                        : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid #d9d9d9', display: 'inline-block' }} />}
                      <Text style={{ fontSize: 12 }}>{item.label}</Text>
                    </Space>
                  </Col>
                  <Col>
                    <Tag color={item.filled ? 'green' : 'default'} style={{ fontSize: 10 }}>
                      {item.filled ? 'Done' : 'Pending'}
                    </Tag>
                  </Col>
                </Row>
              ))}
            </Card>

            {/* Quick Clinical Summary */}
            <Card
              size="small"
              title={<span style={sectionTitleStyle}><HeartOutlined /> Clinical Summary</span>}
              style={{ marginBottom: 16 }}
            >
              <Text type="secondary" style={{ fontSize: 11 }}>ACTIVE PROBLEMS</Text>
              <div style={{ marginBottom: 8, marginTop: 4 }}>
                {diagnoses.filter((d) => d.status === 'active').length > 0 ? (
                  diagnoses.filter((d) => d.status === 'active').map((d, i) => (
                    <Tag key={i} color={d.isPrimary ? 'red' : 'blue'} style={{ marginBottom: 4, fontSize: 11 }}>
                      {d.code} — {d.description.length > 30 ? d.description.substring(0, 30) + '…' : d.description}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>No active problems</Text>
                )}
              </div>

              <Text type="secondary" style={{ fontSize: 11 }}>ALLERGIES</Text>
              <div style={{ marginBottom: 8, marginTop: 4 }}>
                {allergies.length > 0 ? (
                  allergies.map((a, i) => (
                    <Tag key={i} color={severityColors[a.severity]} style={{ marginBottom: 4, fontSize: 11 }}>{a.allergen}</Tag>
                  ))
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>No known allergies</Text>
                )}
              </div>

              <Text type="secondary" style={{ fontSize: 11 }}>CURRENT MEDICATIONS</Text>
              <div style={{ marginBottom: 8, marginTop: 4 }}>
                {medications.length > 0 ? (
                  medications.map((m, i) => (
                    <Tag key={i} style={{ marginBottom: 4, fontSize: 11 }}>
                      {m.name}{m.dosage ? ` ${m.dosage}` : ''}{m.frequency ? ` · ${m.frequency.replace(/_/g, ' ')}` : ''}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>No medications prescribed</Text>
                )}
              </div>

              <Text type="secondary" style={{ fontSize: 11 }}>FOLLOW-UP</Text>
              <div style={{ marginTop: 4 }}>
                {encounter.treatmentPlan?.followUp ? (
                  <Text style={{ fontSize: 12 }}>{encounter.treatmentPlan.followUp}</Text>
                ) : encounter.treatmentPlan?.followUpDate ? (
                  <Text style={{ fontSize: 12 }}>Due: {dayjs(encounter.treatmentPlan.followUpDate).format('MM/DD/YYYY')}</Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>No follow-up scheduled</Text>
                )}
              </div>
            </Card>

            {/* Sticky Action Buttons */}
            <Card size="small" bodyStyle={{ padding: 12 }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {canEdit && (
                  <Button
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={() => handleSave(false)}
                    block
                    size="large"
                  >
                    Save Draft
                  </Button>
                )}
                {isCompleted && !isSigned && (
                  <Button
                    type="primary"
                    icon={<FileDoneOutlined />}
                    onClick={handleSign}
                    block
                    size="large"
                  >
                    Sign & Complete
                  </Button>
                )}
                {encounter.status === 'scheduled' && (
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => handleTransition('in_progress')}
                    loading={transitioning}
                    block
                  >
                    Start Encounter
                  </Button>
                )}
                {encounter.status === 'in_progress' && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleTransition('completed')}
                    loading={transitioning}
                    block
                  >
                    Complete Encounter
                  </Button>
                )}
                {isSigned && !isLocked && (
                  <Button icon={<LockOutlined />} onClick={handleLock} block>Lock Encounter</Button>
                )}
                {isLocked && (
                  <Button icon={<UnlockOutlined />} onClick={handleReopen} block>Reopen Encounter</Button>
                )}
              </Space>
            </Card>
          </div>
        </Col>
      </Row>

      {/* ─── Sticky Footer Action Bar ─── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          padding: '10px 24px',
          zIndex: 1000,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {isDirty && <Text type="warning" style={{ fontSize: 12 }}>● Unsaved changes</Text>}
            <Text type="secondary" style={{ fontSize: 11 }}>
              {encounter.id.substring(0, 8)}… · {encounterTypeLabel}
            </Text>
          </Space>
          <Space size="middle">
            <Button icon={<CloseOutlined />} onClick={() => navigate('/clinical')}>Close</Button>
            <Tooltip title="Print"><Button icon={<PrinterOutlined />} onClick={handlePrint} /></Tooltip>
            <Tooltip title="Export JSON"><Button icon={<ExportOutlined />} onClick={handleExport} /></Tooltip>
            {canEdit && (
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(false)}>
                Save
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
};

export default EncounterDetailPage;
