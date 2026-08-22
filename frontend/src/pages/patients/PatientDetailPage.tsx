import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Tag,
  Table,
  Avatar,
  Typography,
  Space,
  Button,
  Row,
  Col,
  Descriptions,
  Badge,
  List,
  Empty,
  Upload,
  Statistic,
  Alert,
  Divider,
  Progress,
  Select,
  Input,
  message,
  Modal,
  Spin,
  Form,
  DatePicker,
  Drawer,
  InputNumber,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  HeartOutlined,
  AlertOutlined,
  CalendarOutlined,
  FileTextOutlined,
  UploadOutlined,
  DollarOutlined,
  ManOutlined,
  WomanOutlined,
  InboxOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LockOutlined,
  SafetyOutlined,
  KeyOutlined,
  PoweroffOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  MedicineBoxOutlined,
  ProfileOutlined,
  ExperimentOutlined,
  PlusOutlined,
  RobotOutlined,
  GlobalOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Patient, Allergy, MedicalHistory, Appointment, Claim } from '../../types';
import { usePatientStore, useAppointmentStore, useBillingStore } from '../../store/dataStore';
import type { ColumnsType } from 'antd/es/table';
import ProblemListSection from '../../components/patients/ProblemListSection';
import EditPatientModal from '../../components/patients/EditPatientModal';
import { PatientInsuranceManager } from '../../components/patients/PatientInsuranceManager';
import RiskManagementTab from '../../components/patients/RiskManagementTab';
import QualityMeasuresTab from '../../components/patients/QualityMeasuresTab';
import { patientService } from '../../services/patientService';
import type { PortalStatus, EnablePortalResult, PatientDocumentRecord } from '../../services/patientService';
import type { EncounterVitals } from '../../services/encounterService';
import { prescriptionService } from '../../services/prescriptionService';
import type { Prescription } from '../../services/prescriptionService';
import { patientMedicationService } from '../../services/patientMedicationService';
import type { PatientMedication, MedicationSource, TakingStatus } from '../../services/patientMedicationService';
import { carePlanService } from '../../services/carePlanService';
import type { CarePlan, CarePlanGoal, CarePlanTask, FullCarePlan } from '../../services/carePlanService';
import { aiService } from '../../services/aiService';
import type { AICarePlanResponse } from '../../services/aiService';
import IcdSearchInput from '../../components/icd/IcdSearchInput';
import CodeSearchInput from '../../components/codes/CodeSearchInput';
import { laboratoryService } from '../../services/laboratoryService';
import type { LabOrder, ImagingOrder } from '../../services/laboratoryService';
import { encounterService } from '../../services/encounterService';
import type { Encounter as PatientEncounter } from '../../services/encounterService';
import { immunizationService } from '../../services/immunizationService';
import type { Immunization, CreateImmunizationData } from '../../services/immunizationService';
import { growthService } from '../../services/growthService';
import type { GrowthChartResponse } from '../../services/growthService';
import GrowthChart from '../../components/growth/GrowthChart';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const severityColors: Record<string, string> = {
  mild: 'blue',
  moderate: 'orange',
  severe: 'red',
  'life-threatening': '#8B0000',
};

const conditionStatusColors: Record<string, string> = {
  active: 'blue',
  resolved: 'green',
  chronic: 'orange',
};

const appointmentStatusColors: Record<string, string> = {
  scheduled: 'blue',
  confirmed: 'cyan',
  checked_in: 'geekblue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'default',
  no_show: 'red',
};

const claimStatusColors: Record<string, string> = {
  draft: 'default',
  submitted: 'blue',
  pending: 'orange',
  approved: 'cyan',
  denied: 'red',
  paid: 'green',
  appealed: 'purple',
};

