import React, { useEffect, useState } from 'react';
import { Modal, Form, Select, Input, message, Spin } from 'antd';
import { documentationService, DocumentationPreference } from '../../services/documentationService';

const { TextArea } = Input;
const { Option } = Select;

interface Props {
  open: boolean;
  onClose: () => void;
  providerId: string;
}

const DocumentationPreferencesModal: React.FC<Props> = ({ open, onClose, providerId }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && providerId) {
      fetchPreference();
    }
  }, [open, providerId]);

  const fetchPreference = async () => {
    setLoading(true);
    try {
      const res = await documentationService.getPreference(providerId);
      if (res.data) {
        form.setFieldsValue(res.data);
      } else {
        form.resetFields();
        form.setFieldsValue({
          preferredLanguage: 'en',
          noteStyle: 'concise',
          requiredSections: [],
          doNotInfer: [],
          customInstructions: '',
        });
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await documentationService.savePreference(providerId, values);
      message.success('Documentation preferences saved');
      onClose();
    } catch (err: any) {
      if (err?.errorFields) return; // validation error
      message.error(err?.response?.data?.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Documentation Preferences"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save"
      confirmLoading={saving}
      width={520}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item name="preferredLanguage" label="Preferred Language">
            <Select>
              <Option value="en">English</Option>
              <Option value="es">Spanish</Option>
              <Option value="fr">French</Option>
              <Option value="de">German</Option>
              <Option value="zh">Chinese</Option>
              <Option value="hi">Hindi</Option>
            </Select>
          </Form.Item>
          <Form.Item name="noteStyle" label="Note Style">
            <Select>
              <Option value="concise">Concise</Option>
              <Option value="detailed">Detailed</Option>
              <Option value="narrative">Narrative</Option>
            </Select>
          </Form.Item>
          <Form.Item name="requiredSections" label="Required Sections">
            <Select mode="multiple" placeholder="Select required sections">
              <Option value="subjective">Subjective</Option>
              <Option value="objective">Objective</Option>
              <Option value="assessment">Assessment</Option>
              <Option value="plan">Plan</Option>
            </Select>
          </Form.Item>
          <Form.Item name="doNotInfer" label="Do Not Infer (AI should not fabricate)">
            <Select mode="multiple" placeholder="Select items AI should never infer">
              <Option value="diagnoses">Diagnoses</Option>
              <Option value="medications">Medications</Option>
              <Option value="vitals">Vitals</Option>
              <Option value="orders">Orders</Option>
              <Option value="procedures">Procedures</Option>
            </Select>
          </Form.Item>
          <Form.Item name="customInstructions" label="Custom Instructions">
            <TextArea rows={3} placeholder="e.g., Always include social determinants of health in the assessment..." />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default DocumentationPreferencesModal;
