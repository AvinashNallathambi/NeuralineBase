import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  List,
  Avatar,
  Tag,
  Space,
  Statistic,
  Tabs,
  Badge,
  Descriptions,
  Table,
  Divider,
  Input,
  Form,
  Modal,
  DatePicker,
  Select,
  message,
  Timeline,
} from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  MessageOutlined,
  MedicineBoxOutlined,
  FileTextOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  BellOutlined,
  HeartOutlined,
  ReadOutlined,
  PlusOutlined,
  EditOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  ExperimentOutlined,
  SafetyOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import type { Appointment, Message as MessageType, Prescription, LabOrder } from '../../types';
import { useAppointmentStore, useMessageStore, usePrescriptionStore, useLabStore, usePatientStore, useEncounterStore } from '../../store/dataStore';

const { Title, Text, Paragraph } = Typography;

const documents = [
  { id: 'doc1', name: 'Lab Results - HbA1c & Metabolic Panel', type: 'Lab Report', date: '2024-12-17', size: '245 KB' },
  { id: 'doc2', name: 'Visit Summary - Dec 18, 2024', type: 'Visit Summary', date: '2024-12-18', size: '128 KB' },
  { id: 'doc3', name: 'Prescription Summary', type: 'Prescription', date: '2024-12-18', size: '64 KB' },
  { id: 'doc4', name: 'Insurance EOB - BCBS', type: 'Insurance', date: '2024-12-15', size: '312 KB' },
];

const healthArticles = [
  { id: 'ha1', title: 'Managing Type 2 Diabetes: A Comprehensive Guide', category: 'Diabetes', readTime: '8 min' },
  { id: 'ha2', title: 'Heart-Healthy Eating: Foods That Lower Blood Pressure', category: 'Nutrition', readTime: '5 min' },
  { id: 'ha3', title: 'Understanding Your A1C Results', category: 'Lab Results', readTime: '4 min' },
  { id: 'ha4', title: 'Benefits of Daily Walking for Chronic Disease Management', category: 'Exercise', readTime: '6 min' },
  { id: 'ha5', title: 'Medication Adherence: Tips for Staying on Track', category: 'Medications', readTime: '3 min' },
];

