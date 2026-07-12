import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  List,
  Tag,
  Button,
  Spin,
  Empty,
  Space,
  Progress,
} from 'antd';
import {
  CalendarOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  DollarOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import patientPortalService from '../../services/patientPortalService';
import patientAuthService from '../../services/patientAuthService';
import type { PatientDashboard } from '../../services/patientAuthService';

const { Title, Text } = Typography;

const PortalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const patient = patientAuthService.getCurrentPatient();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await patientPortalService.getDashboard();
      setDashboard(data);
    } catch (err) {
      // Silent fail — dashboard shows empty state
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    scheduled: 'blue',
    confirmed: 'green',
    completed: 'default',
    cancelled: 'red',
    checked_in: 'cyan',
    in_progress: 'processing',
  };

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, #0D7C8A 0%, #064E57 100%)',
          borderRadius: 16,
          padding: '32px',
          marginBottom: 24,
          color: '#fff',
        }}
      >
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          Welcome, {patient?.firstName || 'Patient'}
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
          {patient?.email}
          {patient?.mrn ? ` · MRN: ${patient.mrn}` : ''}
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Upcoming Appointments"
              value={dashboard?.upcomingAppointments || 0}
              prefix={<CalendarOutlined style={{ color: '#0D7C8A' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Active Prescriptions"
              value={dashboard?.activePrescriptions || 0}
              prefix={<MedicineBoxOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Pending Lab Results"
              value={dashboard?.pendingLabResults || 0}
              prefix={<ExperimentOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Outstanding Balance"
              value={dashboard?.outstandingBalance || 0}
              prefix={<DollarOutlined style={{ color: '#cf1322' }} />}
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title={<><CalendarOutlined /> Upcoming Appointments</>}
            extra={<Button type="link" onClick={() => navigate('/portal/appointments')}>View All</Button>}
          >
            {dashboard?.recentAppointments?.length ? (
              <List
                dataSource={dashboard.recentAppointments.filter(
                  (a) => a.status === 'scheduled' || a.status === 'confirmed',
                )}
                renderItem={(appt) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<CalendarOutlined style={{ fontSize: 24, color: '#0D7C8A' }} />}
                      title={
                        <Space>
                          <Text strong>{appt.reasonForVisit || appt.appointmentType}</Text>
                          <Tag color={statusColors[appt.status]}>{appt.status}</Tag>
                          {appt.isTelehealth && <Tag color="purple">Telehealth</Tag>}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">
                            <ClockCircleOutlined /> {appt.startTime ? new Date(appt.startTime).toLocaleString() : 'N/A'}
                          </Text>
                          {appt.providerName && <Text type="secondary">Provider: {appt.providerName}</Text>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No upcoming appointments" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<><DollarOutlined /> Recent Invoices</>}
            extra={<Button type="link" onClick={() => navigate('/portal/billing')}>View All</Button>}
          >
            {dashboard?.recentInvoices?.length ? (
              <List
                dataSource={dashboard.recentInvoices}
                renderItem={(inv) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>Invoice #{inv.invoiceNumber || inv.id.slice(0, 8)}</Text>
                          <Tag color={inv.status === 'paid' ? 'green' : inv.status === 'overdue' ? 'red' : 'gold'}>
                            {inv.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space>
                          <Text>Amount: ${Number(inv.totalAmount || 0).toFixed(2)}</Text>
                          {inv.balanceDue > 0 && (
                            <Text type="danger">Balance: ${Number(inv.balanceDue).toFixed(2)}</Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No invoices" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title={<><ExperimentOutlined /> Recent Lab Results</>}
            extra={<Button type="link" onClick={() => navigate('/portal/lab-results')}>View All</Button>}
          >
            {dashboard?.recentLabs?.length ? (
              <List
                dataSource={dashboard.recentLabs}
                renderItem={(lab) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{lab.patientName || 'Lab Order'}</Text>
                          <Tag color={lab.status === 'completed' ? 'green' : lab.status === 'resulted' ? 'blue' : 'default'}>
                            {lab.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Text type="secondary">
                          Ordered: {lab.orderedDate ? new Date(lab.orderedDate).toLocaleDateString() : 'N/A'}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No lab results" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<><MedicineBoxOutlined /> Active Prescriptions</>}
            extra={<Button type="link" onClick={() => navigate('/portal/prescriptions')}>View All</Button>}
          >
            {dashboard?.recentPrescriptions?.filter((p) => p.status === 'active')?.length ? (
              <List
                dataSource={dashboard.recentPrescriptions.filter((p) => p.status === 'active')}
                renderItem={(rx) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Text strong>{rx.medications?.map((m: any) => m.name).join(', ') || 'Prescription'}</Text>}
                      description={
                        <Space>
                          <Text type="secondary">Status: {rx.status}</Text>
                          {rx.pharmacy && <Text type="secondary">Pharmacy: {rx.pharmacy}</Text>}
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
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title={<><FileTextOutlined /> Insurance EOBs</>}>
            {dashboard?.recentEobs?.length ? (
              <List
                dataSource={dashboard.recentEobs}
                renderItem={(eob) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>EOB - {eob.payerName || 'Insurance'}</Text>
                          <Tag>{eob.claimStatus || eob.status}</Tag>
                        </Space>
                      }
                      description={
                        <Space>
                          <Text type="secondary">Service: {eob.serviceDate ? new Date(eob.serviceDate).toLocaleDateString() : 'N/A'}</Text>
                          <Text type="secondary">Billed: ${Number(eob.billedAmount || 0).toFixed(2)}</Text>
                          <Text type="secondary">Paid: ${Number(eob.paidAmount || 0).toFixed(2)}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No EOBs available" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PortalDashboardPage;
