import React, { useEffect } from 'react';
import { Drawer, Form, Input, Select, Switch, message, Tabs, Row, Col, Button, Space } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ClinicalTemplate, CreateClinicalTemplateDto, ClinicalTemplateStatus } from '../../types';
import { clinicalTemplateService } from '../../services/clinicalTemplateService';
import { SPECIALTY_OPTIONS } from '../../constants/specialties';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface Props {
  open: boolean;
  template: ClinicalTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
}

const VISIT_TYPE_OPTIONS = [
  'Annual Physical',
  'Follow-Up',
  'New Patient',
  'Chronic Care',
  'Urgent',
  'Initial Assessment',
  'Video Visit',
  'Phone Follow-Up',
];

const ENCOUNTER_TYPE_OPTIONS = [
  'office_visit',
  'telehealth',
  'hospital',
  'emergency',
  'home_health',
  'nursing_facility',
];

/**
 * Fixed pixel width for the delete-button column in every dynamic form row.
 * Keeping this constant ensures all delete buttons align in a straight
 * vertical line on the right edge, regardless of how many input columns
 * precede them or what their fr proportions are.
 */
const DELETE_COL_WIDTH = 40;

/**
 * Gap (in pixels) between grid columns in a dynamic form row.
 */
const GRID_COL_GAP = 8;

/**
 * Builds a CSS Grid style for a dynamic form row.
 *
 * @param columns - fr values for each input column (NOT including the delete column)
 * @returns a React.CSSProperties object ready to spread on the row wrapper div
 */
const gridRowStyle = (...columns: string[]): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `${columns.join(' ')} ${DELETE_COL_WIDTH}px`,
  columnGap: GRID_COL_GAP,
  alignItems: 'end',
  marginBottom: 16,
});

/**
 * Style applied to every Form.Item inside a grid row so that the grid's
 * own marginBottom controls row spacing instead of the Form.Item default.
 */
const gridItemStyle: React.CSSProperties = { marginBottom: 0 };

/**
 * Tighter row gap for the Orders tab, where rows are short (2 inputs)
 * and the default 16px gap feels too airy.
 */
const gridRowStyleTight = (...columns: string[]): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `${columns.join(' ')} ${DELETE_COL_WIDTH}px`,
  columnGap: GRID_COL_GAP,
  alignItems: 'end',
  marginBottom: 8,
});

/**
 * Style for the "+ Add ..." buttons. The top margin separates the button
 * from the last input row; the bottom margin separates consecutive
 * Add-button sections (Labs / Imaging / Referrals) for visual hierarchy.
 */
const addButtonStyle: React.CSSProperties = { marginTop: 24, marginBottom: 16 };

