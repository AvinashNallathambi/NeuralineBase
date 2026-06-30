import React from 'react';
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
  message,
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
  const { prescriptions } = usePrescriptionStore();

  const prescription = prescriptions.find((rx) => rx.id === id);

  if (!prescription) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/prescriptions')}>
          Back to Prescriptions
        </Button>
        <Title level={4} style={{ marginTop: 24 }}>
          Prescription not found
        </Title>
      </div>
    );
  }

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
              <Button icon={<ReloadOutlined />} onClick={() => message.info('Refill request initiated')}>
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
                {prescription.prescribedDate.split('T')[0]}
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
                <div><Text>{prescription.prescribedDate.split('T')[0]}</Text></div>
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
    </div>
  );
};

export default PrescriptionDetailPage;
