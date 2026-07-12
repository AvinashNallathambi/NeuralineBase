import React, { useEffect, useState, useCallback } from 'react';
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
  Timeline,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  MedicineBoxOutlined,
  EditOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  StopOutlined,
  SendOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  prescriptionService,
  type Prescription,
  type RefillRequest,
  type StatusHistoryEntry,
  type PrescriptionStatus,
} from '../../services/prescriptionService';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  active: 'green',
  draft: 'gold',
  sent: 'cyan',
  completed: 'blue',
  cancelled: 'default',
  discontinued: 'volcano',
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
  const [refillSubmitting, setRefillSubmitting] = useState(false);
  const [refills, setRefills] = useState<RefillRequest[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [statusTransitionLoading, setStatusTransitionLoading] = useState(false);

  const loadPrescription = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const rx = await prescriptionService.findOne(id);
      setPrescription(rx);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Prescription not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRefills = useCallback(async () => {
    if (!id) return;
    try {
      const data = await prescriptionService.findRefills(id);
      setRefills(data);
    } catch {
      setRefills([]);
    }
  }, [id]);

  const loadStatusHistory = useCallback(async () => {
    if (!id) return;
    try {
      const data = await prescriptionService.getStatusHistory(id);
      setStatusHistory(data);
    } catch {
      setStatusHistory([]);
    }
  }, [id]);

  useEffect(() => {
    void loadPrescription();
    void loadRefills();
    void loadStatusHistory();
  }, [loadPrescription, loadRefills, loadStatusHistory]);

  const handleStatusTransition = async (newStatus: PrescriptionStatus, reason?: string) => {
    if (!id) return;
    setStatusTransitionLoading(true);
    try {
      await prescriptionService.updateStatus(id, { status: newStatus, reason });
      message.success(`Status changed to ${newStatus}`);
      await loadPrescription();
      await loadStatusHistory();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to change status');
    } finally {
      setStatusTransitionLoading(false);
    }
  };

  const handleRequestRefill = async () => {
    if (!prescription) return;
    setRefillSubmitting(true);
    try {
      await prescriptionService.createRefill(prescription.id, {
        notes: refillNotes || undefined,
      });
      message.success('Refill request submitted');
      setRefillModalOpen(false);
      setRefillNotes('');
      await loadRefills();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to submit refill request');
    } finally {
      setRefillSubmitting(false);
    }
  };

  const handleDeletePrescription = async () => {
    if (!prescription) return;
    try {
      await prescriptionService.delete(prescription.id);
      message.success('Prescription deleted');
      navigate('/prescriptions');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to delete prescription');
    }
  };

  const medColumns: ColumnsType<any> = [
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

  const isEditable = prescription.status === 'draft' || prescription.status === 'active';
  const canRefill = prescription.status === 'active' || prescription.status === 'sent';
  const canSign = prescription.status === 'draft';
  const canSend = prescription.status === 'active';
  const canComplete = prescription.status === 'active' || prescription.status === 'sent';
  const canDiscontinue = prescription.status === 'active' || prescription.status === 'sent';
  const canCancel = prescription.status === 'draft' || prescription.status === 'active';
  const canDelete = prescription.status === 'draft' || prescription.status === 'cancelled';

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
          <Space wrap>
            {isEditable && (
              <Button
                icon={<EditOutlined />}
                onClick={() => navigate(`/prescriptions/${prescription.id}/edit`)}
              >
                Edit
              </Button>
            )}
            {canSign && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={statusTransitionLoading}
                onClick={() => handleStatusTransition('active', 'Prescription signed and activated')}
              >
                Sign & Activate
              </Button>
            )}
            {canSend && (
              <Button
                icon={<SendOutlined />}
                loading={statusTransitionLoading}
                onClick={() => handleStatusTransition('sent', 'Sent to pharmacy')}
              >
                Send to Pharmacy
              </Button>
            )}
            {canComplete && (
              <Popconfirm
                title="Mark this prescription as completed?"
                onConfirm={() => handleStatusTransition('completed', 'Prescription completed')}
              >
                <Button
                  icon={<CheckCircleOutlined />}
                  loading={statusTransitionLoading}
                >
                  Complete
                </Button>
              </Popconfirm>
            )}
            {canDiscontinue && (
              <Popconfirm
                title="Discontinue this prescription?"
                onConfirm={() => handleStatusTransition('discontinued', 'Prescription discontinued')}
              >
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={statusTransitionLoading}
                >
                  Discontinue
                </Button>
              </Popconfirm>
            )}
            {canCancel && (
              <Popconfirm
                title="Cancel this prescription?"
                onConfirm={() => handleStatusTransition('cancelled', 'Prescription cancelled')}
              >
                <Button
                  icon={<StopOutlined />}
                  loading={statusTransitionLoading}
                >
                  Cancel
                </Button>
              </Popconfirm>
            )}
            <Button icon={<PrinterOutlined />} onClick={() => message.info('Printing prescription...')}>
              Print
            </Button>
            {canRefill && (
              <Button
                icon={<ReloadOutlined />}
                onClick={() => { setRefillNotes(''); setRefillModalOpen(true); }}
              >
                Request Refill
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title="Delete this prescription?"
                description="This action soft-deletes the prescription."
                onConfirm={handleDeletePrescription}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
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

          {refills.length > 0 && (
            <Card title="Refill History" style={{ marginBottom: 24 }}>
              <Timeline
                items={refills.map((r) => ({
                  color: r.status === 'approved' || r.status === 'completed' ? 'green'
                    : r.status === 'denied' ? 'red' : 'orange',
                  children: (
                    <div>
                      <Space>
                        <Text strong>{r.medication} {r.dosage}</Text>
                        <Tag color={r.status === 'approved' ? 'green' : r.status === 'denied' ? 'red' : r.status === 'completed' ? 'blue' : 'orange'}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </Tag>
                      </Space>
                      <div>
                        <Text type="secondary">
                          {new Date(r.createdAt).toLocaleString()}
                          {r.reviewedAt && ` | Reviewed: ${new Date(r.reviewedAt).toLocaleString()}`}
                        </Text>
                      </div>
                      {r.notes && <Text type="secondary" italic>{r.notes}</Text>}
                    </div>
                  ),
                }))}
              />
            </Card>
          )}

          {statusHistory.length > 0 && (
            <Card title="Status History">
              <Timeline
                items={statusHistory.map((h) => ({
                  color: statusColors[h.newStatus] || 'blue',
                  children: (
                    <div>
                      <Space>
                        <Tag color={statusColors[h.newStatus] || 'default'}>
                          {h.newStatus.charAt(0).toUpperCase() + h.newStatus.slice(1)}
                        </Tag>
                        {h.previousStatus && (
                          <Text type="secondary">
                            from {h.previousStatus.charAt(0).toUpperCase() + h.previousStatus.slice(1)}
                          </Text>
                        )}
                      </Space>
                      <div>
                        <Text type="secondary">
                          {new Date(h.createdAt).toLocaleString()}
                        </Text>
                      </div>
                      {h.reason && <Text type="secondary" italic>{h.reason}</Text>}
                    </div>
                  ),
                }))}
              />
            </Card>
          )}
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
        onOk={handleRequestRefill}
        confirmLoading={refillSubmitting}
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
