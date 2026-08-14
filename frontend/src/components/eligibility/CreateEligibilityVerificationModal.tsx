import React, { useEffect, useState, useCallback } from 'react';
import { Form, Select, Input, DatePicker, Button, message, Drawer, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { EligibilityVerificationType, CreateEligibilityVerificationDto } from '../../types';
import { patientService } from '../../services/patientService';
import { billingService, type PatientInsurance } from '../../services/billingService';

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
  const [insurances, setInsurances] = useState<PatientInsurance[]>([]);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(patientId);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (patientId) {
        form.setFieldsValue({ patientId });
        setSelectedPatientId(patientId);
      } else {
        setSelectedPatientId(undefined);
      }
      if (appointmentId) form.setFieldsValue({ appointmentId });
    }
  }, [open, patientId, appointmentId, form]);

  // Load initial patient list (first 50) when modal opens
  useEffect(() => {
    const loadPatients = async () => {
      if (patientId) return;
      setPatientLoading(true);
      try {
        const result = await patientService.findAll({ page: 1, limit: 50 });
        setPatients(result.data);
      } catch {
        message.error('Failed to load patients');
      } finally {
        setPatientLoading(false);
      }
    };
    if (open) loadPatients();
  }, [open, patientId]);

  // Server-side patient search as user types
  const handlePatientSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return;
    setPatientLoading(true);
    try {
      const result = await patientService.findAll({ page: 1, limit: 50, search: searchTerm });
      setPatients(result.data);
    } catch {
      // keep existing list on error
    } finally {
      setPatientLoading(false);
    }
  }, []);

  // Load insurance policies when a patient is selected
  const loadInsurances = useCallback(async (pid: string) => {
    setInsuranceLoading(true);
    setInsurances([]);
    try {
      const result = await billingService.findPatientInsurances(pid);
      setInsurances(result);
    } catch {
      // patient may have no insurance — not an error
    } finally {
      setInsuranceLoading(false);
    }
  }, []);

  const handlePatientChange = (pid: string) => {
    setSelectedPatientId(pid);
    form.setFieldValue('patientInsuranceId', undefined);
    loadInsurances(pid);
  };

  const handleFinish = async (values: CreateEligibilityVerificationDto) => {
    await onSubmit(values);
  };

  return (
    <Drawer
     size={720}
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
            placeholder="Search by name, MRN, email, or phone..."
            optionFilterProp="label"
            onSearch={handlePatientSearch}
            onChange={handlePatientChange}
            filterOption={false}
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.firstName} ${p.lastName}`,
            }))}
          />
        </Form.Item>

        <Form.Item name="appointmentId" label="Appointment ID" hidden={!appointmentId}>
          <Input disabled />
        </Form.Item>

        <Form.Item name="patientInsuranceId" label="Insurance Policy">
          <Select
            loading={insuranceLoading}
            disabled={!selectedPatientId}
            placeholder={selectedPatientId ? 'Select insurance policy' : 'Select a patient first'}
            allowClear
            options={insurances.map((ins) => ({
              value: ins.id,
              label: `${ins.payer?.name || 'Unknown Payer'} — ${ins.policyNumber} (${ins.priority})`,
            }))}
          />
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
