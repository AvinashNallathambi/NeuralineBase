import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  TimePicker,
  DatePicker,
  Switch,
  Popconfirm,
  Tabs,
  message,
  Descriptions,
  Empty,
  InputNumber,
  Spin,
  Alert,
  Statistic,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ScheduleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(customParseFormat);
import { useProviderStore } from '../../store/dataStore';
import { providerAvailabilityService } from '../../services/providerAvailabilityService';
import type { ProviderAvailability, ProviderAvailabilityOverride, OverrideType, AppointmentType } from '../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const overrideTypeColors: Record<OverrideType, string> = {
  time_off: 'red',
  modified_hours: 'orange',
  on_call: 'blue',
  holiday: 'purple',
  break: 'cyan',
  out_of_office: 'default',
};

const overrideTypeLabels: Record<OverrideType, string> = {
  time_off: 'Time Off',
  modified_hours: 'Modified Hours',
  on_call: 'On Call',
  holiday: 'Holiday',
  break: 'Break',
  out_of_office: 'Out of Office',
};

const appointmentTypeOptions: { label: string; value: AppointmentType }[] = [
  { label: 'New Patient', value: 'new_patient' },
  { label: 'Follow Up', value: 'follow_up' },
  { label: 'Annual Physical', value: 'annual_physical' },
  { label: 'Urgent Care', value: 'urgent_care' },
  { label: 'Telehealth', value: 'telehealth' },
  { label: 'Procedure', value: 'procedure' },
  { label: 'Consultation', value: 'consultation' },
  { label: 'Group Therapy', value: 'group_therapy' },
  { label: 'Group Session', value: 'group_session' },
];

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const overlaps = (a: ProviderAvailability, b: ProviderAvailability): boolean => {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
};

const ProviderScheduleDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: providerId } = useParams<{ id: string }>();
  const { providers } = useProviderStore();

  const [schedules, setSchedules] = useState<ProviderAvailability[]>([]);
  const [overrides, setOverrides] = useState<ProviderAvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleDrawer, setScheduleDrawer] = useState(false);
  const [overrideDrawer, setOverrideDrawer] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ProviderAvailability | null>(null);
  const [editingOverride, setEditingOverride] = useState<ProviderAvailabilityOverride | null>(null);

  const [scheduleForm] = Form.useForm();
  const [overrideForm] = Form.useForm();

  const provider = providers.find((p) => p.id === providerId);

  const loadData = async () => {
    if (!providerId) return;
    setLoading(true);
    setError(null);
    try {
      const [availability, overrideList] = await Promise.all([
        providerAvailabilityService.findAvailabilityByProvider(providerId),
        providerAvailabilityService.findOverridesByProvider(providerId),
      ]);
      setSchedules(availability);
      setOverrides(overrideList);
    } catch {
      setError('Failed to load provider availability data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [providerId]);

  const providerSchedules = useMemo(
    () => schedules.filter((s) => s.providerId === providerId).sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    [schedules, providerId]
  );
  const providerOverrides = useMemo(
    () =>
      overrides
        .filter((o) => o.providerId === providerId)
        .sort((a, b) => a.overrideDate.localeCompare(b.overrideDate)),
    [overrides, providerId]
  );

  const weeklyHours = useMemo(
    () =>
      providerSchedules
        .filter((s) => s.isAvailable)
        .reduce((sum, s) => {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          return sum + (eh + em / 60 - (sh + sm / 60));
        }, 0),
    [providerSchedules]
  );

  if (!provider) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/provider-availability')}>
          Back
        </Button>
        <Empty description="Provider not found" style={{ marginTop: 48 }} />
      </div>
    );
  }

  const providerName = `${provider.firstName} ${provider.lastName}`;

  // ── Schedule CRUD ──────────────────────────────────────────────────────
  const openScheduleDrawer = (schedule?: ProviderAvailability) => {
    if (schedule) {
      setEditingSchedule(schedule);
      scheduleForm.setFieldsValue({
        dayOfWeek: schedule.dayOfWeek,
        startTime: dayjs(schedule.startTime, 'HH:mm'),
        endTime: dayjs(schedule.endTime, 'HH:mm'),
        slotDuration: schedule.slotDuration,
        isAvailable: schedule.isAvailable,
        appointmentTypes: schedule.appointmentTypes || [],
        locationId: schedule.locationId || undefined,
        maxAppointments: schedule.maxAppointments ?? undefined,
        bufferMinutes: schedule.bufferMinutes ?? 0,
        notes: schedule.notes || undefined,
        isRecurring: schedule.isRecurring,
        effectiveDate: schedule.effectiveDate ? dayjs(schedule.effectiveDate) : undefined,
        expiryDate: schedule.expiryDate ? dayjs(schedule.expiryDate) : undefined,
      });
    } else {
      setEditingSchedule(null);
      scheduleForm.resetFields();
      scheduleForm.setFieldsValue({
        slotDuration: 30,
        isAvailable: true,
        isRecurring: true,
        bufferMinutes: 0,
        appointmentTypes: [],
      });
    }
    setScheduleDrawer(true);
  };

  const handleScheduleSubmit = async (values: Record<string, unknown>) => {
    const startTime = (values.startTime as dayjs.Dayjs).format('HH:mm');
    const endTime = (values.endTime as dayjs.Dayjs).format('HH:mm');

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      message.error('Start time must be earlier than end time');
      return;
    }

    const entry: Partial<ProviderAvailability> = {
      providerId: providerId!,
      dayOfWeek: values.dayOfWeek as number,
      startTime,
      endTime,
      slotDuration: (values.slotDuration as number) || 30,
      isAvailable: values.isAvailable as boolean,
      appointmentTypes: (values.appointmentTypes as string[]) || [],
      locationId: (values.locationId as string) || null,
      maxAppointments: values.maxAppointments ? Number(values.maxAppointments) : null,
      bufferMinutes: values.bufferMinutes === undefined ? 0 : Number(values.bufferMinutes),
      notes: (values.notes as string) || null,
      isRecurring: values.isRecurring as boolean,
      effectiveDate: values.effectiveDate ? (values.effectiveDate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
      expiryDate: values.expiryDate ? (values.expiryDate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
    };

    const candidate = entry as ProviderAvailability;
    const conflicting = providerSchedules.find(
      (s) =>
        s.id !== editingSchedule?.id &&
        overlaps(s, candidate)
    );
    if (conflicting) {
      message.error(`Schedule conflicts with existing block on ${DAY_NAMES[conflicting.dayOfWeek]}`);
      return;
    }

    try {
      if (editingSchedule) {
        await providerAvailabilityService.updateAvailability(editingSchedule.id, entry as any);
        message.success('Schedule updated');
      } else {
        await providerAvailabilityService.createAvailability(entry as any);
        message.success('Schedule block added');
      }
      setScheduleDrawer(false);
      scheduleForm.resetFields();
      await loadData();
    } catch {
      message.error('Failed to save schedule');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await providerAvailabilityService.deleteAvailability(id);
      message.success('Schedule block removed');
      await loadData();
    } catch {
      message.error('Failed to delete schedule');
    }
  };

  // ── Override CRUD ──────────────────────────────────────────────────────
  const openOverrideDrawer = (override?: ProviderAvailabilityOverride) => {
    if (override) {
      setEditingOverride(override);
      overrideForm.setFieldsValue({
        overrideDate: dayjs(override.overrideDate),
        overrideType: override.overrideType,
        isAvailable: override.isAvailable,
        startTime: override.startTime ? dayjs(override.startTime, 'HH:mm') : undefined,
        endTime: override.endTime ? dayjs(override.endTime, 'HH:mm') : undefined,
        reason: override.reason,
        isRecurring: override.isRecurring,
      });
    } else {
      setEditingOverride(null);
      overrideForm.resetFields();
      overrideForm.setFieldsValue({ isAvailable: false, isRecurring: false });
    }
    setOverrideDrawer(true);
  };

  const handleOverrideSubmit = async (values: Record<string, unknown>) => {
    const startTime = values.startTime ? (values.startTime as dayjs.Dayjs).format('HH:mm') : undefined;
    const endTime = values.endTime ? (values.endTime as dayjs.Dayjs).format('HH:mm') : undefined;

    if (startTime && endTime && timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      message.error('Start time must be earlier than end time');
      return;
    }

    const dto = {
      providerId: providerId!,
      overrideDate: (values.overrideDate as dayjs.Dayjs).format('YYYY-MM-DD'),
      overrideType: values.overrideType as string,
      isAvailable: values.isAvailable as boolean,
      startTime,
      endTime,
      reason: (values.reason as string) || undefined,
      isRecurring: values.isRecurring as boolean,
    };

    try {
      if (editingOverride) {
        await providerAvailabilityService.updateOverride(editingOverride.id, dto);
        message.success('Override updated');
      } else {
        await providerAvailabilityService.createOverride(dto);
        message.success('Override added');
      }
      setOverrideDrawer(false);
      overrideForm.resetFields();
      await loadData();
    } catch {
      message.error('Failed to save override');
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      await providerAvailabilityService.deleteOverride(id);
      message.success('Override removed');
      await loadData();
    } catch {
      message.error('Failed to delete override');
    }
  };

  // ── Weekly visual grid ────────────────────────────────────────────────
  const renderWeeklyGrid = () => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 6);

    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: 1, minWidth: 700 }}>
          <div style={{ padding: 4, fontWeight: 600, fontSize: 12 }} />
          {DAY_SHORT.map((d) => (
            <div key={d} style={{ padding: 4, fontWeight: 600, fontSize: 12, textAlign: 'center', background: '#fafafa' }}>
              {d}
            </div>
          ))}
          {hours.map((hour) => (
            <React.Fragment key={hour}>
              <div style={{ padding: '2px 4px', fontSize: 11, color: '#999', textAlign: 'right' }}>
                {hour > 12 ? `${hour - 12}PM` : hour === 12 ? '12PM' : `${hour}AM`}
              </div>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const isScheduled = providerSchedules.some((s) => {
                  if (s.dayOfWeek !== day || !s.isAvailable) return false;
                  const [sh] = s.startTime.split(':').map(Number);
                  const [eh] = s.endTime.split(':').map(Number);
                  return hour >= sh && hour < eh;
                });
                return (
                  <div
                    key={day}
                    style={{
                      height: 24,
                      background: isScheduled ? '#e6f7f0' : '#fff',
                      border: '1px solid #f0f0f0',
                      borderRadius: 2,
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // ── Table columns ─────────────────────────────────────────────────────
  const scheduleColumns: ColumnsType<ProviderAvailability> = [
    {
      title: 'Day',
      dataIndex: 'dayOfWeek',
      key: 'day',
      render: (day: number) => <strong>{DAY_NAMES[day]}</strong>,
      sorter: (a, b) => a.dayOfWeek - b.dayOfWeek,
    },
    {
      title: 'Hours',
      key: 'hours',
      render: (_, r) => `${r.startTime} – ${r.endTime}`,
    },
    {
      title: 'Slot',
      dataIndex: 'slotDuration',
      key: 'slotDuration',
      render: (d: number) => `${d} min`,
    },
    {
      title: 'Status',
      dataIndex: 'isAvailable',
      key: 'status',
      render: (available: boolean) =>
        available ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>Available</Tag>
        ) : (
          <Tag color="default" icon={<StopOutlined />}>Blocked</Tag>
        ),
    },
    {
      title: 'Types',
      key: 'types',
      render: (_, r) =>
        r.appointmentTypes && r.appointmentTypes.length > 0 ? (
          <span style={{ fontSize: 12 }}>{r.appointmentTypes.map((t) => t.replace(/_/g, ' ')).join(', ')}</span>
        ) : (
          <span style={{ color: '#999' }}>All</span>
        ),
    },
    {
      title: 'Location',
      dataIndex: 'locationId',
      key: 'location',
      render: (loc: string | null | undefined) => loc || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Max',
      dataIndex: 'maxAppointments',
      key: 'max',
      render: (max: number | null | undefined) => (max != null ? max : '—'),
    },
    {
      title: 'Buffer',
      dataIndex: 'bufferMinutes',
      key: 'buffer',
      render: (b: number | undefined) => (b ? `${b} min` : '—'),
    },
    {
      title: 'Effective',
      dataIndex: 'effectiveDate',
      key: 'effective',
      render: (d: string | null | undefined) => (d ? dayjs(d).format('MMM D, YYYY') : '—'),
    },
    {
      title: 'Expiry',
      dataIndex: 'expiryDate',
      key: 'expiry',
      render: (d: string | null | undefined) => (d ? dayjs(d).format('MMM D, YYYY') : '—'),
    },
    {
      title: 'Recurring',
      dataIndex: 'isRecurring',
      key: 'recurring',
      render: (val: boolean) => (val ? <Tag color="geekblue">Yes</Tag> : <span style={{ color: '#999' }}>No</span>),
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (n: string | null | undefined) => n || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <span>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openScheduleDrawer(record);
            }}
            style={{ color: '#0D7C8A' }}
          />
          <Popconfirm
            title="Delete this schedule block?"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDeleteSchedule(record.id);
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              type="link"
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const overrideColumns: ColumnsType<ProviderAvailabilityOverride> = [
    {
      title: 'Date',
      dataIndex: 'overrideDate',
      key: 'date',
      render: (d: string) => <strong>{dayjs(d).format('MMM D, YYYY')}</strong>,
      sorter: (a, b) => a.overrideDate.localeCompare(b.overrideDate),
    },
    {
      title: 'Type',
      dataIndex: 'overrideType',
      key: 'type',
      render: (type: OverrideType) => (
        <Tag color={overrideTypeColors[type]}>{overrideTypeLabels[type] || type}</Tag>
      ),
    },
    {
      title: 'Hours',
      key: 'hours',
      render: (_, r) =>
        r.startTime && r.endTime ? `${r.startTime} – ${r.endTime}` : 'Full day',
    },
    {
      title: 'Available',
      dataIndex: 'isAvailable',
      key: 'available',
      render: (val: boolean) =>
        val ? <Tag color="success">Yes</Tag> : <Tag color="error">No</Tag>,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (r: string | undefined) => r || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Recurring',
      dataIndex: 'isRecurring',
      key: 'recurring',
      render: (val: boolean) =>
        val ? <Tag color="geekblue">Annual</Tag> : <span style={{ color: '#999' }}>No</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <span>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openOverrideDrawer(record);
            }}
            style={{ color: '#0D7C8A' }}
          />
          <Popconfirm
            title="Delete this override?"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDeleteOverride(record.id);
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              type="link"
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div >
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/provider-availability')}
        style={{ marginBottom: 16 }}
      >
        Back to Provider List
      </Button>

      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ScheduleOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
            {providerName}
          </Title>
          <Text type="secondary">
            {provider.specialization || provider.department} &middot; {provider.role}
          </Text>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Weekly Hours"
              value={Math.round(weeklyHours * 10) / 10}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#0D7C8A' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Schedule Blocks"
              value={providerSchedules.length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Active Days"
              value={new Set(providerSchedules.filter((s) => s.isAvailable).map((s) => s.dayOfWeek)).size}
              suffix="/ 7"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Upcoming Overrides"
              value={providerOverrides.filter((o) => new Date(o.overrideDate) >= new Date()).length}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} showIcon />}

      <Spin spinning={loading}>
        <Card title="Weekly Overview" style={{ marginBottom: 24 }}>
          {renderWeeklyGrid()}
        </Card>

        <Card>
          <Tabs
            defaultActiveKey="schedules"
            items={[
              {
                key: 'schedules',
                label: (
                  <span>
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    Recurring Schedule ({providerSchedules.length})
                  </span>
                ),
                children: (
                  <>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openScheduleDrawer()}
                      style={{ marginBottom: 16, backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
                    >
                      Add Schedule Block
                    </Button>
                    <Table
                      columns={scheduleColumns}
                      dataSource={providerSchedules.map((s) => ({ ...s, key: s.id }))}
                      pagination={false}
                      size="middle"
                      scroll={{ x: 1100 }}
                    />
                  </>
                ),
              },
              {
                key: 'overrides',
                label: (
                  <span>
                    <StopOutlined style={{ marginRight: 4 }} />
                    Overrides ({providerOverrides.length})
                  </span>
                ),
                children: (
                  <>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openOverrideDrawer()}
                      style={{ marginBottom: 16, backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
                    >
                      Add Override
                    </Button>
                    <Table
                      columns={overrideColumns}
                      dataSource={providerOverrides.map((o) => ({ ...o, key: o.id }))}
                      pagination={{ pageSize: 10 }}
                      size="middle"
                    />
                  </>
                ),
              },
              {
                key: 'info',
                label: (
                  <span>
                    <ScheduleOutlined style={{ marginRight: 4 }} />
                    Provider Info
                  </span>
                ),
                children: (
                  <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Name">{providerName}</Descriptions.Item>
                    <Descriptions.Item label="Role">
                      <Tag color={provider.role === 'doctor' ? 'blue' : 'green'}>
                        {provider.role}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Specialization">
                      {provider.specialization || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Department">
                      {provider.department || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">{provider.email}</Descriptions.Item>
                    <Descriptions.Item label="Phone">{provider.phone || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Status">
                      {provider.isActive ? (
                        <Tag color="success">Active</Tag>
                      ) : (
                        <Tag color="error">Inactive</Tag>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
            ]}
          />
        </Card>
      </Spin>

      {/* Schedule Drawer */}
      <Drawer
        title={editingSchedule ? 'Edit Schedule Block' : 'Add Schedule Block'}
        open={scheduleDrawer}
        onClose={() => {
          setScheduleDrawer(false);
          scheduleForm.resetFields();
        }}
        width={460}
      >
        <Form form={scheduleForm} layout="vertical" onFinish={handleScheduleSubmit}>
          <Form.Item name="dayOfWeek" label="Day of Week" rules={[{ required: true, message: 'Select a day' }]}>
            <Select
              options={DAY_NAMES.map((name, i) => ({ label: name, value: i }))}
              placeholder="Select day"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startTime" label="Start Time" rules={[{ required: true, message: 'Select start time' }]}>
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="End Time" rules={[{ required: true, message: 'Select end time' }]}>
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="slotDuration" label="Slot Duration (minutes)" rules={[{ required: true, message: 'Select slot duration' }]}>
            <Select
              options={[
                { label: '15 minutes', value: 15 },
                { label: '20 minutes', value: 20 },
                { label: '30 minutes', value: 30 },
                { label: '45 minutes', value: 45 },
                { label: '60 minutes', value: 60 },
              ]}
            />
          </Form.Item>
          <Form.Item name="appointmentTypes" label="Appointment Types">
            <Select
              mode="multiple"
              placeholder="Select applicable types"
              options={appointmentTypeOptions}
            />
          </Form.Item>
          <Form.Item name="locationId" label="Location">
            <Input placeholder="e.g. main-clinic, room-201" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maxAppointments" label="Max Appointments">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bufferMinutes" label="Buffer Minutes">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="effectiveDate" label="Effective Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiryDate" label="Expiry Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isRecurring" label="Recurring" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isAvailable" label="Available" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Notes" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
            >
              {editingSchedule ? 'Update Schedule' : 'Add Schedule'}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Override Drawer */}
      <Drawer
        title={editingOverride ? 'Edit Override' : 'Add Override'}
        open={overrideDrawer}
        onClose={() => {
          setOverrideDrawer(false);
          overrideForm.resetFields();
        }}
        width={400}
      >
        <Form form={overrideForm} layout="vertical" onFinish={handleOverrideSubmit}>
          <Form.Item name="overrideDate" label="Date" rules={[{ required: true, message: 'Select a date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="overrideType" label="Override Type" rules={[{ required: true, message: 'Select a type' }]}>
            <Select
              options={[
                { label: 'Time Off', value: 'time_off' },
                { label: 'Modified Hours', value: 'modified_hours' },
                { label: 'On Call', value: 'on_call' },
                { label: 'Holiday', value: 'holiday' },
                { label: 'Break', value: 'break' },
                { label: 'Out of Office', value: 'out_of_office' },
              ]}
              placeholder="Select type"
            />
          </Form.Item>
          <Form.Item name="isAvailable" label="Available During Override" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startTime" label="Start Time">
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="End Time">
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason">
            <TextArea rows={3} placeholder="Reason for override" />
          </Form.Item>
          <Form.Item name="isRecurring" label="Recurring Annually" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
            >
              {editingOverride ? 'Update Override' : 'Add Override'}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default ProviderScheduleDetailPage;
