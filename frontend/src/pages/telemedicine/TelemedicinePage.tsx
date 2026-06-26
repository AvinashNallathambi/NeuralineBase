import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  Tag,
  Avatar,
  List,
  Input,
  Space,
  Badge,
  Statistic,
  Table,
  Tooltip,
  Upload,
  message,
  Divider,
} from 'antd';
import {
  VideoCameraOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  DesktopOutlined,
  PhoneOutlined,
  SendOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  VideoCameraAddOutlined,
  ExpandOutlined,
  MessageOutlined,
  FileTextOutlined,
  EyeOutlined,
  CameraOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { Appointment, Message as MessageType } from '../../types';
import { useAppointmentStore, useMessageStore } from '../../store/dataStore';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;

const waitingRoomPatients = [
  { id: 'w1', name: 'John Smith', waitingSince: '8:52 AM', reason: 'Diabetes follow-up', avatar: undefined },
  { id: 'w2', name: 'Maria Garcia', waitingSince: '9:05 AM', reason: 'Asthma medication review', avatar: undefined },
  { id: 'w3', name: 'William Davis', waitingSince: '9:12 AM', reason: 'COPD management', avatar: undefined },
];

const chatMessages = [
  { id: 'c1', sender: 'Dr. Sarah Chen', text: 'Good morning, John. How have you been feeling since our last visit?', time: '9:01 AM', isDoctor: true },
  { id: 'c2', sender: 'John Smith', text: 'Good morning, Dr. Chen! I\'ve been doing well. My blood sugar has been more stable.', time: '9:02 AM', isDoctor: false },
  { id: 'c3', sender: 'Dr. Sarah Chen', text: 'That\'s great to hear. Have you been following the new meal plan?', time: '9:03 AM', isDoctor: true },
  { id: 'c4', sender: 'John Smith', text: 'Yes, and I\'ve been walking 30 minutes every day too.', time: '9:04 AM', isDoctor: false },
  { id: 'c5', sender: 'Dr. Sarah Chen', text: 'Excellent progress! Let me review your latest lab results with you.', time: '9:05 AM', isDoctor: true },
];

// ─── Component ──────────────────────────────────────────────────────────────────
const TelemedicinePage: React.FC = () => {
  const { appointments: mockAppointments } = useAppointmentStore();
  const { messages: mockMessages } = useMessageStore();

  // ─── Helper data ────────────────────────────────────────────────────────────────
  const telehealthAppointments = mockAppointments.filter((a) => a.isTelehealth);
  const todayTelehealthAppointments = telehealthAppointments.filter(
    (a) => a.status === 'confirmed' || a.status === 'scheduled'
  );
  const pastVirtualVisits = telehealthAppointments.filter(
    (a) => a.status === 'completed'
  );

  const [activeSession, setActiveSession] = useState<Appointment | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [localChatMessages, setLocalChatMessages] = useState(chatMessages);
  const [waitingRoom, setWaitingRoom] = useState(waitingRoomPatients);

  const handleJoinCall = (appointment: Appointment) => {
    setActiveSession(appointment);
    message.success(`Joining call with ${appointment.patientName}...`);
  };

  const handleEndCall = () => {
    message.info('Call ended.');
    setActiveSession(null);
  };

  const handleAdmitPatient = (patientId: string) => {
    setWaitingRoom((prev) => prev.filter((p) => p.id !== patientId));
    message.success('Patient admitted to the visit.');
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setLocalChatMessages((prev) => [
      ...prev,
      {
        id: `c${Date.now()}`,
        sender: 'Dr. Sarah Chen',
        text: chatInput,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDoctor: true,
      },
    ]);
    setChatInput('');
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'green';
      case 'scheduled': return 'blue';
      case 'in_progress': return 'orange';
      case 'completed': return 'default';
      case 'cancelled': return 'red';
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

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            <VideoCameraOutlined style={{ marginRight: 12, color: '#0D7C8A' }} />
            Telemedicine
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            size="large"
            icon={<VideoCameraAddOutlined />}
            style={{ borderRadius: 8 }}
          >
            Start Virtual Visit
          </Button>
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
              value={22}
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
              value={waitingRoom.length}
              prefix={<TeamOutlined style={{ color: '#FF7A45' }} />}
              valueStyle={{ color: '#FF7A45' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Left Column: Video / Appointments */}
        <Col xs={24} lg={16}>
          {/* Active Session */}
          {activeSession ? (
            <Card
              title={
                <Space>
                  <Badge status="processing" color="red" />
                  <Text strong>Video Consultation</Text>
                  <Tag color="red">LIVE</Tag>
                </Space>
              }
              bordered={false}
              style={{ marginBottom: 16, borderRadius: 12 }}
              extra={
                <Button size="small" icon={<ExpandOutlined />}>
                  Full Screen
                </Button>
              }
            >
              <Row gutter={16}>
                <Col xs={24} md={18}>
                  {/* Video placeholder */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                      borderRadius: 12,
                      height: 380,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <CameraOutlined style={{ fontSize: 64, color: 'rgba(255,255,255,0.2)', marginBottom: 16 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
                      Video Feed Active
                    </Text>
                    {/* Self-view mini */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 16,
                        right: 16,
                        width: 140,
                        height: 100,
                        background: 'linear-gradient(135deg, #0D7C8A 0%, #36CFC9 100%)',
                        borderRadius: 8,
                        border: '2px solid rgba(255,255,255,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UserOutlined style={{ fontSize: 28, color: '#fff' }} />
                    </div>
                    {/* Duration badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: 6,
                        padding: '4px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Badge status="processing" color="red" />
                      <Text style={{ color: '#fff', fontSize: 13 }}>12:34</Text>
                    </div>
                  </div>
                  {/* Controls bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 12,
                      marginTop: 16,
                      padding: '12px 0',
                    }}
                  >
                    <Tooltip title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}>
                      <Button
                        shape="circle"
                        size="large"
                        type={isMicMuted ? 'primary' : 'default'}
                        danger={isMicMuted}
                        icon={isMicMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                        onClick={() => setIsMicMuted(!isMicMuted)}
                      />
                    </Tooltip>
                    <Tooltip title={isVideoMuted ? 'Turn On Camera' : 'Turn Off Camera'}>
                      <Button
                        shape="circle"
                        size="large"
                        type={isVideoMuted ? 'primary' : 'default'}
                        danger={isVideoMuted}
                        icon={<VideoCameraOutlined />}
                        onClick={() => setIsVideoMuted(!isVideoMuted)}
                      />
                    </Tooltip>
                    <Tooltip title="Share Screen">
                      <Button shape="circle" size="large" icon={<DesktopOutlined />} />
                    </Tooltip>
                    <Tooltip title="End Call">
                      <Button
                        shape="circle"
                        size="large"
                        type="primary"
                        danger
                        icon={<PhoneOutlined style={{ transform: 'rotate(135deg)' }} />}
                        onClick={handleEndCall}
                      />
                    </Tooltip>
                  </div>
                </Col>
                {/* Patient Info Side */}
                <Col xs={24} md={6}>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#0D7C8A' }} />
                    <Title level={5} style={{ margin: '8px 0 0' }}>{activeSession.patientName}</Title>
                    <Text type="secondary">{activeSession.reason}</Text>
                  </div>
                  <Divider style={{ margin: '12px 0' }} />
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Scheduled Time</Text>
                    <Text strong>{new Date(activeSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>Type</Text>
                    <Tag color="cyan">{activeSession.type}</Tag>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>Status</Text>
                    <Tag color="green">In Progress</Tag>
                  </Space>
                </Col>
              </Row>
            </Card>
          ) : null}

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
                      disabled={activeSession?.id === apt.id}
                      style={{ borderRadius: 8 }}
                    >
                      {activeSession?.id === apt.id ? 'In Call' : 'Join Call'}
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

          {/* Past Virtual Visits */}
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>Past Virtual Visits</Text>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Table
              dataSource={pastVirtualVisits}
              columns={pastVisitColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>

        {/* Right Column: Chat, Waiting Room, File Share */}
        <Col xs={24} lg={8}>
          {/* Chat Section */}
          <Card
            title={
              <Space>
                <MessageOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>Chat</Text>
              </Space>
            }
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 12 }}
            styles={{ body: { padding: 0 } }}
          >
            <div
              style={{
                height: 320,
                overflowY: 'auto',
                padding: 16,
                background: '#fafafa',
              }}
            >
              {localChatMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.isDoctor ? 'flex-end' : 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      background: msg.isDoctor ? '#0D7C8A' : '#fff',
                      color: msg.isDoctor ? '#fff' : '#1a2b3c',
                      padding: '8px 14px',
                      borderRadius: msg.isDoctor ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: msg.isDoctor ? 'rgba(255,255,255,0.7)' : '#8c8c8c',
                        display: 'block',
                        marginBottom: 2,
                      }}
                    >
                      {msg.sender} - {msg.time}
                    </Text>
                    <Text style={{ color: msg.isDoctor ? '#fff' : '#1a2b3c', fontSize: 13 }}>
                      {msg.text}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
              <Input
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={handleSendMessage}
                style={{ borderRadius: 8 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                style={{ borderRadius: 8 }}
              />
            </div>
          </Card>

          {/* Waiting Room */}
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: '#FF7A45' }} />
                <Text strong>Waiting Room</Text>
                <Badge count={waitingRoom.length} style={{ backgroundColor: '#FF7A45' }} />
              </Space>
            }
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 12 }}
          >
            <List
              dataSource={waitingRoom}
              renderItem={(patient) => (
                <List.Item
                  actions={[
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleAdmitPatient(patient.id)}
                      style={{ borderRadius: 6, background: '#52c41a', borderColor: '#52c41a' }}
                    >
                      Admit
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#B37FEB' }} />}
                    title={patient.name}
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          Waiting since {patient.waitingSince}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{patient.reason}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: 'No patients waiting' }}
            />
          </Card>

          {/* Quick Share */}
          <Card
            title={
              <Space>
                <InboxOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>Quick Share</Text>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Dragger
              multiple
              showUploadList
              accept=".pdf,.doc,.docx,.jpg,.png,.dicom"
              beforeUpload={() => {
                message.success('File ready to share with patient.');
                return false;
              }}
              style={{ borderRadius: 8 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#0D7C8A' }} />
              </p>
              <p className="ant-upload-text">
                Drag & drop files here to share during the call
              </p>
              <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                Supports PDF, DOC, JPG, PNG, DICOM
              </p>
            </Dragger>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TelemedicinePage;
