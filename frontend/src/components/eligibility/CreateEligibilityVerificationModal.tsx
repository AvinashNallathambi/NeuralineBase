import React, { useEffect, useState } from 'react';
import { Form, Select, Input, DatePicker, Button, message, Drawer, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { EligibilityVerificationType, CreateEligibilityVerificationDto } from '../../types';
import { patientService } from '../../services/patientService';

interface Props {
  open: boolean;
  patientId?: string;
  appointmentId?: string;
  onClose: () => void;
  onSubmit: (dto: CreateEligibilityVerificationDto) => Promise<void>;
  confirmLoading?: boolean;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
}

const verificationTypes: { value: EligibilityVerificationType; label: string }[] = [
  { value: 'real-time', label: 'Real-time' },
  { value: 'batch', label: 'Batch' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'manual', label: 'Manual' },
];

export const CreateEligibilityVerificationModal: React.FC<Props> = ({
  open,
  patientId,
  appointmentId,
  onClose,
  onSubmit,
  confirmLoading,
}) => {
  const [form] = Form.useForm();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (patientId) form.setFieldsValue({ patientId });
      if (appointmentId) form.setFieldsValue({ appointmentId });
    }
  }, [open, patientId, appointmentId, form]);

  useEffect(() => {
    const loadPatients = async () => {
      if (patientId) return;
      setPatientLoading(true);
      try {
        const result = await patientService.findAll({ page: 1, limit: 100 });
        setPatients(result.data);
      } catch {
        message.error('Failed to load patients');
      } finally {
        setPatientLoading(false);
      }
    };
    if (open) loadPatients();
  }, [open, patientId]);

  const handleFinish = async (values: CreateEligibilityVerificationDto) => {
    await onSubmit(values);
  };

  return (
    <Drawer
      title="Verify Insurance Eligibility"
      open={open}
      onClose={onClose}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={confirmLoading}
            onClick={() => form.submit()}
          >
            Verify
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="patientId"
          label="Patient"
          rules={[{ required: true, message: 'Patient is required' }]}
        >
          <Select
            showSearch
            loading={patientLoading}
            disabled={!!patientId}
            placeholder="Select patient"
            optionFilterProp="children"
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.firstName} ${p.lastName}`,
            }))}
          />
        </Form.Item>

        <Form.Item name="appointmentId" label="Appointment ID" hidden={!appointmentId}>
          <Input disabled />
        </Form.Item>

        <Form.Item name="patientInsuranceId" label="Insurance Policy (optional)">
          <Input placeholder="Patient insurance UUID" />
        </Form.Item>

        <Form.Item name="verificationType" label="Verification Type" initialValue="real-time">
          <Select options={verificationTypes} />
        </Form.Item>

        <Form.Item name="serviceType" label="Service Type" initialValue="30">
          <Input placeholder="e.g. 30 (Plan Coverage)" />
        </Form.Item>

        <Form.Item name="serviceDate" label="Date of Service">
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default CreateEligibilityVerificationModal;
