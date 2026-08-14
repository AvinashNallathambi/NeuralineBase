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
  DatePicker,
  Input,
  message,
  Spin,
  Empty,
  Space,
  Radio,
  TimePicker,
} from 'antd';
import {
  CalendarOutlined,
  PlusOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PortalAppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joiningApptId, setJoiningApptId] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getAppointments();
      setAppointments(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = async (date: any) => {
    if (!date) {
      setSlots([]);
      return;
    }
    const providerId = form.getFieldValue('providerId');
    if (!providerId) {
      message.warning('Please select a provider first');
      return;
    }
    setLoadingSlots(true);
    try {
      const dateStr = date.format('YYYY-MM-DD');
      const availableSlots = await patientPortalService.getAvailableSlots(providerId, dateStr);
      setSlots(availableSlots);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await patientPortalService.requestAppointment({
        providerId: values.providerId,
        appointmentType: values.appointmentType,
        reasonForVisit: values.reasonForVisit,
        preferredDate: values.preferredDate.format('YYYY-MM-DDTHH:mm:ss'),
        isTelehealth: values.isTelehealth === 'telehealth',
        notes: values.notes,
      });
      message.success('Appointment request submitted! We will confirm shortly.');
      setModalVisible(false);
      form.resetFields();
      setSlots([]);
      loadAppointments();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to request appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    scheduled: 'blue',
    confirmed: 'green',
    completed: 'default',
    cancelled: 'red',
    checked_in: 'cyan',
    in_progress: 'processing',
    no_show: 'orange',
  };

  const handleJoinTelehealth = async (appointmentId: string) => {
    setJoiningApptId(appointmentId);
    try {
      const session = await patientPortalService.findOrCreateTelemedicineSession(appointmentId);
      navigate(`/portal/video-visit/${session.id}`);
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || 'Failed to join telehealth visit. Please try again.',
      );
    } finally {
      setJoiningApptId(null);
    }
  };

  // Mock providers — in production this would come from an API
  const providers = [
    { id: 'prov-1', name: 'Dr. Sarah Chen' },
    { id: 'prov-2', name: 'Dr. Michael Rodriguez' },
    { id: 'prov-3', name: 'Dr. Emily Johnson' },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const upcoming = appointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'confirmed',
  );
  const past = appointments.filter(
    (a) => a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show',
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <CalendarOutlined /> My Appointments
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          Request Appointment
        </Button>
      </div>

      <Card title="Upcoming Appointments" style={{ marginBottom: 16 }}>
        {upcoming.length ? (
          <List
            dataSource={upcoming}
            renderItem={(appt) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<CalendarOutlined style={{ fontSize: 28, color: '#0D7C8A' }} />}
                  title={
                    <Space>
                      <Text strong>{appt.reasonForVisit || appt.appointmentType}</Text>
                      <Tag color={statusColors[appt.status]}>{appt.status}</Tag>
                      {appt.isTelehealth && <Tag color="purple"><VideoCameraOutlined /> Telehealth</Tag>}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">
                        <ClockCircleOutlined /> {appt.startTime ? new Date(appt.startTime).toLocaleString() : 'N/A'}
                      </Text>
                      {appt.providerName && <Text type="secondary">Provider: {appt.providerName}</Text>}
                      {appt.isTelehealth && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<VideoCameraOutlined />}
                          loading={joiningApptId === appt.id}
                          onClick={() => handleJoinTelehealth(appt.id)}
                          style={{ marginTop: 4 }}
                        >
                          Join Video Visit
                        </Button>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No upcoming appointments">
            <Button type="primary" onClick={() => setModalVisible(true)}>
              Request an Appointment
            </Button>
          </Empty>
        )}
      </Card>

      <Card title="Past Appointments">
        {past.length ? (
          <List
            dataSource={past}
            renderItem={(appt) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    appt.status === 'completed' ? (
                      <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                    ) : (
                      <CalendarOutlined style={{ fontSize: 28, color: '#999' }} />
                    )
                  }
                  title={
                    <Space>
                      <Text strong>{appt.reasonForVisit || appt.appointmentType}</Text>
                      <Tag color={statusColors[appt.status]}>{appt.status}</Tag>
                    </Space>
                  }
                  description={
                    <Text type="secondary">
                      {appt.startTime ? new Date(appt.startTime).toLocaleString() : 'N/A'}
                      {appt.providerName ? ` · ${appt.providerName}` : ''}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No past appointments" />
        )}
      </Card>

      <Modal
        title="Request an Appointment"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); setSlots([]); }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={600}
        okText="Submit Request"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="providerId" label="Preferred Provider" rules={[{ required: true }]}>
            <Select placeholder="Select a provider">
              {providers.map((p) => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="appointmentType" label="Visit Type" rules={[{ required: true }]}>
            <Select placeholder="Select visit type">
              <Select.Option value="new_patient">New Patient Visit</Select.Option>
              <Select.Option value="follow_up">Follow-up</Select.Option>
              <Select.Option value="annual_physical">Annual Physical</Select.Option>
              <Select.Option value="urgent_care">Urgent Care</Select.Option>
              <Select.Option value="consultation">Consultation</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="isTelehealth" label="Visit Mode" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="in-person">In-Person</Radio>
              <Radio value="telehealth"><VideoCameraOutlined /> Telehealth</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="preferredDate" label="Preferred Date & Time" rules={[{ required: true }]}>
            <DatePicker
              style={{ width: '100%' }}
              showTime={{ format: 'h:mm A', minuteStep: 15 }}
              format="YYYY-MM-DD h:mm A"
              onChange={handleDateChange}
              disabledDate={(current) =>
                current && current.endOf('day') < dayjs().startOf('day')
              }
              disabledTime={(current) => {
                const now = dayjs();
                if (!current || !current.isSame(now, 'day')) {
                  return {};
                }
                return {
                  disabledHours: () => Array.from({ length: now.hour() }, (_, i) => i),
                  disabledMinutes: (selectedHour: number) =>
                    selectedHour === now.hour()
                      ? Array.from({ length: now.minute() }, (_, i) => i)
                      : [],
                  disabledSeconds: () => Array.from({ length: 60 }, (_, i) => i),
                };
              }}
            />
          </Form.Item>

          {loadingSlots && <div style={{ textAlign: 'center', marginBottom: 16 }}><Spin /></div>}

          {slots.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>Available Time Slots:</Text>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {slots
                  .filter((slot) => {
                    const slotTime = slot.startTime || slot.time;
                    if (!slotTime) return true;
                    return dayjs(slotTime).isAfter(dayjs());
                  })
                  .map((slot, i) => (
                  <Tag
                    key={i}
                    style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 14 }}
                    color="blue"
                  >
                    {slot.startTime || slot.time}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          <Form.Item name="reasonForVisit" label="Reason for Visit" rules={[{ required: true }]}>
            <Input placeholder="Briefly describe your symptoms or reason for visit" />
          </Form.Item>

          <Form.Item name="notes" label="Additional Notes">
            <TextArea rows={3} placeholder="Any additional information for your care team" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalAppointmentsPage;
