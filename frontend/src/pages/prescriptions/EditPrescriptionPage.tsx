import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  AlertOutlined,
  MedicineBoxOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  prescriptionService,
  type Prescription,
  type PrescriptionItem,
  type PrescriptionStatus,
} from '../../services/prescriptionService';
import { patientService, type Patient } from '../../services/patientService';
import { providerService } from '../../services/providerService';
import { medicationService, type Medication } from '../../services/medicationService';
import { pharmacyService, type Pharmacy } from '../../services/pharmacyService';

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
  id?: string;
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

const EditPrescriptionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>();
  const [medications, setMedications] = useState<MedicationFormItem[]>([{}]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [form] = Form.useForm();

  const [patients, setPatients] = useState<ExtendedPatient[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [medicationOptions, setMedicationOptions] = useState<Medication[]>([]);
  const [medicationSearchLoading, setMedicationSearchLoading] = useState(false);
  const [pharmacyOptions, setPharmacyOptions] = useState<Pharmacy[]>([]);
  const [pharmacySearchLoading, setPharmacySearchLoading] = useState(false);

  const isDraft = prescription?.status === 'draft';
  const isActive = prescription?.status === 'active';

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
      if (!id) return;
      try {
        const [rx, pResult, provResult] = await Promise.all([
          prescriptionService.findOne(id),
          patientService.findAll({ page: 1, limit: 1000 }),
          providerService.findAll(),
        ]);
        setPrescription(rx);
        setPatients((pResult.data || []) as ExtendedPatient[]);
        setProviders((provResult || []) as ProviderInfo[]);
        setSelectedPatientId(rx.patientId);
        setSelectedProviderId(rx.providerId);
        setMedications(rx.medications.map((m) => ({ ...m })));
        setSelectedPharmacy(rx.pharmacy);
        setNotes(rx.notes || '');
        setLoadingPatients(false);
        setLoadingProviders(false);
      } catch (err: any) {
        message.error(err?.response?.data?.message || 'Failed to load prescription');
        navigate(`/prescriptions/${id}`);
      } finally {
        setLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      if (isDraft) {
        item.dosage = undefined;
      }
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

  const buildUpdateDto = (status?: PrescriptionStatus) => {
    if (!selectedPatient || !selectedProvider) return null;
    const validMeds = medications.filter((m) => m.medication);

    const medItems: PrescriptionItem[] = validMeds.map((m, i) => ({
      id: m.id || `rxitem-${Date.now()}-${i}`,
      medication: m.medication!,
      rxNormCode: m.rxNormCode,
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      route: m.route || 'Oral',
      duration: m.duration || '',
      quantity: m.quantity || 0,
      refills: m.refills ?? 0,
      instructions: m.instructions,
    }));

    const dto: any = {
      medications: medItems,
      pharmacy: selectedPharmacy,
      notes: notes || undefined,
    };

    if (isDraft) {
      dto.patientId = selectedPatient.id;
      dto.patientName = `${selectedPatient.firstName} ${selectedPatient.lastName}`;
      dto.providerId = selectedProvider.id;
      dto.providerName = `Dr. ${selectedProvider.firstName} ${selectedProvider.lastName}`;
    }

    if (status) {
      dto.status = status;
    }

    return dto;
  };

  const handleSave = async () => {
    if (!id) return;
    const dto = buildUpdateDto();
    if (!dto) return;
    setSaving(true);
    try {
      await prescriptionService.update(id, dto);
      message.success('Prescription updated successfully');
      navigate(`/prescriptions/${id}`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to update prescription');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndActivate = async () => {
    if (!id) return;
    if (!confirmed) {
      message.warning('Please confirm the prescription before activating');
      return;
    }
    if (!selectedPharmacy) {
      message.warning('Please select a pharmacy');
      return;
    }
    const dto = buildUpdateDto('active');
    if (!dto) return;
    setSaving(true);
    try {
      await prescriptionService.update(id, dto);
      message.success('Prescription signed and activated');
      navigate(`/prescriptions/${id}`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to activate prescription');
    } finally {
      setSaving(false);
    }
  };

  const renderPatientSelect = () => (
    <Card title="Patient & Provider" style={{ marginBottom: 24 }}>
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
              disabled={!isDraft}
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
              disabled={!isDraft}
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

      {isActive && (
        <Alert
          type="info"
          showIcon
          message="Active Prescription"
          description="Patient and provider cannot be changed for active prescriptions. Only medications, pharmacy, and notes can be edited."
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  );

  const renderMedicationForm = () => (
    <Card title="Edit Medications" style={{ marginBottom: 24 }}>
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

  const renderReview = () => {
    const validMeds = medications.filter((m) => m.medication);

    return (
      <div>
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
                  avatar={<MedicineBoxOutlined style={{ fontSize: 24, color: '#0D7C8A' }} />}
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

        <Card title="Pharmacy & Notes" style={{ marginBottom: 16 }}>
          <Form.Item label="Pharmacy">
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
          </Form.Item>
          <Form.Item label="Notes">
            <TextArea
              rows={3}
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Form.Item>
        </Card>

        {isDraft && (
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
        )}

        <Row gutter={16} justify="end">
          <Col>
            <Button
              icon={<SaveOutlined />}
              size="large"
              loading={saving}
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </Col>
          {isDraft && (
            <Col>
              <Button
                type="primary"
                icon={<SendOutlined />}
                size="large"
                loading={saving}
                onClick={handleSaveAndActivate}
                disabled={!confirmed || !selectedPharmacy}
              >
                Sign & Activate
              </Button>
            </Col>
          )}
        </Row>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/prescriptions')}>
          Back to Prescriptions
        </Button>
        <Title level={4} style={{ marginTop: 24 }}>
          Prescription not found
        </Title>
      </div>
    );
  }

  if (!isDraft && !isActive) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/prescriptions/${id}`)}>
          Back to Prescription
        </Button>
        <Alert
          type="warning"
          showIcon
          message="This prescription cannot be edited"
          description={`Prescriptions in "${prescription.status}" status are read-only. Only draft and active prescriptions can be edited.`}
          style={{ marginTop: 24 }}
        />
      </div>
    );
  }

  const steps = [
    { title: 'Patient & Provider', content: renderPatientSelect() },
    { title: 'Medications', content: renderMedicationForm() },
    { title: 'Review & Save', content: renderReview() },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/prescriptions/${id}`)}
        >
          Back to Prescription
        </Button>
      </Space>

      <Title level={3} style={{ marginBottom: 24 }}>
        Edit Prescription
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
    </div>
  );
};

export default EditPrescriptionPage;
