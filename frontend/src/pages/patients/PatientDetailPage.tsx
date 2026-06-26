import React, { useState, useMemo } from 'react';
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
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Patient, Allergy, MedicalHistory, Appointment, Claim } from '../../types';
import { mockPatients, mockAppointments, mockClaims } from '../../data/mockData';
import type { ColumnsType } from 'antd/es/table';

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
  const { patients: mockPatients } = usePatientStore();
  const { appointments: mockAppointments } = useAppointmentStore();
  const { claims: mockClaims } = useBillingStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const patient = useMemo(() => mockPatients.find((p) => p.id === id), [id]);

  const patientAppointments = useMemo(
    () => mockAppointments.filter((a) => a.patientId === id),
    [id],
  );

  const patientClaims = useMemo(
    () => mockClaims.filter((c) => c.patientId === id),
    [id],
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

  // ── Mock vitals history for chart display ──
  const vitalsHistory = [
    { date: '2024-08-01', systolic: 142, diastolic: 88, hr: 78, temp: 98.4, spo2: 97 },
    { date: '2024-09-15', systolic: 140, diastolic: 85, hr: 76, temp: 98.6, spo2: 98 },
    { date: '2024-10-10', systolic: 138, diastolic: 82, hr: 76, temp: 98.4, spo2: 98 },
    { date: '2024-11-01', systolic: 136, diastolic: 80, hr: 74, temp: 98.2, spo2: 99 },
  ];

  // ── Mock documents ──
  const documents = [
    { id: 'doc-1', name: 'Insurance Card - Front.pdf', type: 'PDF', size: '245 KB', date: '2024-01-15' },
    { id: 'doc-2', name: 'Lab Report - HbA1c.pdf', type: 'PDF', size: '128 KB', date: '2024-11-01' },
    { id: 'doc-3', name: 'Referral Letter - Cardiology.pdf', type: 'PDF', size: '89 KB', date: '2024-10-20' },
  ];

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
              <Space size={4} direction="vertical" style={{ gap: 0 }}>
                <span>
                  <HomeOutlined style={{ marginRight: 4 }} />
                  {patient.address.street}
                </span>
                <span style={{ marginLeft: 18 }}>
                  {patient.address.city}, {patient.address.state} {patient.address.zipCode}
                </span>
              </Space>
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
        </Card>

        {/* Insurance */}
        <Card
          title={
            <Space>
              <HeartOutlined />
              <span>Insurance ({patient.insurance.length})</span>
            </Space>
          }
          size="small"
        >
          {patient.insurance.length === 0 ? (
            <Text type="secondary">No insurance on file</Text>
          ) : (
            patient.insurance.map((ins) => (
              <div
                key={ins.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Space
                  style={{
                    width: '100%',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text strong>{ins.provider}</Text>
                  {ins.isPrimary && <Tag color="blue">Primary</Tag>}
                </Space>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Policy: {ins.policyNumber} | Group: {ins.groupNumber}
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Effective: {dayjs(ins.effectiveDate).format('MM/DD/YYYY')} -{' '}
                    {dayjs(ins.expirationDate).format('MM/DD/YYYY')}
                  </Text>
                </div>
              </div>
            ))
          )}
        </Card>
      </Col>

      {/* Quick Stats Row */}
      <Col xs={24}>
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Conditions"
                value={patient.medicalHistory.length}
                prefix={<HeartOutlined />}
                valueStyle={{ color: '#0D7C8A' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Allergies"
                value={patient.allergies.length}
                prefix={<AlertOutlined />}
                valueStyle={{
                  color: patient.allergies.length > 0 ? '#ff4d4f' : '#52c41a',
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
      {patient.medicalHistory.length === 0 ? (
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
      {patient.allergies.length === 0 ? (
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
  const DocumentsTab = () => (
    <Row gutter={[24, 24]}>
      <Col xs={24}>
        <Card title="Upload Documents">
          <Dragger
            name="file"
            multiple
            action=""
            onChange={() => {}}
            beforeUpload={() => false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag files to upload</p>
            <p className="ant-upload-hint">
              Support PDF, JPEG, PNG. Medical records, insurance cards, lab results, etc.
            </p>
          </Dragger>
        </Card>
      </Col>
      <Col xs={24}>
        <Card title="Documents">
          <List
            dataSource={documents}
            renderItem={(doc) => (
              <List.Item
                actions={[
                  <Button type="link" key="download">
                    Download
                  </Button>,
                  <Button type="link" danger key="delete">
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
        </Card>
      </Col>
    </Row>
  );

  // ── Tab: Vitals ──
  const VitalsTab = () => {
    const latest = vitalsHistory[vitalsHistory.length - 1];
    return (
      <Row gutter={[24, 24]}>
        {/* Latest Vitals */}
        <Col xs={24}>
          <Card title="Latest Vitals" extra={<Text type="secondary">{dayjs(latest.date).format('MMMM D, YYYY')}</Text>}>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Blood Pressure" value={`${latest.systolic}/${latest.diastolic}`} suffix="mmHg" />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Heart Rate" value={latest.hr} suffix="bpm" />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Temperature" value={latest.temp} suffix="°F" precision={1} />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="SpO2" value={latest.spo2} suffix="%" />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Weight" value={198} suffix="lbs" />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="BMI" value={28.4} precision={1} />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Vitals Trend Table */}
        <Col xs={24}>
          <Card title="Vitals History">
            <Table
              dataSource={vitalsHistory}
              rowKey="date"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'date',
                  render: (d: string) => dayjs(d).format('MM/DD/YYYY'),
                },
                {
                  title: 'BP (mmHg)',
                  render: (_: unknown, r: typeof vitalsHistory[0]) => `${r.systolic}/${r.diastolic}`,
                },
                {
                  title: 'HR (bpm)',
                  dataIndex: 'hr',
                },
                {
                  title: 'Temp (°F)',
                  dataIndex: 'temp',
                },
                {
                  title: 'SpO2 (%)',
                  dataIndex: 'spo2',
                  render: (v: number) => (
                    <span style={{ color: v < 95 ? '#ff4d4f' : '#52c41a' }}>{v}%</span>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* BP Trend visual */}
        <Col xs={24}>
          <Card title="Blood Pressure Trend">
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {vitalsHistory.map((v) => (
                <div key={v.date} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text style={{ width: 90, flexShrink: 0 }}>
                    {dayjs(v.date).format('MMM YYYY')}
                  </Text>
                  <Progress
                    percent={Math.round((v.systolic / 180) * 100)}
                    size="small"
                    format={() => `${v.systolic}/${v.diastolic}`}
                    strokeColor={v.systolic > 140 ? '#ff4d4f' : v.systolic > 130 ? '#faad14' : '#52c41a'}
                    style={{ flex: 1 }}
                  />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
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

  // ── Tabs definition ──
  const tabItems = [
    { key: 'overview', label: 'Overview', children: <OverviewTab /> },
    { key: 'history', label: 'Medical History', children: <MedicalHistoryTab /> },
    { key: 'allergies', label: `Allergies (${patient.allergies.length})`, children: <AllergiesTab /> },
    { key: 'appointments', label: 'Appointments', children: <AppointmentsTab /> },
    { key: 'documents', label: 'Documents', children: <DocumentsTab /> },
    { key: 'vitals', label: 'Vitals', children: <VitalsTab /> },
    { key: 'billing', label: 'Billing', children: <BillingTab /> },
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
                <Button type="primary" icon={<EditOutlined />}>
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
    </div>
  );
};

export default PatientDetailPage;
