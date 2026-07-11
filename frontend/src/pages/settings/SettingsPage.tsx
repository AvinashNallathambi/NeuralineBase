import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  Tabs,
  Form,
  Input,
  Switch,
  Upload,
  Avatar,
  Table,
  Tag,
  Space,
  Descriptions,
  List,
  Badge,
  Divider,
  TimePicker,
  Modal,
  Select,
  Alert,
  message,
} from 'antd';
import {
  SettingOutlined,
  UserOutlined,
  BankOutlined,
  TeamOutlined,
  SafetyOutlined,
  BellOutlined,
  DollarOutlined,
  ApiOutlined,
  AuditOutlined,
  CloudServerOutlined,
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExportOutlined,
  DatabaseOutlined,
  ToolOutlined,
  MailOutlined,
  MobileOutlined,
  NotificationOutlined,
  CrownOutlined,
  LockOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { mockUsers, mockAuditLog } from '../../data/mockData';
import type { User } from '../../types';
import { useIntegrations } from '../../hooks/useIntegrations';
import { integrationService, type Integration } from '../../services/integrationService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const IntegrationCard: React.FC<{ integration: Integration }> = ({ integration }) => {
  const [enabled, setEnabled] = useState(integration.enabled);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      await integrationService.update(integration.key, { enabled: checked });
      setEnabled(checked);
      message.success(`${integration.name} ${checked ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to update integration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Row align="middle" gutter={16}>
        <Col>
          <div style={{ fontSize: 36 }}>{integration.icon || '🔌'}</div>
        </Col>
        <Col flex={1}>
          <Text strong style={{ fontSize: 16 }}>{integration.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{integration.description}</Text>
          <br />
          <Tag color="blue" style={{ marginTop: 4 }}>{integration.provider || 'Internal'}</Tag>
        </Col>
        <Col>
          <Switch
            checked={enabled}
            onChange={handleToggle}
            loading={saving}
            disabled={saving}
          />
        </Col>
      </Row>
    </Card>
  );
};

const IntegrationsTabContent: React.FC = () => {
  const { integrations, loading, error } = useIntegrations();

  if (loading) {
    return <Card loading bordered={false} style={{ borderRadius: 12 }} />;
  }

  if (error) {
    return (
      <Alert
        message="Could not load integrations"
        description={error.message}
        type="error"
        showIcon
      />
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {integrations.map((integration) => (
        <Col xs={24} md={12} key={integration.key}>
          <IntegrationCard integration={integration} />
        </Col>
      ))}
    </Row>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  const handleSave = (section: string) => {
    message.success(`${section} settings saved successfully.`);
  };

  // ─── Profile Tab ──────────────────────────────────────────────────────────────
  const ProfileTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Row gutter={32}>
        <Col xs={24} md={6} style={{ textAlign: 'center', marginBottom: 24 }}>
          <Upload
            showUploadList={false}
            beforeUpload={() => {
              message.success('Avatar uploaded.');
              return false;
            }}
          >
            <div style={{ cursor: 'pointer' }}>
              <Avatar size={120} icon={<UserOutlined />} style={{ backgroundColor: '#0D7C8A', marginBottom: 12 }} />
              <br />
              <Button icon={<UploadOutlined />} size="small">Change Avatar</Button>
            </div>
          </Upload>
        </Col>
        <Col xs={24} md={18}>
          <Form layout="vertical" initialValues={{ firstName: 'Sarah', lastName: 'Chen', email: 'dr.sarah.chen@neuraline.health', phone: '(555) 100-2001', specialization: 'Internal Medicine', department: 'Primary Care', bio: 'Board-certified Internal Medicine physician with over 15 years of experience in primary care and chronic disease management.' }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="First Name" name="firstName" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Last Name" name="lastName" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Phone" name="phone">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Specialization" name="specialization">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Department" name="department">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Bio" name="bio">
              <TextArea rows={3} />
            </Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('Profile')} style={{ borderRadius: 8 }}>
              Save Changes
            </Button>
          </Form>
        </Col>
      </Row>
    </Card>
  );

  // ─── Organization Tab ─────────────────────────────────────────────────────────
  const OrganizationTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Form layout="vertical" initialValues={{ clinicName: 'Neuraline Medical Center', address: '100 Healthcare Blvd, Springfield, IL 62701', phone: '(555) 100-2000', email: 'info@neuraline.health', website: 'https://neuraline.health', taxId: '12-3456789' }}>
        <Row gutter={32}>
          <Col xs={24} md={6} style={{ textAlign: 'center', marginBottom: 24 }}>
            <Upload
              showUploadList={false}
              beforeUpload={() => { message.success('Logo uploaded.'); return false; }}
            >
              <div style={{ cursor: 'pointer', padding: 24, border: '2px dashed #d9d9d9', borderRadius: 12, background: '#fafafa' }}>
                <BankOutlined style={{ fontSize: 48, color: '#0D7C8A', marginBottom: 8 }} />
                <br />
                <Text type="secondary">Upload Logo</Text>
              </div>
            </Upload>
          </Col>
          <Col xs={24} md={18}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Clinic Name" name="clinicName" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Tax ID" name="taxId">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Address" name="address">
              <Input />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Phone" name="phone">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Email" name="email">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Website" name="website">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </Col>
        </Row>
        <Divider />
        <Title level={5}>Operating Hours</Title>
        <Row gutter={[16, 8]}>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
            <Col xs={24} sm={12} md={8} lg={6} key={day}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text strong style={{ fontSize: 13 }}>{day}</Text>
                    <Switch defaultChecked={day !== 'Sunday'} size="small" />
                  </Space>
                  {day !== 'Sunday' && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {day === 'Saturday' ? '9:00 AM - 1:00 PM' : '8:00 AM - 5:00 PM'}
                    </Text>
                  )}
                  {day === 'Sunday' && <Text type="secondary" style={{ fontSize: 12 }}>Closed</Text>}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('Organization')} style={{ borderRadius: 8 }}>
            Save Changes
          </Button>
        </div>
      </Form>
    </Card>
  );

  // ─── Users & Roles Tab ────────────────────────────────────────────────────────
  const roleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'doctor': return 'blue';
      case 'nurse': return 'green';
      case 'receptionist': return 'purple';
      case 'billing_staff': return 'orange';
      default: return 'default';
    }
  };

  const userColumns = [
    {
      title: 'User',
      key: 'user',
      render: (_: unknown, record: User) => (
        <Space>
          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: '#0D7C8A' }} />
          <div>
            <Text strong>{record.firstName} {record.lastName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color={roleColor(role)}>{role.replace('_', ' ').toUpperCase()}</Tag>,
    },
    { title: 'Department', dataIndex: 'department', key: 'department' },
    {
      title: 'MFA',
      dataIndex: 'mfaEnabled',
      key: 'mfa',
      render: (v: boolean) => v ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#d9d9d9' }} />,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={v ? 'Active' : 'Inactive'} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Space>
      ),
    },
  ];

  const UsersTab = (
    <Card
      bordered={false}
      style={{ borderRadius: 12 }}
      title={
        <Space>
          <TeamOutlined />
          <Text strong>Staff Members</Text>
        </Space>
      }
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviteModalVisible(true)} style={{ borderRadius: 8 }}>
          Invite User
        </Button>
      }
    >
      <Table dataSource={mockUsers} columns={userColumns} rowKey="id" pagination={false} size="middle" />
      <Modal
        title="Invite New User"
        open={inviteModalVisible}
        onCancel={() => setInviteModalVisible(false)}
        onOk={() => { setInviteModalVisible(false); message.success('Invitation sent!'); }}
        okText="Send Invitation"
      >
        <Form layout="vertical">
          <Form.Item label="Email Address" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="user@neuraline.health" />
          </Form.Item>
          <Form.Item label="Role">
            <Select
              placeholder="Select role"
              options={[
                { label: 'Doctor', value: 'doctor' },
                { label: 'Nurse', value: 'nurse' },
                { label: 'Receptionist', value: 'receptionist' },
                { label: 'Billing Staff', value: 'billing_staff' },
                { label: 'Admin', value: 'admin' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Department">
            <Input placeholder="e.g., Primary Care" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );

  // ─── Security Tab ─────────────────────────────────────────────────────────────
  const activeSessions = [
    { id: 's1', device: 'Chrome on Windows', ip: '192.168.1.105', location: 'Springfield, IL', lastActive: '2024-12-20 09:15 AM', current: true },
    { id: 's2', device: 'Safari on iPhone', ip: '10.0.0.42', location: 'Springfield, IL', lastActive: '2024-12-20 08:30 AM', current: false },
    { id: 's3', device: 'Firefox on macOS', ip: '172.16.0.15', location: 'Chicago, IL', lastActive: '2024-12-19 04:22 PM', current: false },
  ];

  const SecurityTab = (
    <div>
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={5}>
          <LockOutlined style={{ marginRight: 8 }} />
          Two-Factor Authentication
        </Title>
        <Row align="middle" justify="space-between">
          <Col>
            <Text>Protect your account with 2FA. A verification code will be required on each login.</Text>
          </Col>
          <Col>
            <Switch defaultChecked />
          </Col>
        </Row>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={5}>
          <SafetyOutlined style={{ marginRight: 8 }} />
          Change Password
        </Title>
        <Form layout="vertical" style={{ maxWidth: 400 }}>
          <Form.Item label="Current Password">
            <Input.Password />
          </Form.Item>
          <Form.Item label="New Password">
            <Input.Password />
          </Form.Item>
          <Form.Item label="Confirm New Password">
            <Input.Password />
          </Form.Item>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('Password')} style={{ borderRadius: 8 }}>
            Update Password
          </Button>
        </Form>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Title level={5}>Active Sessions</Title>
        <List
          dataSource={activeSessions}
          renderItem={(session) => (
            <List.Item
              actions={
                session.current
                  ? [<Tag color="green">Current Session</Tag>]
                  : [
                      <Button size="small" danger onClick={() => message.success('Session revoked.')} style={{ borderRadius: 6 }}>
                        Revoke
                      </Button>,
                    ]
              }
            >
              <List.Item.Meta
                title={<Text strong>{session.device}</Text>}
                description={
                  <Space split={<Divider type="vertical" />}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{session.ip}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{session.location}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>Last active: {session.lastActive}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  // ─── Notifications Tab ────────────────────────────────────────────────────────
  const notificationCategories = [
    { key: 'appointments', label: 'Appointment Reminders', desc: 'Notifications for upcoming and changed appointments', email: true, sms: true, inApp: true },
    { key: 'labResults', label: 'Lab Results', desc: 'Alerts when lab results are available', email: true, sms: false, inApp: true },
    { key: 'prescriptions', label: 'Prescription Updates', desc: 'Refill requests and pharmacy notifications', email: true, sms: true, inApp: true },
    { key: 'messages', label: 'Patient Messages', desc: 'New messages from patients', email: false, sms: false, inApp: true },
    { key: 'billing', label: 'Billing Alerts', desc: 'Claim updates and payment notifications', email: true, sms: false, inApp: true },
    { key: 'system', label: 'System Notifications', desc: 'Maintenance updates and system alerts', email: true, sms: false, inApp: true },
  ];

  const NotificationsTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">Configure how you want to receive notifications for each category.</Text>
      </div>
      <Table
        dataSource={notificationCategories}
        rowKey="key"
        pagination={false}
        columns={[
          {
            title: 'Category',
            key: 'category',
            render: (_: unknown, record: (typeof notificationCategories)[0]) => (
              <div>
                <Text strong>{record.label}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>{record.desc}</Text>
              </div>
            ),
          },
          {
            title: <Space><MailOutlined /> Email</Space>,
            key: 'email',
            width: 100,
            align: 'center' as const,
            render: (_: unknown, record: (typeof notificationCategories)[0]) => <Switch defaultChecked={record.email} size="small" />,
          },
          {
            title: <Space><MobileOutlined /> SMS</Space>,
            key: 'sms',
            width: 100,
            align: 'center' as const,
            render: (_: unknown, record: (typeof notificationCategories)[0]) => <Switch defaultChecked={record.sms} size="small" />,
          },
          {
            title: <Space><NotificationOutlined /> In-App</Space>,
            key: 'inApp',
            width: 100,
            align: 'center' as const,
            render: (_: unknown, record: (typeof notificationCategories)[0]) => <Switch defaultChecked={record.inApp} size="small" />,
          },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('Notifications')} style={{ borderRadius: 8 }}>
          Save Changes
        </Button>
      </div>
    </Card>
  );

  // ─── Billing Settings Tab ─────────────────────────────────────────────────────
  const billingHistory = [
    { id: 'b1', date: '2024-12-01', description: 'Professional Plan - Monthly', amount: '$299.00', status: 'paid' },
    { id: 'b2', date: '2024-11-01', description: 'Professional Plan - Monthly', amount: '$299.00', status: 'paid' },
    { id: 'b3', date: '2024-10-01', description: 'Professional Plan - Monthly', amount: '$299.00', status: 'paid' },
    { id: 'b4', date: '2024-09-01', description: 'Professional Plan - Monthly', amount: '$299.00', status: 'paid' },
  ];

  const BillingSettingsTab = (
    <div>
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Row align="middle" gutter={24}>
          <Col>
            <CrownOutlined style={{ fontSize: 40, color: '#FFC53D' }} />
          </Col>
          <Col flex={1}>
            <Title level={4} style={{ margin: 0 }}>Professional Plan</Title>
            <Text type="secondary">Up to 10 providers, unlimited patients, telehealth included</Text>
          </Col>
          <Col>
            <Title level={3} style={{ margin: 0, color: '#0D7C8A' }}>$299<Text type="secondary" style={{ fontSize: 14 }}>/month</Text></Title>
          </Col>
          <Col>
            <Button style={{ borderRadius: 8 }}>Upgrade Plan</Button>
          </Col>
        </Row>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }} title="Payment Method">
        <Descriptions column={1}>
          <Descriptions.Item label="Card Type">Visa ending in 4242</Descriptions.Item>
          <Descriptions.Item label="Expiration">12/2026</Descriptions.Item>
          <Descriptions.Item label="Billing Address">100 Healthcare Blvd, Springfield, IL 62701</Descriptions.Item>
        </Descriptions>
        <Button icon={<EditOutlined />} style={{ marginTop: 8, borderRadius: 8 }}>Update Payment Method</Button>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }} title="Billing History">
        <Table
          dataSource={billingHistory}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: 'Date', dataIndex: 'date', key: 'date' },
            { title: 'Description', dataIndex: 'description', key: 'description' },
            { title: 'Amount', dataIndex: 'amount', key: 'amount' },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (v: string) => <Tag color="green">{v.toUpperCase()}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );

  // ─── Integrations Tab ─────────────────────────────────────────────────────────
  const IntegrationsTab = <IntegrationsTabContent />;

  // ─── Audit Log Tab ────────────────────────────────────────────────────────────
  const auditColumns = [
    {
      title: 'User',
      dataIndex: 'userName',
      key: 'user',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => {
        const colors: Record<string, string> = { VIEW: 'blue', CREATE: 'green', UPDATE: 'orange', DELETE: 'red', EXPORT: 'purple', LOGIN: 'cyan' };
        return <Tag color={colors[v] || 'default'}>{v}</Tag>;
      },
    },
    { title: 'Resource', dataIndex: 'resource', key: 'resource' },
    { title: 'Details', dataIndex: 'details', key: 'details', ellipsis: true },
    { title: 'IP Address', dataIndex: 'ipAddress', key: 'ip' },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  const AuditLogTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Table dataSource={mockAuditLog} columns={auditColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
    </Card>
  );

  // ─── System Tab ───────────────────────────────────────────────────────────────
  const SystemTab = (
    <div>
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={5}>
          <ExportOutlined style={{ marginRight: 8 }} />
          Data Export
        </Title>
        <Paragraph type="secondary">Export all clinic data in a machine-readable format for migration or backup.</Paragraph>
        <Space>
          <Button icon={<ExportOutlined />} style={{ borderRadius: 8 }}>Export All Data (JSON)</Button>
          <Button icon={<ExportOutlined />} style={{ borderRadius: 8 }}>Export Patient Records (CSV)</Button>
        </Space>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={5}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          Backup Status
        </Title>
        <Descriptions column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Last Backup">Dec 20, 2024 at 3:00 AM</Descriptions.Item>
          <Descriptions.Item label="Status"><Badge status="success" text="Completed" /></Descriptions.Item>
          <Descriptions.Item label="Backup Size">2.4 GB</Descriptions.Item>
          <Descriptions.Item label="Next Scheduled">Dec 21, 2024 at 3:00 AM</Descriptions.Item>
          <Descriptions.Item label="Retention Period">90 days</Descriptions.Item>
          <Descriptions.Item label="Storage Location">AWS S3 (us-east-1)</Descriptions.Item>
        </Descriptions>
        <Button type="primary" icon={<DatabaseOutlined />} onClick={() => message.success('Manual backup initiated.')} style={{ marginTop: 8, borderRadius: 8 }}>
          Run Manual Backup
        </Button>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Title level={5}>
          <ToolOutlined style={{ marginRight: 8 }} />
          Maintenance Mode
        </Title>
        <Paragraph type="secondary">
          When enabled, the system will show a maintenance page to all users. Only administrators can access the system.
        </Paragraph>
        <Row align="middle" justify="space-between">
          <Col>
            <Text>Enable Maintenance Mode</Text>
          </Col>
          <Col>
            <Switch />
          </Col>
        </Row>
      </Card>
    </div>
  );

  // ─── All Tabs ─────────────────────────────────────────────────────────────────
  const tabItems = [
    { key: 'profile', label: <span><UserOutlined style={{ marginRight: 6 }} />Profile</span>, children: ProfileTab },
    { key: 'organization', label: <span><BankOutlined style={{ marginRight: 6 }} />Organization</span>, children: OrganizationTab },
    { key: 'users', label: <span><TeamOutlined style={{ marginRight: 6 }} />Users & Roles</span>, children: UsersTab },
    { key: 'security', label: <span><SafetyOutlined style={{ marginRight: 6 }} />Security</span>, children: SecurityTab },
    { key: 'notifications', label: <span><BellOutlined style={{ marginRight: 6 }} />Notifications</span>, children: NotificationsTab },
    { key: 'billing', label: <span><DollarOutlined style={{ marginRight: 6 }} />Billing Settings</span>, children: BillingSettingsTab },
    { key: 'integrations', label: <span><ApiOutlined style={{ marginRight: 6 }} />Integrations</span>, children: IntegrationsTab },
    { key: 'audit', label: <span><AuditOutlined style={{ marginRight: 6 }} />Audit Log</span>, children: AuditLogTab },
    { key: 'system', label: <span><CloudServerOutlined style={{ marginRight: 6 }} />System</span>, children: SystemTab },
  ];

  return (
    <div>
      {/* Header */}
      <Title level={2} style={{ marginBottom: 24 }}>
        <SettingOutlined style={{ marginRight: 12, color: '#0D7C8A' }} />
        Settings & Administration
      </Title>

      {/* Vertical Tabs */}
      <Tabs
        tabPosition="left"
        items={tabItems}
        style={{ minHeight: 500 }}
        defaultActiveKey="profile"
      />
    </div>
  );
};

export default SettingsPage;
