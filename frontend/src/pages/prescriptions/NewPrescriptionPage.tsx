import React, { useEffect, useMemo, useState } from 'react';
import {
  Typography,
  Button,
  Card,
  Steps,
  Form,
  Select,
  Input,
  InputNumber,
  Space,
  Row,
  Col,
  Alert,
  Checkbox,
  Descriptions,
  Tag,
  List,
  message,
  Modal,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  AlertOutlined,
  MedicineBoxOutlined,
  SendOutlined,
  SaveOutlined,
  AudioOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { PrescriptionItem } from '../../types';
import { useIntegrations } from '../../hooks/useIntegrations';
import { patientService, type Patient } from '../../services/patientService';
import { providerService } from '../../services/providerService';
import { medicationService, type Medication } from '../../services/medicationService';
import { pharmacyService, type Pharmacy } from '../../services/pharmacyService';
import { prescriptionService } from '../../services/prescriptionService';
import {
  aiService,
  type ReviewMedicationsResponse,
  type ParsedMedication,
} from '../../services/aiService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const frequencyOptions = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed',
  'At bedtime',
  'Weekly',
];

const routeOptions = [
  'Oral',
  'Topical',
  'Subcutaneous Injection',
  'Intramuscular Injection',
  'Intravenous',
  'Inhalation',
  'Sublingual',
  'Rectal',
  'Ophthalmic',
  'Otic',
  'Nasal',
  'Transdermal',
];

interface MedicationFormItem {
  medication?: string;
  rxNormCode?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  quantity?: number;
  refills?: number;
  instructions?: string;
}

interface PatientAllergy {
  id: string;
  allergen: string;
  reaction: string;
  severity: string;
  status?: string;
}

interface PatientHistory {
  id: string;
  condition: string;
  status?: string;
}

interface ExtendedPatient extends Patient {
  allergies?: PatientAllergy[];
  medicalHistory?: PatientHistory[];
  insurance?: Array<{ provider: string }>;
}

interface ProviderInfo {
  id: string;
  firstName: string;
  lastName: string;
  npi?: string;
}

const NewPrescriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { isEnabled } = useIntegrations();
  const aiEnabled = isEnabled('ai_prescribing');
  const voiceEnabled = isEnabled('voice_prescribing');

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>();
  const [medications, setMedications] = useState<MedicationFormItem[]>([{}]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const [form] = Form.useForm();

  const [patients, setPatients] = useState<ExtendedPatient[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [medicationOptions, setMedicationOptions] = useState<Medication[]>([]);
  const [medicationSearchLoading, setMedicationSearchLoading] = useState(false);
  const [pharmacyOptions, setPharmacyOptions] = useState<Pharmacy[]>([]);
  const [pharmacySearchLoading, setPharmacySearchLoading] = useState(false);

  const [aiReview, setAiReview] = useState<ReviewMedicationsResponse | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceParsing, setVoiceParsing] = useState(false);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId],
  );
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [pResult, provResult] = await Promise.all([
          patientService.findAll({ page: 1, limit: 1000 }),
          providerService.findAll(),
        ]);
        setPatients((pResult.data || []) as ExtendedPatient[]);
        setProviders((provResult || []) as ProviderInfo[]);
      } catch (err: any) {
        message.error(err?.response?.data?.message || 'Failed to load patient/provider data');
      } finally {
        setLoadingPatients(false);
        setLoadingProviders(false);
      }
    };
    void load();
  }, []);

  // Seed pharmacy options with a default search so the dropdown is not empty.
  useEffect(() => {
    const loadPharmacies = async () => {
      setPharmacySearchLoading(true);
      try {
        const res = await pharmacyService.search('');
        setPharmacyOptions(res.data);
      } finally {
        setPharmacySearchLoading(false);
      }
    };
    void loadPharmacies();
  }, []);

  const handleMedicationSearch = async (query: string) => {
    setMedicationSearchLoading(true);
    try {
      const res = await medicationService.search(query, 25);
      setMedicationOptions(res.data);
    } finally {
      setMedicationSearchLoading(false);
    }
  };

  const handlePharmacySearch = async (query: string) => {
    setPharmacySearchLoading(true);
    try {
      const res = await pharmacyService.search(query, 25);
      setPharmacyOptions(res.data);
    } finally {
      setPharmacySearchLoading(false);
    }
  };

  const handleRunAiReview = async () => {
    if (!selectedPatient) {
      message.warning('Select a patient first');
      return;
    }
    const validMeds = medications.filter((m) => m.medication && m.dosage && m.frequency);
    if (validMeds.length === 0) {
      message.warning('Add at least one medication to review');
      return;
    }
    setAiReviewLoading(true);
    try {
      const age = selectedPatient.dateOfBirth
        ? Math.floor((Date.now() - new Date(selectedPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined;
      const res = await aiService.reviewMedications({
        medications: validMeds as Required<MedicationFormItem>[],
        allergies: (selectedPatient.allergies || [])
          .filter((a) => a.status !== 'inactive')
          .map((a) => a.allergen),
        conditions: (selectedPatient.medicalHistory || [])
          .filter((h) => h.status !== 'resolved')
          .map((h) => h.condition),
        age,
        gender: selectedPatient.gender,
      });
      setAiReview(res.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'AI review failed');
    } finally {
      setAiReviewLoading(false);
    }
  };

  const handleVoiceParse = async () => {
    if (!voiceTranscript.trim()) {
      message.warning('Enter or paste a prescription transcript');
      return;
    }
    setVoiceParsing(true);
    try {
      const res = await aiService.parsePrescription({ transcript: voiceTranscript });
      const parsed: ParsedMedication[] = res.data.medications || [];
      if (parsed.length === 0) {
        message.warning('No medications could be parsed from the transcript');
        return;
      }
      setMedications(
        parsed.map((m) => ({
          medication: m.medication,
          dosage: m.dosage,
          frequency: m.frequency,
          route: m.route || 'Oral',
          duration: m.duration || '',
          quantity: m.quantity || 0,
          refills: m.refills ?? 0,
          instructions: m.instructions || '',
        })),
      );
      // Refresh medication search to populate strengths for parsed names.
      await handleMedicationSearch(parsed[0].medication);
      message.success(`Parsed ${parsed.length} medication(s)`);
      setVoiceModalOpen(false);
      setVoiceTranscript('');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Voice parsing failed');
    } finally {
      setVoiceParsing(false);
    }
  };

  // Allergy alerts based on current selection.
  const allergyAlerts = useMemo(() => {
    if (!selectedPatient) return [];
    const alerts: string[] = [];
    const medNames = medications.map((m) => m.medication?.toLowerCase() || '');
    (selectedPatient.allergies || [])
      .filter((a) => a.status !== 'inactive')
      .forEach((allergy) => {
        const allergenLower = allergy.allergen.toLowerCase();
        if (medNames.some((med) => med.includes(allergenLower) || allergenLower.includes(med))) {
          alerts.push(
            `ALLERGY ALERT: Patient is allergic to ${allergy.allergen} (${allergy.reaction}, Severity: ${allergy.severity})`,
          );
        }
        if (allergenLower === 'penicillin' && medNames.some((m) => m.includes('amoxicillin'))) {
          alerts.push(
            'ALLERGY ALERT: Patient has Penicillin allergy - Amoxicillin is a penicillin-type antibiotic. Consider alternative.',
          );
        }
      });
    return alerts;
  }, [selectedPatient, medications]);

  const handleAddMedication = () => {
    setMedications([...medications, {}]);
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleMedicationChange = (
    index: number,
    field: keyof MedicationFormItem,
    value: string | number | undefined,
  ) => {
    const updated = [...medications];
    const item = { ...updated[index], [field]: value };

    if (field === 'medication') {
      const selected = medicationOptions.find((m) => m.name === value);
      item.rxNormCode = selected?.rxNormCode;
      item.dosage = undefined; // reset dosage when medication changes
    }

    updated[index] = item;
    setMedications(updated);
  };

  const handleNext = () => {
    if (currentStep === 0 && !selectedPatientId) {
      message.warning('Please select a patient');
      return;
    }
    if (currentStep === 0 && !selectedProviderId) {
      message.warning('Please select a provider');
      return;
    }
    if (currentStep === 1) {
      const validMeds = medications.filter((m) => m.medication && m.dosage && m.frequency);
      if (validMeds.length === 0) {
        message.warning('Please add at least one medication with required fields');
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSendToPharmacy = async () => {
    if (!confirmed) {
      message.warning('Please confirm the prescription before sending');
      return;
    }
    if (!selectedPatient || !selectedProvider || !selectedPharmacy) {
      message.warning('Please select a patient, provider, and pharmacy');
      return;
    }

    const validMeds = medications.filter((m) => m.medication);
    const now = new Date().toISOString();
    const newPrescription = {
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      providerId: selectedProvider.id,
      providerName: `Dr. ${selectedProvider.firstName} ${selectedProvider.lastName}`,
      medications: validMeds.map((m, i) => ({
        id: `rxitem-${Date.now()}-${i}`,
        medication: m.medication!,
        rxNormCode: m.rxNormCode,
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        route: m.route || 'Oral',
        duration: m.duration || '',
        quantity: m.quantity || 0,
        refills: m.refills ?? 0,
        instructions: m.instructions,
      })) as PrescriptionItem[],
      status: 'active' as const,
      prescribedDate: now,
      pharmacy: selectedPharmacy,
      notes: undefined,
    };

    try {
      const saved = await prescriptionService.create(newPrescription);
      message.success('Prescription sent to pharmacy successfully!');
      navigate(`/prescriptions/${saved.id}`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to send prescription');
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedPatient || !selectedProvider) {
      message.warning('Please select a patient and provider');
      return;
    }
    const validMeds = medications.filter((m) => m.medication);
    if (validMeds.length === 0) {
      message.warning('Please add at least one medication');
      return;
    }

    const now = new Date().toISOString();
    const draftPrescription = {
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      providerId: selectedProvider.id,
      providerName: `Dr. ${selectedProvider.firstName} ${selectedProvider.lastName}`,
      medications: validMeds.map((m, i) => ({
        id: `rxitem-${Date.now()}-${i}`,
        medication: m.medication!,
        rxNormCode: m.rxNormCode,
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        route: m.route || 'Oral',
        duration: m.duration || '',
        quantity: m.quantity || 0,
        refills: m.refills ?? 0,
        instructions: m.instructions,
      })) as PrescriptionItem[],
      status: 'draft' as const,
      prescribedDate: now,
      pharmacy: undefined,
      notes: undefined,
    };

    try {
      const saved = await prescriptionService.create(draftPrescription);
      message.success('Prescription saved as draft');
      navigate(`/prescriptions/${saved.id}`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save draft');
    }
  };

  // Step 1: Select Patient & Provider
  const renderPatientSelect = () => (
    <Card title="Select Patient & Provider" style={{ marginBottom: 24 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Form.Item label="Patient" required>
            <Select
              showSearch
              placeholder="Search and select a patient..."
              value={selectedPatientId}
              onChange={setSelectedPatientId}
              loading={loadingPatients}
              style={{ width: '100%' }}
              size="large"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName} (MRN: ${p.mrn || 'N/A'})`,
              }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item label="Prescribing Provider" required>
            <Select
              showSearch
              placeholder="Select provider..."
              value={selectedProviderId}
              onChange={setSelectedProviderId}
              loading={loadingProviders}
              style={{ width: '100%' }}
              size="large"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
              options={providers.map((p) => ({
                value: p.id,
                label: `Dr. ${p.firstName} ${p.lastName} (NPI: ${p.npi || 'N/A'})`,
              }))}
            />
          </Form.Item>
        </Col>
      </Row>

      {selectedPatient && (
        <Card type="inner" title="Patient Information" style={{ marginTop: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Name">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </Descriptions.Item>
            <Descriptions.Item label="MRN">{selectedPatient.mrn || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {selectedPatient.dateOfBirth}
            </Descriptions.Item>
            <Descriptions.Item label="Gender">
              {selectedPatient.gender.charAt(0).toUpperCase() + selectedPatient.gender.slice(1)}
            </Descriptions.Item>
            <Descriptions.Item label="Phone">{selectedPatient.phone || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Insurance">
              {selectedPatient.insurance?.[0]?.provider || 'N/A'}
            </Descriptions.Item>
          </Descriptions>

          {(selectedPatient.allergies || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text strong>
                <AlertOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                Allergies:
              </Text>
              <Space wrap style={{ marginLeft: 8 }}>
                {(selectedPatient.allergies || [])
                  .filter((a) => a.status !== 'inactive')
                  .map((a) => (
                    <Tag
                      key={a.id}
                      color={a.severity === 'severe' || a.severity === 'life-threatening' ? 'red' : 'orange'}
                    >
                      {a.allergen} ({a.severity})
                    </Tag>
                  ))}
              </Space>
            </div>
          )}

          {(selectedPatient.medicalHistory || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text strong>Active Conditions:</Text>
              <Space wrap style={{ marginLeft: 8 }}>
                {(selectedPatient.medicalHistory || [])
                  .filter((h) => h.status !== 'resolved')
                  .map((h) => (
                    <Tag key={h.id} color="blue">
                      {h.condition}
                    </Tag>
                  ))}
              </Space>
            </div>
          )}
        </Card>
      )}
    </Card>
  );

  // Step 2: Add Medications
  const renderMedicationForm = () => (
    <Card
      title={
        <Space>
          <span>Add Medications</span>
          {voiceEnabled && (
            <Button
              icon={<AudioOutlined />}
              size="small"
              onClick={() => setVoiceModalOpen(true)}
            >
              Voice Prescription
            </Button>
          )}
          {aiEnabled && (
            <Button
              icon={<RobotOutlined />}
              size="small"
              loading={aiReviewLoading}
              onClick={handleRunAiReview}
            >
              AI Review
            </Button>
          )}
        </Space>
      }
      style={{ marginBottom: 24 }}
    >
      {/* AI Review Result */}
      {aiReview && aiReview.issues.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Alert
            message={`AI Review Score: ${aiReview.score}/100`}
            description={
              <>
                <Paragraph>{aiReview.summary}</Paragraph>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {aiReview.issues.map((issue, i) => (
                    <li key={i} style={{ color: issue.severity === 'error' ? '#ff4d4f' : issue.severity === 'warning' ? '#faad14' : 'inherit' }}>
                      <strong>{issue.severity.toUpperCase()}:</strong> {issue.message}
                    </li>
                  ))}
                </ul>
              </>
            }
            type={aiReview.score >= 80 ? 'warning' : aiReview.score >= 50 ? 'warning' : 'error'}
            showIcon
            style={{ marginBottom: 8 }}
          />
        </div>
      )}

      {/* Allergy Alerts */}
      {allergyAlerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {allergyAlerts.map((alert, i) => (
            <Alert
              key={i}
              message="Allergy Alert"
              description={alert}
              type="error"
              showIcon
              icon={<AlertOutlined />}
              style={{ marginBottom: 8 }}
            />
          ))}
        </div>
      )}

      {medications.map((med, index) => {
        const selectedMed = medicationOptions.find((m) => m.name === med.medication);
        const strengths = selectedMed?.strengths?.length ? selectedMed.strengths : ['5mg', '10mg', '25mg', '50mg', '100mg'];
        return (
          <Card
            key={index}
            type="inner"
            title={`Medication ${index + 1}`}
            style={{ marginBottom: 16 }}
            extra={
              medications.length > 1 && (
                <Button
                  type="text"
                  danger
                  icon={<MinusCircleOutlined />}
                  onClick={() => handleRemoveMedication(index)}
                >
                  Remove
                </Button>
              )
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item label="Medication Name" required>
                  <Select
                    showSearch
                    placeholder="Search medication (RxNorm)..."
                    value={med.medication}
                    onChange={(val) => handleMedicationChange(index, 'medication', val)}
                    onSearch={handleMedicationSearch}
                    notFoundContent={medicationSearchLoading ? <Spin size="small" /> : null}
                    filterOption={false}
                    options={medicationOptions.map((m) => ({
                      value: m.name,
                      label: `${m.name} [${m.rxNormCode}]`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Dosage" required>
                  <Select
                    placeholder="Select dosage"
                    value={med.dosage}
                    onChange={(val) => handleMedicationChange(index, 'dosage', val)}
                  >
                    {strengths.map((s) => (
                      <Option key={s} value={s}>
                        {s}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Frequency" required>
                  <Select
                    placeholder="Select frequency"
                    value={med.frequency}
                    onChange={(val) => handleMedicationChange(index, 'frequency', val)}
                  >
                    {frequencyOptions.map((f) => (
                      <Option key={f} value={f}>
                        {f}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Route">
                  <Select
                    placeholder="Select route"
                    value={med.route}
                    onChange={(val) => handleMedicationChange(index, 'route', val)}
                  >
                    {routeOptions.map((r) => (
                      <Option key={r} value={r}>
                        {r}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="Duration" required>
                  <Input
                    placeholder="e.g. 30 days"
                    value={med.duration}
                    onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="Quantity" required>
                  <InputNumber
                    min={1}
                    placeholder="Qty"
                    value={med.quantity}
                    onChange={(val) => handleMedicationChange(index, 'quantity', val ?? undefined)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="Refills">
                  <InputNumber
                    min={0}
                    max={12}
                    placeholder="Refills"
                    value={med.refills}
                    onChange={(val) => handleMedicationChange(index, 'refills', val ?? undefined)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="Special Instructions">
                  <TextArea
                    rows={2}
                    placeholder="Additional instructions for the pharmacist or patient..."
                    value={med.instructions}
                    onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        );
      })}

      <Button
        type="dashed"
        onClick={handleAddMedication}
        icon={<PlusOutlined />}
        block
        style={{ height: 44 }}
      >
        Add Another Medication
      </Button>
    </Card>
  );

  // Step 3: Review
  const renderReview = () => {
    const validMeds = medications.filter((m) => m.medication);

    return (
      <div>
        {aiReview && aiReview.issues.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Alert
              message={`AI Review Score: ${aiReview.score}/100`}
              description={
                <>
                  <Paragraph>{aiReview.summary}</Paragraph>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {aiReview.issues.map((issue, i) => (
                      <li key={i} style={{ color: issue.severity === 'error' ? '#ff4d4f' : issue.severity === 'warning' ? '#faad14' : 'inherit' }}>
                        <strong>{issue.severity.toUpperCase()}:</strong> {issue.message}
                      </li>
                    ))}
                  </ul>
                </>
              }
              type={aiReview.score >= 80 ? 'warning' : aiReview.score >= 50 ? 'warning' : 'error'}
              showIcon
              style={{ marginBottom: 8 }}
            />
          </div>
        )}

        {allergyAlerts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {allergyAlerts.map((alert, i) => (
              <Alert
                key={i}
                message="Allergy Alert"
                description={alert}
                type="error"
                showIcon
                style={{ marginBottom: 8 }}
              />
            ))}
          </div>
        )}

        <Card title="Patient Information" style={{ marginBottom: 16 }}>
          {selectedPatient && (
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Name">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="MRN">{selectedPatient.mrn || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="DOB">{selectedPatient.dateOfBirth}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedPatient.phone || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Insurance">
                {selectedPatient.insurance?.[0]?.provider || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Allergies">
                {(selectedPatient.allergies || []).length > 0
                  ? (selectedPatient.allergies || []).map((a) => a.allergen).join(', ')
                  : 'NKDA'}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        <Card title="Prescribed Medications" style={{ marginBottom: 16 }}>
          <List
            dataSource={validMeds}
            renderItem={(med, index) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <MedicineBoxOutlined style={{ fontSize: 24, color: '#0D7C8A' }} />
                  }
                  title={
                    <Text strong>
                      {index + 1}. {med.medication} {med.dosage}
                    </Text>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text>
                        {med.frequency} | {med.route || 'Oral'} | {med.duration || 'N/A'}
                      </Text>
                      <Text>
                        Qty: {med.quantity || '-'} | Refills: {med.refills ?? '-'}
                      </Text>
                      {med.instructions && (
                        <Text type="secondary" italic>
                          Instructions: {med.instructions}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card title="Pharmacy" style={{ marginBottom: 16 }}>
          <Select
            placeholder="Select pharmacy"
            value={selectedPharmacy}
            onChange={setSelectedPharmacy}
            onSearch={handlePharmacySearch}
            showSearch
            filterOption={false}
            notFoundContent={pharmacySearchLoading ? <Spin size="small" /> : null}
            style={{ width: '100%' }}
            size="large"
            options={pharmacyOptions.map((p) => ({ value: p.name, label: `${p.name} (${p.city || 'Local'}, ${p.state || 'IL'})` }))}
          />
        </Card>

        <Card title="Provider Confirmation" style={{ marginBottom: 16 }}>
          <Checkbox
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          >
            <Text strong>
              I confirm this prescription is accurate, medically necessary, and I accept
              responsibility for this order.
            </Text>
          </Checkbox>
        </Card>

        <Row gutter={16} justify="end">
          <Col>
            <Button
              icon={<SaveOutlined />}
              size="large"
              onClick={handleSaveDraft}
            >
              Save as Draft
            </Button>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<SendOutlined />}
              size="large"
              onClick={handleSendToPharmacy}
              disabled={!confirmed || !selectedPharmacy || !selectedProvider}
            >
              Send to Pharmacy
            </Button>
          </Col>
        </Row>
      </div>
    );
  };

  const steps = [
    { title: 'Select Patient', content: renderPatientSelect() },
    { title: 'Add Medications', content: renderMedicationForm() },
    { title: 'Review & Send', content: renderReview() },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/prescriptions')}
        >
          Back to Prescriptions
        </Button>
      </Space>

      <Title level={3} style={{ marginBottom: 24 }}>
        New Prescription
      </Title>

      <Steps
        current={currentStep}
        items={steps.map((s) => ({ title: s.title }))}
        style={{ marginBottom: 32 }}
      />

      <Form form={form} layout="vertical">
        {steps[currentStep].content}
      </Form>

      {currentStep < 2 && (
        <Row justify="end" style={{ marginTop: 24 }}>
          <Space>
            {currentStep > 0 && (
              <Button size="large" onClick={handlePrev}>
                Previous
              </Button>
            )}
            <Button type="primary" size="large" onClick={handleNext}>
              Next
            </Button>
          </Space>
        </Row>
      )}

      <Modal
        title="Voice Prescription"
        open={voiceModalOpen}
        onCancel={() => setVoiceModalOpen(false)}
        onOk={handleVoiceParse}
        confirmLoading={voiceParsing}
        okText="Parse Prescription"
      >
        <Paragraph type="secondary">
          Paste a transcript of the prescription you want to parse (e.g., “Start metformin 500 mg twice daily for 30 days, 60 tablets, no refills”).
        </Paragraph>
        <TextArea
          rows={6}
          placeholder="Prescription transcript..."
          value={voiceTranscript}
          onChange={(e) => setVoiceTranscript(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default NewPrescriptionPage;