// ─── Component ──────────────────────────────────────────────────────────────────
const PatientPortalPage: React.FC = () => {
  const { appointments: mockAppointments } = useAppointmentStore();
  const { messages: mockMessages } = useMessageStore();
  const { prescriptions: mockPrescriptions } = usePrescriptionStore();
  const { labOrders: mockLabOrders } = useLabStore();
  const { patients: mockPatients } = usePatientStore();
  const { encounters: mockEncounters } = useEncounterStore();

  // ─── Simulated patient context ──────────────────────────────────────────────────
  const currentPatient = mockPatients[0]; // John Smith
  const patientAppointments = mockAppointments.filter((a) => a.patientId === currentPatient.id);
  const upcomingAppointments = patientAppointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'confirmed'
  );
  const patientMessages = mockMessages.filter(
    (m) => m.recipientId === currentPatient.id || m.senderId === currentPatient.id
  );
  const unreadMessages = patientMessages.filter((m) => !m.isRead && m.recipientId === currentPatient.id);
  const patientPrescriptions = mockPrescriptions.filter((p) => p.patientId === currentPatient.id);
  const patientLabs = mockLabOrders.filter((l) => l.patientId === currentPatient.id);
  const patientEncounters = mockEncounters.filter((e) => e.patientId === currentPatient.id);

  const [requestApptVisible, setRequestApptVisible] = useState(false);
  const [refillModalVisible, setRefillModalVisible] = useState(false);

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'green';
      case 'scheduled': return 'blue';
      case 'completed': return 'default';
      case 'cancelled': return 'red';
      default: return 'default';
    }
  };

  // ─── Records sub-tabs ────────────────────────────────────────────────────────
  const encounterItems = (
    <List
      dataSource={patientEncounters}
      renderItem={(enc) => (
        <List.Item>
          <List.Item.Meta
            avatar={<Avatar icon={enc.type === 'telehealth' ? <VideoCameraOutlined /> : <FileTextOutlined />} style={{ backgroundColor: enc.type === 'telehealth' ? '#36CFC9' : '#0D7C8A' }} />}
            title={
              <Space>
                <Text strong>{enc.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</Text>
                <Tag color={enc.status === 'completed' ? 'green' : 'blue'}>{enc.status}</Tag>
              </Space>
            }
            description={
              <div>
                <Text type="secondary">{new Date(enc.startTime).toLocaleDateString()} at {new Date(enc.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                {enc.soapNote && (
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Assessment: {enc.soapNote.assessment}</Text>
                  </div>
                )}
              </div>
            }
          />
        </List.Item>
      )}
      locale={{ emptyText: 'No recent encounters' }}
    />
  );

  const labResultItems = (
    <List
      dataSource={patientLabs}
      renderItem={(lab) => (
        <List.Item
          actions={[
            <Button type="link" size="small" icon={<DownloadOutlined />}>Download</Button>,
          ]}
        >
          <List.Item.Meta
            avatar={<Avatar icon={<ExperimentOutlined />} style={{ backgroundColor: '#B37FEB' }} />}
            title={
              <Space>
                <Text strong>{lab.tests.map((t) => t.name).join(', ')}</Text>
                <Tag color={lab.status === 'completed' ? 'green' : 'orange'}>{lab.status}</Tag>
              </Space>
            }
            description={
              <div>
                <Text type="secondary">Ordered: {lab.orderedDate}</Text>
                {lab.completedDate && <Text type="secondary"> | Completed: {lab.completedDate}</Text>}
                {lab.tests.some((t) => t.abnormalFlag) && (
                  <Tag color="red" style={{ marginLeft: 8 }}>Has Abnormal Values</Tag>
                )}
              </div>
            }
          />
        </List.Item>
      )}
      locale={{ emptyText: 'No lab results' }}
    />
  );

  const prescriptionItems = (
    <List
      dataSource={patientPrescriptions}
      renderItem={(rx) => (
        <List.Item
          actions={[
            <Button size="small" icon={<ReloadOutlined />} onClick={() => { setRefillModalVisible(true); }} style={{ borderRadius: 6 }}>
              Request Refill
            </Button>,
          ]}
        >
          <List.Item.Meta
            avatar={<Avatar icon={<MedicineBoxOutlined />} style={{ backgroundColor: '#FF7A45' }} />}
            title={
              <Space>
                <Text strong>{rx.medications.map((m) => m.medication).join(', ')}</Text>
                <Tag color={rx.status === 'active' ? 'green' : 'default'}>{rx.status}</Tag>
              </Space>
            }
            description={
              <div>
                <Text type="secondary">Prescribed: {rx.prescribedDate} by {rx.providerName}</Text>
                {rx.pharmacy && <Text type="secondary"> | Pharmacy: {rx.pharmacy}</Text>}
              </div>
            }
          />
        </List.Item>
      )}
      locale={{ emptyText: 'No prescriptions' }}
    />
  );

  const recordsTabs = [
    { key: 'encounters', label: <span><FileTextOutlined style={{ marginRight: 4 }} />Recent Encounters</span>, children: encounterItems },
    { key: 'labs', label: <span><ExperimentOutlined style={{ marginRight: 4 }} />Lab Results</span>, children: labResultItems },
    { key: 'prescriptions', label: <span><MedicineBoxOutlined style={{ marginRight: 4 }} />Prescriptions</span>, children: prescriptionItems },
  ];

  return (
    <div>
      {/* Patient Portal Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0D7C8A 0%, #36CFC9 100%)',
          borderRadius: 12,
          padding: '20px 28px',
          marginBottom: 24,
          color: '#fff',
        }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Space size={16} align="center">
              <Avatar size={56} icon={<UserOutlined />} style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.5)' }} />
              <div>
                <Title level={3} style={{ margin: 0, color: '#fff' }}>
                  Welcome back, {currentPatient.firstName}!
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                  Patient Portal | MRN: {currentPatient.mrn}
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Tag color="rgba(255,255,255,0.2)" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 13, padding: '4px 12px' }}>
              <SafetyOutlined style={{ marginRight: 4 }} />
              Patient Portal View
            </Tag>
          </Col>
        </Row>
      </div>

      {/* Quick Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Upcoming Appointments"
              value={upcomingAppointments.length}
              prefix={<CalendarOutlined style={{ color: '#0D7C8A' }} />}
              valueStyle={{ color: '#0D7C8A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Unread Messages"
              value={unreadMessages.length}
              prefix={<MessageOutlined style={{ color: '#FF7A45' }} />}
              valueStyle={{ color: '#FF7A45' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Active Prescriptions"
              value={patientPrescriptions.filter((p) => p.status === 'active').length}
              prefix={<MedicineBoxOutlined style={{ color: '#B37FEB' }} />}
              valueStyle={{ color: '#B37FEB' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Left Column */}
        <Col xs={24} lg={16}>
          {/* My Appointments */}
          <Card
            title={
              <Space>
                <CalendarOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>My Appointments</Text>
              </Space>
            }
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 12 }}
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setRequestApptVisible(true)} style={{ borderRadius: 8 }}>
                Request Appointment
              </Button>
            }
          >
            <List
              dataSource={patientAppointments.filter((a) => a.status !== 'cancelled')}
              renderItem={(apt) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={apt.isTelehealth ? <VideoCameraOutlined /> : <CalendarOutlined />}
                        style={{ backgroundColor: apt.isTelehealth ? '#36CFC9' : '#0D7C8A' }}
                      />
                    }
                    title={
                      <Space>
                        <Text strong>{apt.reason}</Text>
                        <Tag color={statusColor(apt.status)}>{apt.status}</Tag>
                        {apt.isTelehealth && <Tag color="cyan">Telehealth</Tag>}
                      </Space>
                    }
                    description={
                      <Space split={<Divider type="vertical" />}>
                        <Text type="secondary">
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          {new Date(apt.startTime).toLocaleDateString()} at{' '}
                          {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text type="secondary">{apt.providerName}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: 'No appointments' }}
            />
          </Card>

          {/* My Records */}
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>My Records</Text>
              </Space>
            }
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 12 }}
          >
            <Tabs items={recordsTabs} defaultActiveKey="encounters" />
          </Card>

          {/* Documents */}
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>My Documents</Text>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <List
              dataSource={documents}
              renderItem={(doc) => (
                <List.Item
                  actions={[
                    <Button type="link" icon={<DownloadOutlined />} size="small">Download</Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#69C0FF' }} />}
                    title={doc.name}
                    description={
                      <Space split={<Divider type="vertical" />}>
                        <Tag>{doc.type}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>{doc.date}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{doc.size}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Right Column */}
        <Col xs={24} lg={8}>
          {/* Messages */}
          <Card
            title={
              <Space>
                <MessageOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>Messages</Text>
                {unreadMessages.length > 0 && <Badge count={unreadMessages.length} />}
              </Space>
            }
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 12 }}
          >
            <List
              dataSource={patientMessages.slice(0, 5)}
              renderItem={(msg) => {
                const isUnread = !msg.isRead && msg.recipientId === currentPatient.id;
                return (
                  <List.Item style={{ background: isUnread ? '#f0faf9' : 'transparent', padding: '8px 12px', borderRadius: 8, marginBottom: 4 }}>
                    <List.Item.Meta
                      avatar={
                        <Badge dot={isUnread}>
                          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: msg.senderId.startsWith('u') ? '#0D7C8A' : '#B37FEB' }} />
                        </Badge>
                      }
                      title={
                        <Space>
                          <Text strong={isUnread} style={{ fontSize: 13 }}>{msg.senderName}</Text>
                          {msg.priority === 'urgent' && <Tag color="red" style={{ fontSize: 10 }}>Urgent</Tag>}
                        </Space>
                      }
                      description={
                        <div>
                          <Text style={{ fontSize: 12, fontWeight: isUnread ? 600 : 400 }}>{msg.subject}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {new Date(msg.createdAt).toLocaleDateString()} at{' '}
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
              locale={{ emptyText: 'No messages' }}
            />
          </Card>

          {/* Quick Actions */}
          <Card
            title={<Text strong>Quick Actions</Text>}
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 12 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Button block icon={<PlusOutlined />} onClick={() => setRequestApptVisible(true)} style={{ borderRadius: 8, textAlign: 'left' }}>
                Request Appointment
              </Button>
              <Button block icon={<ReloadOutlined />} onClick={() => setRefillModalVisible(true)} style={{ borderRadius: 8, textAlign: 'left' }}>
                Request Prescription Refill
              </Button>
              <Button block icon={<MessageOutlined />} style={{ borderRadius: 8, textAlign: 'left' }}>
                Send Message to Provider
              </Button>
              <Button block icon={<DownloadOutlined />} style={{ borderRadius: 8, textAlign: 'left' }}>
                Download Health Summary
              </Button>
            </Space>
          </Card>

          {/* Profile Section */}
          <Card
            title={
              <Space>
                <IdcardOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>My Profile</Text>
              </Space>
            }
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 12 }}
            extra={<Button type="text" size="small" icon={<EditOutlined />}>Edit</Button>}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label={<><UserOutlined /> Name</>}>{currentPatient.firstName} {currentPatient.lastName}</Descriptions.Item>
              <Descriptions.Item label={<><CalendarOutlined /> DOB</>}>{currentPatient.dateOfBirth}</Descriptions.Item>
              <Descriptions.Item label={<><PhoneOutlined /> Phone</>}>{currentPatient.phone}</Descriptions.Item>
              <Descriptions.Item label={<><MailOutlined /> Email</>}>{currentPatient.email}</Descriptions.Item>
              <Descriptions.Item label={<><EnvironmentOutlined /> Address</>}>
                {currentPatient.address.street}, {currentPatient.address.city}, {currentPatient.address.state}
              </Descriptions.Item>
              <Descriptions.Item label={<><HeartOutlined /> Blood Type</>}>{currentPatient.bloodType}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Educational Resources */}
          <Card
            title={
              <Space>
                <ReadOutlined style={{ color: '#0D7C8A' }} />
                <Text strong>Health Resources</Text>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <List
              dataSource={healthArticles}
              renderItem={(article) => (
                <List.Item style={{ padding: '8px 0' }}>
                  <List.Item.Meta
                    title={
                      <Button type="link" style={{ padding: 0, height: 'auto', fontSize: 13, textAlign: 'left', whiteSpace: 'normal' }}>
                        {article.title}
                      </Button>
                    }
                    description={
                      <Space>
                        <Tag color="blue" style={{ fontSize: 10 }}>{article.category}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <ClockCircleOutlined style={{ marginRight: 2 }} />
                          {article.readTime} read
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Request Appointment Modal */}
      <Modal
        title="Request an Appointment"
        open={requestApptVisible}
        onCancel={() => setRequestApptVisible(false)}
        onOk={() => { setRequestApptVisible(false); message.success('Appointment request submitted! We will contact you to confirm.'); }}
        okText="Submit Request"
      >
        <Form layout="vertical">
          <Form.Item label="Reason for Visit" rules={[{ required: true }]}>
            <Input placeholder="e.g., Follow-up visit, new concern..." />
          </Form.Item>
          <Form.Item label="Preferred Provider">
            <Select
              placeholder="Select provider"
              options={[
                { label: 'Dr. Sarah Chen - Internal Medicine', value: 'u1' },
                { label: 'Dr. James Wilson - Cardiology', value: 'u2' },
                { label: 'Dr. Priya Patel - Pediatrics', value: 'u7' },
                { label: 'No Preference', value: 'any' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Preferred Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Visit Type">
            <Select
              placeholder="Select visit type"
              options={[
                { label: 'In-Person Visit', value: 'in_person' },
                { label: 'Telehealth / Video Visit', value: 'telehealth' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Additional Notes">
            <Input.TextArea rows={3} placeholder="Any additional information for the provider..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Prescription Refill Modal */}
      <Modal
        title="Request Prescription Refill"
        open={refillModalVisible}
        onCancel={() => setRefillModalVisible(false)}
        onOk={() => { setRefillModalVisible(false); message.success('Refill request sent to your provider. You will be notified once approved.'); }}
        okText="Submit Refill Request"
      >
        <Form layout="vertical">
          <Form.Item label="Select Medication" rules={[{ required: true }]}>
            <Select
              placeholder="Choose a medication"
              options={
                patientPrescriptions
                  .flatMap((rx) => rx.medications)
                  .map((med) => ({ label: `${med.medication} - ${med.dosage}`, value: med.id }))
              }
            />
          </Form.Item>
          <Form.Item label="Pharmacy">
            <Select
              defaultValue="walgreens"
              options={[
                { label: 'Walgreens - Springfield Main St', value: 'walgreens' },
                { label: 'CVS Pharmacy - Elm Ave', value: 'cvs' },
                { label: 'Other', value: 'other' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Notes">
            <Input.TextArea rows={2} placeholder="Any notes for your provider..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PatientPortalPage;
