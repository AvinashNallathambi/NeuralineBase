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
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Patient, Allergy, MedicalHistory, Appointment, Claim } from '../../types';
import { mockPatients, mockAppointments, mockClaims } from '../../data/mockData';
import { usePatientStore, useAppointmentStore, useBillingStore } from '../../store/dataStore';
import type { ColumnsType } from 'antd/es/table';
import ProblemListSection from '../../components/patients/ProblemListSection';
import EditPatientModal from '../../components/patients/EditPatientModal';
import { PatientInsuranceManager } from '../../components/patients/PatientInsuranceManager';
import { patientService } from '../../services/patientService';
import type { PortalStatus, EnablePortalResult } from '../../services/patientService';
import type { EncounterVitals } from '../../services/encounterService';

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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [vitalsHistory, setVitalsHistory] = useState<Array<EncounterVitals & { encounterId: string; encounterDate: string }>>([]);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; type: string; size: string; date: string; documentType?: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalActionLoading, setPortalActionLoading] = useState(false);
  const [enableResult, setEnableResult] = useState<EnablePortalResult | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetForm] = Form.useForm();

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
    <Card>
      {!patient.medicalHistory || patient.medicalHistory.length === 0 ? (
        <Empty description="No medical history recorded" />
      ) : (
        <Table<MedicalHistory>
          columns={medicalHistoryColumns}
          dataSource={patient.medicalHistory}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      )}
    </Card>
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
  const DocumentsTab = () => {
    const handleUpload = async (file: File) => {
      if (!patient) return;
      setUploading(true);
      try {
        const result = await patientService.uploadDocument(
          patient.id,
          file,
          'other',
        );
        setDocuments((prev) => [
          {
            id: result.id,
            name: result.fileName,
            type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
            size: `${(file.size / 1024).toFixed(0)} KB`,
            date: new Date().toISOString(),
            documentType: result.documentType,
          },
          ...prev,
        ]);
        message.success(`${file.name} uploaded successfully`);
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
        content: 'Are you sure you want to delete this document?',
        okText: 'Delete',
        okType: 'danger',
        onOk: () => {
          setDocuments((prev) => prev.filter((d) => d.id !== docId));
          message.success('Document deleted');
        },
      });
    };

    return (
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card title="Upload Documents">
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
            {documents.length === 0 ? (
              <Empty description="No documents uploaded yet" />
            ) : (
              <List
                dataSource={documents}
                renderItem={(doc) => (
                  <List.Item
                    actions={[
                      <Button type="link" key="download" icon={<DownloadOutlined />}>
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
                      title={doc.name}
                      description={`${doc.type} - ${doc.size} - Uploaded ${dayjs(doc.date).format('MM/DD/YYYY')}`}
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

  // ── Tabs definition ──
  const tabItems = [
    { key: 'overview', label: 'Overview', children: <OverviewTab /> },
    { key: 'history', label: 'Medical History', children: <MedicalHistoryTab /> },
    { key: 'problems', label: 'Problem List', children: <ProblemListTab /> },
    { key: 'allergies', label: `Allergies (${patient.allergies.length})`, children: <AllergiesTab /> },
    { key: 'appointments', label: 'Appointments', children: <AppointmentsTab /> },
    { key: 'documents', label: 'Documents', children: <DocumentsTab /> },
    { key: 'vitals', label: 'Vitals', children: <VitalsTab /> },
    { key: 'billing', label: 'Billing', children: <BillingTab /> },
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
    </div>
  );
};

export default PatientDetailPage;
