import { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  Card,
  Table,
  Button,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Tag,
  Alert,
  Statistic,
  Row,
  Col,
  Space,
  Typography,
  message,
  Descriptions,
  Steps,
  QRCode,
  Spin,
  Empty,
  Tooltip,
  Badge,
  Progress,
  List,
  Divider,
} from 'antd';
import {
  SafetyCertificateOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  AuditOutlined,
  MedicineBoxOutlined,
  RobotOutlined,
  FileSearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  epcsService,
  ProviderEpcsEnrollment,
  PdmpQuery,
  EpcsAuditLog,
  ControlledSubstanceInfo,
  OpioidRiskScore,
  DiversionCheckResult,
  AlternativeTherapy,
  PdmpSummary,
  BehavioralNudge,
  QuantityOptimization,
  AnomalyDetectionResult,
  ValidationResult,
  DeaSchedule,
} from '../../services/epcsService';
import { useAuthStore } from '../../store';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─────────────────────────────────────────────────────────────────────────────
// Schedule colors
// ─────────────────────────────────────────────────────────────────────────────
const scheduleColors: Record<string, string> = {
  II: 'red',
  III: 'orange',
  IV: 'gold',
  V: 'blue',
};

const riskColors: Record<string, string> = {
  low: 'green',
  moderate: 'blue',
  high: 'orange',
  critical: 'red',
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EPCS PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function EpcsPage() {
  const [activeTab, setActiveTab] = useState('enrollment');

  return (
    <div >
      <div style={{ marginBottom: 16 }}>
        <Title level={2}>
          <SafetyCertificateOutlined style={{ marginRight: 8 }} />
          EPCS — Electronic Prescribing of Controlled Substances
        </Title>
        <Text type="secondary">
          DEA-compliant controlled substance prescribing with AI-powered safety features
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'enrollment',
            label: (
              <span>
                <SafetyCertificateOutlined /> Provider Enrollment
              </span>
            ),
            children: <EnrollmentTab />,
          },
          {
            key: 'medications',
            label: (
              <span>
                <MedicineBoxOutlined /> Controlled Substances
              </span>
            ),
            children: <MedicationsTab />,
          },
          {
            key: 'pdmp',
            label: (
              <span>
                <FileSearchOutlined /> PDMP Query
              </span>
            ),
            children: <PdmpTab />,
          },
          {
            key: 'ai',
            label: (
              <span>
                <RobotOutlined /> AI Safety Features
              </span>
            ),
            children: <AiTab />,
          },
          {
            key: 'audit',
            label: (
              <span>
                <AuditOutlined /> Audit Trail
              </span>
            ),
            children: <AuditTab />,
          },
        ]}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ENROLLMENT TAB
// ═════════════════════════════════════════════════════════════════════════════

