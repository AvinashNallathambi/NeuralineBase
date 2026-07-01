import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Badge,
  Typography,
  Select,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Switch,
  Row,
  Col,
  Segmented,
  Tooltip,
  Timeline,
  message,
  Popconfirm,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LoginOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  LeftOutlined,
  RightOutlined,
  ScheduleOutlined,
  AppstoreOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { Appointment, AppointmentType, AppointmentStatus, WorkflowInstance, WorkflowTemplate } from '../../types';
import { useAppointmentStore } from '../../store/dataStore';
import { workflowService } from '../../services/workflowService';
import { patientService, type Patient } from '../../services/patientService';
import { providerAvailabilityService } from '../../services/providerAvailabilityService';
import WorkflowStatusBadge from '../../components/workflow/WorkflowStatusBadge';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const typeColors: Record<AppointmentType, string> = {
  new_patient: 'purple',
  follow_up: 'blue',
  annual_physical: 'green',
  urgent_care: 'red',
  telehealth: 'cyan',
  procedure: 'orange',
  consultation: 'geekblue',
  group_therapy: 'magenta',
  group_session: 'volcano',
};

const typeBg: Record<AppointmentType, string> = {
  new_patient: '#f9f0ff',
  follow_up: '#e6f4ff',
  annual_physical: '#f6ffed',
  urgent_care: '#fff2f0',
  telehealth: '#e6fffb',
  procedure: '#fff7e6',
  consultation: '#f0f5ff',
  group_therapy: '#fff0f6',
  group_session: '#fff2e8',
};

const typeBorder: Record<AppointmentType, string> = {
  new_patient: '#b37feb',
  follow_up: '#69b1ff',
  annual_physical: '#95de64',
  urgent_care: '#ff7875',
  telehealth: '#5cdbd3',
  procedure: '#ffc069',
  consultation: '#85a5ff',
  group_therapy: '#eb2f96',
  group_session: '#fa541c',
};

const statusColors: Record<AppointmentStatus, string> = {
  scheduled: 'blue',
  confirmed: 'cyan',
  checked_in: 'geekblue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'default',
  no_show: 'red',
};

const statusBadge: Record<AppointmentStatus, 'default' | 'processing' | 'success' | 'error' | 'warning'> = {
  scheduled: 'default',
  confirmed: 'processing',
  checked_in: 'processing',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'default',
  no_show: 'error',
};

type ViewMode = 'day' | 'week' | 'month' | 'year' | 'list';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM

