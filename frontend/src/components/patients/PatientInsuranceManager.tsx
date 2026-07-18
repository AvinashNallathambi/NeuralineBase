import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Tag,
  Space,
  Table,
  Popconfirm,
  message,
  Upload,
  Alert,
  Spin,
  Divider,
  Tooltip,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CameraOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  billingService,
  type PatientInsurance,
  type InsurancePayer,
  type CreatePatientInsuranceDto,
} from '../../services/billingService';

const { Text } = Typography;

interface PatientInsuranceManagerProps {
  patientId: string;
  patientName?: string;
  patientDob?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  primary: 'blue',
  secondary: 'green',
  tertiary: 'orange',
};

const PRIORITY_ORDER = ['primary', 'secondary', 'tertiary'];

export function PatientInsuranceManager({
  patientId,
  patientName,
  patientDob,
}: PatientInsuranceManagerProps) {
  const [insurances, setInsurances] = useState<PatientInsurance[]>([]);
  const [payers, setPayers] = useState<InsurancePayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<PatientInsurance | null>(null);
  const [form] = Form.useForm();
  const [scanning, setScanning] = useState(false);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ins, ps] = await Promise.all([
        billingService.findPatientInsurances(patientId),
        billingService.findAllPayers(),
      ]);
      setInsurances(ins);
      setPayers(ps);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load insurance data');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = () => {
    setEditingInsurance(null);
    setScanWarnings([]);
    form.resetFields();
    form.setFieldsValue({
      subscriberRelation: 'self',
      subscriberName: patientName || '',
      subscriberDob: patientDob ? dayjs(patientDob) : undefined,
      priority: insurances.length === 0 ? 'primary' : insurances.length === 1 ? 'secondary' : 'tertiary',
    });
    setModalVisible(true);
  };

  const handleEdit = (insurance: PatientInsurance) => {
    setEditingInsurance(insurance);
    setScanWarnings([]);
    form.setFieldsValue({
      ...insurance,
      subscriberDob: insurance.subscriberDob ? dayjs(insurance.subscriberDob) : undefined,
      effectiveDate: insurance.effectiveDate ? dayjs(insurance.effectiveDate) : undefined,
      expirationDate: insurance.expirationDate ? dayjs(insurance.expirationDate) : undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await billingService.deletePatientInsurance(patientId, id);
      message.success('Insurance policy deleted');
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to delete insurance');
    }
  };

  const handlePriorityChange = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = PRIORITY_ORDER.indexOf(
      insurances.find((i) => i.id === id)?.priority || 'primary',
    );
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= PRIORITY_ORDER.length) return;
    const newPriority = PRIORITY_ORDER[newIndex];
    try {
      await billingService.updateInsurancePriority(patientId, id, newPriority as any);
      message.success(`Priority changed to ${newPriority}`);
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to update priority');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const dto: CreatePatientInsuranceDto = {
        patientId,
        insurancePayerId: values.insurancePayerId,
        priority: values.priority,
        policyNumber: values.policyNumber,
        groupNumber: values.groupNumber,
        subscriberName: values.subscriberName,
        subscriberRelation: values.subscriberRelation,
        subscriberDob: values.subscriberDob?.format('YYYY-MM-DD'),
        subscriberSsn: values.subscriberSsn,
        authorizationNumber: values.authorizationNumber,
        effectiveDate: values.effectiveDate?.format('YYYY-MM-DD'),
        expirationDate: values.expirationDate?.format('YYYY-MM-DD'),
        copayAmount: values.copayAmount,
        deductibleAmount: values.deductibleAmount,
        coinsurancePercentage: values.coinsurancePercentage,
      };

      if (editingInsurance) {
        await billingService.updatePatientInsurance(patientId, editingInsurance.id, dto);
        message.success('Insurance policy updated');
      } else {
        await billingService.createPatientInsurance(patientId, dto);
        message.success('Insurance policy added');
      }
      setModalVisible(false);
      loadData();
    } catch (err: any) {
      if (err?.errorFields) return; // form validation error
      message.error(err?.response?.data?.message || 'Failed to save insurance');
    }
  };

  const handleCardScan = async (file: File, side: 'front' | 'back') => {
    setScanning(true);
    setScanWarnings([]);
    try {
      const frontImage = side === 'front' ? file : undefined;
      const backImage = side === 'back' ? file : undefined;
      // If only back provided, we still send front as the same file (API expects front)
      const result = await billingService.scanInsuranceCard(
        patientId,
        frontImage || (file as any),
        backImage,
      );

      // Auto-fill form with extracted data
      if (result.extractedData) {
        const d = result.extractedData;
        if (d.policyNumber) form.setFieldValue('policyNumber', d.policyNumber);
        if (d.groupNumber) form.setFieldValue('groupNumber', d.groupNumber);
        if (d.subscriberName) form.setFieldValue('subscriberName', d.subscriberName);
        if (d.subscriberRelation) form.setFieldValue('subscriberRelation', d.subscriberRelation);
        if (d.copayAmount != null) form.setFieldValue('copayAmount', d.copayAmount);
        if (d.deductibleAmount != null) form.setFieldValue('deductibleAmount', d.deductibleAmount);
        if (d.coinsurancePercentage != null) form.setFieldValue('coinsurancePercentage', d.coinsurancePercentage);
        if (d.effectiveDate) form.setFieldValue('effectiveDate', dayjs(d.effectiveDate));
        if (d.expirationDate) form.setFieldValue('expirationDate', dayjs(d.expirationDate));
        if (result.matchedPayerId) form.setFieldValue('insurancePayerId', result.matchedPayerId);
      }

      if (result.warnings?.length > 0) {
        setScanWarnings(result.warnings);
      }
      message.success('Insurance card scanned — review extracted data below');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Card scan failed');
    } finally {
      setScanning(false);
    }
  };

  const columns = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (priority: string, record: PatientInsurance) => (
        <Space direction="vertical" size={0}>
          <Tag color={PRIORITY_COLORS[priority]} style={{ textTransform: 'capitalize' }}>
            {priority}
          </Tag>
          <Space size={2}>
            <Tooltip title="Move up">
              <Button
                size="small"
                type="text"
                icon={<ArrowUpOutlined />}
                disabled={PRIORITY_ORDER.indexOf(priority) === 0}
                onClick={() => handlePriorityChange(record.id, 'up')}
              />
            </Tooltip>
            <Tooltip title="Move down">
              <Button
                size="small"
                type="text"
                icon={<ArrowDownOutlined />}
                disabled={PRIORITY_ORDER.indexOf(priority) === PRIORITY_ORDER.length - 1}
                onClick={() => handlePriorityChange(record.id, 'down')}
              />
            </Tooltip>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Payer',
      key: 'payer',
      render: (_: any, record: PatientInsurance) => (
        <div>
          <Text strong>{record.payer?.name || 'Unknown'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.payer?.payerType}
          </Text>
        </div>
      ),
    },
    {
      title: 'Policy #',
      dataIndex: 'policyNumber',
      key: 'policyNumber',
    },
    {
      title: 'Group #',
      dataIndex: 'groupNumber',
      key: 'groupNumber',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Subscriber',
      key: 'subscriber',
      render: (_: any, record: PatientInsurance) => (
        <div>
          <Text>{record.subscriberName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'capitalize' }}>
            {record.subscriberRelation}
            {record.subscriberDob ? ` · DOB ${dayjs(record.subscriberDob).format('MM/DD/YYYY')}` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Effective',
      key: 'effective',
      render: (_: any, record: PatientInsurance) => (
        <div style={{ fontSize: 12 }}>
          {record.effectiveDate ? dayjs(record.effectiveDate).format('MM/DD/YYYY') : '—'}
          {record.expirationDate && (
            <>
              <br />
              <Text type="secondary">to {dayjs(record.expirationDate).format('MM/DD/YYYY')}</Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Financial',
      key: 'financial',
      render: (_: any, record: PatientInsurance) => (
        <div style={{ fontSize: 12 }}>
          {record.copayAmount != null && <div>Copay: ${record.copayAmount}</div>}
          {record.deductibleAmount != null && <div>Deductible: ${record.deductibleAmount}</div>}
          {record.coinsurancePercentage != null && <div>Coinsurance: {record.coinsurancePercentage}%</div>}
          {record.copayAmount == null && record.deductibleAmount == null && record.coinsurancePercentage == null && (
            <Text type="secondary">—</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: PatientInsurance) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="Delete this insurance policy?"
            description="This will soft-delete the policy. Claims already submitted will not be affected."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <SafetyCertificateOutlined />
          <span>Insurance Coverage</span>
          {insurances.length > 0 && (
            <Tag color="blue">{insurances.length} {insurances.length === 1 ? 'policy' : 'policies'}</Tag>
          )}
        </Space>
      }
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Insurance
        </Button>
      }
      loading={loading}
    >
      {insurances.length === 0 && !loading ? (
        <Alert
          type="warning"
          message="No insurance on file"
          description="Add at least a primary insurance policy for this patient, or scan their insurance card to auto-extract details."
          showIcon
          action={
            <Space>
              <Button size="small" type="primary" onClick={handleAdd}>
                Add Manually
              </Button>
            </Space>
          }
        />
      ) : (
        <Table
          dataSource={insurances}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      )}

      <Modal
        title={editingInsurance ? 'Edit Insurance Policy' : 'Add Insurance Policy'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={720}
        okText={editingInsurance ? 'Update' : 'Add'}
        destroyOnClose
      >
        <Spin spinning={scanning} tip="Scanning insurance card with AI...">
          {/* Card Scan Section */}
          {!editingInsurance && (
            <>
              <Alert
                type="info"
                message="Scan Insurance Card (AI-powered)"
                description="Upload front and back photos of the insurance card. AI will extract policy number, group number, subscriber info, and financial details automatically."
                showIcon
                style={{ marginBottom: 12 }}
              />
              <Space style={{ marginBottom: 12 }}>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleCardScan(file, 'front');
                    return false;
                  }}
                >
                  <Button icon={<CameraOutlined />}>Scan Front of Card</Button>
                </Upload>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleCardScan(file, 'back');
                    return false;
                  }}
                >
                  <Button icon={<CameraOutlined />}>Scan Back of Card</Button>
                </Upload>
              </Space>
              {scanWarnings.length > 0 && (
                <Alert
                  type="warning"
                  message="Scan warnings"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {scanWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  }
                  showIcon
                  icon={<ExclamationCircleOutlined />}
                  style={{ marginBottom: 12 }}
                />
              )}
              <Divider plain>or enter manually</Divider>
            </>
          )}

          <Form form={form} layout="vertical" size="small">
            <Form.Item label="Insurance Payer" name="insurancePayerId" rules={[{ required: true, message: 'Select a payer' }]}>
              <Select
                showSearch
                placeholder="Search for insurance company..."
                optionFilterProp="label"
                options={payers.map((p) => ({ value: p.id, label: p.name }))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item label="Priority" name="priority" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'primary', label: 'Primary' },
                  { value: 'secondary', label: 'Secondary' },
                  { value: 'tertiary', label: 'Tertiary' },
                ]}
              />
            </Form.Item>

            <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
              <Form.Item
                label="Policy Number"
                name="policyNumber"
                rules={[{ required: true, message: 'Required' }]}
                style={{ width: '50%', paddingRight: 8 }}
              >
                <Input placeholder="Member ID / Policy #" />
              </Form.Item>
              <Form.Item label="Group Number" name="groupNumber" style={{ width: '50%' }}>
                <Input placeholder="Group #" />
              </Form.Item>
            </Space.Compact>

            <Divider orientation="left" plain>Subscriber Information</Divider>

            <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
              <Form.Item
                label="Subscriber Name"
                name="subscriberName"
                rules={[{ required: true, message: 'Required' }]}
                style={{ width: '50%', paddingRight: 8 }}
              >
                <Input placeholder="Last, First" />
              </Form.Item>
              <Form.Item label="Relationship" name="subscriberRelation" style={{ width: '50%' }}>
                <Select
                  options={[
                    { value: 'self', label: 'Self' },
                    { value: 'spouse', label: 'Spouse' },
                    { value: 'child', label: 'Child' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </Form.Item>
            </Space.Compact>

            <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
              <Form.Item label="Subscriber DOB" name="subscriberDob" style={{ width: '33%', paddingRight: 8 }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Subscriber SSN" name="subscriberSsn" style={{ width: '33%', paddingRight: 8 }}>
                <Input placeholder="XXX-XX-XXXX" />
              </Form.Item>
              <Form.Item label="Authorization #" name="authorizationNumber" style={{ width: '34%' }}>
                <Input placeholder="Auth #" />
              </Form.Item>
            </Space.Compact>

            <Divider orientation="left" plain>Coverage Dates</Divider>

            <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
              <Form.Item label="Effective Date" name="effectiveDate" style={{ width: '50%', paddingRight: 8 }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Expiration Date" name="expirationDate" style={{ width: '50%' }}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Space.Compact>

            <Divider orientation="left" plain>Financial Details (Optional)</Divider>

            <Space.Compact style={{ width: '100%' }}>
              <Form.Item label="Copay ($)" name="copayAmount" style={{ width: '33%', paddingRight: 8 }}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
              <Form.Item label="Deductible ($)" name="deductibleAmount" style={{ width: '33%', paddingRight: 8 }}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
              <Form.Item label="Coinsurance (%)" name="coinsurancePercentage" style={{ width: '34%' }}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Space.Compact>
          </Form>
        </Spin>
      </Modal>
    </Card>
  );
}