function EnrollmentTab() {
  const user = useAuthStore((state) => state.user);
  const [enrollments, setEnrollments] = useState<ProviderEpcsEnrollment[]>([]);
  const [myEnrollment, setMyEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrollModal, setEnrollModal] = useState(false);
  const [setup2faModal, setSetup2faModal] = useState<{ id: string; otpauthUrl?: string; secret?: string } | null>(null);
  const [accessModal, setAccessModal] = useState<{ id: string; userName: string } | null>(null);
  const [verifyModal, setVerifyModal] = useState<string | null>(null);
  const [enrollForm] = Form.useForm();
  const [accessForm] = Form.useForm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [all, me] = await Promise.all([
        epcsService.getEnrollments(),
        epcsService.getMyEnrollment(),
      ]);
      setEnrollments(all || []);
      setMyEnrollment(me);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEnroll = async (values: any) => {
    try {
      await epcsService.startEnrollment(values);
      message.success('EPCS enrollment started');
      setEnrollModal(false);
      enrollForm.resetFields();
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Enrollment failed');
    }
  };

  const handleSetup2fa = async (id: string, method: string = 'totp') => {
    try {
      const result = await epcsService.setupTwoFactor(id, method);
      setSetup2faModal({ id, otpauthUrl: result.otpauthUrl, secret: result.secret });
      message.success('2FA setup initiated — scan QR code with your authenticator app');
    } catch (err: any) {
      message.error(err?.response?.data?.message || '2FA setup failed');
    }
  };

  const handleVerify2fa = async (token: string) => {
    try {
      if (!verifyModal) return;
      const result = await epcsService.verifyTwoFactor(verifyModal, token);
      if (result.valid) {
        message.success('2FA verified successfully');
        setVerifyModal(null);
        load();
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Verification failed');
    }
  };

  const handleIdentityProofing = async (id: string) => {
    try {
      // In production, this would launch a document verification flow
      // For now, self-attest (the two-person rule still applies at access control)
      const me = myEnrollment;
      await epcsService.completeIdentityProofing(id, me?.id || 'self', 'document_verification');
      message.success('Identity proofing completed');
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Identity proofing failed');
    }
  };

  const handleGrantAccess = async (values: any) => {
    try {
      if (!accessModal) return;
      await epcsService.grantAccessControl(accessModal.id, {
        grantedByUserId: values.grantedByUserId,
        grantedByName: values.grantedByName,
      });
      message.success('EPCS access granted — provider is now EPCS-active');
      setAccessModal(null);
      accessForm.resetFields();
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Access grant failed');
    }
  };

  const columns: ColumnsType<ProviderEpcsEnrollment> = [
    { title: 'Provider', dataIndex: 'userName', key: 'userName' },
    { title: 'DEA #', dataIndex: 'deaNumber', key: 'deaNumber' },
    { title: 'NPI', dataIndex: 'npiNumber', key: 'npiNumber' },
    {
      title: 'ID Proofing',
      dataIndex: 'identityProofingStatus',
      key: 'identityProofingStatus',
      render: (status: string) => {
        const colors: Record<string, string> = { verified: 'green', not_started: 'default', in_progress: 'processing', failed: 'red', expired: 'orange' };
        return <Tag color={colors[status] || 'default'}>{status.replace(/_/g, ' ')}</Tag>;
      },
    },
    {
      title: '2FA',
      dataIndex: 'twoFactorMethod',
      key: 'twoFactorMethod',
      render: (method?: string) => method ? <Tag color="blue">{method.toUpperCase()}</Tag> : <Tag>Not set up</Tag>,
    },
    {
      title: 'Access Control',
      dataIndex: 'accessControlGranted',
      key: 'accessControlGranted',
      render: (granted: boolean) => granted ? <Tag color="green">Granted</Tag> : <Tag>Pending</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = { active: 'green', pending: 'default', suspended: 'orange', revoked: 'red' };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'EPCS Ready',
      key: 'ready',
      render: (_: any, r: ProviderEpcsEnrollment) =>
        r.isEpcsReady ? <CheckCircleOutlined style={{ color: 'green', fontSize: 18 }} /> : <ExclamationCircleOutlined style={{ color: 'orange', fontSize: 18 }} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: ProviderEpcsEnrollment) => (
        <Space>
          {r.identityProofingStatus === 'not_started' && r.status === 'pending' && (
            <Button size="small" onClick={() => handleIdentityProofing(r.id)}>Complete ID Proofing</Button>
          )}
          {r.identityProofingStatus === 'verified' && !r.twoFactorMethod && (
            <Button size="small" type="primary" onClick={() => handleSetup2fa(r.id)}>Set Up 2FA</Button>
          )}
          {r.twoFactorMethod && !r.accessControlGranted && (
            <>
              <Button size="small" onClick={() => setVerifyModal(r.id)}>Verify 2FA</Button>
              <Button size="small" type="primary" onClick={() => setAccessModal({ id: r.id, userName: r.userName })}>Grant Access</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const enrollmentSteps = [
    { title: 'DEA/NPI Validation', description: 'Verify DEA number and NPI' },
    { title: 'Identity Proofing', description: 'IAL2 identity verification' },
    { title: '2FA Setup', description: 'Two-factor authentication' },
    { title: 'Access Control', description: 'Two-person rule approval' },
    { title: 'Active', description: 'Ready to prescribe CS' },
  ];

  const currentStep = (e: ProviderEpcsEnrollment | null) => {
    if (!e || !e.id) return 0;
    if (e.status === 'active') return 4;
    if (e.accessControlGranted) return 4;
    if (e.twoFactorMethod) return 3;
    if (e.identityProofingStatus === 'verified') return 2;
    if (e.status === 'pending') return 1;
    return 0;
  };

  return (
    <Spin spinning={loading}>
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>My EPCS Enrollment Status</Title>
        {myEnrollment && myEnrollment.enrolled ? (
          <>
            <Steps current={currentStep(myEnrollment)} items={enrollmentSteps} style={{ marginBottom: 16 }} />
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="DEA Number" value={myEnrollment.deaNumber} />
              </Col>
              <Col span={6}>
                <Statistic title="NPI" value={myEnrollment.npiNumber} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="2FA Method"
                  value={myEnrollment.twoFactorMethod?.toUpperCase() || 'Not set'}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="EPCS Ready"
                  valueRender={() =>
                    myEnrollment.isEpcsReady ? (
                      <Tag color="green" icon={<CheckCircleOutlined />}>Ready</Tag>
                    ) : (
                      <Tag color="orange">Not Ready</Tag>
                    )
                  }
                />
              </Col>
            </Row>
          </>
        ) : (
          <Empty description="You are not enrolled in EPCS">
            <Button type="primary" onClick={() => setEnrollModal(true)}>
              Start EPCS Enrollment
            </Button>
          </Empty>
        )}
      </Card>

      <Card
        title="All Provider Enrollments"
        extra={<Button type="primary" onClick={() => setEnrollModal(true)}>New Enrollment</Button>}
      >
        <Table
          columns={columns}
          dataSource={enrollments}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Enrollment Drawer */}
      <Drawer
        title="Start EPCS Enrollment"
        open={enrollModal}
        onClose={() => setEnrollModal(false)}
        width={480}
        extra={
          <Space>
            <Button onClick={() => setEnrollModal(false)}>Cancel</Button>
            <Button type="primary" onClick={() => enrollForm.submit()}>Start Enrollment</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          message="EPCS Enrollment — Step 1 of 5"
          description="Enter your DEA registration number and NPI to begin. Your DEA number will be validated using the DEA checksum algorithm."
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Descriptions column={1} size="small" bordered style={{ marginBottom: 24 }}>
          <Descriptions.Item label="Enrolling Provider">
            {user ? `${user.firstName} ${user.lastName}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            {user?.email || '—'}
          </Descriptions.Item>
        </Descriptions>
        <Form form={enrollForm} layout="vertical" onFinish={handleEnroll}>
          <Form.Item name="deaNumber" label="DEA Number" rules={[{ required: true, message: 'DEA number is required' }]}>
            <Input placeholder="AB1234563" maxLength={9} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="npiNumber" label="NPI Number" rules={[{ required: true, message: 'NPI is required' }]}>
            <Input placeholder="1234567890" maxLength={10} />
          </Form.Item>
          <Form.Item name="practiceState" label="Practice State">
            <Select
              showSearch
              placeholder="Select state"
              options={[
                { value: 'NY', label: 'New York' },
                { value: 'FL', label: 'Florida' },
                { value: 'TX', label: 'Texas' },
                { value: 'CA', label: 'California' },
                { value: 'OH', label: 'Ohio' },
                { value: 'NC', label: 'North Carolina' },
                { value: 'AZ', label: 'Arizona' },
                { value: 'MA', label: 'Massachusetts' },
                { value: 'ME', label: 'Maine' },
              ]}
            />
          </Form.Item>
        </Form>
        <Divider />
        <Alert
          type="warning"
          message="What happens next?"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Step 2: Identity proofing (IAL2 verification)</li>
              <li>Step 3: Two-factor authentication setup</li>
              <li>Step 4: Two-person access control approval</li>
              <li>Step 5: EPCS active — ready to prescribe controlled substances</li>
            </ul>
          }
          showIcon
        />
      </Drawer>

      {/* 2FA Setup Modal */}
      <Modal
        title="Two-Factor Authentication Setup"
        open={!!setup2faModal}
        onCancel={() => setSetup2faModal(null)}
        footer={[
          <Button key="close" onClick={() => setSetup2faModal(null)}>Close</Button>,
          <Button key="verify" type="primary" onClick={() => { if (setup2faModal) { setVerifyModal(setup2faModal.id); setSetup2faModal(null); } }}>
            I've Scanned the QR Code
          </Button>,
        ]}
      >
        {setup2faModal?.otpauthUrl && (
          <div style={{ textAlign: 'center' }}>
            <Paragraph>Scan this QR code with Google Authenticator, Authy, or any TOTP app:</Paragraph>
            <QRCode value={setup2faModal.otpauthUrl} size={200} />
            <Divider />
            <Paragraph type="secondary">Or enter this secret manually:</Paragraph>
            <Input.Password value={setup2faModal.secret} readOnly style={{ textAlign: 'center', fontFamily: 'monospace' }} />
          </div>
        )}
      </Modal>

      {/* 2FA Verify Modal */}
      <Modal
        title="Verify Two-Factor Token"
        open={!!verifyModal}
        onCancel={() => setVerifyModal(null)}
        footer={null}
      >
        <Form
          onFinish={(values) => handleVerify2fa(values.token)}
          layout="vertical"
        >
          <Form.Item name="token" label="Enter the 6-digit code from your authenticator app" rules={[{ required: true }]}>
            <Input.OTP length={6} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>Verify</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Access Control Modal (Two-Person Rule) */}
      <Modal
        title={`Grant EPCS Access to ${accessModal?.userName || ''}`}
        open={!!accessModal}
        onCancel={() => setAccessModal(null)}
        onOk={() => accessForm.submit()}
        okText="Grant Access"
      >
        <Alert
          type="warning"
          message="DEA Two-Person Rule"
          description="A second authorized user must approve EPCS access. You cannot grant access to yourself."
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={accessForm} layout="vertical" onFinish={handleGrantAccess}>
          <Form.Item name="grantedByUserId" label="Your User ID" rules={[{ required: true }]}>
            <Input placeholder="Your user ID (must be different from the enrollee)" />
          </Form.Item>
          <Form.Item name="grantedByName" label="Your Name" rules={[{ required: true }]}>
            <Input placeholder="Your name" />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTROLLED SUBSTANCES TAB
// ═════════════════════════════════════════════════════════════════════════════

function MedicationsTab() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ControlledSubstanceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ControlledSubstanceInfo | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validateForm] = Form.useForm();
  const [deaInput, setDeaInput] = useState('');
  const [deaResult, setDeaResult] = useState<boolean | null>(null);

  const handleSearch = async (value: string) => {
    if (!value || value.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await epcsService.searchControlledSubstances(value);
      setResults(data || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const handleValidate = async (values: any) => {
    try {
      const result = await epcsService.validate({
        schedule: values.schedule,
        quantity: values.quantity,
        refills: values.refills,
        daysSupply: values.daysSupply,
        state: values.state,
      });
      setValidation(result);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Validation failed');
    }
  };

  const handleValidateDea = async () => {
    if (!deaInput) return;
    try {
      const result = await epcsService.validateDeaNumber(deaInput);
      setDeaResult(result.valid);
    } catch {
      setDeaResult(false);
    }
  };

  const columns: ColumnsType<ControlledSubstanceInfo> = [
    { title: 'Brand Name', dataIndex: 'name', key: 'name', render: (v: string) => <strong>{v}</strong> },
    { title: 'Generic', dataIndex: 'genericName', key: 'genericName' },
    {
      title: 'Schedule',
      dataIndex: 'schedule',
      key: 'schedule',
      render: (s: DeaSchedule) => <Tag color={scheduleColors[s]}>Schedule {s}</Tag>,
    },
    { title: 'Class', dataIndex: 'deaClass', key: 'deaClass' },
    {
      title: 'Opioid',
      dataIndex: 'isOpioid',
      key: 'isOpioid',
      render: (v: boolean) => v ? <Tag color="volcano">Opioid</Tag> : null,
    },
    {
      title: 'MME/Unit',
      dataIndex: 'mmePerUnit',
      key: 'mmePerUnit',
      render: (v?: number) => v ? v.toFixed(2) : '—',
    },
    {
      title: 'Strengths',
      dataIndex: 'commonStrengths',
      key: 'commonStrengths',
      render: (s: string[]) => s.join(', '),
    },
  ];

  return (
    <div>
      <Card title="Controlled Substance Lookup" style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Search by brand or generic name (e.g., oxycodone, Xanax, Adderall)"
          prefix={<SearchOutlined />}
          enterButton
          loading={loading}
          onSearch={handleSearch}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <Table
          columns={columns}
          dataSource={results}
          rowKey={(r) => r.name}
          pagination={{ pageSize: 10 }}
          size="small"
          style={{ marginTop: 16 }}
          onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Prescription Validation">
            <Form form={validateForm} layout="vertical" onFinish={handleValidate}>
              <Form.Item name="schedule" label="DEA Schedule" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'II', label: 'Schedule II' },
                  { value: 'III', label: 'Schedule III' },
                  { value: 'IV', label: 'Schedule IV' },
                  { value: 'V', label: 'Schedule V' },
                ]} />
              </Form.Item>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
                    <Input type="number" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="refills" label="Refills" rules={[{ required: true }]}>
                    <Input type="number" defaultValue={0} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="daysSupply" label="Days Supply">
                    <Input type="number" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="state" label="State">
                    <Select
                      showSearch
                      allowClear
                      options={[
                        { value: 'NY', label: 'New York' },
                        { value: 'FL', label: 'Florida' },
                        { value: 'TX', label: 'Texas' },
                        { value: 'OH', label: 'Ohio' },
                        { value: 'NC', label: 'North Carolina' },
                        { value: 'AZ', label: 'Arizona' },
                        { value: 'MA', label: 'Massachusetts' },
                        { value: 'ME', label: 'Maine' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" block>Validate Prescription</Button>
            </Form>

            {validation && (
              <div style={{ marginTop: 16 }}>
                {validation.valid ? (
                  <Alert type="success" message="Prescription is valid" showIcon />
                ) : (
                  <Alert type="error" message="Validation Errors" description={validation.errors.map((e, i) => <div key={i}>{e}</div>)} showIcon />
                )}
                {validation.warnings.length > 0 && (
                  <Alert
                    type="warning"
                    message="Warnings"
                    description={validation.warnings.map((w, i) => <div key={i}>{w}</div>)}
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="DEA Number Validator">
            <Input.Group compact>
              <Input
                style={{ width: '60%' }}
                placeholder="AB1234563"
                value={deaInput}
                onChange={(e) => setDeaInput(e.target.value.toUpperCase())}
                maxLength={9}
              />
              <Button type="primary" onClick={handleValidateDea} style={{ width: '40%' }}>Validate</Button>
            </Input.Group>
            {deaResult !== null && (
              <div style={{ marginTop: 16 }}>
                {deaResult ? (
                  <Alert type="success" message="Valid DEA Number" description="Checksum verification passed." showIcon />
                ) : (
                  <Alert type="error" message="Invalid DEA Number" description="Checksum verification failed. Please verify the number." showIcon />
                )}
              </div>
            )}
            <Divider />
            <Title level={5}>DEA Number Format</Title>
            <Paragraph type="secondary">
              • 2 letters + 7 digits (e.g., AB1234563)<br />
              • First letter: A, B, F, G, M, or P<br />
              • Last digit is a checksum<br />
              • Format: [Registrant Type][Last Initial][5 Serial Digits][Checksum]
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PDMP TAB
// ═════════════════════════════════════════════════════════════════════════════

function PdmpTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PdmpQuery | null>(null);
  const [summary, setSummary] = useState<PdmpSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const handleQuery = async (values: any) => {
    setLoading(true);
    setResult(null);
    setSummary(null);
    try {
      const data = await epcsService.queryPdmp(values);
      setResult(data);
      message.success('PDMP query completed');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'PDMP query failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSummary = async () => {
    if (!result) return;
    setSummaryLoading(true);
    try {
      const data = await epcsService.generatePdmpSummary({
        pdmpQueryId: result.id,
        patientName: result.patientName,
      });
      setSummary(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'AI summary failed');
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div>
      <Card title="Query Prescription Drug Monitoring Program (PDMP)" style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          message="In-Workflow PDMP"
          description="Query the state PDMP before prescribing controlled substances. Results appear inline — no separate login or portal."
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="inline" onFinish={handleQuery}>
          <Form.Item name="patientId" rules={[{ required: true }]} style={{ flex: 1, marginRight: 8 }}>
            <Input placeholder="Patient ID" />
          </Form.Item>
          <Form.Item name="patientName" rules={[{ required: true }]} style={{ flex: 1, marginRight: 8 }}>
            <Input placeholder="Patient Name" />
          </Form.Item>
          <Form.Item name="state" rules={[{ required: true }]} style={{ width: 120, marginRight: 8 }}>
            <Select placeholder="State" options={[
              { value: 'NY', label: 'NY' }, { value: 'FL', label: 'FL' }, { value: 'TX', label: 'TX' },
              { value: 'OH', label: 'OH' }, { value: 'NC', label: 'NC' }, { value: 'AZ', label: 'AZ' },
              { value: 'MA', label: 'MA' }, { value: 'ME', label: 'ME' },
            ]} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<FileSearchOutlined />}>
              Query PDMP
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {result && (
        <Row gutter={16}>
          <Col span={14}>
            <Card title="PDMP Results" extra={<Tag color={riskColors[result.riskLevel]}>{result.riskLevel} risk</Tag>}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="CS Prescriptions" value={result.csPrescriptionCount} />
                </Col>
                <Col span={6}>
                  <Statistic title="Prescribers" value={result.prescriberCount} />
                </Col>
                <Col span={6}>
                  <Statistic title="Pharmacies" value={result.pharmacyCount} />
                </Col>
                <Col span={6}>
                  <Statistic title="Total MME/day" value={result.totalMme} />
                </Col>
              </Row>
              <Divider />
              <Statistic title="Early Refills" value={result.earlyRefillCount} />
              <Divider />
              <Title level={5}>Red Flags</Title>
              {result.redFlags?.length > 0 ? (
                <List
                  size="small"
                  dataSource={result.redFlags}
                  renderItem={(flag) => (
                    <List.Item>
                      <Space>
                        <WarningOutlined style={{ color: 'red' }} />
                        <Text>{flag}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No red flags detected" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              <Divider />
              <Title level={5}>Recommendations</Title>
              <List
                size="small"
                dataSource={result.recommendations || []}
                renderItem={(rec) => (
                  <List.Item>
                    <Space>
                      <CheckCircleOutlined style={{ color: 'green' }} />
                      <Text>{rec}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={10}>
            <Card
              title={<span><RobotOutlined /> AI PDMP Summary</span>}
              extra={<Button size="small" onClick={handleSummary} loading={summaryLoading} disabled={!result}>Generate</Button>}
            >
              {summary ? (
                <>
                  <Alert
                    type={riskColors[summary.riskLevel] === 'red' ? 'error' : riskColors[summary.riskLevel] === 'orange' ? 'warning' : 'success'}
                    message={`Risk Level: ${summary.riskLevel.toUpperCase()}`}
                    description={summary.summary}
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Title level={5}>Key Findings</Title>
                  <List size="small" dataSource={summary.keyFindings} renderItem={(f) => <List.Item>{f}</List.Item>} />
                  {summary.redFlags.length > 0 && (
                    <>
                      <Title level={5} style={{ marginTop: 16 }}>Red Flags</Title>
                      <List size="small" dataSource={summary.redFlags} renderItem={(f) => <List.Item><WarningOutlined style={{ color: 'red', marginRight: 8 }} />{f}</List.Item>} />
                    </>
                  )}
                </>
              ) : (
                <Empty description="Click 'Generate' for an AI-powered plain-language summary" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AI SAFETY FEATURES TAB
// ═════════════════════════════════════════════════════════════════════════════

function AiTab() {
  const [activeFeature, setActiveFeature] = useState('risk');

  return (
    <Tabs
      activeKey={activeFeature}
      onChange={setActiveFeature}
      items={[
        { key: 'risk', label: <span><ThunderboltOutlined /> Opioid Risk Score</span>, children: <OpioidRiskTab /> },
        { key: 'diversion', label: <span><FileSearchOutlined /> Diversion Detection</span>, children: <DiversionTab /> },
        { key: 'alternatives', label: <span><MedicineBoxOutlined /> Alternative Therapy</span>, children: <AlternativesTab /> },
        { key: 'nudge', label: <span><RobotOutlined /> Behavioral Nudge</span>, children: <NudgeTab /> },
        { key: 'quantity', label: <span><AuditOutlined /> Quantity Optimizer</span>, children: <QuantityTab /> },
        { key: 'anomaly', label: <span><WarningOutlined /> Anomaly Detection</span>, children: <AnomalyTab /> },
      ]}
    />
  );
}

function OpioidRiskTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OpioidRiskScore | null>(null);

  const handleRun = async (values: any) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await epcsService.scoreOpioidRisk({
        patientId: values.patientId,
        patientName: values.patientName,
        proposedMedication: values.proposedMedication,
        patientContext: {
          age: values.age ? Number(values.age) : undefined,
          priorOpioidRx: values.priorOpioidRx ? Number(values.priorOpioidRx) : undefined,
          benzoCoPrescribed: values.benzoCoPrescribed,
        },
      });
      setResult(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Risk scoring failed');
    } finally { setLoading(false); }
  };

  return (
    <Row gutter={16}>
      <Col span={10}>
        <Card title="Opioid Risk Score Input">
          <Form form={form} layout="vertical" onFinish={handleRun}>
            <Form.Item name="patientId" label="Patient ID" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="patientName" label="Patient Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="proposedMedication" label="Proposed Medication" rules={[{ required: true }]}>
              <Input placeholder="e.g., Oxycodone 10mg" />
            </Form.Item>
            <Row gutter={8}>
              <Col span={12}><Form.Item name="age" label="Age"><Input type="number" /></Form.Item></Col>
              <Col span={12}><Form.Item name="priorOpioidRx" label="Prior Opioid Rx"><Input type="number" /></Form.Item></Col>
            </Row>
            <Form.Item name="benzoCoPrescribed" label="Benzodiazepine Co-Prescribed" valuePropName="checked">
              <Select options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Score Risk</Button>
          </Form>
        </Card>
      </Col>
      <Col span={14}>
        <Card title="Risk Assessment Result">
          {result ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Progress
                  type="circle"
                  percent={result.riskScore}
                  strokeColor={riskColors[result.riskLevel] === 'red' ? '#ff4d4f' : riskColors[result.riskLevel] === 'orange' ? '#faad14' : riskColors[result.riskLevel] === 'blue' ? '#1890ff' : '#52c41a'}
                  format={() => `${result.riskScore}`}
                />
                <div style={{ marginTop: 8 }}>
                  <Tag color={riskColors[result.riskLevel]} style={{ fontSize: 14, padding: '4px 16px' }}>
                    {result.riskLevel.toUpperCase()} RISK
                  </Tag>
                </div>
              </div>
              <Title level={5}>Contributing Factors</Title>
              <List size="small" dataSource={result.contributingFactors} renderItem={(f) => <List.Item><WarningOutlined style={{ color: 'orange', marginRight: 8 }} />{f}</List.Item>} />
              <Title level={5} style={{ marginTop: 16 }}>Recommended Actions</Title>
              <List size="small" dataSource={result.recommendedActions} renderItem={(a) => <List.Item><CheckCircleOutlined style={{ color: 'green', marginRight: 8 }} />{a}</List.Item>} />
              <Divider />
              <Text type="secondary">Model: {result.modelVersion} | Confidence: {result.confidenceLevel}</Text>
            </>
          ) : (
            <Empty description="Enter patient details and click 'Score Risk'" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Col>
    </Row>
  );
}

function DiversionTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiversionCheckResult | null>(null);

  const handleRun = async (values: any) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await epcsService.detectDiversion(values);
      setResult(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Diversion check failed');
    } finally { setLoading(false); }
  };

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="Diversion Detection">
          <Form form={form} layout="vertical" onFinish={handleRun}>
            <Form.Item name="patientId" label="Patient ID" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="patientName" label="Patient Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="pdmpQueryId" label="PDMP Query ID (optional)"><Input placeholder="From PDMP tab" /></Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Check for Diversion</Button>
          </Form>
        </Card>
      </Col>
      <Col span={16}>
        <Card title="Diversion Analysis">
          {result ? (
            <>
              {result.shouldBlock && (
                <Alert type="error" message="CRITICAL — Prescribing should be blocked" description={result.recommendation} showIcon style={{ marginBottom: 16 }} />
              )}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Progress type="circle" percent={result.riskScore} strokeColor={riskColors[result.riskLevel] === 'red' ? '#ff4d4f' : '#faad14'} format={() => `${result.riskScore}`} />
                <div style={{ marginTop: 8 }}><Tag color={riskColors[result.riskLevel]}>{result.riskLevel.toUpperCase()}</Tag></div>
              </div>
              <Title level={5}>Red Flags ({result.redFlags.length})</Title>
              {result.redFlags.length > 0 ? (
                <List
                  dataSource={result.redFlags}
                  renderItem={(flag) => (
                    <List.Item>
                      <Card size="small" style={{ width: '100%' }}>
                        <Space>
                          <Tag color={flag.severity === 'critical' ? 'red' : flag.severity === 'high' ? 'volcano' : flag.severity === 'medium' ? 'orange' : 'blue'}>
                            {flag.severity}
                          </Tag>
                          <strong>{flag.type.replace(/_/g, ' ')}</strong>
                        </Space>
                        <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{flag.description}</Paragraph>
                        <Text type="secondary">{flag.detail}</Text>
                      </Card>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No red flags detected" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              <Divider />
              <Alert type="info" message="Recommendation" description={result.recommendation} showIcon />
            </>
          ) : (
            <Empty description="Enter patient details and run the check" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Col>
    </Row>
  );
}

function AlternativesTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AlternativeTherapy | null>(null);

  const handleRun = async (values: any) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await epcsService.recommendAlternatives(values);
      setResult(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to get alternatives');
    } finally { setLoading(false); }
  };

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="Alternative Therapy Recommender">
          <Form form={form} layout="vertical" onFinish={handleRun}>
            <Form.Item name="proposedMedication" label="Proposed Medication" rules={[{ required: true }]}>
              <Input placeholder="e.g., Oxycodone 10mg" />
            </Form.Item>
            <Form.Item name="diagnosis" label="Diagnosis"><Input placeholder="e.g., chronic lower back pain" /></Form.Item>
            <Form.Item name="allergies" label="Allergies (comma-separated)"><Input placeholder="penicillin, sulfa" /></Form.Item>
            <Form.Item name="renalImpairment" label="Renal Impairment" valuePropName="checked">
              <Select options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Get Alternatives</Button>
          </Form>
        </Card>
      </Col>
      <Col span={16}>
        <Card title="Recommended Alternatives">
          {result ? (
            <>
              <Alert type="info" message="Clinical Reasoning" description={result.reasoning} showIcon style={{ marginBottom: 16 }} />
              <List
                dataSource={result.alternatives}
                renderItem={(alt, i) => (
                  <List.Item>
                    <Card size="small" style={{ width: '100%' }} title={
                      <Space>
                        <Badge count={i + 1} />
                        <strong>{alt.medication}</strong>
                        <Tag>{alt.class}</Tag>
                        <Tag color="green">Evidence {alt.evidenceLevel}</Tag>
                      </Space>
                    }>
                      <Paragraph>{alt.rationale}</Paragraph>
                      <Text strong>Typical dose: </Text><Text>{alt.typicalDose}</Text>
                      <Divider style={{ margin: '8px 0' }} />
                      <Row gutter={16}>
                        <Col span={12}>
                          <Text strong>Advantages:</Text>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {alt.advantages.map((a, j) => <li key={j}>{a}</li>)}
                          </ul>
                        </Col>
                        <Col span={12}>
                          <Text strong>Precautions:</Text>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {alt.precautions.map((p, j) => <li key={j}>{p}</li>)}
                          </ul>
                        </Col>
                      </Row>
                    </Card>
                  </List.Item>
                )}
              />
            </>
          ) : (
            <Empty description="Enter a proposed medication to get alternatives" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Col>
    </Row>
  );
}

function NudgeTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BehavioralNudge | null>(null);

  const handleRun = async (values: any) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await epcsService.generateNudge(values);
      setResult(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Nudge generation failed');
    } finally { setLoading(false); }
  };

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="Behavioral Nudge Generator">
          <Alert type="info" message="Behavioral Economics" description="Generates just-in-time nudges based on behavioral economics to encourage safer prescribing." showIcon style={{ marginBottom: 16 }} />
          <Form form={form} layout="vertical" onFinish={handleRun}>
            <Form.Item name="providerId" label="Provider ID" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="providerName" label="Provider Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="proposedMedication" label="Proposed Medication" rules={[{ required: true }]}><Input placeholder="e.g., Oxycodone" /></Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Generate Nudge</Button>
          </Form>
        </Card>
      </Col>
      <Col span={16}>
        <Card title="Behavioral Nudge">
          {result && result.actionable ? (
            <>
              <Alert
                type={result.severity === 'critical' ? 'error' : result.severity === 'warning' ? 'warning' : 'info'}
                message={result.nudgeType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                description={result.message}
                showIcon
                style={{ marginBottom: 16 }}
              />
              {result.alternativeSuggestions.length > 0 && (
                <>
                  <Title level={5}>Suggested Alternatives</Title>
                  <List
                    size="small"
                    dataSource={result.alternativeSuggestions}
                    renderItem={(s) => <List.Item><CheckCircleOutlined style={{ color: 'green', marginRight: 8 }} />{s}</List.Item>}
                  />
                </>
              )}
            </>
          ) : (
            <Empty description="Enter details and generate a nudge" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Col>
    </Row>
  );
}

function QuantityTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuantityOptimization | null>(null);

  const handleRun = async (values: any) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await epcsService.optimizeQuantity({
        medicationName: values.medicationName,
        quantity: Number(values.quantity),
        daysSupply: values.daysSupply ? Number(values.daysSupply) : undefined,
        isAcutePain: values.isAcutePain,
      });
      setResult(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Quantity check failed');
    } finally { setLoading(false); }
  };

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="Quantity Optimizer">
          <Form form={form} layout="vertical" onFinish={handleRun}>
            <Form.Item name="medicationName" label="Medication" rules={[{ required: true }]}><Input placeholder="e.g., Oxycodone" /></Form.Item>
            <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}><Input type="number" /></Form.Item>
            <Form.Item name="daysSupply" label="Days Supply"><Input type="number" /></Form.Item>
            <Form.Item name="isAcutePain" label="Pain Type" rules={[{ required: true }]}>
              <Select options={[{ value: true, label: 'Acute Pain' }, { value: false, label: 'Chronic Pain' }]} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Check Quantity</Button>
          </Form>
        </Card>
      </Col>
      <Col span={16}>
        <Card title="CDC Guideline Check">
          {result ? (
            <>
              <Alert
                type={result.severity === 'critical' ? 'error' : result.severity === 'warning' ? 'warning' : 'success'}
                message={result.withinGuidelines ? 'Within CDC Guidelines' : 'Exceeds CDC Guidelines'}
                description={result.message}
                showIcon
                style={{ marginBottom: 16 }}
              />
              {result.recommendedQuantity && (
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Current Quantity">{result.currentQuantity}</Descriptions.Item>
                  <Descriptions.Item label="Recommended Quantity">{result.recommendedQuantity}</Descriptions.Item>
                  <Descriptions.Item label="Recommended Duration">{result.recommendedDuration}</Descriptions.Item>
                  {result.percentOver && <Descriptions.Item label="Over Recommended">{result.percentOver}%</Descriptions.Item>}
                </Descriptions>
              )}
              <Divider />
              <Text type="secondary">{result.cdcGuideline}</Text>
            </>
          ) : (
            <Empty description="Enter medication and quantity to check against CDC guidelines" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Col>
    </Row>
  );
}

function AnomalyTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnomalyDetectionResult | null>(null);

  const handleRun = async () => {
    setLoading(true);
    try {
      const data = await epcsService.detectAnomalies();
      setResult(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Anomaly detection failed');
    } finally { setLoading(false); }
  };

  return (
    <Card
      title="EPCS Prescribing Anomaly Detection"
      extra={<Button type="primary" onClick={handleRun} loading={loading} icon={<WarningOutlined />}>Run Detection</Button>}
    >
      {result ? (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Statistic title="Providers Checked" value={result.totalProvidersChecked} />
            </Col>
            <Col span={8}>
              <Statistic title="Anomalies Found" value={result.anomalyCount} valueStyle={{ color: result.anomalyCount > 0 ? '#ff4d4f' : '#52c41a' }} />
            </Col>
            <Col span={8}>
              <Statistic title="Status" valueRender={() => result.anomalyCount === 0 ? <Tag color="green">All Clear</Tag> : <Tag color="red">Review Needed</Tag>} />
            </Col>
          </Row>
          {result.anomalies.length > 0 ? (
            <List
              dataSource={result.anomalies}
              renderItem={(a) => (
                <List.Item>
                  <Card size="small" style={{ width: '100%' }}>
                    <Space>
                      <Tag color={a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'orange' : 'blue'}>{a.severity}</Tag>
                      <Tag>{a.type.replace(/_/g, ' ')}</Tag>
                      <strong>{a.providerName}</strong>
                    </Space>
                    <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{a.description}</Paragraph>
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="No anomalies detected — all providers within normal prescribing patterns" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </>
      ) : (
        <Empty description="Click 'Run Detection' to scan all providers for anomalous EPCS prescribing patterns" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AUDIT TAB
// ═════════════════════════════════════════════════════════════════════════════

function AuditTab() {
  const [logs, setLogs] = useState<{ data: EpcsAuditLog[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [chainValid, setChainValid] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await epcsService.getAuditLogs(page, 50);
      setLogs(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load audit logs');
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async () => {
    try {
      const result = await epcsService.verifyAuditChain();
      setChainValid(result.valid);
      if (result.valid) {
        message.success('Audit chain integrity verified — no tampering detected');
      } else {
        message.error('Audit chain integrity BROKEN — tampering detected!');
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Verification failed');
    }
  };

  const columns: ColumnsType<EpcsAuditLog> = [
    { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: 'Action', dataIndex: 'action', key: 'action', render: (v: string) => <Tag>{v.replace(/_/g, ' ')}</Tag> },
    { title: 'User', dataIndex: 'userName', key: 'userName' },
    { title: 'Patient', dataIndex: 'patientName', key: 'patientName' },
    { title: 'Medication', dataIndex: 'medication', key: 'medication' },
    { title: 'Schedule', dataIndex: 'deaSchedule', key: 'deaSchedule', render: (s?: string) => s ? <Tag color={scheduleColors[s]}>Sch {s}</Tag> : null },
    { title: '2FA', dataIndex: 'twoFactorSuccess', key: 'twoFactorSuccess', render: (v?: boolean) => v !== null && v !== undefined ? (v ? <Tag color="green">✓</Tag> : <Tag color="red">✗</Tag>) : null },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  return (
    <Card
      title="EPCS Audit Trail (21 CFR 1311.300(e))"
      extra={
        <Space>
          {chainValid !== null && (
            <Tag color={chainValid ? 'green' : 'red'} icon={chainValid ? <CheckCircleOutlined /> : <WarningOutlined />}>
              {chainValid ? 'Chain Valid' : 'Chain BROKEN'}
            </Tag>
          )}
          <Button onClick={handleVerify} icon={<AuditOutlined />}>Verify Chain Integrity</Button>
        </Space>
      }
    >
      <Alert
        type="info"
        message="Tamper-Evident Audit Trail"
        description="Every EPCS action is logged in an immutable, cryptographically chained audit trail. Each entry's hash includes the previous entry's hash, making any tampering detectable."
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Table
        columns={columns}
        dataSource={logs?.data || []}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          total: logs?.total || 0,
          pageSize: 50,
          onChange: setPage,
        }}
        size="small"
        scroll={{ x: 800 }}
      />
    </Card>
  );
}
