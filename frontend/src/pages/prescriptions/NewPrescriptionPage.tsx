import React, { useState } from 'react';
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
  Divider,
  Alert,
  Checkbox,
  Descriptions,
  Tag,
  List,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  WarningOutlined,
  AlertOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  SendOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Patient, PrescriptionItem } from '../../types';
import { pharmacyList, medicationList, mockPatients } from '../../data/mockData';
import { usePrescriptionStore } from '../../store/dataStore';

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
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  quantity?: number;
  refills?: number;
  instructions?: string;
}

const NewPrescriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [medications, setMedications] = useState<MedicationFormItem[]>([{}]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const [form] = Form.useForm();
  const { addPrescription } = usePrescriptionStore();

  const selectedPatient = mockPatients.find((p) => p.id === selectedPatientId);

  // Drug interaction check (mock)
  const drugInteractionWarnings = (() => {
    const warnings: { severity: 'warning' | 'error'; message: string }[] = [];
    const medNames = medications.map((m) => m.medication?.toLowerCase() || '');
    if (medNames.includes('lisinopril') || medNames.includes('losartan')) {
      if (
        medNames.includes('potassium chloride') ||
        selectedPatient?.allergies.some((a) =>
          a.allergen.toLowerCase().includes('potassium')
        )
      ) {
        warnings.push({
          severity: 'warning',
          message:
            'Moderate interaction between ACE inhibitor/ARB and Potassium supplements. Monitor serum potassium closely.',
        });
      }
    }
    const hasLisinopril = medNames.includes('lisinopril');
    if (hasLisinopril && medications.length >= 1) {
      warnings.push({
        severity: 'warning',
        message:
          'Moderate interaction: Lisinopril and Potassium supplements. Monitor serum potassium levels and renal function.',
      });
    }
    const unique = warnings.filter(
      (w, i, self) => self.findIndex((s) => s.message === w.message) === i
    );
    return unique;
  })();

  // Allergy alerts
  const allergyAlerts = (() => {
    if (!selectedPatient) return [];
    const alerts: string[] = [];
    const medNames = medications.map((m) => m.medication?.toLowerCase() || '');

    selectedPatient.allergies
      .filter((a) => a.status === 'active')
      .forEach((allergy) => {
        const allergenLower = allergy.allergen.toLowerCase();
        if (
          medNames.some(
            (med) => med.includes(allergenLower) || allergenLower.includes(med)
          )
        ) {
          alerts.push(
            `ALLERGY ALERT: Patient is allergic to ${allergy.allergen} (${allergy.reaction}, Severity: ${allergy.severity})`
          );
        }
        if (
          allergenLower === 'penicillin' &&
          medNames.some((m) => m.includes('amoxicillin'))
        ) {
          alerts.push(
            `ALLERGY ALERT: Patient has Penicillin allergy - Amoxicillin is a penicillin-type antibiotic. Consider alternative.`
          );
        }
      });

    return alerts;
  })();

  const handleAddMedication = () => {
    setMedications([...medications, {}]);
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleMedicationChange = (
    index: number,
    field: keyof MedicationFormItem,
    value: string | number | undefined
  ) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleNext = () => {
    if (currentStep === 0 && !selectedPatientId) {
      message.warning('Please select a patient');
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

  const handleSendToPharmacy = () => {
    if (!confirmed) {
      message.warning('Please confirm the prescription before sending');
      return;
    }
    if (!selectedPatient || !selectedPharmacy) {
      message.warning('Please select a patient and pharmacy');
      return;
    }

    const validMeds = medications.filter((m) => m.medication);
    const newPrescription = {
      id: `rx-${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      providerId: 'usr-001',
      providerName: 'Dr. Sarah Chen',
      medications: validMeds.map((m, i) => ({
        id: `rxitem-${Date.now()}-${i}`,
        medication: m.medication!,
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        route: m.route || 'Oral',
        duration: m.duration || '',
        quantity: m.quantity || 0,
        refills: m.refills || 0,
        instructions: m.instructions,
      })) as PrescriptionItem[],
      status: 'active' as const,
      prescribedDate: new Date().toISOString(),
      pharmacy: selectedPharmacy,
      notes: undefined,
    };

    addPrescription(newPrescription);
    message.success('Prescription sent to pharmacy successfully!');
    navigate('/prescriptions');
  };

  const handleSaveDraft = () => {
    message.info('Prescription saved as draft');
    navigate('/prescriptions');
  };

  // Step 1: Select Patient
  const renderPatientSelect = () => (
    <Card title="Select Patient" style={{ marginBottom: 24 }}>
      <Select
        showSearch
        placeholder="Search and select a patient..."
        value={selectedPatientId}
        onChange={setSelectedPatientId}
        style={{ width: '100%', marginBottom: 16 }}
        size="large"
        filterOption={(input, option) =>
          (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
        }
        options={mockPatients.map((p) => ({
          value: p.id,
          label: `${p.firstName} ${p.lastName} (MRN: ${p.mrn})`,
        }))}
      />

      {selectedPatient && (
        <Card type="inner" title="Patient Information" style={{ marginTop: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Name">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </Descriptions.Item>
            <Descriptions.Item label="MRN">{selectedPatient.mrn}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {selectedPatient.dateOfBirth}
            </Descriptions.Item>
            <Descriptions.Item label="Gender">
              {selectedPatient.gender.charAt(0).toUpperCase() + selectedPatient.gender.slice(1)}
            </Descriptions.Item>
            <Descriptions.Item label="Phone">{selectedPatient.phone}</Descriptions.Item>
            <Descriptions.Item label="Insurance">
              {selectedPatient.insurance[0]?.provider || 'N/A'}
            </Descriptions.Item>
          </Descriptions>

          {selectedPatient.allergies.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text strong>
                <AlertOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                Allergies:
              </Text>
              <Space wrap style={{ marginLeft: 8 }}>
                {selectedPatient.allergies
                  .filter((a) => a.status === 'active')
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

          {selectedPatient.medicalHistory.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text strong>Active Conditions:</Text>
              <Space wrap style={{ marginLeft: 8 }}>
                {selectedPatient.medicalHistory
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
    <Card title="Add Medications" style={{ marginBottom: 24 }}>
      {/* Drug Interaction Warnings */}
      {drugInteractionWarnings.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {drugInteractionWarnings.map((w, i) => (
            <Alert
              key={i}
              message="Drug Interaction Warning"
              description={w.message}
              type={w.severity}
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 8 }}
            />
          ))}
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

      {medications.map((med, index) => (
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
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                  }
                  options={medicationList.map((m) => ({
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
                  {(
                    medicationList.find((m) => m.name === med.medication)?.strengths || [
                      '5mg',
                      '10mg',
                      '25mg',
                      '50mg',
                      '100mg',
                    ]
                  ).map((s) => (
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
              <Form.Item label="Duration">
                <Input
                  placeholder="e.g. 30 days"
                  value={med.duration}
                  onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Quantity">
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
      ))}

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
        {/* Drug Interaction Warnings */}
        {drugInteractionWarnings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {drugInteractionWarnings.map((w, i) => (
              <Alert
                key={i}
                message="Drug Interaction Warning"
                description={w.message}
                type={w.severity}
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 8 }}
              />
            ))}
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
                style={{ marginBottom: 8 }}
              />
            ))}
          </div>
        )}

        {/* Patient Info */}
        <Card title="Patient Information" style={{ marginBottom: 16 }}>
          {selectedPatient && (
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Name">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="MRN">{selectedPatient.mrn}</Descriptions.Item>
              <Descriptions.Item label="DOB">{selectedPatient.dateOfBirth}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedPatient.phone}</Descriptions.Item>
              <Descriptions.Item label="Insurance">
                {selectedPatient.insurance[0]?.provider || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Allergies">
                {selectedPatient.allergies.length > 0
                  ? selectedPatient.allergies.map((a) => a.allergen).join(', ')
                  : 'NKDA'}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        {/* Medications Summary */}
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

        {/* Pharmacy */}
        <Card title="Pharmacy" style={{ marginBottom: 16 }}>
          <Select
            placeholder="Select pharmacy"
            value={selectedPharmacy}
            onChange={setSelectedPharmacy}
            style={{ width: '100%' }}
            size="large"
            options={pharmacyList.map((p) => ({ value: p.name, label: p.name }))}
          />
        </Card>

        {/* Provider Signature */}
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

        {/* Action Buttons */}
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
              disabled={!confirmed || !selectedPharmacy}
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
      {/* Header */}
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

      {/* Steps */}
      <Steps
        current={currentStep}
        items={steps.map((s) => ({ title: s.title }))}
        style={{ marginBottom: 32 }}
      />

      {/* Step Content */}
      <Form form={form} layout="vertical">
        {steps[currentStep].content}
      </Form>

      {/* Navigation Buttons */}
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

export default NewPrescriptionPage;