const ClinicalTemplateFormDrawer: React.FC<Props> = ({ open, template, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('basic');
  const isEdit = !!template;

  useEffect(() => {
    if (open) {
      if (template) {
        form.setFieldsValue({
          name: template.name,
          specialty: template.specialty,
          visitType: template.visitType,
          description: template.description ?? undefined,
          department: template.department ?? undefined,
          tags: template.tags?.join(', '),
          status: template.status,
          encounterType: template.encounterType ?? undefined,
          visitReason: template.visitReason,
          chiefComplaint: template.chiefComplaint,
          soapSubjective: template.soapTemplate?.subjective,
          soapObjective: template.soapTemplate?.objective,
          soapAssessment: template.soapTemplate?.assessment,
          soapPlan: template.soapTemplate?.plan,
          vitals: template.vitalsTemplate,
          diagnoses: template.diagnosisTemplate,
          medications: template.medicationTemplate,
          procedures: template.treatmentPlanTemplate?.procedures || [],
          labs: template.ordersTemplate?.labs || [],
          imaging: template.ordersTemplate?.imaging || [],
          referrals: template.ordersTemplate?.referrals || [],
          followUp: template.treatmentPlanTemplate?.followUp,
          followUpInstructions: template.treatmentPlanTemplate?.homeInstructions,
          goals: template.treatmentPlanTemplate?.goals?.join('\n'),
          interventions: template.treatmentPlanTemplate?.interventions?.join('\n'),
          billingCodes: template.billingCodes,
          providerNotes: template.providerNotes,
          isFavorite: template.isFavorite,
          isDefault: template.isDefault,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          status: 'active',
          encounterType: 'office_visit',
          isFavorite: false,
          isDefault: false,
          vitals: {},
          diagnoses: [],
          medications: [],
          procedures: [],
          labs: [],
          imaging: [],
          referrals: [],
          billingCodes: [],
        });
      }
      setActiveTab('basic');
    }
  }, [open, template, form]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildDto = (values: any): CreateClinicalTemplateDto => {
    return {
      name: values.name,
      specialty: values.specialty,
      visitType: values.visitType,
      description: values.description,
      department: values.department,
      tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      status: values.status as ClinicalTemplateStatus,
      encounterType: values.encounterType,
      visitReason: values.visitReason,
      chiefComplaint: values.chiefComplaint,
      soapTemplate: {
        subjective: values.soapSubjective,
        objective: values.soapObjective,
        assessment: values.soapAssessment,
        plan: values.soapPlan,
      },
      vitalsTemplate: values.vitals || {},
      diagnosisTemplate: values.diagnoses || [],
      medicationTemplate: values.medications || [],
      ordersTemplate: {
        labs: values.labs || [],
        imaging: values.imaging || [],
        referrals: values.referrals || [],
      },
      treatmentPlanTemplate: {
        procedures: values.procedures || [],
        followUp: values.followUp,
        homeInstructions: values.followUpInstructions,
        goals: values.goals ? values.goals.split('\n').filter(Boolean) : [],
        interventions: values.interventions ? values.interventions.split('\n').filter(Boolean) : [],
      },
      billingCodes: values.billingCodes || [],
      providerNotes: values.providerNotes,
      isFavorite: values.isFavorite,
      isDefault: values.isDefault,
    };
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setLoading(true);
    try {
      const dto = buildDto(values);
      if (isEdit && template) {
        await clinicalTemplateService.update(template.id, dto);
        message.success('Template updated');
      } else {
        await clinicalTemplateService.create(dto);
        message.success('Template created');
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      title={isEdit ? 'Edit Template' : 'Create Template'}
      onClose={onClose}
      width={760}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={loading} onClick={handleSubmit}>
              {isEdit ? 'Save' : 'Create'}
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Basic Info" key="basic">
            <Row gutter={16}>
              <Col xs={24} md={16}>
                <Form.Item name="name" label="Template Name" rules={[{ required: true, message: 'Name is required' }]}>
                  <Input placeholder="e.g., Annual Physical" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="status" label="Status">
                  <Select>
                    <Option value="active">Active</Option>
                    <Option value="inactive">Inactive</Option>
                    <Option value="archived">Archived</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="specialty" label="Specialty" rules={[{ required: true, message: 'Specialty is required' }]}>
                  <Select showSearch placeholder="Select specialty">
                    {SPECIALTY_OPTIONS.map((s) => (
                      <Option key={s} value={s}>{s}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="visitType" label="Visit Type" rules={[{ required: true, message: 'Visit type is required' }]}>
                  <Select showSearch placeholder="Select visit type">
                    {VISIT_TYPE_OPTIONS.map((v) => (
                      <Option key={v} value={v}>{v}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="encounterType" label="Encounter Type">
                  <Select allowClear placeholder="Select type">
                    {ENCOUNTER_TYPE_OPTIONS.map((t) => (
                      <Option key={t} value={t}>{t.replace(/_/g, ' ')}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="department" label="Department">
                  <Input placeholder="e.g., Primary Care" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="tags" label="Tags">
                  <Input placeholder="Comma-separated tags" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="Description">
              <TextArea rows={3} placeholder="Template description" />
            </Form.Item>
            <Form.Item name="visitReason" label="Default Visit Reason">
              <Input placeholder="e.g., Annual preventive physical examination" />
            </Form.Item>
            <Form.Item name="chiefComplaint" label="Default Chief Complaint">
              <Input placeholder="e.g., Routine annual physical" />
            </Form.Item>
            <div style={{ display: 'flex', gap: 24 }}>
              <Form.Item name="isDefault" valuePropName="checked" label="Default Template">
                <Switch />
              </Form.Item>
              <Form.Item name="isFavorite" valuePropName="checked" label="Favorite">
                <Switch />
              </Form.Item>
            </div>
          </TabPane>

          <TabPane tab="SOAP Note" key="soap">
            <Form.Item name="soapSubjective" label="Subjective">
              <TextArea rows={4} placeholder="Default subjective note" />
            </Form.Item>
            <Form.Item name="soapObjective" label="Objective">
              <TextArea rows={4} placeholder="Default objective findings" />
            </Form.Item>
            <Form.Item name="soapAssessment" label="Assessment">
              <TextArea rows={4} placeholder="Default assessment" />
            </Form.Item>
            <Form.Item name="soapPlan" label="Plan">
              <TextArea rows={4} placeholder="Default plan" />
            </Form.Item>
          </TabPane>

          <TabPane tab="Vitals" key="vitals">
            <Row gutter={16}>
              {[
                ['bloodPressure', 'Blood Pressure'],
                ['heartRate', 'Heart Rate'],
                ['temperature', 'Temperature'],
                ['temperatureRoute', 'Temperature Route'],
                ['weight', 'Weight'],
                ['weightUnit', 'Weight Unit'],
                ['height', 'Height'],
                ['heightUnit', 'Height Unit'],
                ['bmi', 'BMI'],
                ['oxygenSaturation', 'Oxygen Saturation'],
                ['respiratoryRate', 'Respiratory Rate'],
                ['painScore', 'Pain Score'],
                ['painLocation', 'Pain Location'],
                ['bloodGlucose', 'Blood Glucose'],
                ['bloodGlucoseContext', 'Glucose Context'],
              ].map(([key, label]) => (
                <Col xs={12} md={8} key={key}>
                  <Form.Item name={['vitals', key]} label={label}>
                    <Input placeholder={label} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </TabPane>

          <TabPane tab="Diagnoses" key="diagnoses">
            <Form.List name="diagnoses">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <div key={field.key} style={gridRowStyle('2fr', '3fr')}>
                      <Form.Item {...field} name={[field.name, 'code']} label={index === 0 ? 'Code' : ''} style={gridItemStyle}>
                        <Input placeholder="ICD-10" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'description']} label={index === 0 ? 'Description' : ''} style={gridItemStyle}>
                        <Input placeholder="Description" />
                      </Form.Item>
                      <Form.Item label=" " style={gridItemStyle}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger block />
                      </Form.Item>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>
                    Add Diagnosis
                  </Button>
                </>
              )}
            </Form.List>
          </TabPane>

          <TabPane tab="Orders" key="orders">
            <Form.List name="labs">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <div key={field.key} style={gridRowStyleTight('4fr', '1fr')}>
                      <Form.Item {...field} name={[field.name, 'name']} label={index === 0 ? 'Lab Order' : ''} style={gridItemStyle}>
                        <Input placeholder="Lab name" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'priority']} label={index === 0 ? 'Priority' : ''} style={gridItemStyle}>
                        <Select placeholder="Priority">
                          <Option value="routine">Routine</Option>
                          <Option value="stat">STAT</Option>
                          <Option value="asap">ASAP</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item label=" " style={gridItemStyle}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger block />
                      </Form.Item>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ priority: 'routine' })} style={addButtonStyle}>
                    Add Lab
                  </Button>
                </>
              )}
            </Form.List>

            <Form.List name="imaging">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <div key={field.key} style={gridRowStyleTight('4fr', '1fr')}>
                      <Form.Item {...field} name={[field.name, 'name']} label={index === 0 ? 'Imaging Order' : ''} style={gridItemStyle}>
                        <Input placeholder="Imaging name" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'modality']} label={index === 0 ? 'Modality' : ''} style={gridItemStyle}>
                        <Input placeholder="Modality" />
                      </Form.Item>
                      <Form.Item label=" " style={gridItemStyle}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger block />
                      </Form.Item>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ priority: 'routine' })} style={addButtonStyle}>
                    Add Imaging
                  </Button>
                </>
              )}
            </Form.List>

            <Form.List name="referrals">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <div key={field.key} style={gridRowStyleTight('1fr', '1fr')}>
                      <Form.Item {...field} name={[field.name, 'specialty']} label={index === 0 ? 'Specialty' : ''} style={gridItemStyle}>
                        <Input placeholder="Specialty" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'reason']} label={index === 0 ? 'Reason' : ''} style={gridItemStyle}>
                        <Input placeholder="Reason" />
                      </Form.Item>
                      <Form.Item label=" " style={gridItemStyle}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger block />
                      </Form.Item>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ urgency: 'routine' })} style={addButtonStyle}>
                    Add Referral
                  </Button>
                </>
              )}
            </Form.List>
          </TabPane>

          <TabPane tab="Medications" key="medications">
            <Form.List name="medications">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <div key={field.key} style={gridRowStyle('6fr', '5fr', '5fr', '4fr')}>
                      <Form.Item {...field} name={[field.name, 'name']} label={index === 0 ? 'Medication' : ''} style={gridItemStyle}>
                        <Input placeholder="Name" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'dosage']} label={index === 0 ? 'Dosage' : ''} style={gridItemStyle}>
                        <Input placeholder="Dosage" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'frequency']} label={index === 0 ? 'Frequency' : ''} style={gridItemStyle}>
                        <Input placeholder="Frequency" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'route']} label={index === 0 ? 'Route' : ''} style={gridItemStyle}>
                        <Input placeholder="Route" />
                      </Form.Item>
                      <Form.Item label=" " style={gridItemStyle}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger block />
                      </Form.Item>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>
                    Add Medication
                  </Button>
                </>
              )}
            </Form.List>
          </TabPane>

          <TabPane tab="Treatment Plan" key="plan">
            <Form.List name="procedures">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <div key={field.key} style={gridRowStyle('3fr', '2fr')}>
                      <Form.Item {...field} name={[field.name, 'name']} label={index === 0 ? 'Procedure' : ''} style={gridItemStyle}>
                        <Input placeholder="Procedure name" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'description']} label={index === 0 ? 'Description' : ''} style={gridItemStyle}>
                        <Input placeholder="Description" />
                      </Form.Item>
                      <Form.Item label=" " style={gridItemStyle}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger block />
                      </Form.Item>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>
                    Add Procedure
                  </Button>
                </>
              )}
            </Form.List>

            <Form.Item name="followUp" label="Follow-up Instructions">
              <TextArea rows={3} placeholder="Default follow-up instructions" />
            </Form.Item>
            <Form.Item name="followUpInstructions" label="Patient Instructions">
              <TextArea rows={3} placeholder="Default patient instructions" />
            </Form.Item>
            <Form.Item name="goals" label="Treatment Goals (one per line)">
              <TextArea rows={3} placeholder="Default goals" />
            </Form.Item>
            <Form.Item name="interventions" label="Interventions (one per line)">
              <TextArea rows={3} placeholder="Default interventions" />
            </Form.Item>
          </TabPane>

          <TabPane tab="Billing" key="billing">
            <Form.List name="billingCodes">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <div key={field.key} style={gridRowStyle('3fr', '3fr', '5fr')}>
                      <Form.Item {...field} name={[field.name, 'codeType']} label={index === 0 ? 'Type' : ''} style={gridItemStyle}>
                        <Select placeholder="Type">
                          <Option value="CPT">CPT</Option>
                          <Option value="ICD10">ICD10</Option>
                          <Option value="HCPCS">HCPCS</Option>
                          <Option value="SNOMED">SNOMED</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'code']} label={index === 0 ? 'Code' : ''} style={gridItemStyle}>
                        <Input placeholder="Code" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'description']} label={index === 0 ? 'Description' : ''} style={gridItemStyle}>
                        <Input placeholder="Description" />
                      </Form.Item>
                      <Form.Item label=" " style={gridItemStyle}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger block />
                      </Form.Item>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>
                    Add Billing Code
                  </Button>
                </>
              )}
            </Form.List>

            <Form.Item name="providerNotes" label="Provider Notes (internal)">
              <TextArea rows={3} placeholder="Internal template notes" />
            </Form.Item>
          </TabPane>
        </Tabs>
      </Form>
    </Drawer>
  );
};

export default ClinicalTemplateFormDrawer;
