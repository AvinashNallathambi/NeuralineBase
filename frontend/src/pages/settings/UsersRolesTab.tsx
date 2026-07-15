import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Button,
  Typography,
  Table,
  Tag,
  Space,
  Avatar,
  Badge,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tooltip,
  Spin,
  Tabs,
  Switch,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
  UnlockOutlined,
  SafetyOutlined,
  KeyOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import userService, { type StaffUser, type RolePermission, type PermissionModule } from '../../services/userService';

const { Text } = Typography;

const roleColors: Record<string, string> = {
  admin: 'red',
  doctor: 'blue',
  nurse: 'green',
  receptionist: 'purple',
  billing_staff: 'orange',
};

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  doctor: 'Doctor',
  nurse: 'Nurse',
  receptionist: 'Receptionist',
  billing_staff: 'Billing Staff',
};

const formatRole = (role: string) => roleLabels[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Access Control Matrix Component ────────────────────────────────

const AccessControlMatrix: React.FC<{
  roles: RolePermission[];
  modules: PermissionModule[];
}> = ({ roles, modules }) => {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'manage': return { label: 'Full', color: '#0D7C8A' };
      case 'write': return { label: 'Write', color: '#1890ff' };
      case 'read': return { label: 'Read', color: '#94a3b8' };
      case 'delete': return { label: 'Delete', color: '#ff4d4f' };
      default: return { label: action, color: '#94a3b8' };
    }
  };

  const getPermissionForModule = (permissions: string[], moduleKey: string) => {
    const manage = permissions.includes(`${moduleKey}:manage`);
    if (manage) return 'manage';
    const write = permissions.includes(`${moduleKey}:write`);
    const read = permissions.includes(`${moduleKey}:read`);
    const del = permissions.includes(`${moduleKey}:delete`);
    if (write && read) return 'write';
    if (read) return 'read';
    if (del) return 'delete';
    return null;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid #eef1f4', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Module
            </th>
            {roles.map((role) => (
              <th key={role.key} style={{ textAlign: 'center', padding: '12px 8px', borderBottom: '2px solid #eef1f4', fontSize: 13, fontWeight: 600 }}>
                <Tag color={role.color} style={{ margin: 0, fontWeight: 600 }}>{formatRole(role.key)}</Tag>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((mod, idx) => (
            <tr key={mod.key} style={{ background: idx % 2 === 0 ? '#f8fafb' : 'transparent' }}>
              <td style={{ padding: '10px 16px', borderBottom: '1px solid #eef1f4', fontSize: 13, fontWeight: 500, color: '#334155' }}>
                {mod.label}
              </td>
              {roles.map((role) => {
                const action = getPermissionForModule(role.permissions, mod.key);
                if (!action) {
                  return (
                    <td key={role.key} style={{ textAlign: 'center', padding: '10px 8px', borderBottom: '1px solid #eef1f4' }}>
                      <CloseCircleOutlined style={{ color: '#cbd5e1', fontSize: 16 }} />
                    </td>
                  );
                }
                const { label, color } = getActionIcon(action);
                return (
                  <td key={role.key} style={{ textAlign: 'center', padding: '10px 8px', borderBottom: '1px solid #eef1f4' }}>
                    <Tooltip title={`${label} access`}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 10px',
                        borderRadius: 12,
                        background: `${color}15`,
                        color,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {action === 'manage' && <CheckCircleOutlined style={{ fontSize: 12 }} />}
                        {label}
                      </div>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Users & Roles Tab ─────────────────────────────────────────

const UsersRolesTab: React.FC = () => {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, rolesData, modulesData] = await Promise.all([
        userService.getAll(),
        userService.getRoleDefinitions(),
        userService.getPermissionModules(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setModules(modulesData);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleInvite = async () => {
    try {
      const values = await inviteForm.validateFields();
      setSubmitting(true);
      await userService.create(values);
      message.success(`${values.email} has been added successfully`);
      setInviteModalVisible(false);
      inviteForm.resetFields();
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await userService.update(editingUser.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        department: values.department,
      });
      // If role changed, update it separately
      if (values.role && values.role !== editingUser.role) {
        await userService.changeRole(editingUser.id, values.role);
      }
      message.success('User updated successfully');
      setEditModalVisible(false);
      setEditingUser(null);
      editForm.resetFields();
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    try {
      const updated = await userService.toggleActive(user.id);
      message.success(`${user.firstName} ${user.lastName} ${updated.isActive ? 'activated' : 'deactivated'}`);
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to toggle user status');
    }
  };

  const handleDelete = async (user: StaffUser) => {
    try {
      await userService.remove(user.id);
      message.success(`${user.firstName} ${user.lastName} has been removed`);
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to delete user');
    }
  };

  const openEditModal = (user: StaffUser) => {
    setEditingUser(user);
    setEditModalVisible(true);
    editForm.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      department: user.department || '',
      role: user.role,
    });
  };

  // ─── Table columns ────────────────────────────────────────────────

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: unknown, record: StaffUser) => (
        <Space>
          <Avatar size={36} icon={<UserOutlined />} style={{ backgroundColor: '#0D7C8A' }} />
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
      render: (role: string) => <Tag color={roleColors[role] || 'default'}>{formatRole(role)}</Tag>,
    },
    {
      title: 'Department',
      key: 'department',
      render: (_: unknown, record: StaffUser) => record.department || <Text type="secondary">—</Text>,
    },
    {
      title: 'Phone',
      key: 'phone',
      render: (_: unknown, record: StaffUser) => record.phone || <Text type="secondary">—</Text>,
    },
    {
      title: 'MFA',
      dataIndex: 'mfaEnabled',
      key: 'mfa',
      width: 70,
      align: 'center' as const,
      render: (v: boolean) => v
        ? <LockOutlined style={{ color: '#52c41a' }} />
        : <UnlockOutlined style={{ color: '#cbd5e1' }} />,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_: unknown, record: StaffUser) => (
        <Badge status={record.isActive ? 'success' : 'default'} text={record.isActive ? 'Active' : 'Inactive'} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: StaffUser) => (
        <Space size={4}>
          <Tooltip title="Edit user">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Deactivate' : 'Activate'}>
            <Button
              type="text"
              size="small"
              icon={<Switch checked={record.isActive} size="small" onChange={() => handleToggleActive(record)} />}
              style={{ padding: 0 }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this user?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const tabItems = [
    {
      key: 'users',
      label: <span><TeamOutlined style={{ marginRight: 6 }} />Staff Members ({users.length})</span>,
      children: (
        <Card
          bordered={false}
          style={{ borderRadius: 12 }}
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviteModalVisible(true)} style={{ borderRadius: 8 }}>
              Add User
            </Button>
          }
        >
          <Table
            dataSource={users}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="middle"
          />
        </Card>
      ),
    },
    {
      key: 'roles',
      label: <span><SafetyOutlined style={{ marginRight: 6 }} />Roles & Permissions</span>,
      children: (
        <div>
          <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>Role Definitions</Text>
              <br />
              <Text type="secondary">Each role grants access to specific modules. "Full" = manage (CRUD + admin), "Write" = create/update, "Read" = view only.</Text>
            </div>
            {roles.length > 0 && modules.length > 0 && (
              <AccessControlMatrix roles={roles} modules={modules} />
            )}
          </Card>

          <Row gutter={[16, 16]}>
            {roles.map((role) => (
              <Col xs={24} sm={12} lg={8} key={role.key}>
                <Card size="small" style={{ borderRadius: 12, borderColor: '#eef1f4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Tag color={role.color} style={{ margin: 0, fontWeight: 600 }}>{role.label}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{role.permissions.length} permissions</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{role.description}</Text>
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {role.permissions.map((perm) => {
                      const [mod, action] = perm.split(':');
                      const modLabel = modules.find((m) => m.key === mod)?.label || mod;
                      return (
                        <Tag key={perm} style={{ fontSize: 11, margin: 0 }}>
                          {modLabel}:{action}
                        </Tag>
                      );
                    })}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Tabs items={tabItems} defaultActiveKey="users" />

      {/* Invite / Create User Modal */}
      <Modal
        title="Add New User"
        open={inviteModalVisible}
        onCancel={() => { setInviteModalVisible(false); inviteForm.resetFields(); }}
        onOk={handleInvite}
        confirmLoading={submitting}
        okText="Create User"
        width={520}
      >
        <Form form={inviteForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="First Name" name="firstName" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="First name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Last Name" name="lastName" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="Last name" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Email Address" name="email" rules={[{ required: true, message: 'Required', type: 'email' }]}>
            <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="user@neuraline.health" />
          </Form.Item>
          <Form.Item label="Temporary Password" name="password" rules={[{ required: true, message: 'Required' }, { min: 8, message: 'Min 8 characters' }]}>
            <Input.Password prefix={<KeyOutlined style={{ color: '#94a3b8' }} />} placeholder="Set a temporary password" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Role" name="role" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select role">
                  {roles.map((r) => (
                    <Select.Option key={r.key} value={r.key}>{r.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Department" name="department">
                <Input placeholder="e.g., Primary Care" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Phone" name="phone">
            <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="(555) 123-4567" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title="Edit User"
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); setEditingUser(null); editForm.resetFields(); }}
        onOk={handleEdit}
        confirmLoading={submitting}
        okText="Save Changes"
        width={520}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="First Name" name="firstName" rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Last Name" name="lastName" rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Email Address" name="email" rules={[{ required: true, message: 'Required', type: 'email' }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Role" name="role" rules={[{ required: true, message: 'Required' }]}>
                <Select>
                  {roles.map((r) => (
                    <Select.Option key={r.key} value={r.key}>{r.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Department" name="department">
                <Input placeholder="e.g., Primary Care" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Phone" name="phone">
            <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="(555) 123-4567" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersRolesTab;
