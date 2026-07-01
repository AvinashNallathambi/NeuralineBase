import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Card,
  Space,
  Tag,
  Avatar,
  Typography,
  Drawer,
  Form,
  DatePicker,
  Row,
  Col,
  Popconfirm,
  message,
  Tooltip,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  ManOutlined,
  WomanOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Patient, WorkflowInstance, WorkflowTemplate } from '../../types';
import { usePatientStore } from '../../store/dataStore';
import { workflowService } from '../../services/workflowService';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const statusColors: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  deceased: 'red',
};

const genderIcons: Record<string, React.ReactNode> = {
  male: <ManOutlined style={{ color: '#1890ff' }} />,
  female: <WomanOutlined style={{ color: '#eb2f96' }} />,
  other: <UserOutlined style={{ color: '#8c8c8c' }} />,
};

const PatientListPage: React.FC = () => {
  const { patients, loading, error, fetchPatients, addPatient: storeAddPatient, updatePatient, deletePatient } = usePatientStore();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [genderFilter, setGenderFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [form] = Form.useForm();

  // Workflow state
  const [workflowTemplate, setWorkflowTemplate] = useState<WorkflowTemplate | null>(null);
  const [workflowInstances, setWorkflowInstances] = useState<Record<string, WorkflowInstance>>({});

  // Load patients on mount
  React.useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Load active workflow template for patients
  React.useEffect(() => {
    workflowService.findActiveTemplateForEntity('patient').then((res) => {
      if (res.data) setWorkflowTemplate(res.data);
    }).catch(() => {});
  }, []);

  // Load workflow instances for all patients
  React.useEffect(() => {
    if (workflowTemplate && patients.length > 0) {
      const loadWorkflowInstances = async () => {
        const instances: Record<string, WorkflowInstance> = {};
        for (const patient of patients) {
          try {
            const instance = await workflowService.findInstanceByEntity('patient', patient.id);
            if (instance.data) {
              const transitions = await workflowService.getAvailableTransitions('patient', patient.id);
              instances[patient.id] = {
                ...instance.data,
                availableTransitions: transitions.data || [],
              };
            }
          } catch (error) {
            // No workflow instance for this patient
          }
        }
        setWorkflowInstances(instances);
      };
      loadWorkflowInstances();
    }
  }, [workflowTemplate, patients]);

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        !searchText ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchText.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchText.toLowerCase()) ||
        p.email.toLowerCase().includes(searchText.toLowerCase()) ||
        p.phone.includes(searchText);

      const matchesStatus = !statusFilter || p.status === statusFilter;
      const matchesGender = !genderFilter || p.gender === genderFilter;

      const matchesDate =
        !dateRange ||
        !dateRange[0] ||
        !dateRange[1] ||
        (dayjs(p.dateOfBirth).isAfter(dateRange[0].startOf('day')) &&
          dayjs(p.dateOfBirth).isBefore(dateRange[1].endOf('day')));

      return matchesSearch && matchesStatus && matchesGender && matchesDate;
    });
  }, [patients, searchText, statusFilter, genderFilter, dateRange]);

  const handleAddPatient = async (values: Record<string, unknown>) => {
    const newPatient: Patient = {
      id: `pat-${Date.now()}`,
      mrn: `MRN-2024-${String(patients.length + 1).padStart(4, '0')}`,
      firstName: values.firstName as string,
      lastName: values.lastName as string,
      dateOfBirth: (values.dateOfBirth as dayjs.Dayjs).format('YYYY-MM-DD'),
      gender: values.gender as 'male' | 'female' | 'other',
      email: values.email as string,
      phone: values.phone as string,
      address: {
        street: (values.street as string) || '',
        city: (values.city as string) || '',
        state: (values.state as string) || '',
        zipCode: (values.zipCode as string) || '',
        country: 'US',
      },
      emergencyContact: {
        name: (values.emergencyContactName as string) || '',
        relationship: (values.emergencyContactRelationship as string) || '',
        phone: (values.emergencyContactPhone as string) || '',
      },
      insurance: values.insuranceProvider
        ? [
            {
              id: `ins-${Date.now()}`,
              provider: values.insuranceProvider as string,
              policyNumber: (values.policyNumber as string) || '',
              groupNumber: (values.groupNumber as string) || '',
              subscriberName: `${values.firstName} ${values.lastName}`,
              subscriberRelation: 'Self',
              effectiveDate: dayjs().format('YYYY-MM-DD'),
              expirationDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
              isPrimary: true,
            },
          ]
        : [],
      allergies: [],
      medicalHistory: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storeAddPatient(newPatient);
    setDrawerOpen(false);
    form.resetFields();
    message.success(`Patient ${newPatient.firstName} ${newPatient.lastName} added successfully`);
  };

  // Ensure workflow instance exists for a patient
  const ensureWorkflowInstance = async (patientId: string, initialStep: string): Promise<WorkflowInstance | null> => {
    if (!workflowTemplate) return null;
    if (workflowInstances[patientId]) return workflowInstances[patientId];
    try {
      const instance = await workflowService.createInstance({
        entityType: 'patient',
        entityId: patientId,
        currentStep: initialStep,
        templateId: workflowTemplate.id,
      });
      setWorkflowInstances((prev) => ({
        ...prev,
        [patientId]: instance,
      }));
      return instance;
    } catch (error) {
      console.error('Failed to create workflow instance:', error);
      return null;
    }
  };

  const handleEdit = async (patient: Patient) => {
    // Check if edit is allowed by workflow
    if (workflowTemplate) {
      const workflowInstance = workflowInstances[patient.id];
      const availableTransitions = workflowInstance?.availableTransitions || [];
      const canEdit = availableTransitions.some((t: any) => 
        t.toStep === 'edit' || t.toStep === 'update' || t.action === 'edit'
      );

      if (!canEdit && workflowInstance) {
        message.warning('Edit is not allowed in the current workflow state');
        return;
      }

      // If workflow allows edit, transition to edit state
      if (canEdit) {
        try {
          await workflowService.transition('patient', patient.id, { toStep: 'edit' });
          // Refresh transitions
          const transitions = await workflowService.getAvailableTransitions('patient', patient.id);
          setWorkflowInstances((prev) => ({
            ...prev,
            [patient.id]: {
              ...prev[patient.id],
              availableTransitions: transitions.data || [],
            },
          }));
        } catch (error) {
          console.error('Workflow transition failed:', error);
        }
      }
    }

    setEditingPatient(patient);
    form.setFieldsValue({
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: dayjs(patient.dateOfBirth),
      gender: patient.gender,
      email: patient.email,
      phone: patient.phone,
      street: patient.address?.street,
      city: patient.address?.city,
      state: patient.address?.state,
      zipCode: patient.address?.zipCode,
      emergencyContactName: patient.emergencyContact?.name,
      emergencyContactRelationship: patient.emergencyContact?.relationship,
      emergencyContactPhone: patient.emergencyContact?.phone,
      bloodType: patient.bloodType,
      status: patient.status,
    });
    setDrawerOpen(true);
  };

  const handleUpdatePatient = async (values: Record<string, unknown>) => {
    if (!editingPatient) return;

    const updates: Partial<Patient> = {
      firstName: values.firstName as string,
      lastName: values.lastName as string,
      dateOfBirth: (values.dateOfBirth as dayjs.Dayjs).format('YYYY-MM-DD'),
      gender: values.gender as 'male' | 'female' | 'other',
      email: values.email as string,
      phone: values.phone as string,
      address: {
        street: (values.street as string) || '',
        city: (values.city as string) || '',
        state: (values.state as string) || '',
        zipCode: (values.zipCode as string) || '',
        country: 'US',
      },
      emergencyContact: {
        name: (values.emergencyContactName as string) || '',
        relationship: (values.emergencyContactRelationship as string) || '',
        phone: (values.emergencyContactPhone as string) || '',
      },
      bloodType: values.bloodType as string,
      status: values.status as string,
    };

    await updatePatient(editingPatient.id, updates);

    // Transition workflow after successful update
    if (workflowTemplate) {
      try {
        const transitions = await workflowService.getAvailableTransitions('patient', editingPatient.id);
        const canCompleteEdit = transitions.data?.some((t: any) => 
          t.toStep === 'active' || t.toStep === 'reviewed' || t.action === 'complete_edit'
        );

        if (canCompleteEdit) {
          await workflowService.transition('patient', editingPatient.id, { 
            toStep: transitions.data?.find((t: any) => t.toStep === 'active' || t.toStep === 'reviewed')?.toStep || 'active' 
          });
          // Refresh transitions
          const newTransitions = await workflowService.getAvailableTransitions('patient', editingPatient.id);
          setWorkflowInstances((prev) => ({
            ...prev,
            [editingPatient.id]: {
              ...prev[editingPatient.id],
              availableTransitions: newTransitions.data || [],
            },
          }));
        }
      } catch (error) {
        console.error('Workflow transition failed:', error);
      }
    }

    setDrawerOpen(false);
    setEditingPatient(null);
    form.resetFields();
    message.success(`Patient updated successfully`);
  };

  const handleDelete = async (id: string) => {
    // Check if delete is allowed by workflow
    if (workflowTemplate) {
      const workflowInstance = workflowInstances[id];
      const availableTransitions = workflowInstance?.availableTransitions || [];
      const canDelete = availableTransitions.some((t: any) => 
        t.toStep === 'deleted' || t.toStep === 'archive' || t.action === 'delete'
      );

      if (!canDelete && workflowInstance) {
        message.warning('Delete is not allowed in the current workflow state');
        return;
      }

      // If workflow allows delete, transition to deleted state
      if (canDelete) {
        try {
          await workflowService.transition('patient', id, { toStep: 'deleted' });
          // Refresh transitions
          const transitions = await workflowService.getAvailableTransitions('patient', id);
          setWorkflowInstances((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              availableTransitions: transitions.data || [],
            },
          }));
        } catch (error) {
          console.error('Workflow transition failed:', error);
        }
      }
    }

    await deletePatient(id);
    message.success('Patient deleted successfully');
  };

  const handleExport = () => {
    message.success('Patient data exported successfully');
  };

  const columns: ColumnsType<Patient> = [
    {
      title: 'MRN',
      dataIndex: 'mrn',
      key: 'mrn',
      sorter: (a, b) => a.mrn.localeCompare(b.mrn),
      width: 150,
      render: (mrn: string) => (
        <Text strong style={{ color: '#0D7C8A', fontFamily: 'monospace' }}>
          {mrn}
        </Text>
      ),
    },
    {
      title: 'Name',
      key: 'name',
      sorter: (a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
      render: (_: unknown, record: Patient) => (
        <Space>
          <Avatar
            size={36}
            icon={<UserOutlined />}
            style={{
              backgroundColor: record.gender === 'female' ? '#eb2f96' : '#0D7C8A',
            }}
            src={record.avatar}
          />
          <div>
            <Text strong>
              {record.lastName}, {record.firstName}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Age {calculateAge(record.dateOfBirth)}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'DOB',
      dataIndex: 'dateOfBirth',
      key: 'dateOfBirth',
      sorter: (a, b) => a.dateOfBirth.localeCompare(b.dateOfBirth),
      width: 120,
      render: (dob: string) => dayjs(dob).format('MM/DD/YYYY'),
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 100,
      filters: [
        { text: 'Male', value: 'male' },
        { text: 'Female', value: 'female' },
        { text: 'Other', value: 'other' },
      ],
      onFilter: (value, record) => record.gender === value,
      render: (gender: string) => (
        <Space size={4}>
          {genderIcons[gender]}
          <span style={{ textTransform: 'capitalize' }}>{gender}</span>
        </Space>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Insurance',
      key: 'insurance',
      width: 180,
      ellipsis: true,
      render: (_: unknown, record: Patient) => {
        const primary = record.insurance.find((i) => i.isPrimary);
        return primary ? (
          <Text ellipsis={{ tooltip: primary.provider }}>{primary.provider}</Text>
        ) : (
          <Text type="secondary">No insurance</Text>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Inactive', value: 'inactive' },
        { text: 'Deceased', value: 'deceased' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => (
        <Tag color={statusColors[status]} style={{ textTransform: 'capitalize' }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_: unknown, record: Patient) => {
        const workflowInstance = workflowInstances[record.id];
        const availableTransitions = workflowInstance?.availableTransitions || [];
        const useWorkflowActions = workflowTemplate && workflowInstance && availableTransitions.length > 0;

        // Check if edit is allowed
        const canEdit = useWorkflowActions
          ? availableTransitions.some((t: any) => t.toStep === 'edit' || t.toStep === 'update' || t.action === 'edit')
          : true;

        // Check if delete is allowed
        const canDelete = useWorkflowActions
          ? availableTransitions.some((t: any) => t.toStep === 'deleted' || t.toStep === 'archive' || t.action === 'delete')
          : true;

        return (
          <Space size={4}>
            <Tooltip title="View">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/patients/${record.id}`);
                }}
              />
            </Tooltip>
            {canEdit && (
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(record);
                  }}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Delete Patient"
                description="Are you sure you want to delete this patient?"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDelete(record.id);
                }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Patients
          </Title>
          <Text type="secondary">Manage patient records and information</Text>
        </div>
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            Export
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingPatient(null);
              form.resetFields();
              setDrawerOpen(true);
            }}
          >
            Add Patient
          </Button>
        </Space>
      </div>

      {/* Filters Row */}
      <Card bodyStyle={{ padding: 16 }} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Search patients..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Select
              placeholder="Status"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Deceased', value: 'deceased' },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Select
              placeholder="Gender"
              allowClear
              style={{ width: '100%' }}
              value={genderFilter}
              onChange={setGenderFilter}
              options={[
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
                { label: 'Other', value: 'other' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['DOB From', 'DOB To']}
              onChange={(dates) =>
                setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)
              }
            />
          </Col>
        </Row>
      </Card>

      {/* Table Card */}
      <Card bodyStyle={{ padding: 0 }}>
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text type="secondary">
            Showing <Text strong>{filteredPatients.length}</Text> of{' '}
            <Text strong>{patients.length}</Text> patients
          </Text>
        </div>
        <Table<Patient>
          columns={columns}
          dataSource={filteredPatients}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} patients`,
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/patients/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>

      {/* Add/Edit Patient Drawer */}
      <Drawer
        title={editingPatient ? 'Edit Patient' : 'Add New Patient'}
        placement="right"
        width={640}
        onClose={() => {
          setDrawerOpen(false);
          setEditingPatient(null);
          form.resetFields();
        }}
        open={drawerOpen}
        extra={
          <Space>
            <Button
              onClick={() => {
                setDrawerOpen(false);
                setEditingPatient(null);
                form.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" onClick={() => form.submit()}>
              {editingPatient ? 'Update Patient' : 'Save Patient'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingPatient ? handleUpdatePatient : handleAddPatient}
          initialValues={{ gender: 'male' }}
        >
          <Divider orientation="left" plain>
            Personal Information
          </Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="First name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="Last name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dateOfBirth"
                label="Date of Birth"
                rules={[{ required: true, message: 'Required' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="gender"
                label="Gender"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select
                  options={[
                    { label: 'Male', value: 'male' },
                    { label: 'Female', value: 'female' },
                    { label: 'Other', value: 'other' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Required' },
                  { type: 'email', message: 'Invalid email' },
                ]}
              >
                <Input placeholder="patient@email.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="(555) 000-0000" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            Address
          </Divider>
          <Form.Item name="street" label="Street Address">
            <Input placeholder="123 Main Street" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="city" label="City">
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="state" label="State">
                <Input placeholder="State" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="zipCode" label="Zip Code">
                <Input placeholder="00000" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            Emergency Contact
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="emergencyContactName" label="Name">
                <Input placeholder="Contact name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="emergencyContactRelationship" label="Relationship">
                <Select
                  placeholder="Select"
                  options={[
                    { label: 'Spouse', value: 'Spouse' },
                    { label: 'Parent', value: 'Parent' },
                    { label: 'Sibling', value: 'Sibling' },
                    { label: 'Child', value: 'Child' },
                    { label: 'Friend', value: 'Friend' },
                    { label: 'Other', value: 'Other' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="emergencyContactPhone" label="Phone">
                <Input placeholder="(555) 000-0000" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            Insurance Information
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="insuranceProvider" label="Provider">
                <Input placeholder="Insurance provider" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="policyNumber" label="Policy Number">
                <Input placeholder="Policy #" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="groupNumber" label="Group Number">
                <Input placeholder="Group #" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </div>
  );
};

export default PatientListPage;
