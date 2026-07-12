import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  List,
  Tag,
  Button,
  Modal,
  Form,
  Select,
  Input,
  message,
  Spin,
  Empty,
  Space,
  Descriptions,
} from 'antd';
import { MedicineBoxOutlined, ReloadOutlined } from '@ant-design/icons';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PortalPrescriptionsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [refillModalVisible, setRefillModalVisible] = useState(false);
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPrescriptions();
  }, []);

  const loadPrescriptions = async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getPrescriptions();
      setPrescriptions(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRefill = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await patientPortalService.requestRefill(selectedRx.id, {
        pharmacy: values.pharmacy,
        notes: values.notes,
      });
      message.success('Refill request submitted!');
      setRefillModalVisible(false);
      form.resetFields();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to request refill');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    active: 'green',
    draft: 'default',
    sent: 'blue',
    completed: 'default',
    cancelled: 'red',
    discontinued: 'orange',
    expired: 'red',
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const active = prescriptions.filter((p) => p.status === 'active');
  const past = prescriptions.filter((p) => p.status !== 'active');

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <MedicineBoxOutlined /> My Prescriptions
      </Title>

      <Card title="Active Prescriptions" style={{ marginBottom: 16 }}>
        {active.length ? (
          <List
            dataSource={active}
            renderItem={(rx) => (
              <List.Item
                actions={[
                  <Button
                    type="primary"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => { setSelectedRx(rx); setRefillModalVisible(true); }}
                  >
                    Request Refill
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{rx.medications?.map((m: any) => `${m.name} ${m.dosage || ''}`).join(', ') || 'Prescription'}</Text>
                      <Tag color={statusColors[rx.status]}>{rx.status}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      {rx.medications?.map((m: any, i: number) => (
                        <Text key={i} type="secondary">
                          {m.name} — {m.dosage}, {m.frequency}, {m.route}, {m.duration}
                          {m.refillsRemaining !== undefined ? ` · Refills: ${m.refillsRemaining}` : ''}
                        </Text>
                      ))}
                      {rx.pharmacy && <Text type="secondary">Pharmacy: {rx.pharmacy}</Text>}
                      {rx.prescriberName && <Text type="secondary">Prescribed by: {rx.prescriberName}</Text>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No active prescriptions" />
        )}
      </Card>

      <Card title="Past Prescriptions">
        {past.length ? (
          <List
            dataSource={past}
            renderItem={(rx) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{rx.medications?.map((m: any) => m.name).join(', ') || 'Prescription'}</Text>
                      <Tag color={statusColors[rx.status]}>{rx.status}</Tag>
                    </Space>
                  }
                  description={
                    <Text type="secondary">
                      Prescribed: {rx.prescribedDate ? new Date(rx.prescribedDate).toLocaleDateString() : 'N/A'}
                      {rx.prescriberName ? ` · ${rx.prescriberName}` : ''}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No past prescriptions" />
        )}
      </Card>

      <Modal
        title="Request Prescription Refill"
        open={refillModalVisible}
        onCancel={() => { setRefillModalVisible(false); form.resetFields(); }}
        onOk={handleRefill}
        confirmLoading={submitting}
        okText="Submit Refill Request"
      >
        {selectedRx && (
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Medication">
              {selectedRx.medications?.map((m: any) => m.name).join(', ')}
            </Descriptions.Item>
            <Descriptions.Item label="Current Pharmacy">
              {selectedRx.pharmacy || 'N/A'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="pharmacy" label="Pharmacy">
            <Select placeholder="Select pharmacy" allowClear>
              <Select.Option value="cvs">CVS Pharmacy</Select.Option>
              <Select.Option value="walgreens">Walgreens</Select.Option>
              <Select.Option value="walmart">Walmart Pharmacy</Select.Option>
              <Select.Option value="riteaid">Rite Aid</Select.Option>
              <Select.Option value="costco">Costco Pharmacy</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Any notes for the pharmacy or prescriber" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalPrescriptionsPage;
