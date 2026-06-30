import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Switch,
  Space,
  Typography,
  message,
  Divider,
  Collapse,
  Tag,
  InputNumber,
  Popconfirm,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SaveOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkflowStore } from '../../store/dataStore';
import type { WorkflowStepConfig, WorkflowTransition } from '../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

const COLORS = [
  { label: 'Blue', value: 'blue' },
  { label: 'Cyan', value: 'cyan' },
  { label: 'Green', value: 'green' },
  { label: 'Orange', value: 'orange' },
  { label: 'Purple', value: 'purple' },
  { label: 'Red', value: 'red' },
  { label: 'Geekblue', value: 'geekblue' },
  { label: 'Magenta', value: 'magenta' },
  { label: 'Gold', value: 'gold' },
  { label: 'Lime', value: 'lime' },
];

const ICONS = [
  { label: 'Calendar', value: 'CalendarOutlined' },
  { label: 'Check Circle', value: 'CheckCircleOutlined' },
  { label: 'Clock Circle', value: 'ClockCircleOutlined' },
  { label: 'User', value: 'UserOutlined' },
  { label: 'File Text', value: 'FileTextOutlined' },
  { label: 'Medicine Box', value: 'MedicineBoxOutlined' },
  { label: 'Experiment', value: 'ExperimentOutlined' },
  { label: 'Dollar', value: 'DollarOutlined' },
  { label: 'Phone', value: 'PhoneOutlined' },
  { label: 'Video Camera', value: 'VideoCameraOutlined' },
  { label: 'Setting', value: 'SettingOutlined' },
  { label: 'Flag', value: 'FlagOutlined' },
];

const WorkflowBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { templates, createTemplate, updateTemplate, fetchTemplates } = useWorkflowStore();
  const [form] = Form.useForm();
  const [steps, setSteps] = useState<WorkflowStepConfig[]>([]);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(id);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (isEditing && templates.length > 0) {
      const template = templates.find((t) => t.id === id);
      if (template) {
        form.setFieldsValue({
          name: template.name,
          description: template.description,
          entityType: template.entityType,
          isActive: template.isActive,
        });
        setSteps(template.steps);
      }
    }
  }, [isEditing, id, templates, form]);

  const addStep = () => {
    const newStep: WorkflowStepConfig = {
      name: `step_${steps.length + 1}`,
      label: `Step ${steps.length + 1}`,
      order: steps.length,
      color: 'blue',
      icon: 'SettingOutlined',
      allowedTransitions: [],
      requiredFields: [],
      assignableRoles: [],
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index: number, field: keyof WorkflowStepConfig, value: unknown) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSteps(updated.map((s, i) => ({ ...s, order: i })));
  };

  const toggleTransition = (fromIndex: number, targetName: string) => {
    const step = steps[fromIndex];
    const transitions = step.allowedTransitions.includes(targetName)
      ? step.allowedTransitions.filter((t) => t !== targetName)
      : [...step.allowedTransitions, targetName];
    updateStep(fromIndex, 'allowedTransitions', transitions);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      // Auto-generate transitions if not manually set
      const autoTransitions: WorkflowTransition[] = [];
      for (const step of steps) {
        for (const target of step.allowedTransitions) {
          autoTransitions.push({
            fromStep: step.name,
            toStep: target,
            label: `${step.label} -> ${steps.find((s) => s.name === target)?.label || target}`,
          });
        }
      }

      const dto = {
        ...values,
        steps: steps.map((s, i) => ({ ...s, order: i })),
        transitions: autoTransitions,
      };

      if (isEditing) {
        await updateTemplate(id!, dto);
        message.success('Workflow template updated');
      } else {
        await createTemplate(dto);
        message.success('Workflow template created');
      }
      navigate('/workflow');
    } catch (err) {
      console.error('Validation failed:', err);
      message.error('Please fix validation errors');
    } finally {
      setSaving(false);
    }
  };

  const availableStepOptions = steps.map((s) => ({
    label: s.label,
    value: s.name,
  }));

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}>
            {isEditing ? 'Edit Workflow Template' : 'Create Workflow Template'}
          </Title>
          <Space>
            <Button icon={<RollbackOutlined />} onClick={() => navigate('/workflow')}>
              Back
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              Save
            </Button>
          </Space>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Workflow Name"
                rules={[{ required: true, message: 'Please enter a name' }]}
              >
                <Input placeholder="e.g., Appointment Workflow" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="entityType"
                label="Entity Type"
                rules={[{ required: true, message: 'Please select entity type' }]}
              >
                <Select
                  placeholder="Select entity type"
                  options={[
                    { label: 'Appointment', value: 'appointment' },
                    { label: 'Encounter', value: 'encounter' },
                    { label: 'Prescription', value: 'prescription' },
                    { label: 'Lab Order', value: 'lab_order' },
                    { label: 'Claim', value: 'claim' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Optional description" />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>

        <Divider>Workflow Steps</Divider>

        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Define the steps in your workflow and configure allowed transitions between them.
          </Text>
        </div>

        {steps.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            No steps defined yet. Click "Add Step" to begin.
          </div>
        )}

        <Collapse
          items={steps.map((step, index) => ({
            key: String(index),
            label: (
              <Space>
                <Tag color={step.color}>{step.label}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({step.name})
                </Text>
                {step.allowedTransitions.length > 0 && (
                  <Space size={4}>
                    {step.allowedTransitions.map((t) => (
                      <Tag key={t} color="blue" style={{ fontSize: 11 }}>
                        &rarr; {steps.find((s) => s.name === t)?.label || t}
                      </Tag>
                    ))}
                  </Space>
                )}
              </Space>
            ),
            extra: (
              <Space onClick={(e) => e.stopPropagation()}>
                <Button
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => moveStep(index, 'up')}
                />
                <Button
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={index === steps.length - 1}
                  onClick={() => moveStep(index, 'down')}
                />
                <Popconfirm title="Remove this step?" onConfirm={() => removeStep(index)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Step Name</Text>
                    <Input
                      value={step.name}
                      onChange={(e) => updateStep(index, 'name', e.target.value)}
                      placeholder="step_identifier"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Label</Text>
                    <Input
                      value={step.label}
                      onChange={(e) => updateStep(index, 'label', e.target.value)}
                      placeholder="Human readable name"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Color</Text>
                    <Select
                      value={step.color}
                      onChange={(value) => updateStep(index, 'color', value)}
                      style={{ width: '100%', marginTop: 4 }}
                      options={COLORS}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Icon</Text>
                    <Select
                      value={step.icon}
                      onChange={(value) => updateStep(index, 'icon', value)}
                      style={{ width: '100%', marginTop: 4 }}
                      options={ICONS}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Allowed Transitions</Text>
                    <div style={{ marginTop: 4 }}>
                      {availableStepOptions
                        .filter((opt) => opt.value !== step.name)
                        .map((opt) => (
                          <Tag
                            key={opt.value}
                            color={step.allowedTransitions.includes(opt.value) ? 'green' : 'default'}
                            style={{ cursor: 'pointer', marginBottom: 4 }}
                            onClick={() => toggleTransition(index, opt.value)}
                          >
                            {step.allowedTransitions.includes(opt.value) ? '✓ ' : ''}
                            {opt.label}
                          </Tag>
                        ))}
                    </div>
                    {availableStepOptions.filter((opt) => opt.value !== step.name).length === 0 && (
                      <Text type="secondary">Add more steps to configure transitions</Text>
                    )}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Required Fields</Text>
                    <Select
                      mode="tags"
                      value={step.requiredFields || []}
                      onChange={(values) => updateStep(index, 'requiredFields', values)}
                      style={{ width: '100%', marginTop: 4 }}
                      placeholder="Enter field names"
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Assignable Roles</Text>
                    <Select
                      mode="multiple"
                      value={step.assignableRoles || []}
                      onChange={(values) => updateStep(index, 'assignableRoles', values)}
                      style={{ width: '100%', marginTop: 4 }}
                      options={[
                        { label: 'Admin', value: 'admin' },
                        { label: 'Doctor', value: 'doctor' },
                        { label: 'Nurse', value: 'nurse' },
                        { label: 'Receptionist', value: 'receptionist' },
                        { label: 'Billing Staff', value: 'billing_staff' },
                      ]}
                    />
                  </div>
                </Col>
              </Row>
            ),
          }))}
        />

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addStep} block>
            Add Step
          </Button>
        </div>

        <Divider />

        {steps.length > 0 && (
          <div>
            <Title level={5}>Workflow Preview</Title>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {steps
                .sort((a, b) => a.order - b.order)
                .map((step, idx) => (
                  <React.Fragment key={step.name}>
                    <Tag color={step.color} style={{ padding: '4px 12px', fontSize: 14 }}>
                      {step.label}
                    </Tag>
                    {step.allowedTransitions.map((target) => (
                      <span key={`${step.name}-${target}`} style={{ fontSize: 12, color: '#999' }}>
                        &rarr; {steps.find((s) => s.name === target)?.label || target}
                      </span>
                    ))}
                    {idx < steps.length - 1 && step.allowedTransitions.length === 0 && (
                      <span style={{ fontSize: 12, color: '#999' }}>&rarr;</span>
                    )}
                  </React.Fragment>
                ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default WorkflowBuilderPage;
