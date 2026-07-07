import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, message, Tabs, Row, Col, Button } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ClinicalTemplate, CreateClinicalTemplateDto, ClinicalTemplateStatus } from '../../types';
import { clinicalTemplateService } from '../../services/clinicalTemplateService';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface Props {
  open: boolean;
  template: ClinicalTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
}

const SPECIALTY_OPTIONS = [
  'General Medicine',
  'Primary Care',
  'Cardiology',
  'Pulmonology',
  'Behavioral Health',
  'Urgent Care',
  'Telehealth',
  'Custom',
];

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

const ClinicalTemplateFormModal: React.FC<Props> = ({ open, template, onClose, onSuccess }) => {
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
    <Modal
      open={open}
      title={isEdit ? 'Edit Template' : 'Create Template'}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={isEdit ? 'Save' : 'Create'}
      width={720}
      destroyOnHidden
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
                    <Row gutter={8} key={field.key} align="bottom" style={{ marginBottom: 8 }}>
                      <Col xs={8}>
                        <Form.Item {...field} name={[field.name, 'code']} label={index === 0 ? 'Code' : ''}>
                          <Input placeholder="ICD-10" />
                        </Form.Item>
                      </Col>
                      <Col xs={12}>
                        <Form.Item {...field} name={[field.name, 'description']} label={index === 0 ? 'Description' : ''}>
                          <Input placeholder="Description" />
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger />
                      </Col>
                    </Row>
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
                    <Row gutter={8} key={field.key} align="bottom" style={{ marginBottom: 8 }}>
                      <Col xs={16}>
                        <Form.Item {...field} name={[field.name, 'name']} label={index === 0 ? 'Lab Order' : ''}>
                          <Input placeholder="Lab name" />
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Form.Item {...field} name={[field.name, 'priority']} label={index === 0 ? 'Priority' : ''}>
                          <Select placeholder="Priority">
                            <Option value="routine">Routine</Option>
                            <Option value="stat">STAT</Option>
                            <Option value="asap">ASAP</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ priority: 'routine' })}>
                    Add Lab
                  </Button>
                </>
              )}
            </Form.List>

            <Form.List name="imaging">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Row gutter={8} key={field.key} align="bottom" style={{ marginBottom: 8 }}>
                      <Col xs={16}>
                        <Form.Item {...field} name={[field.name, 'name']} label={index === 0 ? 'Imaging Order' : ''}>
                          <Input placeholder="Imaging name" />
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Form.Item {...field} name={[field.name, 'modality']} label={index === 0 ? 'Modality' : ''}>
                          <Input placeholder="Modality" />
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ priority: 'routine' })}>
                    Add Imaging
                  </Button>
                </>
              )}
            </Form.List>

            <Form.List name="referrals">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Row gutter={8} key={field.key} align="bottom" style={{ marginBottom: 8 }}>
                      <Col xs={10}>
                        <Form.Item {...field} name={[field.name, 'specialty']} label={index === 0 ? 'Specialty' : ''}>
                          <Input placeholder="Specialty" />
                        </Form.Item>
                      </Col>
                      <Col xs={10}>
                        <Form.Item {...field} name={[field.name, 'reason']} label={index === 0 ? 'Reason' : ''}>
                          <Input placeholder="Reason" />
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ urgency: 'routine' })}>
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
                    <Row gutter={8} key={field.key} align="bottom" style={{ marginBottom: 8 }}>
                      <Col xs={6}>
                        <Form.Item {...field} name={[field.name, 'name']} label={index === 0 ? 'Medication' : ''}>
                          <Input placeholder="Name" />
                        </Form.Item>
                      </Col>
                      <Col xs={5}>
                        <Form.Item {...field} name={[field.name, 'dosage']} label={index === 0 ? 'Dosage' : ''}>
                          <Input placeholder="Dosage" />
                        </Form.Item>
                      </Col>
                      <Col xs={5}>
                        <Form.Item {...field} name={[field.name, 'frequency']} label={index === 0 ? 'Frequency' : ''}>
                          <Input placeholder="Frequency" />
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Form.Item {...field} name={[field.name, 'route']} label={index === 0 ? 'Route' : ''}>
                          <Input placeholder="Route" />
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger />
                      </Col>
                    </Row>
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
                    <Row gutter={8} key={field.key} align="bottom" style={{ marginBottom: 8 }}>
                      <Col xs={12}>
                        <Form.Item {...field} name={[field.name, 'name']} label={index === 0 ? 'Procedure' : ''}>
                          <Input placeholder="Procedure name" />
                        </Form.Item>
                      </Col>
                      <Col xs={8}>
                        <Form.Item {...field} name={[field.name, 'description']} label={index === 0 ? 'Description' : ''}>
                          <Input placeholder="Description" />
                        </Form.Item>
                      </Col>
                      <Col xs={4}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger />
                      </Col>
                    </Row>
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
                    <Row gutter={8} key={field.key} align="bottom" style={{ marginBottom: 8 }}>
                      <Col xs={6}>
                        <Form.Item {...field} name={[field.name, 'codeType']} label={index === 0 ? 'Type' : ''}>
                          <Select placeholder="Type">
                            <Option value="CPT">CPT</Option>
                            <Option value="ICD10">ICD10</Option>
                            <Option value="HCPCS">HCPCS</Option>
                            <Option value="SNOMED">SNOMED</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={6}>
                        <Form.Item {...field} name={[field.name, 'code']} label={index === 0 ? 'Code' : ''}>
                          <Input placeholder="Code" />
                        </Form.Item>
                      </Col>
                      <Col xs={10}>
                        <Form.Item {...field} name={[field.name, 'description']} label={index === 0 ? 'Description' : ''}>
                          <Input placeholder="Description" />
                        </Form.Item>
                      </Col>
                      <Col xs={2}>
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger />
                      </Col>
                    </Row>
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
    </Modal>
  );
};

export default ClinicalTemplateFormModal;