const AppointmentPage: React.FC = () => {
  const [view, setView] = useState<ViewMode>('month');
  const { appointments, addAppointment, changeStatus: storeChangeStatus, loading, error, fetchAppointments } = useAppointmentStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [providerFilter, setProviderFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [form] = Form.useForm();
  const [isTelehealth, setIsTelehealth] = useState(false);
  
  // Real patients from API
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  // Group appointment state
  const [isGroupAppointment, setIsGroupAppointment] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [maxParticipants, setMaxParticipants] = useState(15);

  // Extract unique providers from appointments
  const uniqueProviders = useMemo(() => {
    const providerMap = new Map<string, { id: string; name: string }>();
    appointments.forEach((appt) => {
      if (appt.providerId && appt.providerName && !providerMap.has(appt.providerId)) {
        providerMap.set(appt.providerId, { id: appt.providerId, name: appt.providerName });
      }
    });
    return Array.from(providerMap.values());
  }, [appointments]);

  // ── Workflow Integration ──
  const [workflowTemplate, setWorkflowTemplate] = useState<WorkflowTemplate | null>(null);
  const [workflowInstances, setWorkflowInstances] = useState<Record<string, WorkflowInstance>>({});

  // Load active workflow template for appointments
  React.useEffect(() => {
    workflowService.findActiveTemplateForEntity('appointment').then((res) => {
      if (res.data) setWorkflowTemplate(res.data);
    }).catch(() => {});
  }, []);

  // Load workflow instances for all appointments
  React.useEffect(() => {
    if (workflowTemplate && appointments.length > 0) {
      const loadWorkflowInstances = async () => {
        const instances: Record<string, WorkflowInstance> = {};
        for (const appointment of appointments) {
          try {
            const instance = await workflowService.findInstanceByEntity('appointment', appointment.id);
            if (instance.data) {
              const transitions = await workflowService.getAvailableTransitions('appointment', appointment.id);
              instances[appointment.id] = {
                ...instance.data,
                availableTransitions: transitions.data || [],
              };
            }
          } catch (error) {
            // No workflow instance for this appointment
          }
        }
        setWorkflowInstances(instances);
      };
      loadWorkflowInstances();
    }
  }, [workflowTemplate, appointments]);

  // Create workflow instance on first status change if template exists
  const ensureWorkflowInstance = async (appointmentId: string, initialStep: string): Promise<WorkflowInstance | null> => {
    if (!workflowTemplate) return null;
    if (workflowInstances[appointmentId]) return workflowInstances[appointmentId];
    try {
      const instance = await workflowService.createInstance({
        entityType: 'appointment',
        entityId: appointmentId,
        currentStep: initialStep,
        templateId: workflowTemplate.id,
      });
      setWorkflowInstances((prev) => ({ ...prev, [appointmentId]: instance }));
      return instance;
    } catch {
      return null;
    }
  };

  // Load appointments on mount
  React.useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Load patients from API on mount
  React.useEffect(() => {
    const fetchPatients = async () => {
      setPatientsLoading(true);
      try {
        const response = await patientService.findAll({ page: 1, limit: 100 });
        setPatients(response.data);
      } catch (error) {
        console.error('Failed to fetch patients:', error);
        message.error('Failed to load patients');
      } finally {
        setPatientsLoading(false);
      }
    };
    fetchPatients();
  }, []);

  // ── Filtered appointments ──
  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const matchProvider = !providerFilter || a.providerId === providerFilter;
      const matchStatus = !statusFilter || a.status === statusFilter;
      const matchType = !typeFilter || a.type === typeFilter;
      const matchDate =
        !dateRange ||
        !dateRange[0] ||
        !dateRange[1] ||
        (dayjs(a.startTime).isAfter(dateRange[0].startOf('day')) &&
          dayjs(a.startTime).isBefore(dateRange[1].endOf('day')));
      return matchProvider && matchStatus && matchType && matchDate;
    });
  }, [appointments, providerFilter, statusFilter, typeFilter, dateRange]);

  // ── Status quick-change (with workflow support) ──
  const changeStatus = async (id: string, newStatus: AppointmentStatus) => {
    // Try to transition through workflow system first if template is configured
    if (workflowTemplate) {
      try {
        const instance = await ensureWorkflowInstance(id, newStatus);
        if (instance) {
          await workflowService.transition('appointment', id, { toStep: newStatus });
          // Refresh workflow instances to update available transitions
          const transitions = await workflowService.getAvailableTransitions('appointment', id);
          setWorkflowInstances((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              availableTransitions: transitions.data || [],
            },
          }));
        }
        // Update local state after successful workflow transition
        storeChangeStatus(id, newStatus);
        message.success(`Appointment status changed to ${newStatus.replace(/_/g, ' ')}`);
        return;
      } catch (error) {
        // Workflow transition failed - fall back to direct status change
        console.error('Workflow transition failed:', error);
      }
    }

    // Fallback: direct status change without workflow
    storeChangeStatus(id, newStatus);
    message.success(`Appointment status changed to ${newStatus.replace(/_/g, ' ')}`);
  };

  // ── New appointment handler ──
  const handleNewAppointment = async (values: Record<string, unknown>) => {
    try {
      if (isGroupAppointment) {
        // Create group appointment
        const groupDto = {
          providerId: values.providerId as string,
          appointmentType: values.type as string,
          startTime: (values.date as dayjs.Dayjs).startOf('day').add((values.timeRange as [dayjs.Dayjs, dayjs.Dayjs])[0].hour(), 'hour').add((values.timeRange as [dayjs.Dayjs, dayjs.Dayjs])[0].minute(), 'minute').toISOString(),
          endTime: (values.date as dayjs.Dayjs).startOf('day').add((values.timeRange as [dayjs.Dayjs, dayjs.Dayjs])[1].hour(), 'hour').add((values.timeRange as [dayjs.Dayjs, dayjs.Dayjs])[1].minute(), 'minute').toISOString(),
          patientIds: selectedPatients,
          maxParticipants,
          location: isTelehealth ? 'telehealth' : 'in_person',
          notes: values.reason as string,
          isTelehealth,
        };

        await providerAvailabilityService.createGroupAppointment(groupDto);
        message.success('Group appointment scheduled successfully');
      } else {
        // Create individual appointment
        const patient = patients.find((p) => p.id === values.patientId);
        const provider = uniqueProviders.find((p) => p.id === values.providerId);
        const apptDate = values.date as dayjs.Dayjs;
        const timeRange = values.timeRange as [dayjs.Dayjs, dayjs.Dayjs];

        const newAppt: Appointment = {
          id: `apt-${Date.now()}`,
          patientId: values.patientId as string,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
          providerId: values.providerId as string,
          providerName: provider ? provider.name : 'Unknown',
          type: values.type as AppointmentType,
          status: 'scheduled',
          startTime: apptDate
            .hour(timeRange[0].hour())
            .minute(timeRange[0].minute())
            .toISOString(),
          endTime: apptDate
            .hour(timeRange[1].hour())
            .minute(timeRange[1].minute())
            .toISOString(),
          reason: (values.reason as string) || '',
          isTelehealth: !!values.isTelehealth,
          meetingLink: values.isTelehealth
            ? `https://telehealth.neuraline.health/room/apt-${Date.now()}`
            : undefined,
          reminders: true,
          createdAt: new Date().toISOString(),
        };
        addAppointment(newAppt);
        message.success('Appointment created successfully');
      }

      // Refresh appointments
      fetchAppointments();
      setDrawerOpen(false);
      form.resetFields();
      setIsTelehealth(false);
      setIsGroupAppointment(false);
      setSelectedPatients([]);
      setMaxParticipants(15);
    } catch (error) {
      console.error('Failed to create appointment:', error);
      message.error('Failed to create appointment');
    }
  };

  // ── Click on time slot to create appointment ──
  const handleTimeSlotClick = (hour: number) => {
    const startTime = selectedDate.hour(hour).minute(0);
    const endTime = startTime.add(1, 'hour');

    form.setFieldsValue({
      date: selectedDate,
      timeRange: [startTime, endTime],
    });

    setDrawerOpen(true);
  };

  // ── Navigation helpers ──
  const navigatePrev = () => {
    if (view === 'day') setSelectedDate(selectedDate.subtract(1, 'day'));
    else if (view === 'week') setSelectedDate(selectedDate.subtract(1, 'week'));
    else if (view === 'month') setSelectedDate(selectedDate.subtract(1, 'month'));
    else if (view === 'year') setSelectedDate(selectedDate.subtract(1, 'year'));
  };

  const navigateNext = () => {
    if (view === 'day') setSelectedDate(selectedDate.add(1, 'day'));
    else if (view === 'week') setSelectedDate(selectedDate.add(1, 'week'));
    else if (view === 'month') setSelectedDate(selectedDate.add(1, 'month'));
    else if (view === 'year') setSelectedDate(selectedDate.add(1, 'year'));
  };

  const goToday = () => setSelectedDate(dayjs());

  const getHeaderLabel = (): string => {
    if (view === 'day') return selectedDate.format('dddd, MMMM D, YYYY');
    if (view === 'week') {
      const start = selectedDate.startOf('week');
      const end = selectedDate.endOf('week');
      if (start.month() === end.month()) return `${start.format('MMMM D')} - ${end.format('D, YYYY')}`;
      return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
    }
    if (view === 'month') return selectedDate.format('MMMM YYYY');
    if (view === 'year') return selectedDate.format('YYYY');
    return '';
  };

  // ── Appointment card (reusable in day/week views) ──
  const ApptCard: React.FC<{ appt: Appointment; compact?: boolean }> = ({ appt, compact }) => (
    <Tooltip
      title={
        <div>
          <div><strong>{appt.patientName}</strong></div>
          <div>{dayjs(appt.startTime).format('h:mm A')} - {dayjs(appt.endTime).format('h:mm A')}</div>
          <div>{appt.providerName}</div>
          <div style={{ textTransform: 'capitalize' }}>{(appt.type ?? '').replace(/_/g, ' ')} | {(appt.status ?? '').replace(/_/g, ' ')}</div>
          {appt.reason && <div style={{ marginTop: 4 }}>{appt.reason}</div>}
        </div>
      }
    >
      <div
        style={{
          background: typeBg[appt.type],
          borderLeft: `3px solid ${typeBorder[appt.type]}`,
          borderRadius: 6,
          padding: compact ? '2px 6px' : '6px 10px',
          marginBottom: 2,
          cursor: 'pointer',
          fontSize: compact ? 11 : 12,
          overflow: 'hidden',
          transition: 'box-shadow 0.2s',
        }}
        onClick={() => { setSelectedAppointment(appt); setDetailDrawerOpen(true); }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {compact ? dayjs(appt.startTime).format('h:mm') : dayjs(appt.startTime).format('h:mm A')}{' '}
          {appt.patientName}
        </div>
        {!compact && (
          <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
            <Tag color={typeColors[appt.type]} style={{ fontSize: 10, margin: 0, lineHeight: '18px', padding: '0 4px' }}>
              {(appt.type ?? '').replace(/_/g, ' ')}
            </Tag>
            {appt.isTelehealth && (
              <Tag icon={<VideoCameraOutlined />} color="processing" style={{ fontSize: 10, margin: 0, lineHeight: '18px', padding: '0 4px' }}>
                Video
              </Tag>
            )}
          </div>
        )}
      </div>
    </Tooltip>
  );

  // ═══════════════════════════════════════════
  //  DAY VIEW - Hourly timeline for one day
  // ═══════════════════════════════════════════
  const DayView: React.FC = () => {
    const dayAppts = appointments
      .filter((a) => dayjs(a.startTime).isSame(selectedDate, 'day'))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const isToday = selectedDate.isSame(dayjs(), 'day');
    const nowMinutes = dayjs().hour() * 60 + dayjs().minute();
    const startMinutes = 6 * 60;
    const endMinutes = 21 * 60;

    return (
      <Card bodyStyle={{ padding: 0 }}>
        {/* Day summary banner */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <CalendarOutlined style={{ color: '#0D7C8A' }} />
            <Text strong>{selectedDate.format('dddd, MMMM D, YYYY')}</Text>
            {isToday && <Tag color="blue">Today</Tag>}
          </Space>
          <Space>
            <Badge count={dayAppts.length} style={{ backgroundColor: '#0D7C8A' }} />
            <Text type="secondary">{dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}</Text>
          </Space>
        </div>

        {/* Hourly grid */}
        <div style={{ position: 'relative', overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
          {/* Current time indicator */}
          {isToday && nowMinutes >= startMinutes && nowMinutes <= endMinutes && (
            <div
              style={{
                position: 'absolute',
                top: ((nowMinutes - startMinutes) / 60) * 80,
                left: 0,
                right: 0,
                height: 2,
                background: '#ff4d4f',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4d4f', position: 'absolute', top: -4, left: 60 }} />
            </div>
          )}

          {HOURS.map((hour) => {
            const hourAppts = dayAppts.filter((a) => dayjs(a.startTime).hour() === hour);
            return (
              <div
                key={hour}
                style={{
                  display: 'flex',
                  minHeight: 80,
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                {/* Time label */}
                <div
                  style={{
                    width: 70,
                    flexShrink: 0,
                    padding: '8px 12px 8px 8px',
                    textAlign: 'right',
                    borderRight: '1px solid #f0f0f0',
                    color: '#8c8c8c',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {dayjs().hour(hour).minute(0).format('h:mm A')}
                </div>

                {/* Appointments in this hour */}
                <div
                  style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}
                  onClick={() => handleTimeSlotClick(hour)}
                >
                  {hourAppts.map((appt) => (
                    <div
                      key={appt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: typeBg[appt.type],
                        borderLeft: `4px solid ${typeBorder[appt.type]}`,
                        borderRadius: 8,
                        padding: '8px 12px',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s',
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedAppointment(appt); setDetailDrawerOpen(true); }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <Avatar size={36} icon={<UserOutlined />} style={{ backgroundColor: typeBorder[appt.type], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong style={{ fontSize: 14 }}>{appt.patientName}</Text>
                        <Space size={4}>
                          {workflowTemplate && workflowInstances[appt.id] ? (
                            <WorkflowStatusBadge
                              template={workflowTemplate}
                              instance={workflowInstances[appt.id]}
                            />
                          ) : (
                            <Tag color={statusColors[appt.status]} style={{ margin: 0, fontSize: 11, textTransform: 'capitalize' }}>
                              {(appt.status ?? '').replace(/_/g, ' ')}
                            </Tag>
                          )}
                        </Space>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {dayjs(appt.startTime).format('h:mm A')} - {dayjs(appt.endTime).format('h:mm A')}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{appt.providerName}</Text>
                          <Tag color={typeColors[appt.type]} style={{ fontSize: 10, margin: 0, textTransform: 'capitalize' }}>
                            {(appt.type ?? '').replace(/_/g, ' ')}
                          </Tag>
                          {appt.isTelehealth && (
                            <Tag icon={<VideoCameraOutlined />} color="processing" style={{ fontSize: 10, margin: 0 }}>Video</Tag>
                          )}
                        </div>
                        {appt.reason && (
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                            {appt.reason}
                          </Text>
                        )}
                      </div>
                      {/* Quick actions */}
                      <Space size={4} style={{ flexShrink: 0 }}>
                        {appt.status === 'scheduled' && (
                          <Button size="small" type="primary" ghost icon={<LoginOutlined />} onClick={(e) => { e.stopPropagation(); changeStatus(appt.id, 'checked_in'); }}>
                            Check In
                          </Button>
                        )}
                        {(appt.status === 'confirmed' || appt.status === 'checked_in') && (
                          <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={(e) => { e.stopPropagation(); changeStatus(appt.id, 'in_progress'); }}>
                            Start
                          </Button>
                        )}
                        {appt.status === 'in_progress' && (
                          <Button size="small" style={{ borderColor: '#52c41a', color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={(e) => { e.stopPropagation(); changeStatus(appt.id, 'completed'); }}>
                            Complete
                          </Button>
                        )}
                      </Space>
                    </div>
                  ))}
                  {hourAppts.length === 0 && (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 11, opacity: 0.4 }}>—</Text>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  // ═══════════════════════════════════════════
  //  WEEK VIEW - 7-day grid with hourly rows
  // ═══════════════════════════════════════════
  const WeekView: React.FC = () => {
    const weekStart = selectedDate.startOf('week'); // Sunday
    const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
    const todayStr = dayjs().format('YYYY-MM-DD');

    const apptsByDayHour: Record<string, Record<number, Appointment[]>> = {};
    weekDays.forEach((d) => {
      const key = d.format('YYYY-MM-DD');
      apptsByDayHour[key] = {};
      HOURS.forEach((h) => { apptsByDayHour[key][h] = []; });
    });
    appointments.forEach((a) => {
      const d = dayjs(a.startTime);
      const key = d.format('YYYY-MM-DD');
      const h = d.hour();
      if (apptsByDayHour[key] && apptsByDayHour[key][h]) {
        apptsByDayHour[key][h].push(a);
      }
    });

    return (
      <Card bodyStyle={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ minWidth: 900 }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(7, 1fr)', borderBottom: '2px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 5, background: '#fff' }}>
            <div style={{ borderRight: '1px solid #f0f0f0' }} />
            {weekDays.map((d) => {
              const isToday = d.format('YYYY-MM-DD') === todayStr;
              const dayCount = appointments.filter((a) => dayjs(a.startTime).isSame(d, 'day')).length;
              return (
                <div
                  key={d.format('YYYY-MM-DD')}
                  style={{
                    textAlign: 'center',
                    padding: '12px 4px',
                    borderRight: '1px solid #f0f0f0',
                    background: isToday ? '#e6f7f8' : '#fafafa',
                    cursor: 'pointer',
                  }}
                  onClick={() => { setSelectedDate(d); setView('day'); }}
                >
                  <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600 }}>
                    {d.format('ddd')}
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      fontSize: 16,
                      fontWeight: isToday ? 700 : 500,
                      background: isToday ? '#0D7C8A' : 'transparent',
                      color: isToday ? '#fff' : '#1a2b3c',
                      margin: '4px auto',
                    }}
                  >
                    {d.date()}
                  </div>
                  {dayCount > 0 && (
                    <Badge count={dayCount} size="small" style={{ backgroundColor: isToday ? '#0D7C8A' : '#8c8c8c' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Hourly rows */}
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
            {HOURS.map((hour) => (
              <div key={hour} style={{ display: 'grid', gridTemplateColumns: '70px repeat(7, 1fr)', minHeight: 64, borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #f0f0f0', color: '#8c8c8c', fontSize: 11, fontWeight: 500 }}>
                  {dayjs().hour(hour).minute(0).format('h A')}
                </div>
                {weekDays.map((d) => {
                  const key = d.format('YYYY-MM-DD');
                  const hourAppts = apptsByDayHour[key]?.[hour] || [];
                  return (
                    <div key={key} style={{ borderRight: '1px solid #f5f5f5', padding: '2px 3px', minHeight: 64 }}>
                      {hourAppts.map((appt) => (
                        <ApptCard key={appt.id} appt={appt} compact />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  };

  // ═══════════════════════════════════════════
  //  MONTH VIEW - Calendar grid
  // ═══════════════════════════════════════════
  const MonthView: React.FC = () => {
    const startOfMonth = selectedDate.startOf('month');
    const endOfMonth = selectedDate.endOf('month');
    const startDay = startOfMonth.day();
    const daysInMonth = selectedDate.daysInMonth();
    const todayStr = dayjs().format('YYYY-MM-DD');

    // Previous month padding days
    const prevMonthEnd = startOfMonth.subtract(1, 'day');
    const prevPadding = startDay;

    // Build 6-week grid
    const totalCells = 42; // 6 rows x 7 cols
    const cells: { date: dayjs.Dayjs; inMonth: boolean }[] = [];
    for (let i = 0; i < prevPadding; i++) {
      cells.push({ date: prevMonthEnd.subtract(prevPadding - 1 - i, 'day'), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: selectedDate.date(d), inMonth: true });
    }
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ date: endOfMonth.add(i, 'day'), inMonth: false });
    }

    // Group appointments by day
    const apptsByDay: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      const key = dayjs(a.startTime).format('YYYY-MM-DD');
      if (!apptsByDay[key]) apptsByDay[key] = [];
      apptsByDay[key].push(a);
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <Card bodyStyle={{ padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
          {/* Day name headers */}
          {dayNames.map((name) => (
            <div key={name} style={{ background: '#fafafa', padding: '10px 4px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#8c8c8c', borderBottom: '2px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }}>
              {name}
            </div>
          ))}

          {/* Date cells */}
          {cells.map((cell, idx) => {
            const dateStr = cell.date.format('YYYY-MM-DD');
            const isToday = dateStr === todayStr;
            const dayAppts = (apptsByDay[dateStr] || []).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            return (
              <div
                key={idx}
                style={{
                  minHeight: 100,
                  padding: 4,
                  borderRight: '1px solid #f0f0f0',
                  borderBottom: '1px solid #f0f0f0',
                  background: isToday ? '#e6f7f8' : cell.inMonth ? '#fff' : '#fafafa',
                  opacity: cell.inMonth ? 1 : 0.5,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => { setSelectedDate(cell.date); setView('day'); }}
                onMouseEnter={(e) => { if (!isToday) e.currentTarget.style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { if (!isToday) e.currentTarget.style.background = cell.inMonth ? '#fff' : '#fafafa'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 400,
                      background: isToday ? '#0D7C8A' : 'transparent',
                      color: isToday ? '#fff' : cell.inMonth ? '#1a2b3c' : '#bfbfbf',
                    }}
                  >
                    {cell.date.date()}
                  </div>
                  {dayAppts.length > 0 && (
                    <Badge count={dayAppts.length} size="small" style={{ backgroundColor: '#0D7C8A' }} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {dayAppts.slice(0, 3).map((appt) => (
                    <ApptCard key={appt.id} appt={appt} compact />
                  ))}
                  {dayAppts.length > 3 && (
                    <Text type="secondary" style={{ fontSize: 10, paddingLeft: 4 }}>+{dayAppts.length - 3} more</Text>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  // ═══════════════════════════════════════════
  //  YEAR VIEW - 12 mini month calendars
  // ═══════════════════════════════════════════
  const YearView: React.FC = () => {
    const year = selectedDate.year();
    const todayStr = dayjs().format('YYYY-MM-DD');

    // Count appointments per day for the whole year
    const apptCounts: Record<string, number> = {};
    appointments.forEach((a) => {
      const d = dayjs(a.startTime);
      if (d.year() === year) {
        const key = d.format('YYYY-MM-DD');
        apptCounts[key] = (apptCounts[key] || 0) + 1;
      }
    });

    const months = Array.from({ length: 12 }, (_, i) => dayjs().year(year).month(i).startOf('month'));
    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const getHeatColor = (count: number): string => {
      if (count === 0) return 'transparent';
      if (count === 1) return '#b5f5ec';
      if (count === 2) return '#87e8de';
      if (count <= 4) return '#36cfc9';
      return '#0D7C8A';
    };

    return (
      <Row gutter={[16, 16]}>
        {months.map((month) => {
          const startDay = month.day();
          const daysInMonth = month.daysInMonth();
          const cells: (number | null)[] = [];
          for (let i = 0; i < startDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          // Pad to fill last row
          while (cells.length % 7 !== 0) cells.push(null);

          // Count total appointments this month
          let monthTotal = 0;
          for (let d = 1; d <= daysInMonth; d++) {
            const key = month.date(d).format('YYYY-MM-DD');
            monthTotal += apptCounts[key] || 0;
          }

          return (
            <Col xs={12} sm={8} md={6} lg={4} key={month.month()}>
              <Card
                size="small"
                bodyStyle={{ padding: '8px 10px' }}
                style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                hoverable
                onClick={() => { setSelectedDate(month); setView('month'); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 13 }}>{month.format('MMMM')}</Text>
                  {monthTotal > 0 && (
                    <Badge count={monthTotal} size="small" style={{ backgroundColor: '#0D7C8A' }} />
                  )}
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center' }}>
                  {dayLetters.map((l, i) => (
                    <div key={i} style={{ fontSize: 9, color: '#bfbfbf', fontWeight: 600, paddingBottom: 2 }}>{l}</div>
                  ))}
                </div>

                {/* Day cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center' }}>
                  {cells.map((day, idx) => {
                    if (day === null) return <div key={idx} style={{ height: 20 }} />;

                    const dateStr = month.date(day).format('YYYY-MM-DD');
                    const count = apptCounts[dateStr] || 0;
                    const isToday = dateStr === todayStr;

                    return (
                      <Tooltip key={idx} title={count > 0 ? `${month.date(day).format('MMM D')}: ${count} appointment${count > 1 ? 's' : ''}` : month.date(day).format('MMM D')}>
                        <div
                          style={{
                            height: 20,
                            width: 20,
                            margin: '0 auto',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: isToday ? 700 : 400,
                            background: isToday ? '#0D7C8A' : getHeatColor(count),
                            color: isToday ? '#fff' : count > 2 ? '#fff' : '#595959',
                            cursor: 'pointer',
                            transition: 'transform 0.15s',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(month.date(day));
                            setView('day');
                          }}
                        >
                          {day}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              </Card>
            </Col>
          );
        })}

        {/* Year legend */}
        <Col span={24}>
          <Card size="small" bodyStyle={{ padding: '8px 16px' }}>
            <Space size={16} wrap>
              <Text type="secondary" style={{ fontSize: 12 }}>Appointment density:</Text>
              {[
                { color: 'transparent', border: '1px solid #d9d9d9', label: 'None' },
                { color: '#b5f5ec', label: '1' },
                { color: '#87e8de', label: '2' },
                { color: '#36cfc9', label: '3-4' },
                { color: '#0D7C8A', label: '5+' },
              ].map((item) => (
                <Space key={item.label} size={4}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: item.color, border: item.border || 'none' }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>{item.label}</Text>
                </Space>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    );
  };

  // ── Table columns ──
  const columns: ColumnsType<Appointment> = [
    {
      title: 'Date / Time',
      key: 'dateTime',
      width: 180,
      sorter: (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      defaultSortOrder: 'ascend',
      render: (_: unknown, r: Appointment) => (
        <div>
          <Text strong>{dayjs(r.startTime).format('MMM DD, YYYY')}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(r.startTime).format('h:mm A')} - {dayjs(r.endTime).format('h:mm A')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
      render: (name: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#0D7C8A' }} />
          <Text>{name}</Text>
        </Space>
      ),
    },
    { title: 'Provider', dataIndex: 'providerName', key: 'providerName' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (type: AppointmentType, record: Appointment) => (
        <Space>
          <Tag color={typeColors[type]} style={{ textTransform: 'capitalize' }}>{(type ?? '').replace(/_/g, ' ')}</Tag>
          {record.isGroup && (
            <Tag color="magenta" icon={<TeamOutlined />} style={{ fontSize: 11 }}>Group</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status: AppointmentStatus, record: Appointment) => (
        workflowTemplate && workflowInstances[record.id] ? (
          <WorkflowStatusBadge
            template={workflowTemplate}
            instance={workflowInstances[record.id]}
          />
        ) : (
          <Badge
            status={statusBadge[status]}
            text={<Tag color={statusColors[status]} style={{ textTransform: 'capitalize' }}>{(status ?? '').replace(/_/g, ' ')}</Tag>}
          />
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: Appointment) => {
        const s = record.status;
        const workflowInstance = workflowInstances[record.id];
        const availableTransitions = workflowInstance?.availableTransitions || [];

        // Use workflow transitions if available, otherwise use hardcoded status-based actions
        const useWorkflowActions = workflowTemplate && workflowInstance && availableTransitions.length > 0;

        return (
          <Space size={4} wrap>
            {useWorkflowActions ? (
              // Fully dynamic workflow-based actions
              <>
                {availableTransitions.map((transition: any) => {
                  const isDestructive = transition.toStep === 'cancelled' || transition.toStep === 'no_show';
                  const button = (
                    <Button
                      key={transition.toStep}
                      size="small"
                      type={transition.toStep === 'completed' ? 'primary' : 
                             transition.toStep === 'cancelled' ? 'default' : 
                             transition.toStep === 'no_show' ? 'default' : 'default'}
                      ghost={transition.toStep !== 'completed' && transition.toStep !== 'cancelled' && transition.toStep !== 'no_show'}
                      danger={isDestructive}
                      icon={transition.toStep === 'checked_in' ? <LoginOutlined /> : 
                             transition.toStep === 'in_progress' ? <PlayCircleOutlined /> :
                             transition.toStep === 'completed' ? <CheckCircleOutlined /> :
                             transition.toStep === 'cancelled' ? <CloseCircleOutlined /> : undefined}
                      onClick={() => changeStatus(record.id, transition.toStep)}
                    >
                      {transition.label || transition.toStep.replace(/_/g, ' ')}
                    </Button>
                  );

                  return isDestructive ? (
                    <Popconfirm
                      key={`confirm-${transition.toStep}`}
                      title={`Are you sure you want to ${transition.toStep.replace(/_/g, ' ')} this appointment?`}
                      onConfirm={() => changeStatus(record.id, transition.toStep)}
                    >
                      {button}
                    </Popconfirm>
                  ) : button;
                })}
              </>
            ) : (
              // Fallback to hardcoded status-based actions when no workflow
              <>
                {s === 'scheduled' && (
                  <Button size="small" type="primary" ghost icon={<LoginOutlined />} onClick={() => changeStatus(record.id, 'checked_in')}>Check In</Button>
                )}
                {(s === 'confirmed' || s === 'checked_in') && (
                  <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => changeStatus(record.id, 'in_progress')}>Start</Button>
                )}
                {s === 'in_progress' && (
                  <Button size="small" style={{ borderColor: '#52c41a', color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => changeStatus(record.id, 'completed')}>Complete</Button>
                )}
                {s !== 'completed' && s !== 'cancelled' && s !== 'no_show' && (
                  <Popconfirm title="Cancel this appointment?" onConfirm={() => changeStatus(record.id, 'cancelled')}>
                    <Button size="small" danger icon={<CloseCircleOutlined />}>Cancel</Button>
                  </Popconfirm>
                )}
              </>
            )}
            
            {record.isTelehealth && s !== 'completed' && s !== 'cancelled' && (
              <Tooltip title="Join Telehealth">
                <Button size="small" icon={<VideoCameraOutlined />} type="link" />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  // ── Today's Schedule Sidebar ──
  const todayAppts = appointments
    .filter((a) => dayjs(a.startTime).isSame(dayjs(), 'day'))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const TodaySchedule: React.FC = () => (
    <Card
      title={
        <Space>
          <ClockCircleOutlined />
          <span>Today's Schedule</span>
          <Badge count={todayAppts.length} style={{ backgroundColor: '#0D7C8A' }} />
        </Space>
      }
      size="small"
    >
      {todayAppts.length === 0 ? (
        <Text type="secondary">No appointments today</Text>
      ) : (
        <Timeline
          items={todayAppts.map((a) => ({
            color: a.status === 'completed' ? 'green' : a.status === 'in_progress' ? 'orange' : a.status === 'cancelled' ? 'gray' : 'blue',
            children: (
              <div>
                <Text strong style={{ fontSize: 13 }}>{dayjs(a.startTime).format('h:mm A')}</Text>
                <br />
                <Text style={{ fontSize: 13 }}>{a.patientName}</Text>
                <br />
                <Space size={4}>
                  <Tag color={typeColors[a.type]} style={{ fontSize: 10, textTransform: 'capitalize' }}>{(a.type ?? '').replace(/_/g, ' ')}</Tag>
                  {workflowTemplate && workflowInstances[a.id] ? (
                    <WorkflowStatusBadge
                      template={workflowTemplate}
                      instance={workflowInstances[a.id]}
                    />
                  ) : (
                    <Tag color={statusColors[a.status]} style={{ fontSize: 10, textTransform: 'capitalize' }}>{(a.status ?? '').replace(/_/g, ' ')}</Tag>
                  )}
                </Space>
                {a.isTelehealth && (
                  <div style={{ marginTop: 4 }}>
                    <Tag icon={<VideoCameraOutlined />} color="processing">Telehealth</Tag>
                  </div>
                )}
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Appointments</Title>
          <Text type="secondary">Schedule and manage patient appointments</Text>
        </div>
        <Space wrap>
          <Segmented
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            options={[
              { label: 'Day', value: 'day', icon: <ScheduleOutlined /> },
              { label: 'Week', value: 'week', icon: <AppstoreOutlined /> },
              { label: 'Month', value: 'month', icon: <CalendarOutlined /> },
              { label: 'Year', value: 'year', icon: <CalendarOutlined /> },
              { label: 'List', value: 'list', icon: <UnorderedListOutlined /> },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            New Appointment
          </Button>
        </Space>
      </div>

      {/* Calendar navigation bar (not for list view) */}
      {view !== 'list' && (
        <Card bodyStyle={{ padding: '12px 16px' }} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space>
              <Button icon={<LeftOutlined />} onClick={navigatePrev} />
              <Button icon={<RightOutlined />} onClick={navigateNext} />
              <Button onClick={goToday}>Today</Button>
              <Title level={4} style={{ margin: 0, minWidth: 200 }}>{getHeaderLabel()}</Title>
            </Space>
            <Space wrap>
              <Select placeholder="Provider" allowClear style={{ minWidth: 180 }} value={providerFilter} onChange={setProviderFilter}
                options={uniqueProviders.map((p) => ({ label: p.name, value: p.id }))}
              />
              <Select placeholder="Status" allowClear style={{ minWidth: 130 }} value={statusFilter} onChange={setStatusFilter}
                options={[
                  { label: 'Scheduled', value: 'scheduled' }, { label: 'Confirmed', value: 'confirmed' },
                  { label: 'Checked In', value: 'checked_in' }, { label: 'In Progress', value: 'in_progress' },
                  { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' },
                ]}
              />
            </Space>
          </div>
        </Card>
      )}

      {/* List view filters */}
      {view === 'list' && (
        <Card bodyStyle={{ padding: 16 }} style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={6}>
              <Select placeholder="Provider" allowClear style={{ width: '100%' }} value={providerFilter} onChange={setProviderFilter}
                options={uniqueProviders.map((p) => ({ label: p.name, value: p.id }))}
              />
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Select placeholder="Status" allowClear style={{ width: '100%' }} value={statusFilter} onChange={setStatusFilter}
                options={[
                  { label: 'Scheduled', value: 'scheduled' }, { label: 'Confirmed', value: 'confirmed' },
                  { label: 'Checked In', value: 'checked_in' }, { label: 'In Progress', value: 'in_progress' },
                  { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' },
                  { label: 'No Show', value: 'no_show' },
                ]}
              />
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Select placeholder="Type" allowClear style={{ width: '100%' }} value={typeFilter} onChange={setTypeFilter}
                options={[
                  { label: 'New Patient', value: 'new_patient' }, { label: 'Follow Up', value: 'follow_up' },
                  { label: 'Annual Physical', value: 'annual_physical' }, { label: 'Urgent Care', value: 'urgent_care' },
                  { label: 'Telehealth', value: 'telehealth' }, { label: 'Procedure', value: 'procedure' },
                  { label: 'Consultation', value: 'consultation' },
                ]}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <RangePicker style={{ width: '100%' }} onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Content */}
      <Row gutter={24}>
        <Col xs={24} lg={view === 'list' ? 17 : 24}>
          {view === 'day' && <DayView />}
          {view === 'week' && <WeekView />}
          {view === 'month' && <MonthView />}
          {view === 'year' && <YearView />}
          {view === 'list' && (
            <Card bodyStyle={{ padding: 0 }}>
              <Table<Appointment>
                columns={columns}
                dataSource={filtered}
                rowKey="id"
                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}` }}
                scroll={{ x: 1000 }}
                size="middle"
              />
            </Card>
          )}
        </Col>
        {view === 'list' && (
          <Col xs={24} lg={7}>
            <TodaySchedule />
          </Col>
        )}
      </Row>

      {/* New Appointment Drawer */}
      <Drawer
        title="New Appointment"
        placement="right"
        width={520}
        onClose={() => { setDrawerOpen(false); form.resetFields(); setIsTelehealth(false); }}
        open={drawerOpen}
        extra={
          <Space>
            <Button onClick={() => { setDrawerOpen(false); form.resetFields(); setIsTelehealth(false); }}>Cancel</Button>
            <Button type="primary" onClick={() => form.submit()}>Schedule</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleNewAppointment}>
          <Form.Item label="Appointment Mode">
            <Radio.Group value={isGroupAppointment} onChange={(e) => setIsGroupAppointment(e.target.value)}>
              <Radio value={false}>Individual</Radio>
              <Radio value={true}>Group Session</Radio>
            </Radio.Group>
          </Form.Item>

          {!isGroupAppointment ? (
            <Form.Item name="patientId" label="Patient" rules={[{ required: true, message: 'Select a patient' }]}>
              <Select
                showSearch
                placeholder="Search patient..."
                optionFilterProp="label"
                loading={patientsLoading}
                options={patients.map((p) => ({ label: `${p.firstName} ${p.lastName} (${p.mrn || 'No MRN'})`, value: p.id }))}
              />
            </Form.Item>
          ) : (
            <Form.Item label="Patients" rules={[{ required: true, message: 'Select at least 2 patients' }]}>
              <Select
                mode="multiple"
                showSearch
                placeholder="Search and select patients..."
                optionFilterProp="label"
                loading={patientsLoading}
                value={selectedPatients}
                onChange={setSelectedPatients}
                options={patients.map((p) => ({ label: `${p.firstName} ${p.lastName} (${p.mrn || 'No MRN'})`, value: p.id }))}
                maxTagCount={3}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                {selectedPatients.length} patient(s) selected (min: 2, max: {maxParticipants})
              </div>
            </Form.Item>
          )}

          <Form.Item name="providerId" label="Provider" rules={[{ required: true, message: 'Select a provider' }]}>
            <Select placeholder="Select provider"
              options={uniqueProviders.map((p) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>
          <Form.Item name="type" label="Appointment Type" rules={[{ required: true, message: 'Select type' }]}>
            <Select placeholder="Select type"
              options={[
                { label: 'New Patient', value: 'new_patient' }, { label: 'Follow Up', value: 'follow_up' },
                { label: 'Annual Physical', value: 'annual_physical' }, { label: 'Urgent Care', value: 'urgent_care' },
                { label: 'Telehealth', value: 'telehealth' }, { label: 'Procedure', value: 'procedure' },
                { label: 'Consultation', value: 'consultation' },
                ...(isGroupAppointment ? [
                  { label: 'Group Therapy', value: 'group_therapy' },
                  { label: 'Group Session', value: 'group_session' },
                ] : []),
              ]}
            />
          </Form.Item>

          {isGroupAppointment && (
            <Form.Item label="Max Participants">
              <InputNumber
                min={2}
                max={50}
                value={maxParticipants}
                onChange={setMaxParticipants}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Select date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="timeRange" label="Time" rules={[{ required: true, message: 'Select time' }]}>
                <DatePicker.RangePicker picker="time" format="h:mm A" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isTelehealth" label="Telehealth" valuePropName="checked">
            <Switch onChange={setIsTelehealth} />
          </Form.Item>
          {isTelehealth && (
            <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8, padding: '8px 12px', marginBottom: 24, marginTop: -12 }}>
              <Space>
                <VideoCameraOutlined style={{ color: '#1890ff' }} />
                <Text style={{ color: '#1890ff' }}>A meeting link will be generated automatically</Text>
              </Space>
            </div>
          )}
          <Form.Item name="reason" label="Reason for Visit">
            <TextArea rows={3} placeholder="Brief description of the visit reason..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Appointment Detail Drawer */}
      <Drawer
        title="Appointment Details"
        placement="right"
        width={520}
        onClose={() => { setDetailDrawerOpen(false); setSelectedAppointment(null); }}
        open={detailDrawerOpen}
        extra={
          <Space>
            <Button onClick={() => { setDetailDrawerOpen(false); setSelectedAppointment(null); }}>Close</Button>
          </Space>
        }
      >
        {selectedAppointment && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Space direction="vertical" size="small">
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Patient</Text>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedAppointment.patientName}</div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Provider</Text>
                  <div style={{ fontSize: 16 }}>{selectedAppointment.providerName}</div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Date & Time</Text>
                  <div style={{ fontSize: 16 }}>
                    {dayjs(selectedAppointment.startTime).format('MMMM D, YYYY')}
                  </div>
                  <div style={{ fontSize: 14 }}>
                    {dayjs(selectedAppointment.startTime).format('h:mm A')} - {dayjs(selectedAppointment.endTime).format('h:mm A')}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Type</Text>
                  <div>
                    <Tag color={typeColors[selectedAppointment.type]} style={{ textTransform: 'capitalize' }}>
                      {(selectedAppointment.type ?? '').replace(/_/g, ' ')}
                    </Tag>
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Status</Text>
                  <div>
                    {workflowTemplate && workflowInstances[selectedAppointment.id] ? (
                      <WorkflowStatusBadge
                        template={workflowTemplate}
                        instance={workflowInstances[selectedAppointment.id]}
                      />
                    ) : (
                      <Tag color={statusColors[selectedAppointment.status]} style={{ textTransform: 'capitalize' }}>
                        {(selectedAppointment.status ?? '').replace(/_/g, ' ')}
                      </Tag>
                    )}
                  </div>
                </div>
                {selectedAppointment.isTelehealth && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Telehealth</Text>
                    <div>
                      <Tag icon={<VideoCameraOutlined />} color="processing">Video Call</Tag>
                    </div>
                    {selectedAppointment.meetingLink && (
                      <div style={{ marginTop: 4 }}>
                        <a href={selectedAppointment.meetingLink} target="_blank" rel="noopener noreferrer">
                          {selectedAppointment.meetingLink}
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {selectedAppointment.reason && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Reason for Visit</Text>
                    <div style={{ fontSize: 14 }}>{selectedAppointment.reason}</div>
                  </div>
                )}
                {selectedAppointment.notes && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Notes</Text>
                    <div style={{ fontSize: 14 }}>{selectedAppointment.notes}</div>
                  </div>
                )}
              </Space>
            </div>
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              <Text strong>Quick Actions</Text>
              <div style={{ marginTop: 12 }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {selectedAppointment.status === 'scheduled' && (
                    <Button type="primary" ghost icon={<LoginOutlined />} onClick={() => { changeStatus(selectedAppointment.id, 'checked_in'); setDetailDrawerOpen(false); }} block>
                      Check In
                    </Button>
                  )}
                  {(selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'checked_in') && (
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => { changeStatus(selectedAppointment.id, 'in_progress'); setDetailDrawerOpen(false); }} block>
                      Start Appointment
                    </Button>
                  )}
                  {selectedAppointment.status === 'in_progress' && (
                    <Button style={{ borderColor: '#52c41a', color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => { changeStatus(selectedAppointment.id, 'completed'); setDetailDrawerOpen(false); }} block>
                      Complete Appointment
                    </Button>
                  )}
                  {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'no_show' && (
                    <Popconfirm title="Cancel this appointment?" onConfirm={() => { changeStatus(selectedAppointment.id, 'cancelled'); setDetailDrawerOpen(false); }}>
                      <Button danger icon={<CloseCircleOutlined />} block>Cancel Appointment</Button>
                    </Popconfirm>
                  )}
                </Space>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AppointmentPage;
