import React, { useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Divider,
  Button,
  Space,
  message,
} from 'antd';
import dayjs from 'dayjs';
import type { Patient } from '../../types';
import { usePatientStore } from '../../store/dataStore';

const { Option } = Select;

interface Props {
  open: boolean;
  patient: Patient | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const EditPatientModal: React.FC<Props> = ({ open, patient, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const { updatePatient, loading } = usePatientStore();

  useEffect(() => {
    if (open && patient) {
      form.setFieldsValue({
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth ? dayjs(patient.dateOfBirth) : undefined,
        gender: patient.gender,
        email: patient.email,
        phone: patient.phone,
        bloodType: patient.bloodType,
        status: patient.status,
        street: patient.address?.street || patient.address?.street1,
        street2: patient.address?.street2,
        city: patient.address?.city,
        state: patient.address?.state,
        zipCode: patient.address?.zipCode,
        country: patient.address?.country || 'US',
        emergencyContactName: patient.emergencyContact?.name,
        emergencyContactRelationship: patient.emergencyContact?.relationship,
        emergencyContactPhone: patient.emergencyContact?.phone,
        emergencyContactEmail: patient.emergencyContact?.email,
      });
    }
  }, [open, patient, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values || !patient) return;

    const updates: Partial<Patient> = {
      firstName: values.firstName,
      lastName: values.lastName,
      dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : patient.dateOfBirth,
      gender: values.gender,
      email: values.email,
      phone: values.phone,
      bloodType: values.bloodType,
      status: values.status,
      address: {
        street: values.street || '',
        street2: values.street2,
        city: values.city || '',
        state: values.state || '',
        zipCode: values.zipCode || '',
        country: values.country || 'US',
      },
      emergencyContact: values.emergencyContactName
        ? {
            name: values.emergencyContactName,
            relationship: values.emergencyContactRelationship,
            phone: values.emergencyContactPhone,
            email: values.emergencyContactEmail,
          }
        : undefined,
    };

    await updatePatient(patient.id, updates);
    message.success('Patient updated successfully');
    form.resetFields();
    onClose();
    onSuccess?.();
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Drawer
      title="Edit Patient"
      placement="right"
      width={720}
      open={open}
      onClose={handleClose}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            Save Changes
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Divider orientation="left" plain>
          Personal Information
        </Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="firstName" label="First Name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="First name" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="Last name" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="dateOfBirth" label="Date of Birth" rules={[{ required: true, message: 'Required' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="gender" label="Gender" rules={[{ required: true, message: 'Required' }]}>
              <Select>
                <Option value="male">Male</Option>
                <Option value="female">Female</Option>
                <Option value="other">Other</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="bloodType" label="Blood Type">
              <Select allowClear placeholder="Select">
                {BLOOD_TYPE_OPTIONS.map((bt) => (
                  <Option key={bt} value={bt}>{bt}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
              <Input placeholder="patient@email.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="Phone">
              <Input placeholder="(555) 000-0000" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="status" label="Status">
          <Select>
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
            <Option value="deceased">Deceased</Option>
          </Select>
        </Form.Item>

        <Divider orientation="left" plain>
          Address
        </Divider>
        <Form.Item name="street" label="Street Address">
          <Input placeholder="123 Main Street" />
        </Form.Item>
        <Form.Item name="street2" label="Street Address 2">
          <Input placeholder="Apt, Suite, etc." />
        </Form.Item>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="city" label="City">
              <Input placeholder="City" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="state" label="State">
              <Input placeholder="State" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="zipCode" label="Zip Code">
              <Input placeholder="00000" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="country" label="Country">
              <Input placeholder="US" />
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
              <Select allowClear placeholder="Select">
                <Option value="Spouse">Spouse</Option>
                <Option value="Parent">Parent</Option>
                <Option value="Sibling">Sibling</Option>
                <Option value="Child">Child</Option>
                <Option value="Friend">Friend</Option>
                <Option value="Other">Other</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="emergencyContactPhone" label="Phone">
              <Input placeholder="(555) 000-0000" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="emergencyContactEmail" label="Emergency Contact Email">
          <Input placeholder="contact@email.com" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default EditPatientModal;
