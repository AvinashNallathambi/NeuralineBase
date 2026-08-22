import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  Tag,
  Avatar,
  List,
  Space,
  Badge,
  Statistic,
  Table,
  Tooltip,
  message,
  Divider,
  Spin,
} from 'antd';
import {
  VideoCameraOutlined,
  PhoneOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  VideoCameraAddOutlined,
  FileTextOutlined,
  EyeOutlined,
  CalendarOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { Appointment } from '../../types';
import { useAppointmentStore } from '../../store/dataStore';
import { telemedicineService, TelemedicineSession } from '../../services/telemedicineService';

const { Title, Text } = Typography;

// ─── Component ──────────────────────────────────────────────────────────────────
const TelemedicinePage: React.FC = () => {
  const navigate = useNavigate();
  const { appointments } = useAppointmentStore();

  // ─── Helper data from appointment store ────────────────────────────────────────
  const telehealthAppointments = appointments.filter((a) => a.isTelehealth);
  const todayTelehealthAppointments = telehealthAppointments.filter(
    (a) => a.status === 'confirmed' || a.status === 'scheduled'
  );
  const pastVirtualVisits = telehealthAppointments.filter(
    (a) => a.status === 'completed'
  );

  // ─── Real telemedicine sessions from API ───────────────────────────────────────
  const [sessions, setSessions] = useState<TelemedicineSession[]>([]);
  const [analytics, setAnalytics] = useState<{
    totalSessions: number;
    completedSessions: number;
    averageDurationMinutes: number;
    noShowCount: number;
    cancelledCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, analyticsRes] = await Promise.allSettled([
        telemedicineService.listSessions({ limit: 50 }),
        telemedicineService.getAnalytics(),
      ]);

      if (sessionsRes.status === 'fulfilled') {
        setSessions(sessionsRes.value.data);
      }
      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value);
      }
    } catch (err) {
      // Non-fatal — dashboard still shows appointment data
      console.error('Failed to load telemedicine data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Derive waiting room from sessions with status "waiting" ───────────────────
  const waitingRoomSessions = sessions.filter((s) => s.status === 'waiting');
  const inProgressSessions = sessions.filter((s) => s.status === 'in_progress');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  // ─── Join call: find or create session, then navigate to call page ─────────────
  const handleJoinCall = async (appointment: Appointment) => {
    if (!appointment.id) {
      message.error('Appointment ID missing — cannot join call.');
      return;
    }
    setJoiningId(appointment.id);
    try {
      const session = await telemedicineService.findOrCreateForAppointment(appointment.id);
      message.success(`Joining call with ${appointment.patientName}...`);
      navigate(`/telemedicine/${session.id}`);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Unknown error';
      message.error(`Failed to join call: ${errMsg}`);
    } finally {
      setJoiningId(null);
    }
  };

  // ─── Join an existing in-progress or waiting session ───────────────────────────
  const handleJoinExistingSession = (sessionId: string) => {
    navigate(`/telemedicine/${sessionId}`);
  };

  // ─── Admit patient from waiting room (marks as joined) ─────────────────────────
  const handleAdmitPatient = (session: TelemedicineSession) => {
    navigate(`/telemedicine/${session.id}`);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'green';
      case 'scheduled': return 'blue';
      case 'in_progress': return 'orange';
      case 'completed': return 'default';
      case 'cancelled': return 'red';
      case 'waiting': return 'gold';
      default: return 'default';
    }
  };

  const sessionStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'blue';
      case 'waiting': return 'gold';
      case 'in_progress': return 'orange';
      case 'completed': return 'green';
      case 'cancelled': return 'red';
      case 'no_show': return 'default';
      default: return 'default';
    }
  };

  const pastVisitColumns = [
    { title: 'Date', dataIndex: 'startTime', key: 'date', render: (v: string) => new Date(v).toLocaleDateString() },
    { title: 'Patient', dataIndex: 'patientName', key: 'patient' },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: unknown, record: Appointment) => {
        if (!record.endTime) return '-';
        const mins = Math.round((new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 60000);
        return `${mins} min`;
      },
    },
    {
      title: 'Notes',
      key: 'notes',
      render: (_: unknown, record: Appointment) =>
        record.notes ? (
          <Tooltip title={record.notes}>
            <Button type="link" size="small" icon={<EyeOutlined />}>View</Button>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  const completedSessionColumns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'date',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: 'Patient ID',
      dataIndex: 'patientId',
      key: 'patient',
      render: (v: string) => <Text code>{v?.substring(0, 8)}</Text>,
    },
    {
      title: 'Duration',
      dataIndex: 'durationMinutes',
      key: 'duration',
      render: (v: number | null) => (v ? `${v} min` : '-'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={sessionStatusColor(v)}>{v.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: TelemedicineSession) =>
        record.soapNote?.subjective ? (
          <Tooltip title="SOAP note generated">
            <Button type="link" size="small" icon={<FileTextOutlined />}>SOAP</Button>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <VideoCameraOutlined style={{ marginRight: 12, color: '#0D7C8A' }} />
            Telemedicine
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<VideoCameraAddOutlined />}
              style={{ borderRadius: 8 }}
              onClick={() => message.info('Select a telehealth appointment below to start a visit.')}
            >
              Start Virtual Visit
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Virtual Visits Today"
              value={todayTelehealthAppointments.length}
              prefix={<VideoCameraOutlined style={{ color: '#0D7C8A' }} />}
              valueStyle={{ color: '#0D7C8A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Average Duration"
              value={analytics?.averageDurationMinutes ?? 0}
              suffix="min"
              prefix={<FieldTimeOutlined style={{ color: '#36CFC9' }} />}
              valueStyle={{ color: '#36CFC9' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Patients Waiting"
              value={waitingRoomSessions.length}
              prefix={<TeamOutlined style={{ color: '#FF7A45' }} />}
              valueStyle={{ color: '#FF7A45' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Active Sessions Banner */}
      {inProgressSessions.length > 0 && (
        <Card
          bordered={false}
          style={{ marginBottom: 16, borderRadius: 12, borderColor: '#ff7a45' }}
          bodyStyle={{ padding: '12px 24px' }}
        >
          <Row align="middle" justify="space-between">
            <Col>
              <Space>
                <Badge status="processing" color="red" />
                <Text strong>{inProgressSessions.length} session(s) in progress</Text>
              </Space>
            </Col>
            <Col>
              <Space>
                {inProgressSessions.slice(0, 3).map((s) => (
                  <Button
                    key={s.id}
                    type="primary"
                    icon={<VideoCameraOutlined />}
                    onClick={() => handleJoinExistingSession(s.id)}
                  >
                    Rejoin
                  </Button>
                ))}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {/* Left Column: Appointments & Past Visits */}
        <Col xs={24} lg={16}>
          <Spin spinning={loading}>
            {/* Today's Virtual Appointments */}
            <Card
              title={
                <Space>
                  <CalendarOutlined style={{ color: '#0D7C8A' }} />
                  <Text strong>Today's Virtual Appointments</Text>
                  <Badge count={todayTelehealthAppointments.length} style={{ backgroundColor: '#0D7C8A' }} />
                </Space>
              }
              bordered={false}
              style={{ marginBottom: 16, borderRadius: 12 }}
            >
              <List
                dataSource={todayTelehealthAppointments}
                renderItem={(apt) => (
                  <List.Item
                    actions={[
                      <Button
                        type="primary"
                        icon={<VideoCameraOutlined />}
                        onClick={() => handleJoinCall(apt)}
                        loading={joiningId === apt.id}
                        style={{ borderRadius: 8 }}
                      >
                        Join Call
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#0D7C8A' }} />}
                      title={
                        <Space>
                          <Text strong>{apt.patientName}</Text>
                          <Tag color={statusColor(apt.status)}>{apt.status}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {new Date(apt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text type="secondary">{apt.reason}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: 'No virtual appointments today' }}
              />
            </Card>

            {/* Past Virtual Visits (from appointments) */}
            <Card
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#0D7C8A' }} />
                  <Text strong>Past Virtual Visits</Text>
                </Space>
              }
              bordered={false}
              style={{ marginBottom: 16, borderRadius: 12 }}
            >
              <Table
                dataSource={pastVirtualVisits}
                columns={pastVisitColumns}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
                locale={{ emptyText: 'No past virtual visits' }}
              />
            </Card>

            {/* Completed Telemedicine Sessions (from API) */}
            {completedSessions.length > 0 && (
              <Card
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text strong>Completed Sessions</Text>
                    <Badge count={completedSessions.length} style={{ backgroundColor: '#52c41a' }} />
                  </Space>
                }
                bordered={false}
                style={{ borderRadius: 12 }}
              >
                <Table
                  dataSource={completedSessions}
                  columns={completedSessionColumns}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </Card>
            )}
          </Spin>
        </Col>

        {/* Right Column: Waiting Room */}
        <Col xs={24} lg={8}>
          {/* Waiting Room — real sessions with status "waiting" */}
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: '#FF7A45' }} />
                <Text strong>Waiting Room</Text>
                <Badge count={waitingRoomSessions.length} style={{ backgroundColor: '#FF7A45' }} />
              </Space>
            }
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 12 }}
          >
            <List
              dataSource={waitingRoomSessions}
              renderItem={(session) => {
                const patientParticipant = session.participants?.find((p) => p.role === 'patient');
                return (
                  <List.Item
                    actions={[
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleAdmitPatient(session)}
                        style={{ borderRadius: 6, background: '#52c41a', borderColor: '#52c41a' }}
                      >
                        Admit
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#B37FEB' }} />}
                      title={patientParticipant?.name || `Patient ${session.patientId?.substring(0, 8)}`}
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            Waiting since{' '}
                            {session.startedAt
                              ? new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Session: {session.id.substring(0, 8)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
              locale={{ emptyText: 'No patients waiting' }}
            />
          </Card>

          {/* Session Stats */}
          {analytics && (
            <Card
              title={
                <Space>
                  <FieldTimeOutlined style={{ color: '#0D7C8A' }} />
                  <Text strong>Session Statistics</Text>
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12 }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Total Sessions</Text>
                  <Text strong>{analytics.totalSessions}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Completed</Text>
                  <Text strong style={{ color: '#52c41a' }}>{analytics.completedSessions}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">No-Shows</Text>
                  <Text strong style={{ color: '#faad14' }}>{analytics.noShowCount}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Cancelled</Text>
                  <Text strong style={{ color: '#ff4d4f' }}>{analytics.cancelledCount}</Text>
                </div>
                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Avg Duration</Text>
                  <Text strong>{analytics.averageDurationMinutes} min</Text>
                </div>
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default TelemedicinePage;