const PatientDetailPage: React.FC = () => {
  const { patients, fetchPatients } = usePatientStore();
  const { appointments, fetchAppointments } = useAppointmentStore();
  const { claims } = useBillingStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [medicalHistoryInnerTab, setMedicalHistoryInnerTab] = useState('conditions');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [vitalsHistory, setVitalsHistory] = useState<Array<EncounterVitals & { encounterId: string; encounterDate: string }>>([]);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [documents, setDocuments] = useState<PatientDocumentRecord[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalActionLoading, setPortalActionLoading] = useState(false);
  const [enableResult, setEnableResult] = useState<EnablePortalResult | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetForm] = Form.useForm();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [labOrdersLoading, setLabOrdersLoading] = useState(false);
  const [imagingOrders, setImagingOrders] = useState<ImagingOrder[]>([]);
  const [imagingOrdersLoading, setImagingOrdersLoading] = useState(false);
  const [encounters, setEncounters] = useState<PatientEncounter[]>([]);
  const [encountersLoading, setEncountersLoading] = useState(false);
  const [patientMeds, setPatientMeds] = useState<PatientMedication[]>([]);
  const [patientMedsLoading, setPatientMedsLoading] = useState(false);
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  const [immunizationsLoading, setImmunizationsLoading] = useState(false);
  const [addImmunizationDrawerOpen, setAddImmunizationDrawerOpen] = useState(false);
  const [immunizationForm] = Form.useForm();
  const [growthData, setGrowthData] = useState<GrowthChartResponse | null>(null);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [immunizationForecast, setImmunizationForecast] = useState<any>(null);
  const [immunizationForecastLoading, setImmunizationForecastLoading] = useState(false);
  const [vaccineEducation, setVaccineEducation] = useState<any>(null);
  const [vaccineEducationLoading, setVaccineEducationLoading] = useState(false);
  const [vaccineEducationName, setVaccineEducationName] = useState<string>('');
  const [growthAssessment, setGrowthAssessment] = useState<any>(null);
  const [growthAssessmentLoading, setGrowthAssessmentLoading] = useState(false);
  const [growthCounseling, setGrowthCounseling] = useState<any>(null);
  const [growthCounselingLoading, setGrowthCounselingLoading] = useState(false);
  const [travelVaccines, setTravelVaccines] = useState<any>(null);
  const [travelVaccinesLoading, setTravelVaccinesLoading] = useState(false);
  const [travelModalOpen, setTravelModalOpen] = useState(false);
  const [travelForm] = Form.useForm();
  const [specialtyChart, setSpecialtyChart] = useState<string | undefined>(undefined);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [carePlansLoading, setCarePlansLoading] = useState(false);
  const [selectedCarePlan, setSelectedCarePlan] = useState<FullCarePlan | null>(null);
  const [carePlanDetailLoading, setCarePlanDetailLoading] = useState(false);
  const [addMedModalOpen, setAddMedModalOpen] = useState(false);
  const [addMedForm] = Form.useForm();
  const [aiGeneratingPlan, setAiGeneratingPlan] = useState(false);
  const [aiPreviewPlan, setAiPreviewPlan] = useState<AICarePlanResponse | null>(null);
  const [patientProblems, setPatientProblems] = useState<any[]>([]);
  const [createPlanModalOpen, setCreatePlanModalOpen] = useState(false);
  const [createPlanForm] = Form.useForm();
  const [planIcdCode, setPlanIcdCode] = useState('');
  const [planIcdDesc, setPlanIcdDesc] = useState('');
  const [planCodeSystem, setPlanCodeSystem] = useState('ICD-10-CM');
  const [addGoalModalOpen, setAddGoalModalOpen] = useState(false);
  const [addGoalForm] = Form.useForm();
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [addTaskForm] = Form.useForm();

  // ── History tab state (allergies, family, surgical, social) ──
  const [staffAllergies, setStaffAllergies] = useState<any[]>([]);
  const [staffAllergiesLoading, setStaffAllergiesLoading] = useState(false);
  const [allergyDrawerOpen, setAllergyDrawerOpen] = useState(false);
  const [allergyForm] = Form.useForm();

  const [staffFamilyHistory, setStaffFamilyHistory] = useState<any[]>([]);
  const [staffFamilyHistoryLoading, setStaffFamilyHistoryLoading] = useState(false);
  const [familyHistoryDrawerOpen, setFamilyHistoryDrawerOpen] = useState(false);
  const [familyHistoryForm] = Form.useForm();

  const [staffSurgicalHistory, setStaffSurgicalHistory] = useState<any[]>([]);
  const [staffSurgicalHistoryLoading, setStaffSurgicalHistoryLoading] = useState(false);
  const [surgicalDrawerOpen, setSurgicalDrawerOpen] = useState(false);
  const [surgicalForm] = Form.useForm();

  const [staffSocialHistory, setStaffSocialHistory] = useState<any[]>([]);
  const [staffSocialHistoryLoading, setStaffSocialHistoryLoading] = useState(false);
  const [socialDrawerOpen, setSocialDrawerOpen] = useState(false);
  const [socialForm] = Form.useForm();

  // Fetch patients and appointments on mount
  React.useEffect(() => {
    fetchPatients();
    fetchAppointments();
  }, [fetchPatients, fetchAppointments]);

  // Fetch vitals from encounters
  const fetchVitals = useCallback(async () => {
    if (!id) return;
    setVitalsLoading(true);
    try {
      const data = await patientService.getVitals(id);
      setVitalsHistory(data);
    } catch {
      // silent – vitals may not exist yet
    } finally {
      setVitalsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVitals();
  }, [fetchVitals]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    setDocumentsLoading(true);
    try {
      const data = await patientService.getDocuments(id);
      setDocuments(data);
    } catch {
      // silent – documents may not exist yet
    } finally {
      setDocumentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const fetchPrescriptions = useCallback(async () => {
    if (!id) return;
    setPrescriptionsLoading(true);
    try {
      const result = await prescriptionService.findAll({
        page: 1,
        limit: 200,
        patientId: id,
      });
      setPrescriptions(result.data);
    } catch {
      // silent – prescriptions may not exist yet
    } finally {
      setPrescriptionsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const fetchLabOrders = useCallback(async () => {
    if (!id) return;
    setLabOrdersLoading(true);
    try {
      const result = await laboratoryService.getOrders({
        patientId: id,
        page: 1,
        limit: 200,
      });
      setLabOrders(result.data);
    } catch {
      // silent
    } finally {
      setLabOrdersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLabOrders();
  }, [fetchLabOrders]);

  const fetchImagingOrders = useCallback(async () => {
    if (!id) return;
    setImagingOrdersLoading(true);
    try {
      const result = await laboratoryService.getImagingOrders({
        patientId: id,
        page: 1,
        limit: 200,
      });
      setImagingOrders(result.data);
    } catch {
      // silent
    } finally {
      setImagingOrdersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchImagingOrders();
  }, [fetchImagingOrders]);

  const fetchEncounters = useCallback(async () => {
    if (!id) return;
    setEncountersLoading(true);
    try {
      const data = await encounterService.findByPatient(id);
      setEncounters(data);
    } catch {
      // silent
    } finally {
      setEncountersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEncounters();
  }, [fetchEncounters]);

  const fetchPatientMeds = useCallback(async () => {
    if (!id) return;
    setPatientMedsLoading(true);
    try {
      const data = await patientMedicationService.findByPatient(id);
      setPatientMeds(data);
    } catch {
      // silent
    } finally {
      setPatientMedsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatientMeds();
  }, [fetchPatientMeds]);

  const fetchImmunizations = useCallback(async () => {
    if (!id) return;
    setImmunizationsLoading(true);
    try {
      const data = await immunizationService.findByPatient(id);
      setImmunizations(data);
    } catch {
      // silent
    } finally {
      setImmunizationsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchImmunizations();
  }, [fetchImmunizations]);

  const fetchGrowthData = useCallback(async () => {
    if (!id) return;
    setGrowthLoading(true);
    try {
      const data = await growthService.getGrowthChart(id, specialtyChart as any);
      setGrowthData(data);
    } catch {
      // silent — patient may not have growth data
    } finally {
      setGrowthLoading(false);
    }
  }, [id, specialtyChart]);

  useEffect(() => {
    fetchGrowthData();
  }, [fetchGrowthData]);

  // ── AI: Immunization Forecast ──
  const handleImmunizationForecast = async () => {
    if (!patient) return;
    setImmunizationForecastLoading(true);
    setImmunizationForecast(null);
    try {
      const dob = new Date(patient.dateOfBirth);
      const ageMonths = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      const history = immunizations.map((i) => ({
        vaccineName: i.vaccineName,
        cvxCode: i.cvxCode || undefined,
        date: i.administeredDate,
        doseNumber: i.doseNumber || undefined,
      }));
      const result = await immunizationService.forecast({
        patientAgeMonths: Math.round(ageMonths),
        patientSex: patient.gender,
        immunizationHistory: history,
        gestationalAgeWeeks: (patient as any).gestationalAgeWeeks,
      });
      setImmunizationForecast(result);
    } catch {
      message.error('AI immunization forecast failed');
    } finally {
      setImmunizationForecastLoading(false);
    }
  };

  // ── AI: Vaccine Education ──
  const handleVaccineEducation = async (vaccineName: string) => {
    if (!patient) return;
    setVaccineEducationLoading(true);
    setVaccineEducation(null);
    setVaccineEducationName(vaccineName);
    try {
      const dob = new Date(patient.dateOfBirth);
      const ageMonths = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      const result = await immunizationService.getEducation({
        vaccineName,
        patientAgeMonths: Math.round(ageMonths),
        patientSex: patient.gender,
      });
      setVaccineEducation(result);
    } catch {
      message.error('AI vaccine education failed');
    } finally {
      setVaccineEducationLoading(false);
    }
  };

  // ── AI: Growth Assessment ──
  const handleGrowthAssessment = async () => {
    if (!patient || !growthData) return;
    setGrowthAssessmentLoading(true);
    setGrowthAssessment(null);
    try {
      const dob = new Date(patient.dateOfBirth);
      const ageMonths = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      const result = await growthService.assessGrowth({
        patientAgeMonths: Math.round(ageMonths),
        patientSex: growthData.sex,
        gestationalAgeWeeks: growthData.gestationalAgeWeeks,
        weightMeasurements: growthData.measurements.weight.map((w) => ({
          date: w.encounterDate, value: w.value, unit: w.unit, percentile: w.percentile,
        })),
        heightMeasurements: growthData.measurements.height.map((h) => ({
          date: h.encounterDate, value: h.value, unit: h.unit, percentile: h.percentile,
        })),
        headCircumferenceMeasurements: growthData.measurements.headCircumference.map((h) => ({
          date: h.encounterDate, value: h.value, percentile: h.percentile,
        })),
        bmiMeasurements: growthData.measurements.bmi.map((b) => ({
          date: b.encounterDate, value: b.value, percentile: b.percentile,
        })),
        midParentalHeight: growthData.midParentalHeight || undefined,
      });
      setGrowthAssessment(result);
    } catch {
      message.error('AI growth assessment failed');
    } finally {
      setGrowthAssessmentLoading(false);
    }
  };

  // ── AI: Growth Counseling ──
  const handleGrowthCounseling = async () => {
    if (!patient || !growthData) return;
    setGrowthCounselingLoading(true);
    setGrowthCounseling(null);
    try {
      const dob = new Date(patient.dateOfBirth);
      const ageMonths = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      const latestWeight = growthData.measurements.weight[0];
      const latestHeight = growthData.measurements.height[0];
      const latestHead = growthData.measurements.headCircumference[0];
      const latestBmi = growthData.measurements.bmi[0];
      const result = await growthService.getCounseling({
        patientAgeMonths: Math.round(ageMonths),
        patientSex: growthData.sex,
        patientName: `${patient.firstName} ${patient.lastName}`,
        weightPercentile: latestWeight?.percentile,
        heightPercentile: latestHeight?.percentile,
        headCircumferencePercentile: latestHead?.percentile,
        bmiPercentile: latestBmi?.percentile,
        midParentalHeight: growthData.midParentalHeight || undefined,
      });
      setGrowthCounseling(result);
    } catch {
      message.error('AI growth counseling failed');
    } finally {
      setGrowthCounselingLoading(false);
    }
  };

  // ── AI: Travel Vaccines ──
  const handleTravelVaccines = async (values: any) => {
    if (!patient) return;
    setTravelVaccinesLoading(true);
    setTravelVaccines(null);
    try {
      const dob = new Date(patient.dateOfBirth);
      const ageMonths = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      const destinations = (values.destinations as string || '').split(',').map((d: string) => d.trim()).filter(Boolean);
      const result = await immunizationService.getTravelVaccines({
        destinations,
        departureDate: values.departureDate,
        returnDate: values.returnDate,
        patientAgeMonths: Math.round(ageMonths),
        patientSex: patient.gender,
        immunizationHistory: immunizations.map((i) => ({ vaccineName: i.vaccineName, date: i.administeredDate })),
        pregnancy: values.pregnancy,
      });
      setTravelVaccines(result);
      setTravelModalOpen(false);
    } catch {
      message.error('AI travel vaccine recommendations failed');
    } finally {
      setTravelVaccinesLoading(false);
    }
  };

  const fetchCarePlans = useCallback(async () => {
    if (!id) return;
    setCarePlansLoading(true);
    try {
      const data = await carePlanService.findByPatient(id);
      setCarePlans(data);
    } catch {
      // silent
    } finally {
      setCarePlansLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCarePlans();
  }, [fetchCarePlans]);

  const fetchPatientProblems = useCallback(async () => {
    if (!id) return;
    try {
      const data = await patientService.findProblems(id, { clinicalStatus: 'active' });
      setPatientProblems(data);
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    fetchPatientProblems();
  }, [fetchPatientProblems]);

  const fetchPortalStatus = useCallback(async () => {
    if (!id) return;
    setPortalLoading(true);
    try {
      const data = await patientService.getPortalStatus(id);
      setPortalStatus(data);
    } catch {
      setPortalStatus(null);
    } finally {
      setPortalLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPortalStatus();
  }, [fetchPortalStatus]);

  const patient = useMemo(() => patients.find((p) => p.id === id), [id, patients]);

  const patientAppointments = useMemo(
    () => appointments.filter((a) => a.patientId === id),
    [id, appointments],
  );

  const patientClaims = useMemo(
    () => claims.filter((c) => c.patientId === id),
    [id, claims],
  );

  if (!patient) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Empty description="Patient not found" />
        <Button type="primary" onClick={() => navigate('/patients')} style={{ marginTop: 16 }}>
          Back to Patients
        </Button>
      </div>
    );
  }

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const statusColor = patient.status === 'active' ? 'green' : patient.status === 'inactive' ? 'default' : 'red';
  const genderIcon = patient.gender === 'female' ? <WomanOutlined /> : patient.gender === 'male' ? <ManOutlined /> : <UserOutlined />;

  // ── Tab: Overview ──
  const OverviewTab = () => (
    <Row gutter={[24, 24]}>
      {/* Demographics */}
      <Col xs={24} lg={12}>
        <Card
          title={
            <Space>
              <UserOutlined />
              <span>Demographics</span>
            </Space>
          }
          size="small"
        >
          <Descriptions column={1} size="small" labelStyle={{ fontWeight: 500, width: 140 }}>
            <Descriptions.Item label="Full Name">
              {patient.firstName} {patient.lastName}
            </Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {dayjs(patient.dateOfBirth).format('MMMM D, YYYY')} (Age {calculateAge(patient.dateOfBirth)})
            </Descriptions.Item>
            <Descriptions.Item label="Gender">
              <Space size={4}>
                {genderIcon}
                <span style={{ textTransform: 'capitalize' }}>{patient.gender}</span>
              </Space>
            </Descriptions.Item>
            {patient.bloodType && (
              <Descriptions.Item label="Blood Type">
                <Tag color="red">{patient.bloodType}</Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="MRN">
              <Text code>{patient.mrn}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Phone">
              <Space size={4}>
                <PhoneOutlined />
                {patient.phone}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              <Space size={4}>
                <MailOutlined />
                {patient.email}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Address">
              {patient.address ? (
                <Space size={4} direction="vertical" style={{ gap: 0 }}>
                  <span>
                    <HomeOutlined style={{ marginRight: 4 }} />
                    {patient.address.street1 || patient.address.street}
                  </span>
                  <span style={{ marginLeft: 18 }}>
                    {patient.address.city}, {patient.address.state} {patient.address.zipCode}
                  </span>
                </Space>
              ) : (
                <Text type="secondary">No address on file</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>

      {/* Emergency Contact */}
      <Col xs={24} lg={12}>
        <Card
          title={
            <Space>
              <AlertOutlined />
              <span>Emergency Contact</span>
            </Space>
          }
          size="small"
          style={{ marginBottom: 24 }}
        >
          {patient.emergencyContact ? (
            <Descriptions column={1} size="small" labelStyle={{ fontWeight: 500, width: 140 }}>
              <Descriptions.Item label="Name">{patient.emergencyContact.name}</Descriptions.Item>
              <Descriptions.Item label="Relationship">
                {patient.emergencyContact.relationship}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                <Space size={4}>
                  <PhoneOutlined />
                  {patient.emergencyContact.phone}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Text type="secondary">No emergency contact on file</Text>
          )}
        </Card>
      </Col>

      {/* Insurance — full CRUD with multi-policy support */}
      <Col xs={24}>
        <PatientInsuranceManager
          patientId={patient.id}
          patientName={`${patient.lastName}, ${patient.firstName}`}
          patientDob={patient.dateOfBirth}
        />
      </Col>

      {/* Quick Stats Row */}
      <Col xs={24}>
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Conditions"
                value={patient.medicalHistory?.length || 0}
                prefix={<HeartOutlined />}
                valueStyle={{ color: '#0D7C8A' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Allergies"
                value={patient.allergies?.length || 0}
                prefix={<AlertOutlined />}
                valueStyle={{
                  color: (patient.allergies?.length || 0) > 0 ? '#ff4d4f' : '#52c41a',
                }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Appointments"
                value={patientAppointments.length}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Claims"
                value={patientClaims.length}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      </Col>
    </Row>
  );

  // ── Tab: Medical History ──
  const medicalHistoryColumns: ColumnsType<MedicalHistory> = [
    {
      title: 'Condition',
      dataIndex: 'condition',
      key: 'condition',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'ICD Code',
      dataIndex: 'icdCode',
      key: 'icdCode',
      width: 100,
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={conditionStatusColors[status]} style={{ textTransform: 'capitalize' }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Diagnosed',
      dataIndex: 'diagnosedDate',
      key: 'diagnosedDate',
      width: 120,
      render: (d: string) => dayjs(d).format('MM/DD/YYYY'),
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (n: string) => n || <Text type="secondary">--</Text>,
    },
  ];

  const MedicalHistoryTab = () => (
    <Tabs
      activeKey={medicalHistoryInnerTab}
      onChange={setMedicalHistoryInnerTab}
      items={[
        {
          key: 'conditions',
          label: <span><MedicineBoxOutlined /> Conditions</span>,
          children: <ProblemListSection patientId={patient.id} />,
        },
        {
          key: 'surgical-history',
          label: <span><FileTextOutlined /> Surgical History ({staffSurgicalHistory.length})</span>,
          children: <StaffSurgicalHistoryTab />,
        },
        {
          key: 'social-history',
          label: <span><UserOutlined /> Social History ({staffSocialHistory.length})</span>,
          children: <StaffSocialHistoryTab />,
        },
        {
          key: 'family-history',
          label: <span><TeamOutlined /> Family History ({staffFamilyHistory.length})</span>,
          children: <StaffFamilyHistoryTab />,
        },
      ]}
    />
  );

  // ── Tab: Allergies ──
  const AllergiesTab = () => (
    <Card>
      {!patient.allergies || patient.allergies.length === 0 ? (
        <Empty description="No known allergies (NKA)" />
      ) : (
        <List<Allergy>
          dataSource={patient.allergies}
          renderItem={(allergy) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar
                    style={{
                      backgroundColor:
                        allergy.severity === 'life-threatening'
                          ? '#ff4d4f'
                          : allergy.severity === 'severe'
                          ? '#fa8c16'
                          : allergy.severity === 'moderate'
                          ? '#faad14'
                          : '#1890ff',
                    }}
                    icon={<AlertOutlined />}
                  />
                }
                title={
                  <Space>
                    <Text strong>{allergy.allergen}</Text>
                    <Tag
                      color={severityColors[allergy.severity]}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {allergy.severity}
                    </Tag>
                    <Tag color={allergy.status === 'active' ? 'green' : 'default'}>
                      {allergy.status}
                    </Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Text>Reaction: {allergy.reaction}</Text>
                    {allergy.onsetDate && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Onset: {dayjs(allergy.onsetDate).format('MMMM D, YYYY')}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );

  // ── Tab: Appointments ──
  const appointmentColumns: ColumnsType<Appointment> = [
    {
      title: 'Date/Time',
      key: 'dateTime',
      width: 180,
      sorter: (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      defaultSortOrder: 'descend',
      render: (_: unknown, r: Appointment) => (
        <div>
          <Text strong>{dayjs(r.startTime).format('MM/DD/YYYY')}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(r.startTime).format('h:mm A')} - {dayjs(r.endTime).format('h:mm A')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'providerName',
      key: 'providerName',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type: string) => (
        <Tag style={{ textTransform: 'capitalize' }}>
          {type.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={appointmentStatusColors[status]} style={{ textTransform: 'capitalize' }}>
          {status.replace(/_/g, ' ')}
        </Tag>
      ),
    },
  ];

  const AppointmentsTab = () => (
    <Card>
      {patientAppointments.length === 0 ? (
        <Empty description="No appointments found" />
      ) : (
        <Table<Appointment>
          columns={appointmentColumns}
          dataSource={patientAppointments}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          size="middle"
        />
      )}
    </Card>
  );

  // ── Tab: Documents ──
  const documentTypeOptions = [
    { label: 'Lab Report', value: 'lab_report' },
    { label: 'Imaging', value: 'imaging' },
    { label: 'Consent Form', value: 'consent' },
    { label: 'Referral', value: 'referral' },
    { label: 'Insurance Card', value: 'insurance_card' },
    { label: 'Identity Document', value: 'identity' },
    { label: 'Other', value: 'other' },
  ];

  const documentTypeLabel = (type: string): string =>
    documentTypeOptions.find((o) => o.value === type)?.label || type;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const DocumentsTab = () => {
    const [selectedType, setSelectedType] = useState<string>('other');
    const [description, setDescription] = useState<string>('');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const handleUpload = async (file: File) => {
      if (!patient) return;
      setUploading(true);
      try {
        await patientService.uploadDocument(
          patient.id,
          file,
          selectedType,
          description || undefined,
        );
        await fetchDocuments();
        message.success(`${file.name} uploaded successfully`);
        setDescription('');
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        message.error(error?.response?.data?.message || 'Failed to upload document');
      } finally {
        setUploading(false);
      }
    };

    const handleDelete = (docId: string) => {
      Modal.confirm({
        title: 'Delete Document',
        content: 'Are you sure you want to delete this document? This cannot be undone.',
        okText: 'Delete',
        okType: 'danger',
        onOk: async () => {
          try {
            await patientService.deleteDocument(patient!.id, docId);
            setDocuments((prev) => prev.filter((d) => d.id !== docId));
            message.success('Document deleted');
          } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            message.error(error?.response?.data?.message || 'Failed to delete document');
          }
        },
      });
    };

    const handleDownload = async (docId: string) => {
      if (!patient) return;
      setDownloadingId(docId);
      try {
        await patientService.downloadDocument(patient.id, docId);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        message.error(error?.response?.data?.message || 'Failed to download document');
      } finally {
        setDownloadingId(null);
      }
    };

    return (
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card title="Upload Documents">
            <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 16 }}>
              <Row gutter={12}>
                <Col xs={24} sm={10}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>Document Type</Text>
                  <Select
                    value={selectedType}
                    onChange={setSelectedType}
                    options={documentTypeOptions}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col xs={24} sm={14}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>Description (optional)</Text>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Chest X-ray from 2024-03-15"
                    maxLength={255}
                  />
                </Col>
              </Row>
            </Space>
            <Dragger
              name="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              showUploadList={false}
              beforeUpload={(file) => {
                handleUpload(file);
                return false;
              }}
              disabled={uploading}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                {uploading ? 'Uploading...' : 'Click or drag files to upload'}
              </p>
              <p className="ant-upload-hint">
                Support PDF, JPEG, PNG, DOC. Medical records, insurance cards, lab results, etc.
              </p>
            </Dragger>
          </Card>
        </Col>
        <Col xs={24}>
          <Card title={`Documents (${documents.length})`}>
            {documentsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin />
              </div>
            ) : documents.length === 0 ? (
              <Empty description="No documents uploaded yet" />
            ) : (
              <List
                dataSource={documents}
                renderItem={(doc) => (
                  <List.Item
                    actions={[
                      <Button
                        type="link"
                        key="download"
                        icon={<DownloadOutlined />}
                        loading={downloadingId === doc.id}
                        onClick={() => handleDownload(doc.id)}
                      >
                        Download
                      </Button>,
                      <Button
                        type="link"
                        danger
                        key="delete"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(doc.id)}
                      >
                        Delete
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined style={{ fontSize: 24, color: '#0D7C8A' }} />}
                      title={
                        <Space>
                          <Text strong>{doc.fileName}</Text>
                          <Tag color="blue">{documentTypeLabel(doc.documentType)}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2}>
                          <Text type="secondary">
                            {formatFileSize(Number(doc.fileSize))} - Uploaded {dayjs(doc.createdAt).format('MM/DD/YYYY')}
                          </Text>
                          {doc.description && <Text type="secondary">{doc.description}</Text>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    );
  };

  // ── Tab: Vitals ──
  const VitalsTab = () => {
    const latest = vitalsHistory[0];
    const parseBP = (bp?: string): { systolic: number; diastolic: number } | null => {
      if (!bp) return null;
      const parts = bp.split('/');
      if (parts.length !== 2) return null;
      const s = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      return isNaN(s) || isNaN(d) ? null : { systolic: s, diastolic: d };
    };

    if (vitalsLoading) {
      return <Card loading={vitalsLoading} />;
    }

    if (!latest) {
      return (
        <Card>
          <Empty description="No vitals recorded yet. Vitals are captured during encounters.">
            <Button type="primary" onClick={() => navigate('/clinical/new')}>
              Start New Encounter
            </Button>
          </Empty>
        </Card>
      );
    }

    const bp = parseBP(latest.bloodPressure);

    return (
      <Row gutter={[24, 24]}>
        {/* Latest Vitals */}
        <Col xs={24}>
          <Card title="Latest Vitals" extra={<Text type="secondary">{dayjs(latest.encounterDate).format('MMMM D, YYYY')}</Text>}>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={12} md={6}>
                <Statistic title="Blood Pressure" value={latest.bloodPressure || '—'} suffix={latest.bloodPressure ? 'mmHg' : ''} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title="Heart Rate" value={latest.heartRate || '—'} suffix={latest.heartRate ? 'bpm' : ''} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title="Temperature" value={latest.temperature || '—'} suffix={latest.temperature ? '°F' : ''} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title="SpO₂" value={latest.oxygenSaturation || '—'} suffix={latest.oxygenSaturation ? '%' : ''} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title="Respiratory Rate" value={latest.respiratoryRate || '—'} suffix={latest.respiratoryRate ? '/min' : ''} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title="Weight" value={latest.weight || '—'} suffix={latest.weight ? latest.weightUnit || 'lbs' : ''} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title="BMI" value={latest.bmi || '—'} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title="Pain Score" value={latest.painScore !== undefined ? latest.painScore : '—'} suffix={latest.painScore !== undefined ? '/10' : ''} />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Vitals Trend Table */}
        <Col xs={24}>
          <Card title="Vitals History">
            <Table
              dataSource={vitalsHistory}
              rowKey="encounterId"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'encounterDate',
                  render: (d: string) => dayjs(d).format('MM/DD/YYYY'),
                },
                {
                  title: 'BP (mmHg)',
                  dataIndex: 'bloodPressure',
                  render: (bp: string) => bp || '—',
                },
                {
                  title: 'HR (bpm)',
                  dataIndex: 'heartRate',
                  render: (v: string) => v || '—',
                },
                {
                  title: 'Temp (°F)',
                  dataIndex: 'temperature',
                  render: (v: string) => v || '—',
                },
                {
                  title: 'SpO2 (%)',
                  dataIndex: 'oxygenSaturation',
                  render: (v: string) => {
                    if (!v) return '—';
                    const num = parseFloat(v);
                    return <span style={{ color: !isNaN(num) && num < 95 ? '#ff4d4f' : '#52c41a' }}>{v}%</span>;
                  },
                },
                {
                  title: 'Weight',
                  dataIndex: 'weight',
                  render: (v: string, r: any) => v ? `${v} ${r.weightUnit || 'lbs'}` : '—',
                },
              ]}
            />
          </Card>
        </Col>

        {/* BP Trend visual */}
        {vitalsHistory.filter((v) => v.bloodPressure).length > 0 && (
          <Col xs={24}>
            <Card title="Blood Pressure Trend">
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {vitalsHistory
                  .filter((v) => v.bloodPressure)
                  .map((v) => {
                    const parsed = parseBP(v.bloodPressure);
                    if (!parsed) return null;
                    return (
                      <div key={v.encounterId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Text style={{ width: 90, flexShrink: 0 }}>
                          {dayjs(v.encounterDate).format('MMM YYYY')}
                        </Text>
                        <Progress
                          percent={Math.round((parsed.systolic / 180) * 100)}
                          size="small"
                          format={() => `${parsed.systolic}/${parsed.diastolic}`}
                          strokeColor={parsed.systolic > 140 ? '#ff4d4f' : parsed.systolic > 130 ? '#faad14' : '#52c41a'}
                          style={{ flex: 1 }}
                        />
                      </div>
                    );
                  })}
              </Space>
            </Card>
          </Col>
        )}
      </Row>
    );
  };

  // ── Tab: Billing ──
  const claimColumns: ColumnsType<Claim> = [
    {
      title: 'Claim #',
      dataIndex: 'claimNumber',
      key: 'claimNumber',
      render: (num: string) => <Text code>{num}</Text>,
    },
    {
      title: 'Service Date',
      dataIndex: 'serviceDate',
      key: 'serviceDate',
      render: (d: string) => dayjs(d).format('MM/DD/YYYY'),
    },
    {
      title: 'Provider',
      dataIndex: 'providerName',
      key: 'providerName',
    },
    {
      title: 'Insurance',
      dataIndex: 'insuranceProvider',
      key: 'insuranceProvider',
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (a: number) => `$${a.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={claimStatusColors[status]} style={{ textTransform: 'capitalize' }}>
          {status}
        </Tag>
      ),
    },
  ];

  const BillingTab = () => {
    const totalBilled = patientClaims.reduce((s, c) => s + c.totalAmount, 0);
    const totalPaid = patientClaims.reduce((s, c) => s + (c.paidAmount || 0), 0);
    const outstanding = totalBilled - totalPaid;

    return (
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Row gutter={16}>
            <Col xs={8}>
              <Card size="small">
                <Statistic title="Total Billed" value={totalBilled} prefix="$" precision={2} />
              </Card>
            </Col>
            <Col xs={8}>
              <Card size="small">
                <Statistic
                  title="Total Paid"
                  value={totalPaid}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card size="small">
                <Statistic
                  title="Outstanding"
                  value={outstanding}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: outstanding > 0 ? '#faad14' : '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>
        <Col xs={24}>
          <Card title="Claims">
            {patientClaims.length === 0 ? (
              <Empty description="No claims found" />
            ) : (
              <Table<Claim>
                columns={claimColumns}
                dataSource={patientClaims}
                rowKey="id"
                pagination={false}
                size="middle"
              />
            )}
          </Card>
        </Col>
      </Row>
    );
  };

  // ── Tab: Problem List ──
  const ProblemListTab = () => <ProblemListSection patientId={patient.id} />;

  // ── Tab: Portal Access ──
  const handleEnablePortal = async () => {
    setPortalActionLoading(true);
    setEnableResult(null);
    try {
      const result = await patientService.enablePortal(patient.id);
      setEnableResult(result);
      await fetchPortalStatus();
      if (result.emailSent) {
        message.success('Portal access enabled. Invitation email sent to patient.');
      } else {
        message.success('Portal access enabled. Copy the invitation link and share it with the patient.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to enable portal access';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setPortalActionLoading(false);
    }
  };

  const handleDisablePortal = async () => {
    Modal.confirm({
      title: 'Disable Portal Access?',
      icon: <ExclamationCircleOutlined />,
      content:
        'The patient will be immediately logged out and will not be able to log in again. Their password and MFA will be cleared. They will need a new invitation to regain access.',
      okText: 'Disable Access',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setPortalActionLoading(true);
        try {
          await patientService.disablePortal(patient.id, 'Disabled by staff from patient detail page');
          await fetchPortalStatus();
          setEnableResult(null);
          message.success('Portal access disabled. All active sessions have been revoked.');
        } catch (err: any) {
          const msg = err.response?.data?.message || err.message || 'Failed to disable portal access';
          message.error(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
          setPortalActionLoading(false);
        }
      },
    });
  };

  const handleResetPassword = async (values: { mode: 'email' | 'temp'; temporaryPassword?: string }) => {
    setPortalActionLoading(true);
    try {
      if (values.mode === 'temp' && values.temporaryPassword) {
        await patientService.resetPortalPassword(patient.id, {
          temporaryPassword: values.temporaryPassword,
          sendEmail: false,
        });
        message.success('Temporary password set. Share it with the patient securely and ask them to change it after logging in.');
      } else {
        const result = await patientService.resetPortalPassword(patient.id, { sendEmail: true });
        if (result.emailSent) {
          message.success('Password reset email sent to the patient.');
        } else {
          message.warning('Password reset token issued, but the email could not be sent. Share the reset link manually if needed.');
        }
      }
      setResetModalOpen(false);
      resetForm.resetFields();
      await fetchPortalStatus();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setPortalActionLoading(false);
    }
  };

  const PortalTab = () => {
    if (portalLoading) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        </Card>
      );
    }

    if (!portalStatus) {
      return (
        <Card>
          <Empty description="Unable to load portal status" />
        </Card>
      );
    }

    const active = portalStatus.portalActive;
    const hasPassword = portalStatus.hasPassword;
    const invitationPending = portalStatus.invitationPending;

    return (
      <div>
        <Card
          title={
            <Space>
              <SafetyOutlined />
              <span>Patient Portal Access</span>
            </Space>
          }
          extra={
            <Tag color={active ? 'green' : 'default'} style={{ fontSize: 13, padding: '4px 12px' }}>
              {active ? 'ACTIVE' : 'DISABLED'}
            </Tag>
          }
        >
          {!portalStatus.email && (
            <Alert
              type="warning"
              showIcon
              message="No email on file"
              description="This patient must have an email address before portal access can be enabled. Update the patient's demographics first."
              style={{ marginBottom: 16 }}
            />
          )}

          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Portal Status">
              <Tag color={active ? 'green' : 'default'}>
                {active ? 'Active' : 'Disabled'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Password Set">
              <Tag color={hasPassword ? 'blue' : 'default'}>
                {hasPassword ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="MFA Enabled">
              <Tag color={portalStatus.mfaEnabled ? 'gold' : 'default'}>
                {portalStatus.mfaEnabled ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Last Login">
              {portalStatus.lastLoginAt
                ? dayjs(portalStatus.lastLoginAt).format('MMM D, YYYY h:mm A')
                : 'Never'}
            </Descriptions.Item>
            <Descriptions.Item label="Email on File">
              {portalStatus.email || 'None'}
            </Descriptions.Item>
            <Descriptions.Item label="Invitation Pending">
              {invitationPending ? (
                <Space>
                  <Tag color="orange">Pending</Tag>
                  {portalStatus.invitationExpiresAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      expires {dayjs(portalStatus.invitationExpiresAt).format('MMM D, YYYY')}
                    </Text>
                  )}
                </Space>
              ) : (
                <Tag color="default">No</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <Space wrap>
            {!active && (
              <Button
                type="primary"
                icon={<PoweroffOutlined />}
                loading={portalActionLoading}
                onClick={handleEnablePortal}
                disabled={!portalStatus.email}
              >
                Enable Portal Access
              </Button>
            )}
            {active && (
              <>
                <Button
                  danger
                  icon={<LockOutlined />}
                  loading={portalActionLoading}
                  onClick={handleDisablePortal}
                >
                  Disable Portal Access
                </Button>
                <Button
                  icon={<KeyOutlined />}
                  loading={portalActionLoading}
                  onClick={() => {
                    setEnableResult(null);
                    setResetModalOpen(true);
                  }}
                >
                  Reset Password
                </Button>
                {invitationPending && (
                  <Button
                    type="primary"
                    icon={<PoweroffOutlined />}
                    loading={portalActionLoading}
                    onClick={handleEnablePortal}
                  >
                    Re-issue Invitation
                  </Button>
                )}
              </>
            )}
          </Space>

          {enableResult && (
            <Alert
              type="success"
              showIcon
              icon={<SafetyOutlined />}
              style={{ marginTop: 16 }}
              message="Portal invitation issued"
              description={
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    {enableResult.emailSent
                      ? 'An invitation email has been sent to the patient. Alternatively, share this link directly:'
                      : 'The invitation email could not be sent. Share this link with the patient directly:'}
                  </Paragraph>
                  <Input.Group compact>
                    <Input
                      style={{ width: 'calc(100% - 90px)' }}
                      value={enableResult.invitationUrl}
                      readOnly
                    />
                    <Button
                      type="primary"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(enableResult.invitationUrl);
                        message.success('Invitation link copied to clipboard');
                      }}
                    >
                      Copy
                    </Button>
                  </Input.Group>
                  <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                    This link expires in 7 days. The patient will use it to choose their own password.
                  </Paragraph>
                </div>
              }
            />
          )}
        </Card>

        {/* Reset Password Modal */}
        <Modal
          title="Reset Patient Portal Password"
          open={resetModalOpen}
          onCancel={() => {
            setResetModalOpen(false);
            resetForm.resetFields();
          }}
          footer={null}
        >
          <Form
            form={resetForm}
            layout="vertical"
            onFinish={handleResetPassword}
            initialValues={{ mode: 'email' }}
          >
            <Form.Item name="mode" label="Reset method" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'email', label: 'Send password reset link to patient email' },
                  { value: 'temp', label: 'Set a temporary password manually' },
                ]}
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, next) => prev.mode !== next.mode}
            >
              {({ getFieldValue }) =>
                getFieldValue('mode') === 'temp' ? (
                  <Form.Item
                    name="temporaryPassword"
                    label="Temporary password"
                    rules={[
                      { required: true, message: 'Please enter a temporary password' },
                      { min: 8, message: 'Password must be at least 8 characters' },
                    ]}
                    extra="The patient should change this after their first login."
                  >
                    <Input.Password placeholder="Enter a temporary password" />
                  </Form.Item>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    message="A password reset link will be emailed to the patient. The link is valid for 1 hour."
                    style={{ marginBottom: 16 }}
                  />
                )
              }
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button
                  onClick={() => {
                    setResetModalOpen(false);
                    resetForm.resetFields();
                  }}
                >
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={portalActionLoading}>
                  Reset Password
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  };

  // ── Tab: E-Prescriptions ──
  const prescriptionStatusColors: Record<string, string> = {
    draft: 'default',
    active: 'green',
    sent: 'blue',
    completed: 'default',
    cancelled: 'red',
    discontinued: 'orange',
    expired: 'red',
  };

  const EPrescriptionsTab = () => {
    const active = prescriptions.filter((p) => p.status === 'active' || p.status === 'sent');
    const past = prescriptions.filter((p) => p.status !== 'active' && p.status !== 'sent');

    return (
      <div>
        {prescriptionsLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : prescriptions.length === 0 ? (
          <Card>
            <Empty description="No prescriptions on file" />
          </Card>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card
              title={<span><MedicineBoxOutlined /> Active Medications ({active.length})</span>}
              size="small"
            >
              {active.length ? (
                <List
                  dataSource={active}
                  renderItem={(rx) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>
                              {rx.medications?.map((m) => `${m.medication} ${m.dosage || ''}`).join(', ') || 'Prescription'}
                            </Text>
                            <Tag color={prescriptionStatusColors[rx.status]}>{rx.status}</Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            {rx.medications?.map((m, i) => (
                              <Text key={i} type="secondary">
                                {m.medication} — {m.dosage}, {m.frequency}, {m.route}, {m.duration}
                                {m.refills !== undefined ? ` · Refills: ${m.refills}` : ''}
                                {m.instructions ? ` · ${m.instructions}` : ''}
                              </Text>
                            ))}
                            {rx.pharmacy && <Text type="secondary">Pharmacy: {rx.pharmacy}</Text>}
                            {rx.providerName && <Text type="secondary">Prescribed by: {rx.providerName}</Text>}
                            {rx.prescribedDate && (
                              <Text type="secondary">
                                Prescribed: {dayjs(rx.prescribedDate).format('MM/DD/YYYY')}
                              </Text>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No active medications" />
              )}
            </Card>

            {past.length > 0 && (
              <Card title={`Past Prescriptions (${past.length})`} size="small">
                <List
                  dataSource={past}
                  renderItem={(rx) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{rx.medications?.map((m) => m.medication).join(', ') || 'Prescription'}</Text>
                            <Tag color={prescriptionStatusColors[rx.status]}>{rx.status}</Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary">
                            Prescribed: {rx.prescribedDate ? dayjs(rx.prescribedDate).format('MM/DD/YYYY') : 'N/A'}
                            {rx.providerName ? ` · ${rx.providerName}` : ''}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </Space>
        )}
      </div>
    );
  };

  // ── Tab: Orders (Lab + Imaging + Referrals) ──
  const labStatusColors: Record<string, string> = {
    draft: 'default',
    ordered: 'blue',
    collected: 'cyan',
    in_progress: 'processing',
    resulted: 'green',
    completed: 'green',
    cancelled: 'red',
  };

  const imagingStatusColors: Record<string, string> = {
    ordered: 'blue',
    scheduled: 'cyan',
    in_progress: 'processing',
    completed: 'green',
    cancelled: 'red',
  };

  const referralStatusColors: Record<string, string> = {
    pending: 'orange',
    sent: 'blue',
    scheduled: 'cyan',
    completed: 'green',
    cancelled: 'red',
  };

  const modalityLabels: Record<string, string> = {
    xray: 'X-Ray',
    mri: 'MRI',
    ct: 'CT Scan',
    ultrasound: 'Ultrasound',
    mammogram: 'Mammogram',
    dexa: 'DEXA Scan',
    other: 'Other',
  };

  // Flatten referrals from all encounters
  const allReferrals = useMemo(() => {
    const refs: Array<{
      specialty: string;
      provider?: string;
      reason: string;
      urgency?: string;
      status: string;
      notes?: string;
      encounterId: string;
      encounterDate: string;
    }> = [];
    for (const enc of encounters) {
      for (const ref of enc.orders?.referrals || []) {
        refs.push({
          ...ref,
          encounterId: enc.id,
          encounterDate: enc.startTime,
        });
      }
    }
    return refs.sort((a, b) => new Date(b.encounterDate).getTime() - new Date(a.encounterDate).getTime());
  }, [encounters]);

  const OrdersTab = () => (
    <div>
      {(labOrdersLoading || imagingOrdersLoading || encountersLoading) ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : labOrders.length === 0 && imagingOrders.length === 0 && allReferrals.length === 0 ? (
        <Card>
          <Empty description="No orders on file" />
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* Lab Orders */}
          <Card
            title={<span><ExperimentOutlined /> Lab Orders ({labOrders.length})</span>}
            size="small"
          >
            {labOrders.length > 0 ? (
              <Table<LabOrder>
                dataSource={labOrders}
                rowKey="id"
                pagination={false}
                size="small"
                expandable={{
                  expandedRowRender: (order) => {
                    if (!order.tests || order.tests.length === 0) {
                      return <Empty description="No test details" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
                    }
                    const testColumns = [
                      { title: 'Test', dataIndex: 'name', key: 'name' },
                      {
                        title: 'Result',
                        key: 'result',
                        render: (_: any, t: any) =>
                          t.result ? (
                            <Space>
                              <Text strong style={t.abnormalFlag === 'critical_high' || t.abnormalFlag === 'critical_low' ? { color: '#cf1322' } : t.abnormalFlag === 'high' || t.abnormalFlag === 'low' ? { color: '#fa8c16' } : {}}>
                                {t.result} {t.unit || ''}
                              </Text>
                              {t.abnormalFlag && t.abnormalFlag !== 'normal' && (
                                <Tag color={t.abnormalFlag.includes('critical') ? 'red' : 'orange'}>
                                  {t.abnormalFlag.replace(/_/g, ' ')}
                                </Tag>
                              )}
                            </Space>
                          ) : (
                            <Text type="secondary">Pending</Text>
                          ),
                      },
                      {
                        title: 'Reference Range',
                        dataIndex: 'referenceRange',
                        key: 'range',
                        render: (r: string) => r ? <Text type="secondary">{r}</Text> : null,
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        render: (s: string) => <Tag>{s}</Tag>,
                      },
                    ];
                    return <Table columns={testColumns} dataSource={order.tests} rowKey="id" pagination={false} size="small" />;
                  },
                }}
              >
                <Table.Column
                  title="Tests"
                  key="tests"
                  render={(_, order: LabOrder) => (
                    <Text strong>{order.tests?.map((t) => t.name).join(', ') || 'N/A'}</Text>
                  )}
                />
                <Table.Column
                  title="Status"
                  dataIndex="status"
                  key="status"
                  render={(s: string) => <Tag color={labStatusColors[s]}>{s}</Tag>}
                />
                <Table.Column
                  title="Priority"
                  dataIndex="priority"
                  key="priority"
                  render={(p: string) => p && p !== 'routine' ? <Tag color={p === 'stat' ? 'red' : 'orange'}>{p}</Tag> : <Text type="secondary">routine</Text>}
                />
                <Table.Column
                  title="Ordered"
                  dataIndex="orderedDate"
                  key="orderedDate"
                  render={(d: string) => d ? dayjs(d).format('MM/DD/YYYY') : 'N/A'}
                />
                <Table.Column
                  title="Provider"
                  dataIndex="providerName"
                  key="providerName"
                  render={(n: string) => n || 'N/A'}
                />
              </Table>
            ) : (
              <Empty description="No lab orders" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* Imaging Orders */}
          <Card
            title={<span><ExperimentOutlined /> Imaging Orders ({imagingOrders.length})</span>}
            size="small"
          >
            {imagingOrders.length > 0 ? (
              <Table<ImagingOrder>
                dataSource={imagingOrders}
                rowKey="id"
                pagination={false}
                size="small"
                expandable={{
                  expandedRowRender: (order) => {
                    if (order.status === 'completed' && (order.findings || order.impression)) {
                      return (
                        <div style={{ padding: '8px 0' }}>
                          {order.findings && (
                            <div style={{ marginBottom: 8 }}>
                              <Text strong>Findings: </Text>
                              <Text>{order.findings}</Text>
                            </div>
                          )}
                          {order.impression && (
                            <div style={{ marginBottom: 8 }}>
                              <Text strong>Impression: </Text>
                              <Text>{order.impression}</Text>
                            </div>
                          )}
                          {order.radiologyReportUrl && (
                            <Button type="link" href={order.radiologyReportUrl} target="_blank" rel="noopener noreferrer" style={{ padding: 0 }}>
                              View Radiology Report
                            </Button>
                          )}
                        </div>
                      );
                    }
                    return <Empty description={order.status === 'completed' ? 'Findings not yet available' : `Status: ${order.status} — results will appear when ready`} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
                  },
                }}
              >
                <Table.Column
                  title="Study"
                  dataIndex="studyName"
                  key="studyName"
                  render={(s: string) => <Text strong>{s}</Text>}
                />
                <Table.Column
                  title="Modality"
                  dataIndex="modality"
                  key="modality"
                  render={(m: string) => <Tag>{modalityLabels[m] || m}</Tag>}
                />
                <Table.Column
                  title="Body Part"
                  dataIndex="bodyPart"
                  key="bodyPart"
                />
                <Table.Column
                  title="Status"
                  dataIndex="status"
                  key="status"
                  render={(s: string) => <Tag color={imagingStatusColors[s]}>{s.replace(/_/g, ' ')}</Tag>}
                />
                <Table.Column
                  title="Ordered"
                  dataIndex="orderedDate"
                  key="orderedDate"
                  render={(d: string) => d ? dayjs(d).format('MM/DD/YYYY') : 'N/A'}
                />
                <Table.Column
                  title="Provider"
                  dataIndex="providerName"
                  key="providerName"
                  render={(n: string) => n || 'N/A'}
                />
              </Table>
            ) : (
              <Empty description="No imaging orders" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* Referrals */}
          <Card
            title={<span><ProfileOutlined /> Referrals ({allReferrals.length})</span>}
            size="small"
          >
            {allReferrals.length > 0 ? (
              <Table
                dataSource={allReferrals}
                rowKey={(r) => `${r.encounterId}-${r.specialty}-${r.reason}`}
                pagination={false}
                size="small"
              >
                <Table.Column
                  title="Specialty"
                  dataIndex="specialty"
                  key="specialty"
                  render={(s: string) => <Text strong>{s}</Text>}
                />
                <Table.Column
                  title="Reason"
                  dataIndex="reason"
                  key="reason"
                />
                <Table.Column
                  title="Provider"
                  dataIndex="provider"
                  key="provider"
                  render={(p: string) => p || 'N/A'}
                />
                <Table.Column
                  title="Urgency"
                  dataIndex="urgency"
                  key="urgency"
                  render={(u: string) => u && u !== 'routine' ? <Tag color={u === 'emergent' ? 'red' : 'orange'}>{u}</Tag> : <Text type="secondary">routine</Text>}
                />
                <Table.Column
                  title="Status"
                  dataIndex="status"
                  key="status"
                  render={(s: string) => <Tag color={referralStatusColors[s]}>{s}</Tag>}
                />
                <Table.Column
                  title="Date"
                  dataIndex="encounterDate"
                  key="encounterDate"
                  render={(d: string) => d ? dayjs(d).format('MM/DD/YYYY') : 'N/A'}
                />
              </Table>
            ) : (
              <Empty description="No referrals" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Space>
      )}
    </div>
  );

  // ── Tab: Medications (patient medication list — includes Rx, OTC, patient-reported) ──
  const medSourceLabels: Record<string, string> = {
    prescription: 'Prescription',
    patient_reported: 'Patient Reported',
    pbm_history: 'PBM History',
    encounter: 'Encounter',
  };

  const medSourceColors: Record<string, string> = {
    prescription: 'blue',
    patient_reported: 'green',
    pbm_history: 'purple',
    encounter: 'cyan',
  };

  const takingStatusColors: Record<string, string> = {
    taking: 'green',
    taking_differently: 'orange',
    not_taking: 'red',
    unknown: 'default',
    completed: 'blue',
  };

  const handleAddMed = async (values: any) => {
    if (!id || !patient) return;
    try {
      // Combine dosage amount + unit into a single dosage string
      const dosageParts = [
        values.dosageAmount != null ? String(values.dosageAmount) : '',
        values.dosageUnit || '',
      ].filter(Boolean);
      const dosage = dosageParts.join(' ') || undefined;

      // Convert duration days to string
      const duration = values.durationDays != null ? `${values.durationDays} days` : undefined;

      await patientMedicationService.create({
        medicationName: values.medicationName,
        dosage,
        frequency: values.frequency,
        route: values.route,
        duration,
        instructions: values.instructions,
        startDate: values.startDate ? (values.startDate as dayjs.Dayjs).toISOString() : undefined,
        patientId: id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        source: values.source || 'patient_reported',
        takingStatus: values.takingStatus || 'taking',
        status: 'active',
        notes: values.notes,
      });
      message.success('Medication added');
      setAddMedModalOpen(false);
      addMedForm.resetFields();
      fetchPatientMeds();
    } catch {
      message.error('Failed to add medication');
    }
  };

  const handleUpdateTakingStatus = async (medId: string, status: TakingStatus) => {
    try {
      await patientMedicationService.updateTakingStatus(medId, status);
      message.success('Taking status updated');
      fetchPatientMeds();
    } catch {
      message.error('Failed to update status');
    }
  };

  const MedicationsTab = () => {
    const activeMeds = patientMeds.filter((m) => m.status === 'active');
    const inactiveMeds = patientMeds.filter((m) => m.status !== 'active');

    return (
      <div>
        {patientMedsLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5}>Medication List ({patientMeds.length})</Title>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddMedModalOpen(true)}>
                Add Medication
              </Button>
            </div>

            {patientMeds.length === 0 ? (
              <Card><Empty description="No medications on file. Add patient-reported medications, OTC, supplements, or herbal remedies." /></Card>
            ) : (
              <>
                <Card title={`Active Medications (${activeMeds.length})`} size="small">
                  {activeMeds.length > 0 ? (
                    <Table<PatientMedication>
                      dataSource={activeMeds}
                      rowKey="id"
                      pagination={false}
                      size="small"
                    >
                      <Table.Column
                        title="Medication"
                        key="med"
                        render={(_, m: PatientMedication) => (
                          <Space direction="vertical" size={0}>
                            <Text strong>{m.medicationName}</Text>
                            {m.dosage && <Text type="secondary">{m.dosage} · {m.frequency || ''} · {m.route || ''}</Text>}
                            {m.instructions && <Text type="secondary" style={{ fontSize: 12 }}>{m.instructions}</Text>}
                          </Space>
                        )}
                      />
                      <Table.Column
                        title="Source"
                        dataIndex="source"
                        key="source"
                        render={(s: string) => <Tag color={medSourceColors[s]}>{medSourceLabels[s] || s}</Tag>}
                      />
                      <Table.Column
                        title="Taking"
                        dataIndex="takingStatus"
                        key="takingStatus"
                        render={(s: string, m: PatientMedication) => (
                          <Select
                            size="small"
                            value={s}
                            style={{ width: 140 }}
                            onChange={(val) => handleUpdateTakingStatus(m.id, val as TakingStatus)}
                            options={[
                              { value: 'taking', label: 'Taking' },
                              { value: 'taking_differently', label: 'Taking Differently' },
                              { value: 'not_taking', label: 'Not Taking' },
                              { value: 'unknown', label: 'Unknown' },
                              { value: 'completed', label: 'Completed' },
                            ]}
                          />
                        )}
                      />
                      <Table.Column
                        title="Started"
                        dataIndex="startDate"
                        key="startDate"
                        render={(d: string) => d ? dayjs(d).format('MM/DD/YYYY') : 'N/A'}
                      />
                      <Table.Column
                        title="Reviewed"
                        dataIndex="isReviewed"
                        key="reviewed"
                        render={(r: boolean) => r ? <Tag color="green">Reviewed</Tag> : <Tag>Pending</Tag>}
                      />
                    </Table>
                  ) : (
                    <Empty description="No active medications" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Card>

                {inactiveMeds.length > 0 && (
                  <Card title={`Past Medications (${inactiveMeds.length})`} size="small">
                    <Table<PatientMedication>
                      dataSource={inactiveMeds}
                      rowKey="id"
                      pagination={false}
                      size="small"
                    >
                      <Table.Column
                        title="Medication"
                        dataIndex="medicationName"
                        key="name"
                        render={(n: string) => <Text strong>{n}</Text>}
                      />
                      <Table.Column
                        title="Source"
                        dataIndex="source"
                        key="source"
                        render={(s: string) => <Tag color={medSourceColors[s]}>{medSourceLabels[s] || s}</Tag>}
                      />
                      <Table.Column
                        title="Status"
                        dataIndex="status"
                        key="status"
                        render={(s: string) => <Tag>{s}</Tag>}
                      />
                      <Table.Column
                        title="Stopped"
                        dataIndex="stopDate"
                        key="stopDate"
                        render={(d: string) => d ? dayjs(d).format('MM/DD/YYYY') : 'N/A'}
                      />
                    </Table>
                  </Card>
                )}
              </>
            )}

            {/* Add Medication Drawer */}
            <Drawer
              title="Add Patient Medication"
              open={addMedModalOpen}
              onClose={() => { setAddMedModalOpen(false); addMedForm.resetFields(); }}
              width={480}
              destroyOnClose
            >
              <Form form={addMedForm} layout="vertical" onFinish={handleAddMed}>
                <Form.Item name="medicationName" label="Medication Name" rules={[{ required: true, message: 'Required' }]}>
                  <Input placeholder="e.g. Aspirin, Vitamin D, Metformin" />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="dosageAmount" label="Dosage Amount">
                      <InputNumber placeholder="81" min={0} step={0.1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="dosageUnit" label="Dosage Unit">
                      <Select allowClear placeholder="Select unit" options={[
                        { value: 'mg', label: 'mg' },
                        { value: 'mcg', label: 'mcg' },
                        { value: 'g', label: 'g' },
                        { value: 'mL', label: 'mL' },
                        { value: 'L', label: 'L' },
                        { value: 'units', label: 'units' },
                        { value: 'IU', label: 'IU' },
                        { value: 'mg/mL', label: 'mg/mL' },
                        { value: '%', label: '%' },
                        { value: 'puff', label: 'puff' },
                        { value: 'drop', label: 'drop' },
                        { value: 'patch', label: 'patch' },
                      ]} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="frequency" label="Frequency">
                      <Select allowClear placeholder="Select frequency" options={[
                        { value: 'once_daily', label: 'Once Daily' },
                        { value: 'twice_daily', label: 'Twice Daily (BID)' },
                        { value: 'three_times_daily', label: 'Three Times Daily (TID)' },
                        { value: 'four_times_daily', label: 'Four Times Daily (QID)' },
                        { value: 'every_other_day', label: 'Every Other Day' },
                        { value: 'weekly', label: 'Weekly' },
                        { value: 'as_needed', label: 'As Needed (PRN)' },
                        { value: 'at_bedtime', label: 'At Bedtime' },
                        { value: 'before_meals', label: 'Before Meals' },
                        { value: 'with_food', label: 'With Food' },
                        { value: 'empty_stomach', label: 'Empty Stomach' },
                      ]} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="route" label="Route">
                      <Select allowClear placeholder="Select route" options={[
                        { value: 'oral', label: 'Oral' },
                        { value: 'topical', label: 'Topical' },
                        { value: 'sublingual', label: 'Sublingual' },
                        { value: 'buccal', label: 'Buccal' },
                        { value: 'intravenous', label: 'Intravenous (IV)' },
                        { value: 'intramuscular', label: 'Intramuscular (IM)' },
                        { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
                        { value: 'inhaled', label: 'Inhaled' },
                        { value: 'intranasal', label: 'Intranasal' },
                        { value: 'ophthalmic', label: 'Ophthalmic' },
                        { value: 'otic', label: 'Otic (Ear)' },
                        { value: 'rectal', label: 'Rectal' },
                        { value: 'vaginal', label: 'Vaginal' },
                        { value: 'transdermal', label: 'Transdermal' },
                      ]} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="durationDays" label="Duration (days)">
                      <InputNumber placeholder="30" min={1} max={365} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="startDate" label="Start Date">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="instructions" label="Instructions / SIG">
                  <Input.TextArea rows={2} placeholder="Take with food, avoid grapefruit..." />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="source" label="Source" initialValue="patient_reported">
                      <Select options={[
                        { value: 'patient_reported', label: 'Patient Reported' },
                        { value: 'prescription', label: 'Prescription' },
                        { value: 'encounter', label: 'Encounter' },
                        { value: 'pbm_history', label: 'PBM History' },
                      ]} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="takingStatus" label="Taking Status" initialValue="taking">
                      <Select options={[
                        { value: 'taking', label: 'Taking' },
                        { value: 'taking_differently', label: 'Taking Differently' },
                        { value: 'not_taking', label: 'Not Taking' },
                        { value: 'unknown', label: 'Unknown' },
                      ]} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="notes" label="Notes">
                  <Input.TextArea rows={2} placeholder="Additional notes..." />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">Add Medication</Button>
                    <Button onClick={() => { setAddMedModalOpen(false); addMedForm.resetFields(); }}>Cancel</Button>
                  </Space>
                </Form.Item>
              </Form>
            </Drawer>
          </Space>
        )}
      </div>
    );
  };

  // ── Tab: Care Plans ──
  const carePlanStatusColors: Record<string, string> = {
    active: 'green',
    completed: 'blue',
    suspended: 'orange',
    cancelled: 'red',
  };

  const taskStatusColors: Record<string, string> = {
    pending: 'blue',
    in_progress: 'processing',
    completed: 'green',
    cancelled: 'red',
    overdue: 'red',
    no_response: 'orange',
  };

  const taskTypeLabels: Record<string, string> = {
    monitoring: 'Monitoring',
    lab_order: 'Lab Order',
    imaging_order: 'Imaging Order',
    medication_adherence: 'Med Adherence',
    patient_education: 'Education',
    questionnaire: 'Questionnaire',
    appointment: 'Appointment',
    care_team_action: 'Care Team Action',
    lifestyle: 'Lifestyle',
    follow_up: 'Follow-Up',
    referral: 'Referral',
    custom: 'Custom',
  };

  const goalStatusColors: Record<string, string> = {
    active: 'blue',
    achieved: 'green',
    not_achieved: 'red',
    suspended: 'orange',
    cancelled: 'default',
  };

  const handleViewCarePlan = async (planId: string) => {
    setCarePlanDetailLoading(true);
    try {
      const data = await carePlanService.findOne(planId);
      setSelectedCarePlan(data);
    } catch {
      message.error('Failed to load care plan');
    } finally {
      setCarePlanDetailLoading(false);
    }
  };

  const handleApprovePlan = async (planId: string) => {
    try {
      await carePlanService.approve(planId);
      message.success('Care plan approved');
      fetchCarePlans();
      handleViewCarePlan(planId);
    } catch {
      message.error('Failed to approve');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await carePlanService.completeTask(taskId, {});
      message.success('Task completed');
      if (selectedCarePlan) handleViewCarePlan(selectedCarePlan.plan.id);
    } catch {
      message.error('Failed to complete task');
    }
  };

  const handleAIGenerateCarePlan = async () => {
    if (!patient || !id) return;
    if (patientProblems.length === 0) {
      message.warning('No active problems on the problem list. Add diagnoses first to generate a care plan.');
      return;
    }
    setAiGeneratingPlan(true);
    try {
      const age = calculateAge(patient.dateOfBirth);
      const conditions = patientProblems.map((p: any) => ({
        condition: p.description,
        code: p.code,
        codeSystem: p.codeSystem,
      }));
      const currentMedications = patientMeds
        .filter((m) => m.status === 'active')
        .map((m) => ({ name: m.medicationName, dosage: m.dosage || undefined }));
      const allergies = patient.allergies.map((a: any) => a.allergen);

      const response = await aiService.generateCarePlan({
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientAge: age,
        patientSex: patient.gender,
        conditions,
        currentMedications,
        allergies,
      });
      setAiPreviewPlan(response.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'AI care plan generation failed');
    } finally {
      setAiGeneratingPlan(false);
    }
  };

  const handleSaveAICarePlan = async () => {
    if (!aiPreviewPlan || !patient || !id) return;
    try {
      // Create the care plan
      const plan = await carePlanService.create({
        patientId: id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        title: aiPreviewPlan.title,
        description: aiPreviewPlan.description,
        category: aiPreviewPlan.category,
        addresses: aiPreviewPlan.addresses.map((a, i) => ({
          id: `addr-${i}`,
          condition: a.condition,
          code: a.code || a.icd10Code,
          codeSystem: a.codeSystem || (a.icd10Code ? 'ICD-10-CM' : undefined),
          description: a.description,
          severity: a.severity as any,
        })),
        careTeam: aiPreviewPlan.careTeam.map((c, i) => ({
          id: `ct-${i}`,
          name: c.role,
          role: c.role,
          isActive: true,
          joinedAt: new Date().toISOString(),
        })),
        isAiGenerated: true,
        patientEducation: aiPreviewPlan.patientEducation,
      });

      // Create goals
      for (const g of aiPreviewPlan.goals) {
        await carePlanService.createGoal({
          carePlanId: plan.id,
          patientId: id,
          description: g.description,
          targetValue: g.targetValue,
          targetUnit: g.targetUnit,
          metricName: g.metricName,
          targetDirection: g.targetDirection as any,
          priority: (g.priority as any) || 'medium',
          targetDate: g.targetDate,
        });
      }

      // Create tasks
      for (const t of aiPreviewPlan.tasks) {
        await carePlanService.createTask({
          carePlanId: plan.id,
          patientId: id,
          title: t.title,
          description: t.description,
          taskType: t.taskType as any,
          assignedTo: t.assignedTo as any,
          frequency: t.frequency as any,
          priority: (t.priority as any) || 'medium',
          metricName: t.metricName,
          targetValue: t.targetValue,
          targetUnit: t.targetUnit,
          isAiSuggested: true,
        });
      }

      message.success('AI care plan saved. Review and approve it.');
      setAiPreviewPlan(null);
      fetchCarePlans();
    } catch (err: any) {
      message.error('Failed to save AI care plan');
    }
  };

  const handleCreateCarePlan = async (values: any) => {
    if (!patient || !id) return;
    try {
      const condition = values.condition || planIcdDesc || undefined;
      const careTeam = (values.careTeam || [])
        .filter((m: any) => m && m.name && m.name.trim())
        .map((m: any, i: number) => ({
          id: `ct-${Date.now()}-${i}`,
          name: m.name.trim(),
          role: m.role || 'Care Team Member',
          isActive: true,
          joinedAt: new Date().toISOString(),
        }));
      const plan = await carePlanService.create({
        patientId: id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        title: values.title,
        description: values.description,
        category: values.category || 'chronic_care',
        status: 'active',
        intent: 'plan',
        startDate: values.startDate ? (values.startDate as dayjs.Dayjs).toISOString() : undefined,
        endDate: values.endDate ? (values.endDate as dayjs.Dayjs).toISOString() : undefined,
        addresses: condition
          ? [{ id: `addr-${Date.now()}`, condition, description: condition, code: planIcdCode || undefined, codeSystem: planIcdCode ? planCodeSystem : undefined }]
          : [],
        careTeam,
        notes: values.notes,
      });

      // Create goals from the form
      const goals = (values.goals || [])
        .filter((g: any) => g && g.description && g.description.trim());
      for (const g of goals) {
        await carePlanService.createGoal({
          carePlanId: plan.id,
          patientId: id,
          description: g.description.trim(),
          targetValue: g.targetValue || undefined,
          targetUnit: g.targetUnit || undefined,
          metricName: g.metricName || undefined,
          targetDirection: g.targetDirection || undefined,
          priority: g.priority || 'medium',
          targetDate: g.targetDate ? (g.targetDate as dayjs.Dayjs).toISOString() : undefined,
        });
      }

      message.success(`Care plan created${goals.length > 0 ? ` with ${goals.length} goal${goals.length > 1 ? 's' : ''}` : ''}`);
      setCreatePlanModalOpen(false);
      createPlanForm.resetFields();
      setPlanIcdCode('');
      setPlanIcdDesc('');
      setPlanCodeSystem('ICD-10-CM');
      fetchCarePlans();
      handleViewCarePlan(plan.id);
    } catch {
      message.error('Failed to create care plan');
    }
  };

  const handleAddGoal = async (values: any) => {
    if (!selectedCarePlan || !id) return;
    const goals = (values.goals || []).filter((g: any) => g && g.description && g.description.trim());
    if (goals.length === 0) {
      message.warning('Add at least one goal with a description');
      return;
    }
    try {
      let count = 0;
      for (const g of goals) {
        await carePlanService.createGoal({
          carePlanId: selectedCarePlan.plan.id,
          patientId: id,
          description: g.description.trim(),
          targetValue: g.targetValue != null ? String(g.targetValue) : undefined,
          targetUnit: g.targetUnit,
          metricName: g.metricName,
          targetDirection: g.targetDirection,
          priority: g.priority || 'medium',
          targetDate: g.targetDate ? (g.targetDate as dayjs.Dayjs).toISOString() : undefined,
          notes: g.notes,
        });
        count++;
      }
      message.success(`${count} goal${count > 1 ? 's' : ''} added`);
      setAddGoalModalOpen(false);
      addGoalForm.resetFields();
      handleViewCarePlan(selectedCarePlan.plan.id);
    } catch {
      message.error('Failed to add goal(s)');
    }
  };

  const handleAddTask = async (values: any) => {
    if (!selectedCarePlan || !id) return;
    const tasks = (values.tasks || []).filter((t: any) => t && t.title && t.title.trim());
    if (tasks.length === 0) {
      message.warning('Add at least one task with a title');
      return;
    }
    try {
      let count = 0;
      for (const t of tasks) {
        await carePlanService.createTask({
          carePlanId: selectedCarePlan.plan.id,
          patientId: id,
          title: t.title.trim(),
          description: t.description,
          taskType: t.taskType || 'monitoring',
          assignedTo: t.assignedTo || 'patient',
          frequency: t.frequency || 'daily',
          priority: t.priority || 'medium',
          metricName: t.metricName,
          targetValue: t.targetValue != null ? String(t.targetValue) : undefined,
          targetUnit: t.targetUnit,
          dueDate: t.dueDate ? (t.dueDate as dayjs.Dayjs).toISOString() : undefined,
          notes: t.notes,
        });
        count++;
      }
      message.success(`${count} task${count > 1 ? 's' : ''} added`);
      setAddTaskModalOpen(false);
      addTaskForm.resetFields();
      handleViewCarePlan(selectedCarePlan.plan.id);
    } catch {
      message.error('Failed to add task(s)');
    }
  };

  const GrowthChartsTab = () => {
    if (growthLoading) {
      return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
    }

    if (!growthData) {
      return (
        <Card>
          <Empty description="Unable to load growth chart data. Ensure the patient has a date of birth and recorded vitals." />
        </Card>
      );
    }

    const hasAnyData =
      growthData.measurements.weight.length > 0 ||
      growthData.measurements.height.length > 0 ||
      growthData.measurements.headCircumference.length > 0 ||
      growthData.measurements.bmi.length > 0;

    return (
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5}>Growth Charts</Title>
          <Space size="large">
            <Tag color={growthData.sex === 'male' ? 'blue' : 'pink'}>
              {growthData.sex === 'male' ? 'Male' : 'Female'}
            </Tag>
            {growthData.gestationalAgeWeeks && growthData.gestationalAgeWeeks < 37 && (
              <Tag color="orange">
                Preemie ({growthData.gestationalAgeWeeks}w gestation — adjusted age applied)
              </Tag>
            )}
            {growthData.midParentalHeight && (
              <Tag color="purple">
                Target Height: {growthData.midParentalHeight.targetHeightCm}cm
              </Tag>
            )}
            <Button icon={<RobotOutlined />} loading={growthAssessmentLoading} onClick={handleGrowthAssessment}>
              AI Assessment
            </Button>
            <Button icon={<RobotOutlined />} loading={growthCounselingLoading} onClick={handleGrowthCounseling}>
              AI Counseling
            </Button>
            <Select
              allowClear
              placeholder="Specialty Chart"
              style={{ width: 180 }}
              value={specialtyChart}
              onChange={(v) => setSpecialtyChart(v)}
              options={[
                { value: 'down-syndrome', label: 'Down Syndrome' },
                { value: 'achondroplasia', label: 'Achondroplasia' },
                { value: 'turner-syndrome', label: 'Turner Syndrome' },
              ]}
            />
          </Space>
        </div>

        {/* Growth Velocity */}
        {growthData?.velocity && growthData.velocity.length > 0 && (
          <Card title="Growth Velocity" size="small">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {growthData.velocity.map((v, i) => (
                <div key={i}>
                  <Tag color={v.assessment === 'slow' ? 'red' : v.assessment === 'rapid' ? 'orange' : 'green'}>
                    {v.measurement}
                  </Tag>
                  <Text> {v.valuePerYear} {v.unit}</Text>
                  <Text type="secondary"> — {v.period}</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>({v.assessment})</Text>
                </div>
              ))}
            </Space>
          </Card>
        )}

        {/* AI Growth Assessment Result */}
        {growthAssessment && (
          <Card title={<span><RobotOutlined /> AI Growth Assessment</span>} size="small">
            <Alert
              type={growthAssessment.overallAssessment?.includes('normal') ? 'success' : growthAssessment.overallAssessment?.includes('concern') ? 'warning' : 'error'}
              message={growthAssessment.overallAssessment}
              style={{ marginBottom: 12 }}
            />
            {growthAssessment.summary && <Paragraph>{growthAssessment.summary}</Paragraph>}
            {growthAssessment.concerns?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>Clinical Concerns</Text>
                {growthAssessment.concerns.map((c: any, i: number) => (
                  <Alert
                    key={i}
                    type={c.severity === 'severe' ? 'error' : c.severity === 'moderate' ? 'warning' : 'info'}
                    style={{ marginTop: 8 }}
                    message={`${c.type} (${c.severity})`}
                    description={<><div>{c.detail}</div><Text type="secondary" style={{ fontSize: 12 }}>Evidence: {c.evidence}</Text></>}
                  />
                ))}
              </div>
            )}
            {growthAssessment.growthVelocity && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>Growth Velocity: </Text>
                <Text>{growthAssessment.growthVelocity.assessment}</Text>
                {growthAssessment.growthVelocity.weightVelocity && <Text type="secondary" style={{ marginLeft: 8 }}>Weight: {growthAssessment.growthVelocity.weightVelocity}</Text>}
                {growthAssessment.growthVelocity.heightVelocity && <Text type="secondary" style={{ marginLeft: 8 }}>Height: {growthAssessment.growthVelocity.heightVelocity}</Text>}
              </div>
            )}
            {growthAssessment.recommendations?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>Recommendations</Text>
                {growthAssessment.recommendations.map((r: any, i: number) => (
                  <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                    <Tag color={r.priority === 'high' ? 'red' : r.priority === 'moderate' ? 'orange' : 'blue'}>{r.priority}</Tag>
                    <Text> {r.action}</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{r.rationale} — Timeframe: {r.timeframe}</Text>
                  </div>
                ))}
              </div>
            )}
            {growthAssessment.followUp && (
              <Alert
                type="info"
                message="Follow-Up Plan"
                description={<>
                  <div>When: {growthAssessment.followUp.timeframe}</div>
                  <div>Measure: {growthAssessment.followUp.measurements?.join(', ')}</div>
                  {growthAssessment.followUp.referralNeeded && <div><Text strong>Referral needed: </Text>{growthAssessment.followUp.referralType}</div>}
                </>}
              />
            )}
          </Card>
        )}

        {/* AI Growth Counseling Result */}
        {growthCounseling && (
          <Card title={<span><RobotOutlined /> Parent-Friendly Growth Explanation</span>} size="small">
            <Paragraph>{growthCounseling.greeting}</Paragraph>
            <Alert type="info" message={growthCounseling.overallMessage} style={{ marginBottom: 12 }} />
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {growthCounseling.whatThePercentilesMean && <div><Text strong>What percentiles mean: </Text><Text>{growthCounseling.whatThePercentilesMean}</Text></div>}
              {growthCounseling.weightExplanation && <div><Text strong>Weight: </Text><Text>{growthCounseling.weightExplanation}</Text></div>}
              {growthCounseling.heightExplanation && <div><Text strong>Height: </Text><Text>{growthCounseling.heightExplanation}</Text></div>}
              {growthCounseling.headCircumferenceExplanation && <div><Text strong>Head circumference: </Text><Text>{growthCounseling.headCircumferenceExplanation}</Text></div>}
              {growthCounseling.bmiExplanation && <div><Text strong>BMI: </Text><Text>{growthCounseling.bmiExplanation}</Text></div>}
              {growthCounseling.nutritionTips?.length > 0 && (
                <div><Text strong>Nutrition tips:</Text><ul style={{ margin: '4px 0 0 20px' }}>{growthCounseling.nutritionTips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
              )}
              {growthCounseling.activityTips?.length > 0 && (
                <div><Text strong>Activity tips:</Text><ul style={{ margin: '4px 0 0 20px' }}>{growthCounseling.activityTips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></div>
              )}
              {growthCounseling.whenToRecheck && <div><Text strong>Next check: </Text><Text>{growthCounseling.whenToRecheck}</Text></div>}
              {growthCounseling.whenToCallDoctor?.length > 0 && (
                <Alert type="warning" message="When to call your doctor" description={growthCounseling.whenToCallDoctor.map((s: string, i: number) => <div key={i}>• {s}</div>)} />
              )}
              {growthCounseling.encouragement && <Paragraph style={{ marginTop: 8, color: '#52c41a' }}>{growthCounseling.encouragement}</Paragraph>}
            </Space>
          </Card>
        )}

        {!hasAnyData && (
          <Alert
            type="info"
            showIcon
            message="No growth measurements recorded yet"
            description="Record weight, height/length, head circumference, or BMI during encounters to see the patient's growth plotted against WHO/CDC percentile curves."
          />
        )}

        <Card size="small">
          <GrowthChart
            title="Weight-for-Age"
            unit="kg"
            dataPoints={growthData.measurements.weight}
            curves={growthData.percentileCurves.weight}
            color="#0D7C8A"
          />
        </Card>

        <Card size="small">
          <GrowthChart
            title="Height/Length-for-Age"
            unit="cm"
            dataPoints={growthData.measurements.height}
            curves={growthData.percentileCurves.height}
            midParentalHeight={growthData.midParentalHeight}
            color="#52c41a"
          />
        </Card>

        {growthData.measurements.headCircumference.length > 0 || growthData.percentileCurves.headCircumference.length > 0 ? (
          <Card size="small">
            <GrowthChart
              title="Head Circumference-for-Age"
              unit="cm"
              dataPoints={growthData.measurements.headCircumference}
              curves={growthData.percentileCurves.headCircumference}
              color="#722ed1"
            />
          </Card>
        ) : null}

        {growthData.measurements.bmi.length > 0 || growthData.percentileCurves.bmi.length > 0 ? (
          <Card size="small">
            <GrowthChart
              title="BMI-for-Age"
              unit="kg/m²"
              dataPoints={growthData.measurements.bmi}
              curves={growthData.percentileCurves.bmi}
              color="#fa8c16"
            />
          </Card>
        ) : null}
      </Space>
    );
  };

  const handleAddImmunization = async (values: any) => {
    if (!id) return;
    try {
      const data: CreateImmunizationData = {
        patientId: id,
        vaccineName: values.vaccineName,
        cvxCode: values.cvxCode || undefined,
        cptCode: values.cptCode || undefined,
        manufacturer: values.manufacturer || undefined,
        lotNumber: values.lotNumber || undefined,
        expirationDate: values.expirationDate ? values.expirationDate.format('YYYY-MM-DD') : undefined,
        administeredDate: values.administeredDate.format('YYYY-MM-DD'),
        doseNumber: values.doseNumber || undefined,
        doseAmount: values.doseAmount || undefined,
        doseUnit: values.doseUnit || undefined,
        route: values.route || undefined,
        site: values.site || undefined,
        source: values.source || 'administered',
        providerName: values.providerName || undefined,
        facilityName: values.facilityName || undefined,
        visDate: values.visDate ? values.visDate.format('YYYY-MM-DD') : undefined,
        vfcEligibility: values.vfcEligibility || undefined,
        fundingSource: values.fundingSource || undefined,
        notes: values.notes || undefined,
      };
      await immunizationService.create(data);
      message.success('Immunization recorded');
      immunizationForm.resetFields();
      setAddImmunizationDrawerOpen(false);
      fetchImmunizations();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to record immunization');
    }
  };

  const handleDeleteImmunization = async (immId: string) => {
    try {
      await immunizationService.remove(immId);
      message.success('Immunization removed');
      fetchImmunizations();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to remove immunization');
    }
  };

  const ImmunizationsTab = () => {
    const routeOptions = [
      { value: 'intramuscular', label: 'Intramuscular (IM)' },
      { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
      { value: 'intradermal', label: 'Intradermal (ID)' },
      { value: 'intranasal', label: 'Intranasal' },
      { value: 'oral', label: 'Oral' },
      { value: 'intravenous', label: 'Intravenous (IV)' },
      { value: 'transdermal', label: 'Transdermal' },
    ];
    const siteOptions = [
      { value: 'left arm', label: 'Left Arm' },
      { value: 'right arm', label: 'Right Arm' },
      { value: 'left thigh', label: 'Left Thigh' },
      { value: 'right thigh', label: 'Right Thigh' },
      { value: 'left deltoid', label: 'Left Deltoid' },
      { value: 'right deltoid', label: 'Right Deltoid' },
      { value: 'left gluteal', label: 'Left Gluteal' },
      { value: 'right gluteal', label: 'Right Gluteal' },
      { value: 'left vastus lateralis', label: 'Left Vastus Lateralis' },
      { value: 'right vastus lateralis', label: 'Right Vastus Lateralis' },
    ];
    const sourceLabels: Record<string, string> = {
      administered: 'Administered',
      historical: 'Historical',
      registry: 'Registry',
      patient_reported: 'Patient Reported',
    };
    const sourceColors: Record<string, string> = {
      administered: 'green',
      historical: 'blue',
      registry: 'purple',
      patient_reported: 'orange',
    };

    const columns: ColumnsType<Immunization> = [
      {
        title: 'Vaccine',
        key: 'vaccine',
        render: (_, r) => (
          <Space direction="vertical" size={0}>
            <Text strong>{r.vaccineName}</Text>
            {r.cvxCode && <Text type="secondary" style={{ fontSize: 12 }}>CVX: {r.cvxCode}</Text>}
            {r.cptCode && <Text type="secondary" style={{ fontSize: 12 }}>CPT: {r.cptCode}</Text>}
          </Space>
        ),
      },
      {
        title: 'Date',
        dataIndex: 'administeredDate',
        key: 'date',
        render: (d: string) => dayjs(d).format('MM/DD/YYYY'),
        sorter: (a, b) => dayjs(a.administeredDate).valueOf() - dayjs(b.administeredDate).valueOf(),
        defaultSortOrder: 'descend',
      },
      {
        title: 'Dose',
        key: 'dose',
        render: (_, r) => (
          <Space direction="vertical" size={0}>
            {r.doseNumber && <Text>Dose #{r.doseNumber}</Text>}
            {r.doseAmount && <Text type="secondary" style={{ fontSize: 12 }}>{r.doseAmount} {r.doseUnit || ''}</Text>}
          </Space>
        ),
      },
      {
        title: 'Route / Site',
        key: 'routeSite',
        render: (_, r) => (
          <Space direction="vertical" size={0}>
            {r.route && <Text style={{ textTransform: 'capitalize' }}>{r.route}</Text>}
            {r.site && <Text type="secondary" style={{ fontSize: 12 }}>{r.site}</Text>}
          </Space>
        ),
      },
      {
        title: 'Lot / Mfr',
        key: 'lot',
        render: (_, r) => (
          <Space direction="vertical" size={0}>
            {r.lotNumber && <Text style={{ fontSize: 12 }}>{r.lotNumber}</Text>}
            {r.manufacturer && <Text type="secondary" style={{ fontSize: 12 }}>{r.manufacturer}</Text>}
          </Space>
        ),
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        render: (s: string) => <Tag color={sourceColors[s]}>{sourceLabels[s] || s}</Tag>,
      },
      {
        title: 'Provider',
        key: 'provider',
        render: (_, r) => (
          <Space direction="vertical" size={0}>
            {r.providerName && <Text style={{ fontSize: 12 }}>{r.providerName}</Text>}
            {r.facilityName && <Text type="secondary" style={{ fontSize: 12 }}>{r.facilityName}</Text>}
          </Space>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_, r) => (
          <Popconfirm
            title="Remove this immunization record?"
            onConfirm={() => handleDeleteImmunization(r.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        ),
      },
    ];

    return (
      <div>
        {immunizationsLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5}>Immunization History ({immunizations.length})</Title>
              <Space>
                <Button
                  icon={<RobotOutlined />}
                  loading={immunizationForecastLoading}
                  onClick={handleImmunizationForecast}
                >
                  AI Forecast
                </Button>
                <Button
                  icon={<GlobalOutlined />}
                  onClick={() => setTravelModalOpen(true)}
                >
                  Travel Vaccines
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddImmunizationDrawerOpen(true)}>
                  Add Immunization
                </Button>
              </Space>
            </div>

            {immunizations.length === 0 ? (
              <Card><Empty description="No immunizations on file. Record administered vaccines or historical immunizations." /></Card>
            ) : (
              <Card size="small">
                <Table<Immunization>
                  dataSource={immunizations}
                  columns={columns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            )}

            {/* AI Immunization Forecast Result */}
            {immunizationForecast && (
              <Card title={<span><RobotOutlined /> AI Immunization Forecast</span>} size="small">
                <Alert type="info" message={immunizationForecast.summary} style={{ marginBottom: 12 }} />
                {immunizationForecast.overdue?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ color: '#ff4d4f' }}>Overdue</Text>
                    {immunizationForecast.overdue.map((v: any, i: number) => (
                      <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                        <Tag color="red">{v.vaccineName} — Dose {v.doseNumber}</Tag>
                        <Text type="secondary"> {v.reason}</Text>
                        {v.catchUpRecommendation && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Catch-up: {v.catchUpRecommendation}</Text>}
                      </div>
                    ))}
                  </div>
                )}
                {immunizationForecast.dueNow?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ color: '#fa8c16' }}>Due Now</Text>
                    {immunizationForecast.dueNow.map((v: any, i: number) => (
                      <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                        <Tag color="orange">{v.vaccineName} — Dose {v.doseNumber}</Tag>
                        <Text type="secondary"> {v.reason}</Text>
                        <Button size="small" type="link" onClick={() => handleVaccineEducation(v.vaccineName)}>Education</Button>
                      </div>
                    ))}
                  </div>
                )}
                {immunizationForecast.upcoming?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ color: '#52c41a' }}>Upcoming</Text>
                    {immunizationForecast.upcoming.map((v: any, i: number) => (
                      <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                        <Tag color="green">{v.vaccineName} — Dose {v.doseNumber}</Tag>
                        <Text type="secondary"> Due: {v.dueDate}</Text>
                      </div>
                    ))}
                  </div>
                )}
                {immunizationForecast.completed?.length > 0 && (
                  <div>
                    <Text strong>Completed Series</Text>
                    {immunizationForecast.completed.map((v: any, i: number) => (
                      <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                        <Tag color={v.status === 'complete' ? 'green' : 'blue'}>{v.vaccineName}</Tag>
                        <Text type="secondary"> {v.dosesReceived}/{v.dosesRequired} doses — {v.status}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* AI Vaccine Education Result */}
            {vaccineEducationLoading && <Card><div style={{ textAlign: 'center', padding: 30 }}><Spin tip="Generating vaccine education..." /></div></Card>}
            {vaccineEducation && (
              <Card title={<span><RobotOutlined /> Vaccine Education: {vaccineEducationName}</span>} size="small">
                <Alert type="info" message={vaccineEducation.summary} style={{ marginBottom: 12 }} />
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div><Text strong>What it protects against: </Text><Text>{vaccineEducation.whatItProtectsAgainst}</Text></div>
                  <div><Text strong>Why important: </Text><Text>{vaccineEducation.whyImportant}</Text></div>
                  <div><Text strong>How given: </Text><Text>{vaccineEducation.howGiven}</Text></div>
                  {vaccineEducation.commonSideEffects?.length > 0 && (
                    <div><Text strong>Common side effects: </Text><Text>{vaccineEducation.commonSideEffects.join(', ')}</Text></div>
                  )}
                  {vaccineEducation.rareSideEffects?.length > 0 && (
                    <div><Text strong>Rare side effects: </Text><Text>{vaccineEducation.rareSideEffects.join(', ')}</Text></div>
                  )}
                  {vaccineEducation.whenToCallDoctor?.length > 0 && (
                    <Alert type="warning" message="When to call doctor" description={vaccineEducation.whenToCallDoctor.map((s: string, i: number) => <div key={i}>• {s}</div>)} style={{ marginTop: 4 }} />
                  )}
                  {vaccineEducation.mythsAndFacts?.length > 0 && (
                    <div>
                      <Text strong>Myths & Facts</Text>
                      {vaccineEducation.mythsAndFacts.map((mf: any, i: number) => (
                        <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                          <Text type="secondary">Myth: {mf.myth}</Text><br />
                          <Text>Fact: {mf.fact}</Text>
                        </div>
                      ))}
                    </div>
                  )}
                  {vaccineEducation.parentTips?.length > 0 && (
                    <div><Text strong>Parent tips: </Text><Text>{vaccineEducation.parentTips.join(', ')}</Text></div>
                  )}
                </Space>
              </Card>
            )}

            {/* AI Travel Vaccines Result */}
            {travelVaccines && (
              <Card title={<span><GlobalOutlined /> Travel Vaccine Recommendations</span>} size="small">
                <Alert type="info" message={travelVaccines.summary} style={{ marginBottom: 12 }} />
                {travelVaccines.requiredVaccines?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ color: '#ff4d4f' }}>Required for Entry</Text>
                    {travelVaccines.requiredVaccines.map((v: any, i: number) => (
                      <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                        <Tag color="red">{v.vaccineName}</Tag>
                        {v.alreadyCovered && <Tag color="green">Already Covered</Tag>}
                        <Text type="secondary"> {v.reason}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Schedule: {v.schedule} — {v.dosesNeeded} dose(s)</Text>
                      </div>
                    ))}
                  </div>
                )}
                {travelVaccines.recommendedVaccines?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ color: '#fa8c16' }}>Recommended</Text>
                    {travelVaccines.recommendedVaccines.map((v: any, i: number) => (
                      <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                        <Tag color="orange">{v.vaccineName}</Tag>
                        {v.alreadyCovered && <Tag color="green">Already Covered</Tag>}
                        <Text type="secondary"> {v.reason}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Schedule: {v.schedule}</Text>
                      </div>
                    ))}
                  </div>
                )}
                {travelVaccines.routineBoosters?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Routine Boosters Needed</Text>
                    {travelVaccines.routineBoosters.map((v: any, i: number) => (
                      <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                        <Tag color="blue">{v.vaccineName}</Tag>
                        <Text type="secondary"> {v.reason}</Text>
                      </div>
                    ))}
                  </div>
                )}
                {travelVaccines.medications?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Medications (e.g. Antimalarials)</Text>
                    {travelVaccines.medications.map((m: any, i: number) => (
                      <div key={i} style={{ marginLeft: 16, marginTop: 4 }}>
                        <Tag color="purple">{m.medication}</Tag>
                        <Text type="secondary"> {m.reason}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{m.schedule} — Duration: {m.duration}</Text>
                      </div>
                    ))}
                  </div>
                )}
                {travelVaccines.destinationSpecificRisks?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Destination-Specific Risks</Text>
                    {travelVaccines.destinationSpecificRisks.map((d: any, i: number) => (
                      <Alert key={i} type="warning" style={{ marginTop: 8 }} message={d.destination} description={<><div>{d.risks?.join(', ')}</div>{d.notes && <Text type="secondary">{d.notes}</Text>}</>} />
                    ))}
                  </div>
                )}
                {travelVaccines.timeSensitive?.length > 0 && (
                  <Alert type="error" message="Time-Sensitive Actions" description={travelVaccines.timeSensitive.map((s: string, i: number) => <div key={i}>• {s}</div>)} />
                )}
                {travelVaccines.precautions?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Text strong>General Precautions</Text>
                    <ul style={{ margin: '4px 0 0 20px' }}>{travelVaccines.precautions.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
                  </div>
                )}
              </Card>
            )}

            {/* Travel Vaccines Modal */}
            <Modal
              title="Travel Vaccine Recommendations"
              open={travelModalOpen}
              onCancel={() => setTravelModalOpen(false)}
              footer={null}
            >
              <Form form={travelForm} layout="vertical" onFinish={handleTravelVaccines}>
                <Form.Item name="destinations" label="Destinations (comma-separated)" rules={[{ required: true, message: 'At least one destination required' }]}>
                  <Input placeholder="e.g. Kenya, Thailand, Brazil" />
                </Form.Item>
                <Form.Item name="departureDate" label="Departure Date" rules={[{ required: true, message: 'Departure date required' }]}>
                  <Input type="date" />
                </Form.Item>
                <Form.Item name="returnDate" label="Return Date (optional)">
                  <Input type="date" />
                </Form.Item>
                <Form.Item name="pregnancy" label="Pregnant?">
                  <Select allowClear placeholder="Select if applicable">
                    <Select.Option value={true}>Yes</Select.Option>
                    <Select.Option value={false}>No</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={travelVaccinesLoading} icon={<RobotOutlined />}>
                    Get Recommendations
                  </Button>
                </Form.Item>
              </Form>
            </Modal>

            <Drawer
              title="Record Immunization"
              open={addImmunizationDrawerOpen}
              onClose={() => setAddImmunizationDrawerOpen(false)}
              width={480}
              destroyOnClose
            >
              <Form
                form={immunizationForm}
                layout="vertical"
                onFinish={handleAddImmunization}
                initialValues={{ source: 'administered', route: 'intramuscular' }}
              >
                <Form.Item name="vaccineName" label="Vaccine Name" rules={[{ required: true, message: 'Vaccine name is required' }]}>
                  <Input placeholder="e.g. Influenza quadrivalent, MMR, Tdap" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="cvxCode" label="CVX Code">
                      <Input placeholder="e.g. 141" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="cptCode" label="CPT Code">
                      <Input placeholder="e.g. 90686" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="administeredDate" label="Date Administered" rules={[{ required: true, message: 'Date is required' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="doseNumber" label="Dose #">
                      <InputNumber min={1} style={{ width: '100%' }} placeholder="1" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="doseAmount" label="Dose Amount">
                      <Input placeholder="0.5" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="doseUnit" label="Unit">
                      <Input placeholder="mL" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="route" label="Route">
                      <Select options={routeOptions} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="site" label="Site">
                      <Select options={siteOptions} allowClear />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="manufacturer" label="Manufacturer">
                      <Input placeholder="e.g. Sanofi Pasteur" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="lotNumber" label="Lot Number">
                      <Input placeholder="e.g. U12345" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="expirationDate" label="Expiration Date">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="visDate" label="VIS Date">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="source" label="Source">
                  <Select options={[
                    { value: 'administered', label: 'Administered (in-clinic)' },
                    { value: 'historical', label: 'Historical (from records)' },
                    { value: 'registry', label: 'Registry (from IIS)' },
                    { value: 'patient_reported', label: 'Patient Reported' },
                  ]} />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="providerName" label="Administering Provider">
                      <Input placeholder="Dr. Smith" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="facilityName" label="Facility">
                      <Input placeholder="Neuraline Clinic" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="notes" label="Notes">
                  <Input.TextArea rows={2} placeholder="Any notes about this immunization" />
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">Record Immunization</Button>
                    <Button onClick={() => setAddImmunizationDrawerOpen(false)}>Cancel</Button>
                  </Space>
                </Form.Item>
              </Form>
            </Drawer>
          </Space>
        )}
      </div>
    );
  };

  const CarePlansTab = () => {
    if (selectedCarePlan) {
      const { plan, goals, tasks } = selectedCarePlan;
      return (
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedCarePlan(null)}
            style={{ marginBottom: 16 }}
          >
            Back to Care Plans
          </Button>

          {carePlanDetailLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card
                title={
                  <Space>
                    <Text strong style={{ fontSize: 16 }}>{plan.title}</Text>
                    <Tag color={carePlanStatusColors[plan.status]}>{plan.status}</Tag>
                    {plan.isAiGenerated && <Tag color="purple">AI Generated</Tag>}
                    {plan.isApproved ? <Tag color="green">Approved</Tag> : <Tag color="orange">Pending Approval</Tag>}
                  </Space>
                }
                extra={!plan.isApproved && (
                  <Button type="primary" onClick={() => handleApprovePlan(plan.id)}>Approve</Button>
                )}
              >
                <Descriptions column={2} size="small">
                  {plan.description && <Descriptions.Item label="Description" span={2}>{plan.description}</Descriptions.Item>}
                  <Descriptions.Item label="Category">{plan.category}</Descriptions.Item>
                  <Descriptions.Item label="Provider">{plan.providerName || 'N/A'}</Descriptions.Item>
                  {plan.startDate && <Descriptions.Item label="Start">{dayjs(plan.startDate).format('MM/DD/YYYY')}</Descriptions.Item>}
                  {plan.endDate && <Descriptions.Item label="End">{dayjs(plan.endDate).format('MM/DD/YYYY')}</Descriptions.Item>}
                </Descriptions>
                {plan.addresses.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Text strong>Health Concerns: </Text>
                    {plan.addresses.map((c, i) => (
                      <Tag key={i} color="blue">{c.condition || c.description}{(c.code || c.icd10Code) ? ` (${c.code || c.icd10Code}${c.codeSystem ? ' — ' + c.codeSystem : ''})` : ''}</Tag>
                    ))}
                  </div>
                )}
                {plan.careTeam.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text strong>Care Team: </Text>
                    {plan.careTeam.map((m, i) => (
                      <Tag key={i}>{m.name} ({m.role})</Tag>
                    ))}
                  </div>
                )}
              </Card>

              {/* Goals */}
              <Card
                title={`Goals (${goals.length})`}
                size="small"
                extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setAddGoalModalOpen(true)}>Add Goal</Button>}
              >
                {goals.length > 0 ? (
                  <Table<CarePlanGoal>
                    dataSource={goals}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  >
                    <Table.Column
                      title="Goal"
                      dataIndex="description"
                      key="desc"
                      render={(d: string) => <Text strong>{d}</Text>}
                    />
                    <Table.Column
                      title="Target"
                      key="target"
                      render={(_, g: CarePlanGoal) => g.targetValue ? `${g.targetValue} ${g.targetUnit || ''}` : 'N/A'}
                    />
                    <Table.Column
                      title="Current"
                      key="current"
                      render={(_, g: CarePlanGoal) => g.currentValue ? (
                        <Text style={g.status === 'achieved' ? { color: '#52c41a', fontWeight: 'bold' } : {}}>
                          {g.currentValue} {g.targetUnit || ''}
                        </Text>
                      ) : <Text type="secondary">—</Text>}
                    />
                    <Table.Column
                      title="Progress"
                      key="progress"
                      render={(_, g: CarePlanGoal) => {
                        if (!g.targetValue || !g.currentValue) return null;
                        const target = parseFloat(g.targetValue);
                        const current = parseFloat(g.currentValue);
                        if (isNaN(target) || isNaN(current)) return null;
                        const pct = g.targetDirection === 'decrease'
                          ? Math.min(100, Math.round((target / current) * 100))
                          : g.targetDirection === 'increase'
                          ? Math.min(100, Math.round((current / target) * 100))
                          : 100;
                        return <Progress percent={pct} size="small" status={g.status === 'achieved' ? 'success' : 'active'} />;
                      }}
                    />
                    <Table.Column
                      title="Status"
                      dataIndex="status"
                      key="status"
                      render={(s: string) => <Tag color={goalStatusColors[s]}>{s.replace(/_/g, ' ')}</Tag>}
                    />
                    <Table.Column
                      title="Due"
                      dataIndex="targetDate"
                      key="due"
                      render={(d: string) => d ? dayjs(d).format('MM/DD/YYYY') : 'N/A'}
                    />
                  </Table>
                ) : <Empty description="No goals" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>

              {/* Tasks */}
              <Card
                title={`Monitoring Tasks (${tasks.length})`}
                size="small"
                extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setAddTaskModalOpen(true)}>Add Task</Button>}
              >
                {tasks.length > 0 ? (
                  <Table<CarePlanTask>
                    dataSource={tasks}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  >
                    <Table.Column
                      title="Task"
                      key="title"
                      render={(_, t: CarePlanTask) => (
                        <Space direction="vertical" size={0}>
                          <Text strong>{t.title}</Text>
                          {t.description && <Text type="secondary" style={{ fontSize: 12 }}>{t.description}</Text>}
                        </Space>
                      )}
                    />
                    <Table.Column
                      title="Type"
                      dataIndex="taskType"
                      key="type"
                      render={(t: string) => <Tag>{taskTypeLabels[t] || t}</Tag>}
                    />
                    <Table.Column
                      title="Assigned To"
                      dataIndex="assignedTo"
                      key="assigned"
                      render={(a: string) => <Tag>{a.replace(/_/g, ' ')}</Tag>}
                    />
                    <Table.Column
                      title="Frequency"
                      dataIndex="frequency"
                      key="freq"
                      render={(f: string) => f.replace(/_/g, ' ')}
                    />
                    <Table.Column
                      title="Status"
                      dataIndex="status"
                      key="status"
                      render={(s: string) => <Tag color={taskStatusColors[s]}>{s.replace(/_/g, ' ')}</Tag>}
                    />
                    <Table.Column
                      title="Due"
                      dataIndex="dueDate"
                      key="due"
                      render={(d: string) => d ? dayjs(d).format('MM/DD/YYYY') : 'N/A'}
                    />
                    <Table.Column
                      title="Last Reported"
                      key="reported"
                      render={(_, t: CarePlanTask) => t.reportedValue ? (
                        <Text>{t.reportedValue} {t.targetUnit || ''}</Text>
                      ) : <Text type="secondary">—</Text>}
                    />
                    <Table.Column
                      title="Action"
                      key="action"
                      render={(_, t: CarePlanTask) => t.status !== 'completed' && (
                        <Button size="small" type="link" onClick={() => handleCompleteTask(t.id)}>Complete</Button>
                      )}
                    />
                  </Table>
                ) : <Empty description="No tasks" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>

              {plan.patientEducation.length > 0 && (
                <Card title="Patient Education" size="small">
                  {plan.patientEducation.map((edu, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <Text strong>{edu.title}</Text>
                      <Paragraph type="secondary" style={{ marginTop: 4 }}>{edu.content}</Paragraph>
                    </div>
                  ))}
                </Card>
              )}
            </Space>
          )}
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={5}>Care Plans ({carePlans.length})</Title>
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setCreatePlanModalOpen(true)}
            >
              Create Care Plan
            </Button>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              loading={aiGeneratingPlan}
              onClick={handleAIGenerateCarePlan}
            >
              Generate AI Care Plan
            </Button>
          </Space>
        </div>

        {carePlansLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : carePlans.length === 0 ? (
          <Card><Empty description="No care plans. Use the AI button above to generate one from the patient's problem list, or create one manually." /></Card>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {carePlans.map((plan) => (
              <Card
                key={plan.id}
                hoverable
                onClick={() => handleViewCarePlan(plan.id)}
                title={
                  <Space>
                    <Text strong>{plan.title}</Text>
                    <Tag color={carePlanStatusColors[plan.status]}>{plan.status}</Tag>
                    {plan.isAiGenerated && <Tag color="purple">AI</Tag>}
                    {plan.isApproved ? <Tag color="green">Approved</Tag> : <Tag color="orange">Pending</Tag>}
                  </Space>
                }
                size="small"
              >
                <Space direction="vertical" size={4}>
                  {plan.description && <Text type="secondary">{plan.description}</Text>}
                  <Space>
                    <Text type="secondary">Category: {plan.category}</Text>
                    {plan.providerName && <Text type="secondary">· Provider: {plan.providerName}</Text>}
                  </Space>
                  <Space>
                    {plan.startDate && <Text type="secondary">Start: {dayjs(plan.startDate).format('MM/DD/YYYY')}</Text>}
                    {plan.endDate && <Text type="secondary">· End: {dayjs(plan.endDate).format('MM/DD/YYYY')}</Text>}
                  </Space>
                  {plan.addresses.length > 0 && (
                    <div>
                      {plan.addresses.map((c, i) => (
                        <Tag key={i} color="blue">{c.condition || c.description}</Tag>
                      ))}
                    </div>
                  )}
                </Space>
              </Card>
            ))}
          </Space>
        )}

        {/* AI Care Plan Preview Modal */}
        <Modal
          title="AI-Generated Care Plan Preview"
          open={!!aiPreviewPlan}
          onCancel={() => setAiPreviewPlan(null)}
          footer={[
            <Button key="cancel" onClick={() => setAiPreviewPlan(null)}>Discard</Button>,
            <Button key="save" type="primary" onClick={handleSaveAICarePlan}>
              Save Plan (Review & Approve Later)
            </Button>,
          ]}
          width={800}
        >
          {aiPreviewPlan && (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Title level={5}>{aiPreviewPlan.title}</Title>
                <Paragraph type="secondary">{aiPreviewPlan.description}</Paragraph>
                <Tag color="purple">AI Generated</Tag> <Tag>{aiPreviewPlan.category.replace(/_/g, ' ')}</Tag>
              </div>

              {aiPreviewPlan.addresses.length > 0 && (
                <div>
                  <Text strong>Health Concerns: </Text>
                  {aiPreviewPlan.addresses.map((c, i) => (
                    <Tag key={i} color="blue">{c.condition}</Tag>
                  ))}
                </div>
              )}

              <Card title={`Goals (${aiPreviewPlan.goals.length})`} size="small">
                {aiPreviewPlan.goals.map((g, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <Text strong>{g.description}</Text>
                    {g.targetValue && <Text type="secondary"> — Target: {g.targetValue} {g.targetUnit || ''}</Text>}
                    {g.priority && <Tag style={{ marginLeft: 8 }}>{g.priority}</Tag>}
                  </div>
                ))}
              </Card>

              <Card title={`Tasks (${aiPreviewPlan.tasks.length})`} size="small">
                {aiPreviewPlan.tasks.map((t, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <Text strong>{t.title}</Text>
                    {t.description && <div><Text type="secondary">{t.description}</Text></div>}
                    <Space style={{ marginTop: 4 }}>
                      <Tag>{t.taskType.replace(/_/g, ' ')}</Tag>
                      <Tag>{t.assignedTo}</Tag>
                      <Tag>{t.frequency.replace(/_/g, ' ')}</Tag>
                    </Space>
                  </div>
                ))}
              </Card>

              {aiPreviewPlan.patientEducation.length > 0 && (
                <Card title={`Patient Education (${aiPreviewPlan.patientEducation.length})`} size="small">
                  {aiPreviewPlan.patientEducation.map((edu, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <Text strong>{edu.title}</Text>
                      <Paragraph type="secondary" style={{ marginTop: 4 }}>{edu.content}</Paragraph>
                    </div>
                  ))}
                </Card>
              )}

              <Paragraph type="warning" style={{ fontSize: 12 }}>
                This plan was generated by AI. Review it carefully, then save. After saving, approve it to make it visible to the patient.
              </Paragraph>
            </Space>
          )}
        </Modal>

        {/* Create Care Plan Drawer */}
        <Drawer
          title="Create Care Plan"
          open={createPlanModalOpen}
          onClose={() => { setCreatePlanModalOpen(false); createPlanForm.resetFields(); }}
          width={480}
          destroyOnClose
        >
          <Form form={createPlanForm} layout="vertical" onFinish={handleCreateCarePlan}>
            <Form.Item name="title" label="Plan Title" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="e.g. Type 2 Diabetes Management Plan" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={2} placeholder="Brief summary of the care plan" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="category" label="Category" initialValue="chronic_care">
                  <Select options={[
                    { value: 'chronic_care', label: 'Chronic Care' },
                    { value: 'post_discharge', label: 'Post-Discharge' },
                    { value: 'preventive', label: 'Preventive' },
                    { value: 'palliative', label: 'Palliative' },
                    { value: 'behavioral', label: 'Behavioral Health' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="condition" label="Primary Condition (optional)">
                  <Input placeholder="e.g. Type 2 Diabetes" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Code (optional — ICD-10, ICD-9, CPT, HCPCS, SNOMED, etc.)">
              <CodeSearchInput
                value={planIcdCode}
                description={planIcdDesc}
                codeSystem={planCodeSystem}
                placeholder="Search any code system..."
                onSelect={(selection) => {
                  setPlanIcdCode(selection.code);
                  setPlanIcdDesc(selection.description);
                  setPlanCodeSystem(selection.codeSystem);
                  // Auto-fill condition if empty
                  const currentCondition = createPlanForm.getFieldValue('condition');
                  if (!currentCondition && selection.description) {
                    createPlanForm.setFieldsValue({ condition: selection.description });
                  }
                }}
              />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="startDate" label="Start Date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="endDate" label="End Date (optional)">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {/* Care Team Members */}
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <Text strong style={{ fontSize: 13 }}>Care Team Members</Text>
            </div>
            <Form.List name="careTeam">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                      <Col span={10}>
                        <Form.Item {...restField} name={[name, 'name']} noStyle>
                          <Input placeholder="Name (e.g. Dr. Smith)" />
                        </Form.Item>
                      </Col>
                      <Col span={10}>
                        <Form.Item {...restField} name={[name, 'role']} noStyle>
                          <Select
                            placeholder="Role"
                            allowClear
                            options={[
                              { value: 'Primary Physician', label: 'Primary Physician' },
                              { value: 'Cardiologist', label: 'Cardiologist' },
                              { value: 'Endocrinologist', label: 'Endocrinologist' },
                              { value: 'Nurse Care Manager', label: 'Nurse Care Manager' },
                              { value: 'Dietitian', label: 'Dietitian' },
                              { value: 'Pharmacist', label: 'Pharmacist' },
                              { value: 'Physical Therapist', label: 'Physical Therapist' },
                              { value: 'Mental Health Provider', label: 'Mental Health Provider' },
                              { value: 'Social Worker', label: 'Social Worker' },
                              { value: 'Care Coordinator', label: 'Care Coordinator' },
                              { value: 'Care Team Member', label: 'Care Team Member' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ role: 'Care Team Member' })}>
                    Add Team Member
                  </Button>
                </>
              )}
            </Form.List>

            {/* Care Goals */}
            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <Text strong style={{ fontSize: 13 }}>Care Goals</Text>
            </div>
            <Form.List name="goals">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 8 }}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />}
                    >
                      <Form.Item {...restField} name={[name, 'description']} label="Goal" rules={[{ required: true, message: 'Required' }]}>
                        <Input.TextArea rows={1} placeholder="e.g. Reduce HbA1c to below 7.0%" />
                      </Form.Item>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'metricName']} label="Metric">
                            <Input placeholder="HbA1c" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'targetValue']} label="Target">
                            <InputNumber placeholder="7.0" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'targetUnit']} label="Unit">
                            <Input placeholder="%" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'targetDirection']} label="Direction">
                            <Select
                              placeholder="Select"
                              allowClear
                              options={[
                                { value: 'decrease', label: 'Decrease' },
                                { value: 'increase', label: 'Increase' },
                                { value: 'maintain', label: 'Maintain' },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'priority']} label="Priority" initialValue="medium">
                            <Select
                              options={[
                                { value: 'high', label: 'High' },
                                { value: 'medium', label: 'Medium' },
                                { value: 'low', label: 'Low' },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'targetDate']} label="Target Date">
                            <DatePicker style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ priority: 'medium' })}>
                    Add Goal
                  </Button>
                </>
              )}
            </Form.List>

            <Form.Item name="notes" label="Notes" style={{ marginTop: 16 }}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">Create Plan</Button>
                <Button onClick={() => { setCreatePlanModalOpen(false); createPlanForm.resetFields(); }}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        </Drawer>

        {/* Add Goal Drawer */}
        <Drawer
          title="Add Goals"
          open={addGoalModalOpen}
          onClose={() => { setAddGoalModalOpen(false); addGoalForm.resetFields(); }}
          width={480}
          destroyOnClose
        >
          <Form form={addGoalForm} layout="vertical" onFinish={handleAddGoal}>
            <Form.List name="goals" initialValue={[{}]}>
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 12 }}
                      title={`Goal ${name + 1}`}
                      extra={fields.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />}
                    >
                      <Form.Item {...restField} name={[name, 'description']} label="Goal Description" rules={[{ required: true, message: 'Required' }]}>
                        <Input.TextArea rows={2} placeholder="e.g. Reduce HbA1c to below 7.0%" />
                      </Form.Item>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'metricName']} label="Metric">
                            <Input placeholder="HbA1c" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'targetValue']} label="Target">
                            <InputNumber placeholder="7.0" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'targetUnit']} label="Unit">
                            <Input placeholder="%" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'targetDirection']} label="Direction">
                            <Select allowClear placeholder="Select" options={[
                              { value: 'decrease', label: 'Decrease' },
                              { value: 'increase', label: 'Increase' },
                              { value: 'maintain', label: 'Maintain' },
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'priority']} label="Priority" initialValue="medium">
                            <Select options={[
                              { value: 'high', label: 'High' },
                              { value: 'medium', label: 'Medium' },
                              { value: 'low', label: 'Low' },
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'targetDate']} label="Target Date">
                            <DatePicker style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item {...restField} name={[name, 'notes']} label="Notes">
                        <Input.TextArea rows={1} />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ priority: 'medium' })} style={{ marginBottom: 16 }}>
                    Add Another Goal
                  </Button>
                </>
              )}
            </Form.List>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">Save Goals</Button>
                <Button onClick={() => { setAddGoalModalOpen(false); addGoalForm.resetFields(); }}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        </Drawer>

        {/* Add Task Drawer */}
        <Drawer
          title="Add Tasks"
          open={addTaskModalOpen}
          onClose={() => { setAddTaskModalOpen(false); addTaskForm.resetFields(); }}
          width={480}
          destroyOnClose
        >
          <Form form={addTaskForm} layout="vertical" onFinish={handleAddTask}>
            <Form.List name="tasks" initialValue={[{}]}>
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 12 }}
                      title={`Task ${name + 1}`}
                      extra={fields.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />}
                    >
                      <Form.Item {...restField} name={[name, 'title']} label="Task Title" rules={[{ required: true, message: 'Required' }]}>
                        <Input placeholder="e.g. Check fasting blood glucose" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'description']} label="Description">
                        <Input.TextArea rows={2} placeholder="Task details / instructions" />
                      </Form.Item>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'taskType']} label="Type" initialValue="monitoring">
                            <Select options={[
                              { value: 'monitoring', label: 'Monitoring' },
                              { value: 'lab_order', label: 'Lab Order' },
                              { value: 'imaging_order', label: 'Imaging' },
                              { value: 'medication_adherence', label: 'Med Adherence' },
                              { value: 'patient_education', label: 'Education' },
                              { value: 'questionnaire', label: 'Questionnaire' },
                              { value: 'appointment', label: 'Appointment' },
                              { value: 'care_team_action', label: 'Care Team' },
                              { value: 'lifestyle', label: 'Lifestyle' },
                              { value: 'follow_up', label: 'Follow-Up' },
                              { value: 'referral', label: 'Referral' },
                              { value: 'custom', label: 'Custom' },
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'assignedTo']} label="Assigned To" initialValue="patient">
                            <Select options={[
                              { value: 'patient', label: 'Patient' },
                              { value: 'care_team', label: 'Care Team' },
                              { value: 'system', label: 'System' },
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'frequency']} label="Frequency" initialValue="daily">
                            <Select options={[
                              { value: 'one_time', label: 'One Time' },
                              { value: 'daily', label: 'Daily' },
                              { value: 'weekly', label: 'Weekly' },
                              { value: 'biweekly', label: 'Biweekly' },
                              { value: 'monthly', label: 'Monthly' },
                              { value: 'quarterly', label: 'Quarterly' },
                              { value: 'annually', label: 'Annually' },
                              { value: 'as_needed', label: 'As Needed' },
                            ]} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'priority']} label="Priority" initialValue="medium">
                            <Select options={[
                              { value: 'high', label: 'High' },
                              { value: 'medium', label: 'Medium' },
                              { value: 'low', label: 'Low' },
                            ]} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'metricName']} label="Metric">
                            <Input placeholder="Blood Glucose" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'dueDate']} label="Due Date">
                            <DatePicker style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item {...restField} name={[name, 'targetValue']} label="Target Value">
                            <InputNumber placeholder="140" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item {...restField} name={[name, 'targetUnit']} label="Unit">
                            <Input placeholder="mg/dL" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item {...restField} name={[name, 'notes']} label="Notes">
                        <Input.TextArea rows={1} />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ taskType: 'monitoring', assignedTo: 'patient', frequency: 'daily', priority: 'medium' })} style={{ marginBottom: 16 }}>
                    Add Another Task
                  </Button>
                </>
              )}
            </Form.List>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">Save Tasks</Button>
                <Button onClick={() => { setAddTaskModalOpen(false); addTaskForm.resetFields(); }}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        </Drawer>
      </div>
    );
  };

  // ── History tab: fetch + handlers ──────────────────────────────────

  const fetchStaffAllergies = useCallback(async () => {
    if (!id) return;
    setStaffAllergiesLoading(true);
    try {
      const data = await patientService.findAllergies(id);
      setStaffAllergies(data || []);
    } catch {
      message.error('Failed to load allergies');
    } finally {
      setStaffAllergiesLoading(false);
    }
  }, [id]);

  const fetchStaffFamilyHistory = useCallback(async () => {
    if (!id) return;
    setStaffFamilyHistoryLoading(true);
    try {
      const data = await patientService.findFamilyHistory(id);
      setStaffFamilyHistory(data || []);
    } catch {
      message.error('Failed to load family history');
    } finally {
      setStaffFamilyHistoryLoading(false);
    }
  }, [id]);

  const fetchStaffSurgicalHistory = useCallback(async () => {
    if (!id) return;
    setStaffSurgicalHistoryLoading(true);
    try {
      const data = await patientService.findSurgicalHistory(id);
      setStaffSurgicalHistory(data || []);
    } catch {
      message.error('Failed to load surgical history');
    } finally {
      setStaffSurgicalHistoryLoading(false);
    }
  }, [id]);

  const fetchStaffSocialHistory = useCallback(async () => {
    if (!id) return;
    setStaffSocialHistoryLoading(true);
    try {
      const data = await patientService.findSocialHistory(id);
      setStaffSocialHistory(data || []);
    } catch {
      message.error('Failed to load social history');
    } finally {
      setStaffSocialHistoryLoading(false);
    }
  }, [id]);

  // Load history data when patient is available
  useEffect(() => {
    if (patient) {
      fetchStaffAllergies();
      fetchStaffFamilyHistory();
      fetchStaffSurgicalHistory();
      fetchStaffSocialHistory();
    }
  }, [patient, fetchStaffAllergies, fetchStaffFamilyHistory, fetchStaffSurgicalHistory, fetchStaffSocialHistory]);

  // ── Allergy handlers ──
  const handleAddAllergy = async (values: any) => {
    if (!id) return;
    try {
      await patientService.createAllergy(id, {
        allergen: values.allergen,
        reaction: values.reaction,
        severity: values.severity,
        clinicalStatus: values.clinicalStatus || 'active',
        onsetDate: values.onsetDate ? values.onsetDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes,
      });
      message.success('Allergy added');
      setAllergyDrawerOpen(false);
      allergyForm.resetFields();
      fetchStaffAllergies();
    } catch {
      message.error('Failed to add allergy');
    }
  };

  const handleVerifyAllergy = async (allergyId: string) => {
    if (!id) return;
    try {
      await patientService.updateAllergy(id, allergyId, { verificationStatus: 'confirmed' });
      message.success('Allergy verified');
      fetchStaffAllergies();
    } catch {
      message.error('Failed to verify allergy');
    }
  };

  const handleDeleteAllergy = async (allergyId: string) => {
    if (!id) return;
    try {
      await patientService.deleteAllergy(id, allergyId);
      message.success('Allergy removed');
      fetchStaffAllergies();
    } catch {
      message.error('Failed to remove allergy');
    }
  };

  // ── Family history handlers ──
  const handleAddFamilyHistory = async (values: any) => {
    if (!id) return;
    try {
      await patientService.createFamilyHistory(id, {
        relationship: values.relationship,
        memberName: values.memberName,
        condition: values.condition,
        ageOfOnset: values.ageOfOnset,
        isDeceased: values.isDeceased || false,
        ageAtDeath: values.ageAtDeath,
        notes: values.notes,
      });
      message.success('Family history added');
      setFamilyHistoryDrawerOpen(false);
      familyHistoryForm.resetFields();
      fetchStaffFamilyHistory();
    } catch {
      message.error('Failed to add family history');
    }
  };

  const handleVerifyFamilyHistory = async (fhId: string) => {
    if (!id) return;
    try {
      await patientService.updateFamilyHistory(id, fhId, { verificationStatus: 'confirmed' });
      message.success('Family history verified');
      fetchStaffFamilyHistory();
    } catch {
      message.error('Failed to verify');
    }
  };

  const handleDeleteFamilyHistory = async (fhId: string) => {
    if (!id) return;
    try {
      await patientService.deleteFamilyHistory(id, fhId);
      message.success('Family history removed');
      fetchStaffFamilyHistory();
    } catch {
      message.error('Failed to remove');
    }
  };

  // ── Surgical history handlers ──
  const handleAddSurgicalHistory = async (values: any) => {
    if (!id) return;
    try {
      await patientService.createSurgicalHistory(id, {
        procedure: values.procedure,
        procedureDate: values.procedureDate ? values.procedureDate.format('YYYY-MM-DD') : undefined,
        surgeon: values.surgeon,
        facility: values.facility,
        bodySite: values.bodySite,
        outcome: values.outcome,
        notes: values.notes,
      });
      message.success('Surgical history added');
      setSurgicalDrawerOpen(false);
      surgicalForm.resetFields();
      fetchStaffSurgicalHistory();
    } catch {
      message.error('Failed to add surgical history');
    }
  };

  const handleVerifySurgicalHistory = async (shId: string) => {
    if (!id) return;
    try {
      await patientService.updateSurgicalHistory(id, shId, { verificationStatus: 'confirmed' });
      message.success('Surgical history verified');
      fetchStaffSurgicalHistory();
    } catch {
      message.error('Failed to verify');
    }
  };

  const handleDeleteSurgicalHistory = async (shId: string) => {
    if (!id) return;
    try {
      await patientService.deleteSurgicalHistory(id, shId);
      message.success('Surgical history removed');
      fetchStaffSurgicalHistory();
    } catch {
      message.error('Failed to remove');
    }
  };

  // ── Social history handlers ──
  const socialCategoryLabels: Record<string, string> = {
    smoking: 'Smoking / Tobacco',
    alcohol: 'Alcohol Use',
    substance_use: 'Substance Use',
    occupation: 'Occupation',
    exercise: 'Exercise / Activity',
    diet: 'Diet',
    caffeine: 'Caffeine Intake',
    sexual_history: 'Sexual History',
    living_situation: 'Living Situation',
    marital_status: 'Marital Status',
    education: 'Education',
    travel: 'Travel',
    safety: 'Safety',
    advance_directive: 'Advance Directive',
    other: 'Other',
  };

  const handleAddSocialHistory = async (values: any) => {
    if (!id) return;
    try {
      await patientService.createSocialHistory(id, {
        category: values.category,
        status: values.status || 'current',
        detail: values.detail,
        frequency: values.frequency,
        amount: values.amount,
        durationYears: values.durationYears,
        quitDate: values.quitDate ? values.quitDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes,
      });
      message.success('Social history added');
      setSocialDrawerOpen(false);
      socialForm.resetFields();
      fetchStaffSocialHistory();
    } catch {
      message.error('Failed to add social history');
    }
  };

  const handleVerifySocialHistory = async (shId: string) => {
    if (!id) return;
    try {
      await patientService.updateSocialHistory(id, shId, { verificationStatus: 'confirmed' });
      message.success('Social history verified');
      fetchStaffSocialHistory();
    } catch {
      message.error('Failed to verify');
    }
  };

  const handleDeleteSocialHistory = async (shId: string) => {
    if (!id) return;
    try {
      await patientService.deleteSocialHistory(id, shId);
      message.success('Social history removed');
      fetchStaffSocialHistory();
    } catch {
      message.error('Failed to remove');
    }
  };

  // ── History tab components ──

  const sourceTag = (entry: any) =>
    entry.source === 'patient' ? (
      <Tag color="warning" icon={<ExclamationCircleOutlined />}>Patient-reported</Tag>
    ) : (
      <Tag color="blue">Staff-entered</Tag>
    );

  const verificationTag = (status: string) =>
    status === 'confirmed' ? (
      <Tag color="success">Verified</Tag>
    ) : (
      <Tag color="warning">Pending Review</Tag>
    );

  const StaffAllergiesTab = () => (
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">Patient allergies and adverse reactions. Patient-submitted entries need review.</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAllergyDrawerOpen(true)}>Add Allergy</Button>
      </div>
      <Spin spinning={staffAllergiesLoading}>
        {staffAllergies.length === 0 ? (
          <Empty description="No known allergies (NKA)" />
        ) : (
          <Table
            dataSource={staffAllergies}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Allergen',
                dataIndex: 'allergen',
                key: 'allergen',
                render: (t: string) => <Text strong>{t}</Text>,
              },
              { title: 'Reaction', dataIndex: 'reaction', key: 'reaction', ellipsis: true },
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 100,
                render: (s: string) => <Tag color={severityColors[s] || 'default'} style={{ textTransform: 'capitalize' }}>{s}</Tag>,
              },
              {
                title: 'Status',
                dataIndex: 'clinicalStatus',
                key: 'clinicalStatus',
                width: 90,
                render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag>,
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                width: 130,
                render: (_: any, r: any) => sourceTag(r),
              },
              {
                title: 'Verified',
                dataIndex: 'verificationStatus',
                key: 'verificationStatus',
                width: 120,
                render: (s: string) => verificationTag(s),
              },
              {
                title: '',
                key: 'action',
                width: 120,
                render: (_: any, r: any) => (
                  <Space>
                    {r.verificationStatus !== 'confirmed' && (
                      <Button size="small" type="link" onClick={() => handleVerifyAllergy(r.id)}>Verify</Button>
                    )}
                    <Popconfirm title="Remove this allergy?" onConfirm={() => handleDeleteAllergy(r.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Spin>
    </Card>
  );

  const StaffFamilyHistoryTab = () => (
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">Family health conditions. Used for hereditary risk assessment.</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFamilyHistoryDrawerOpen(true)}>Add Family History</Button>
      </div>
      <Spin spinning={staffFamilyHistoryLoading}>
        {staffFamilyHistory.length === 0 ? (
          <Empty description="No family history recorded" />
        ) : (
          <Table
            dataSource={staffFamilyHistory}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Relationship',
                dataIndex: 'relationship',
                key: 'relationship',
                width: 120,
                render: (r: string) => <Tag style={{ textTransform: 'capitalize' }}>{r}</Tag>,
              },
              { title: 'Member', dataIndex: 'memberName', key: 'memberName', width: 120, render: (t: string) => t || '-' },
              { title: 'Condition', dataIndex: 'condition', key: 'condition', render: (t: string) => <Text strong>{t}</Text> },
              { title: 'Onset Age', dataIndex: 'ageOfOnset', key: 'ageOfOnset', width: 80, render: (a: number) => a ?? '-' },
              {
                title: 'Deceased',
                dataIndex: 'isDeceased',
                key: 'isDeceased',
                width: 80,
                render: (d: boolean) => (d ? <Tag color="default">Yes</Tag> : '-'),
              },
              {
                title: 'Source',
                key: 'source',
                width: 130,
                render: (_: any, r: any) => sourceTag(r),
              },
              {
                title: 'Verified',
                dataIndex: 'verificationStatus',
                key: 'verificationStatus',
                width: 120,
                render: (s: string) => verificationTag(s),
              },
              {
                title: '',
                key: 'action',
                width: 120,
                render: (_: any, r: any) => (
                  <Space>
                    {r.verificationStatus !== 'confirmed' && (
                      <Button size="small" type="link" onClick={() => handleVerifyFamilyHistory(r.id)}>Verify</Button>
                    )}
                    <Popconfirm title="Remove this entry?" onConfirm={() => handleDeleteFamilyHistory(r.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Spin>
    </Card>
  );

  const StaffSurgicalHistoryTab = () => (
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">Past surgeries and medical procedures.</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setSurgicalDrawerOpen(true)}>Add Surgery</Button>
      </div>
      <Spin spinning={staffSurgicalHistoryLoading}>
        {staffSurgicalHistory.length === 0 ? (
          <Empty description="No surgical history recorded" />
        ) : (
          <Table
            dataSource={staffSurgicalHistory}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              { title: 'Procedure', dataIndex: 'procedure', key: 'procedure', render: (t: string) => <Text strong>{t}</Text> },
              {
                title: 'Date',
                dataIndex: 'procedureDate',
                key: 'procedureDate',
                width: 110,
                render: (d: string) => (d ? dayjs(d).format('MMM D, YYYY') : '-'),
              },
              { title: 'Surgeon', dataIndex: 'surgeon', key: 'surgeon', width: 120, render: (t: string) => t || '-' },
              { title: 'Facility', dataIndex: 'facility', key: 'facility', ellipsis: true, render: (t: string) => t || '-' },
              {
                title: 'Source',
                key: 'source',
                width: 130,
                render: (_: any, r: any) => sourceTag(r),
              },
              {
                title: 'Verified',
                dataIndex: 'verificationStatus',
                key: 'verificationStatus',
                width: 120,
                render: (s: string) => verificationTag(s),
              },
              {
                title: '',
                key: 'action',
                width: 120,
                render: (_: any, r: any) => (
                  <Space>
                    {r.verificationStatus !== 'confirmed' && (
                      <Button size="small" type="link" onClick={() => handleVerifySurgicalHistory(r.id)}>Verify</Button>
                    )}
                    <Popconfirm title="Remove this entry?" onConfirm={() => handleDeleteSurgicalHistory(r.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Spin>
    </Card>
  );

  const StaffSocialHistoryTab = () => (
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">Lifestyle factors: smoking, alcohol, substance use, occupation, exercise, diet, safety, and more.</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setSocialDrawerOpen(true)}>Add Social History</Button>
      </div>
      <Spin spinning={staffSocialHistoryLoading}>
        {staffSocialHistory.length === 0 ? (
          <Empty description="No social history recorded" />
        ) : (
          <Table
            dataSource={staffSocialHistory}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Category',
                dataIndex: 'category',
                key: 'category',
                width: 150,
                render: (c: string) => <Tag>{socialCategoryLabels[c] || c}</Tag>,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 90,
                render: (s: string) => <Tag style={{ textTransform: 'capitalize' }}>{s}</Tag>,
              },
              { title: 'Detail', dataIndex: 'detail', key: 'detail', ellipsis: true, render: (t: string) => t || '-' },
              { title: 'Frequency', dataIndex: 'frequency', key: 'frequency', width: 120, render: (t: string) => t || '-' },
              {
                title: 'Source',
                key: 'source',
                width: 130,
                render: (_: any, r: any) => sourceTag(r),
              },
              {
                title: 'Verified',
                dataIndex: 'verificationStatus',
                key: 'verificationStatus',
                width: 120,
                render: (s: string) => verificationTag(s),
              },
              {
                title: '',
                key: 'action',
                width: 120,
                render: (_: any, r: any) => (
                  <Space>
                    {r.verificationStatus !== 'confirmed' && (
                      <Button size="small" type="link" onClick={() => handleVerifySocialHistory(r.id)}>Verify</Button>
                    )}
                    <Popconfirm title="Remove this entry?" onConfirm={() => handleDeleteSocialHistory(r.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Spin>
    </Card>
  );

  // ── History drawers ──

  const allergyDrawer = (
    <Drawer title="Add Allergy" open={allergyDrawerOpen} onClose={() => setAllergyDrawerOpen(false)} width={480} destroyOnClose>
      <Form form={allergyForm} layout="vertical" onFinish={handleAddAllergy} initialValues={{ severity: 'moderate', clinicalStatus: 'active' }}>
        <Form.Item name="allergen" label="Allergen" rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="e.g., Penicillin, Peanuts, Latex" />
        </Form.Item>
        <Form.Item name="reaction" label="Reaction">
          <Input placeholder="e.g., Hives, Anaphylaxis, Rash" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="severity" label="Severity">
              <Select options={[
                { value: 'mild', label: 'Mild' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'severe', label: 'Severe' },
                { value: 'life-threatening', label: 'Life-threatening' },
              ]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="clinicalStatus" label="Status">
              <Select options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'resolved', label: 'Resolved' },
              ]} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="onsetDate" label="Onset Date">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Add</Button>
            <Button onClick={() => setAllergyDrawerOpen(false)}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Drawer>
  );

  const familyHistoryDrawer = (
    <Drawer title="Add Family History" open={familyHistoryDrawerOpen} onClose={() => setFamilyHistoryDrawerOpen(false)} width={480} destroyOnClose>
      <Form form={familyHistoryForm} layout="vertical" onFinish={handleAddFamilyHistory}>
        <Form.Item name="relationship" label="Relationship" rules={[{ required: true, message: 'Required' }]}>
          <Select placeholder="Select relationship" options={[
            { value: 'father', label: 'Father' },
            { value: 'mother', label: 'Mother' },
            { value: 'brother', label: 'Brother' },
            { value: 'sister', label: 'Sister' },
            { value: 'son', label: 'Son' },
            { value: 'daughter', label: 'Daughter' },
            { value: 'grandfather', label: 'Grandfather' },
            { value: 'grandmother', label: 'Grandmother' },
            { value: 'uncle', label: 'Uncle' },
            { value: 'aunt', label: 'Aunt' },
            { value: 'cousin', label: 'Cousin' },
            { value: 'other', label: 'Other' },
          ]} />
        </Form.Item>
        <Form.Item name="memberName" label="Member Name (optional)">
          <Input placeholder="e.g., John (father)" />
        </Form.Item>
        <Form.Item name="condition" label="Condition" rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="e.g., Diabetes, Heart disease" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="ageOfOnset" label="Age of Onset">
              <InputNumber min={0} max={120} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="isDeceased" label="Deceased?">
              <Select options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="ageAtDeath" label="Age at Death (if deceased)">
          <InputNumber min={0} max={120} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Add</Button>
            <Button onClick={() => setFamilyHistoryDrawerOpen(false)}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Drawer>
  );

  const surgicalDrawer = (
    <Drawer title="Add Surgery / Procedure" open={surgicalDrawerOpen} onClose={() => setSurgicalDrawerOpen(false)} width={480} destroyOnClose>
      <Form form={surgicalForm} layout="vertical" onFinish={handleAddSurgicalHistory}>
        <Form.Item name="procedure" label="Procedure" rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="e.g., Appendectomy, Knee Replacement" />
        </Form.Item>
        <Form.Item name="procedureDate" label="Date of Procedure">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="surgeon" label="Surgeon">
          <Input placeholder="e.g., Dr. Smith" />
        </Form.Item>
        <Form.Item name="facility" label="Facility / Hospital">
          <Input placeholder="e.g., General Hospital" />
        </Form.Item>
        <Form.Item name="bodySite" label="Body Site">
          <Input placeholder="e.g., Right knee, Abdomen" />
        </Form.Item>
        <Form.Item name="outcome" label="Outcome">
          <Select allowClear placeholder="Select outcome" options={[
            { value: 'full_recovery', label: 'Full Recovery' },
            { value: 'partial_recovery', label: 'Partial Recovery' },
            { value: 'ongoing_treatment', label: 'Ongoing Treatment' },
            { value: 'complications', label: 'Complications' },
            { value: 'unknown', label: 'Unknown' },
          ]} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Add</Button>
            <Button onClick={() => setSurgicalDrawerOpen(false)}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Drawer>
  );

  const socialDrawer = (
    <Drawer title="Add Social History" open={socialDrawerOpen} onClose={() => setSocialDrawerOpen(false)} width={480} destroyOnClose>
      <Form form={socialForm} layout="vertical" onFinish={handleAddSocialHistory} initialValues={{ status: 'current' }}>
        <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Required' }]}>
          <Select placeholder="Select category" options={Object.entries(socialCategoryLabels).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="status" label="Status">
          <Select options={[
            { value: 'current', label: 'Current' },
            { value: 'former', label: 'Former' },
            { value: 'never', label: 'Never' },
            { value: 'unknown', label: 'Unknown' },
          ]} />
        </Form.Item>
        <Form.Item name="detail" label="Details">
          <Input.TextArea rows={2} placeholder="e.g., Cigarettes, Construction worker, Jogging 3x/week" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="frequency" label="Frequency">
              <Input placeholder="e.g., 1 pack/day" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="amount" label="Amount">
              <Input placeholder="e.g., 20 cigarettes" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="durationYears" label="Duration (years)">
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="quitDate" label="Quit Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Add</Button>
            <Button onClick={() => setSocialDrawerOpen(false)}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Drawer>
  );

  // ── Tabs definition ──
  const tabItems = [
    { key: 'overview', label: 'Overview', children: <OverviewTab /> },
    { key: 'history', label: 'Medical History', children: <MedicalHistoryTab /> },
    { key: 'problems', label: 'Problem List', children: <ProblemListTab /> },
    { key: 'allergies', label: `Allergies (${staffAllergies.length})`, children: <StaffAllergiesTab /> },
    { key: 'medications', label: <span><MedicineBoxOutlined /> Medications</span>, children: <MedicationsTab /> },
    { key: 'e-prescriptions', label: <span><MedicineBoxOutlined /> E-Prescriptions</span>, children: <EPrescriptionsTab /> },
    { key: 'orders', label: <span><ProfileOutlined /> Orders</span>, children: <OrdersTab /> },
    { key: 'immunizations', label: <span><MedicineBoxOutlined /> Immunizations</span>, children: <ImmunizationsTab /> },
    { key: 'growth', label: <span><ProfileOutlined /> Growth Charts</span>, children: <GrowthChartsTab /> },
    { key: 'care-plans', label: <span><ProfileOutlined /> Care Plans</span>, children: <CarePlansTab /> },
    { key: 'appointments', label: 'Appointments', children: <AppointmentsTab /> },
    { key: 'documents', label: 'Documents', children: <DocumentsTab /> },
    { key: 'vitals', label: 'Vitals', children: <VitalsTab /> },
    { key: 'billing', label: 'Billing', children: <BillingTab /> },
    { key: 'risk-management', label: <span><SafetyOutlined /> Risk Management</span>, children: <RiskManagementTab patientId={id} /> },
    { key: 'quality-measures', label: <span><SafetyCertificateOutlined /> Quality Measures</span>, children: <QualityMeasuresTab patientId={id} /> },
    { key: 'portal', label: <span><SafetyOutlined /> Portal</span>, children: <PortalTab /> },
  ];

  return (
    <div>
      {/* Back Button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/patients')}
        style={{ marginBottom: 16 }}
      >
        Back to Patients
      </Button>

      {/* Patient Header Card */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle">
          <Col flex="none">
            <Avatar
              size={80}
              icon={<UserOutlined />}
              style={{
                backgroundColor: patient.gender === 'female' ? '#eb2f96' : '#0D7C8A',
                fontSize: 36,
              }}
              src={patient.avatar}
            />
          </Col>
          <Col flex="auto">
            <Row justify="space-between" align="top">
              <Col>
                <Space direction="vertical" size={2}>
                  <Space align="center">
                    <Title level={3} style={{ margin: 0 }}>
                      {patient.firstName} {patient.lastName}
                    </Title>
                    <Badge
                      status={
                        patient.status === 'active'
                          ? 'success'
                          : patient.status === 'inactive'
                          ? 'default'
                          : 'error'
                      }
                      text={
                        <Tag color={statusColor} style={{ textTransform: 'capitalize' }}>
                          {patient.status}
                        </Tag>
                      }
                    />
                  </Space>
                  <Space split={<Divider type="vertical" />} wrap>
                    <Text type="secondary">
                      <Text strong>MRN:</Text> {patient.mrn}
                    </Text>
                    <Text type="secondary">
                      <Text strong>DOB:</Text> {dayjs(patient.dateOfBirth).format('MM/DD/YYYY')} (
                      {calculateAge(patient.dateOfBirth)} yrs)
                    </Text>
                    <Text type="secondary">
                      <Space size={4}>
                        {genderIcon}
                        <span style={{ textTransform: 'capitalize' }}>{patient.gender}</span>
                      </Space>
                    </Text>
                    {patient.bloodType && (
                      <Text type="secondary">
                        <Text strong>Blood:</Text> {patient.bloodType}
                      </Text>
                    )}
                  </Space>
                  <Space split={<Divider type="vertical" />}>
                    <Text type="secondary">
                      <PhoneOutlined style={{ marginRight: 4 }} />
                      {patient.phone}
                    </Text>
                    <Text type="secondary">
                      <MailOutlined style={{ marginRight: 4 }} />
                      {patient.email}
                    </Text>
                  </Space>
                </Space>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditModalOpen(true)}
                >
                  Edit Patient
                </Button>
              </Col>
            </Row>

            {/* Allergies Alert */}
            {patient.allergies.length > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<AlertOutlined />}
                style={{ marginTop: 12 }}
                message={
                  <Space size={8} wrap>
                    <Text strong>Allergies:</Text>
                    {patient.allergies.map((a) => (
                      <Tag
                        key={a.id}
                        color={severityColors[a.severity]}
                      >
                        {a.allergen} ({a.severity})
                      </Tag>
                    ))}
                  </Space>
                }
              />
            )}
          </Col>
        </Row>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ marginBottom: 24 }}
      />

      {/* Edit Patient Modal */}
      <EditPatientModal
        open={editModalOpen}
        patient={patient}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          fetchPatients();
          fetchVitals();
        }}
      />

      {/* History Drawers */}
      {allergyDrawer}
      {familyHistoryDrawer}
      {surgicalDrawer}
      {socialDrawer}
    </div>
  );
};

export default PatientDetailPage;
