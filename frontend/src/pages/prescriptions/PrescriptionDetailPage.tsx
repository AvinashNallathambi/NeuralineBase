import React, { useEffect, useState } from 'react';
import {
  Typography,
  Button,
  Card,
  Space,
  Tag,
  Descriptions,
  Table,
  Row,
  Col,
  Divider,
  Spin,
  message,
  Input,
  Modal,
} from 'antd';
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  MedicineBoxOutlined,
  EditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { PrescriptionItem } from '../../types';
import type { RefillRequest } from '../../data/mockData';
import { prescriptionService, type Prescription } from '../../services/prescriptionService';
import { usePrescriptionStore } from '../../store/dataStore';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  active: 'green',
  draft: 'gold',
  completed: 'blue',
  cancelled: 'default',
  expired: 'red',
};

const PrescriptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refillModalOpen, setRefillModalOpen] = useState(false);
  const [refillNotes, setRefillNotes] = useState('');
  const { addRefillRequest } = usePrescriptionStore();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    prescriptionService
      .findOne(id)
      .then((rx) => {
        setPrescription(rx);
        setError(null);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message || 'Prescription not found');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const medColumns: ColumnsType<PrescriptionItem> = [
    { title: 'Medication', dataIndex: 'medication', key: 'medication', width: 180 },
    { title: 'Dosage', dataIndex: 'dosage', key: 'dosage', width: 100 },
    { title: 'Frequency', dataIndex: 'frequency', key: 'frequency', width: 160 },
    { title: 'Route', dataIndex: 'route', key: 'route', width: 100 },
    { title: 'Duration', dataIndex: 'duration', key: 'duration', width: 100 },
    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: 'Refills', dataIndex: 'refills', key: 'refills', width: 80 },
    {
      title: 'Instructions',
      dataIndex: 'instructions',
      key: 'instructions',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !prescription) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/prescriptions')}>
          Back to Prescriptions
        </Button>
        <Title level={4} style={{ marginTop: 24 }}>
          {error || 'Prescription not found'}
        </Title>
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/prescriptions')}>
          Back to Prescriptions
        </Button>
      </Space>

      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <MedicineBoxOutlined style={{ fontSize: 28, color: '#0D7C8A' }} />
            <Title level={3} style={{ margin: 0 }}>
              Prescription {prescription.id}
            </Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => message.info('Edit not implemented')}>
              Edit
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => message.info('Printing prescription...')}>
              Print
            </Button>
            {prescription.status === 'active' && (
              <Button icon={<ReloadOutlined />} onClick={() => { setRefillNotes(''); setRefillModalOpen(true); }}>
                Request Refill
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="Prescription Details" style={{ marginBottom: 24 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Prescription ID">{prescription.id}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[prescription.status] || 'default'}>
                  {prescription.status.charAt(0).toUpperCase() + prescription.status.slice(1)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Prescribed Date">
                {prescription.prescribedDate ? prescription.prescribedDate.split('T')[0] : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Patient">{prescription.patientName}</Descriptions.Item>
              <Descriptions.Item label="Provider">{prescription.providerName}</Descriptions.Item>
              <Descriptions.Item label="Pharmacy">
                {prescription.pharmacy || <Text type="secondary">Not assigned</Text>}
              </Descriptions.Item>
              {prescription.notes && (
                <Descriptions.Item label="Notes" span={2}>
                  {prescription.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            <Title level={5}>Medications</Title>
            <Table
              columns={medColumns}
              dataSource={prescription.medications}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 900 }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Patient Summary" style={{ marginBottom: 24 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>Patient</Text>
                <div><Text>{prescription.patientName}</Text></div>
              </div>
              <div>
                <Text strong>Prescribing Provider</Text>
                <div><Text>{prescription.providerName}</Text></div>
              </div>
              <div>
                <Text strong>Date Prescribed</Text>
                <div><Text>{prescription.prescribedDate ? prescription.prescribedDate.split('T')[0] : '-'}</Text></div>
              </div>
              <div>
                <Text strong>Pharmacy</Text>
                <div><Text>{prescription.pharmacy || 'Not assigned'}</Text></div>
              </div>
              <div>
                <Text strong>Status</Text>
                <div>
                  <Tag color={statusColors[prescription.status] || 'default'}>
                    {prescription.status.charAt(0).toUpperCase() + prescription.status.slice(1)}
                  </Tag>
                </div>
              </div>
              <div>
                <Text strong>Total Medications</Text>
                <div><Text>{prescription.medications.length}</Text></div>
              </div>
              <div>
                <Text strong>Total Quantity</Text>
                <div><Text>{prescription.medications.reduce((sum, m) => sum + (m.quantity || 0), 0)}</Text></div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Request Refill"
        open={refillModalOpen}
        onOk={() => {
          const newRequest: RefillRequest = {
            id: `rr-${Date.now()}`,
            prescriptionId: prescription.id,
            patientName: prescription.patientName,
            medication: prescription.medications[0]?.medication || '',
            dosage: prescription.medications[0]?.dosage || '',
            requestedDate: new Date().toISOString(),
            status: 'pending',
            notes: refillNotes || undefined,
          };
          addRefillRequest(newRequest);
          message.success('Refill request submitted');
          setRefillModalOpen(false);
        }}
        onCancel={() => setRefillModalOpen(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            Request a refill for prescription <Text strong>{prescription.id}</Text>?
          </Text>
          <Text type="secondary">Patient: {prescription.patientName}</Text>
          <Text type="secondary">
            Medication: {prescription.medications[0]?.medication} {prescription.medications[0]?.dosage}
          </Text>
          <Input.TextArea
            placeholder="Add notes (optional)..."
            value={refillNotes}
            onChange={(e) => setRefillNotes(e.target.value)}
            rows={3}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default PrescriptionDetailPage;
