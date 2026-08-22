import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Badge,
  Typography,
  Descriptions,
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
  List,
  Empty,
  Alert,
  Spin,
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
  CloseOutlined,
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
import { patientGroupService, type PatientGroup } from '../../services/patientGroupService';
import { userService, type StaffUser } from '../../services/userService';
import { telemedicineService } from '../../services/telemedicineService';
import WorkflowStatusBadge from '../../components/workflow/WorkflowStatusBadge';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const { appointments, addAppointment, changeStatus: storeChangeStatus, loading, error, fetchAppointments } = useAppointmentStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [providerFilter, setProviderFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Expose filter setters on window for E2E tests. Ant Design v6 Select
  // doesn't respond reliably to Playwright's click/keyboard events, so
  // tests set filters via this global API instead.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setProviderFilter = setProviderFilter;
      (window as any).__setStatusFilter = setStatusFilter;
      (window as any).__setTypeFilter = setTypeFilter;
      (window as any).__setDateRange = setDateRange;
    }
  }, [setProviderFilter, setStatusFilter, setTypeFilter, setDateRange]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [form] = Form.useForm();
  const [isTelehealth, setIsTelehealth] = useState(false);
  
  // Real patients from API
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const patientSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced server-side patient search
  const searchPatients = useCallback((query: string) => {
    if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    if (!query || query.trim().length < 2) return;
    patientSearchTimer.current = setTimeout(async () => {
      setPatientsLoading(true);
      try {
        const response = await patientService.findAll({ page: 1, limit: 50, search: query.trim() });
        setPatients(response.data);
      } catch {
        // keep existing list
      } finally {
        setPatientsLoading(false);
      }
    }, 300);
  }, []);

  // Group appointment state
  const [isGroupAppointment, setIsGroupAppointment] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [maxParticipants, setMaxParticipants] = useState(15);

  // Patient groups (for Group Session dropdown) — fetched dynamically so newly
  // created groups appear immediately.
  const [patientGroups, setPatientGroups] = useState<PatientGroup[]>([]);
  const [patientGroupsLoading, setPatientGroupsLoading] = useState(false);
  const [selectedPatientGroupId, setSelectedPatientGroupId] = useState<string | undefined>();

  // Staff users from Settings → Users & Roles — drives the Provider dropdown so
  // any user/role added in Settings reflects here immediately.
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [staffUsersLoading, setStaffUsersLoading] = useState(false);

  // Available slots for the selected provider+date in the New Appointment drawer
  const [availableSlots, setAvailableSlots] = useState<{ start: string; end: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsChecked, setSlotsChecked] = useState(false);

  // Watch provider + date form values to fetch available slots
  const selectedProviderId = Form.useWatch('providerId', form);
  const selectedFormDate = Form.useWatch('date', form);
  const selectedAppointmentType = Form.useWatch('type', form);

  useEffect(() => {
    if (!selectedProviderId || !selectedFormDate) {
      setAvailableSlots([]);
      setSlotsChecked(false);
      return;
    }
    let cancelled = false;
    const fetchSlots = async () => {
      setSlotsLoading(true);
      setSlotsChecked(false);
      try {
        const dateObj = (selectedFormDate as dayjs.Dayjs).toDate();
        const slots = await providerAvailabilityService.getAvailableSlots(
          selectedProviderId,
          dateObj,
          selectedAppointmentType,
        );
        if (!cancelled) {
          setAvailableSlots(slots);
          setSlotsChecked(true);
        }
      } catch {
        if (!cancelled) {
          setAvailableSlots([]);
          setSlotsChecked(true);
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    };
    fetchSlots();
    return () => { cancelled = true; };
  }, [selectedProviderId, selectedFormDate, selectedAppointmentType]);

  // Extract unique statuses from appointments
  const uniqueStatuses = useMemo(() => {
    const statusSet = new Set<AppointmentStatus>();
    appointments.forEach((appt) => {
      if (appt.status) {
        statusSet.add(appt.status);
      }
    });
    return Array.from(statusSet);
  }, [appointments]);

  // Extract unique types from appointments
  const uniqueTypes = useMemo(() => {
    const typeSet = new Set<AppointmentType>();
    appointments.forEach((appt) => {
      if (appt.type) {
        typeSet.add(appt.type);
      }
    });
    return Array.from(typeSet);
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

  // Load staff users (Settings → Users & Roles) on mount — drives the Provider dropdown.
  React.useEffect(() => {
    const fetchStaffUsers = async () => {
      setStaffUsersLoading(true);
      try {
        const users = await userService.getAll();
        // Only active users who can deliver care should be assignable as providers.
        setStaffUsers(users.filter((u) => u.isActive));
      } catch (error) {
        console.error('Failed to fetch staff users:', error);
      } finally {
        setStaffUsersLoading(false);
      }
    };
    fetchStaffUsers();
  }, []);

  // Fetch the latest patient groups from the backend. Called on mount and every
  // time the New Appointment drawer opens so newly-created groups appear.
  const refreshPatientGroups = useCallback(async () => {
    setPatientGroupsLoading(true);
    try {
      const result = await patientGroupService.findAll({ page: 1, limit: 100, status: 'active' });
      setPatientGroups(result.data);
    } catch (error) {
      console.error('Failed to fetch patient groups:', error);
    } finally {
      setPatientGroupsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshPatientGroups();
  }, [refreshPatientGroups]);

  // Providers derived from Settings → Users & Roles (with a fallback to any
  // providers seen on existing appointments so the dropdown is never empty).
  const providerOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    staffUsers.forEach((u) => {
      map.set(u.id, { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() || u.email });
    });
    // Fallback: include providers referenced by existing appointments that are
    // not in the staff users list (e.g. legacy data).
    appointments.forEach((appt) => {
      if (appt.providerId && appt.providerName && !map.has(appt.providerId)) {
        map.set(appt.providerId, { id: appt.providerId, name: appt.providerName });
      }
    });
    return Array.from(map.values());
  }, [staffUsers, appointments]);

  // When a patient group is selected, fetch its members and populate the
  // selectedPatients list so the group can be scheduled as a group session.
  const handlePatientGroupSelect = useCallback(async (groupId: string) => {
    setSelectedPatientGroupId(groupId);
    if (!groupId) {
      setSelectedPatients([]);
      return;
    }
    try {
      // Fetch all members (paginate if necessary)
      const result = await patientGroupService.getMembers(groupId, { page: 1, limit: 500 });
      const ids = result.data.map((m) => m.id);
      setSelectedPatients(ids);
      if (result.total > 0) {
        message.success(`Loaded ${result.total} patient(s) from group`);
      }
    } catch (error) {
      console.error('Failed to fetch group members:', error);
      message.error('Failed to load group members');
    }
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
      // Guard against past-time bookings even if the picker validation is
      // somehow bypassed (e.g. via time-slot click).
      const apptDate = values.date as dayjs.Dayjs;
      const timeRange = values.timeRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
      if (apptDate && timeRange) {
        const start = apptDate.hour(timeRange[0].hour()).minute(timeRange[0].minute());
        if (start.isBefore(dayjs())) {
          message.error('Cannot book an appointment in the past. Please select a future time.');
          return;
        }
      }

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
        const provider = providerOptions.find((p) => p.id === values.providerId);
        const apptDate = values.date as dayjs.Dayjs;
        const timeRange = values.timeRange as [dayjs.Dayjs, dayjs.Dayjs];

        const newAppt: Appointment = {
          id: `apt-${Date.now()}`,
          patientId: values.patientId as string,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : '',
          providerId: values.providerId as string,
          providerName: provider ? provider.name : '',
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
          // No fake meeting link — the real video room is created on the
          // backend via telemedicineService.findOrCreateForAppointment()
          // when the provider/patient joins the call.
          meetingLink: undefined,
          reminders: values.remindersEnabled !== false,
          remindersEnabled: values.remindersEnabled !== false,
          createdAt: new Date().toISOString(),
        };
        addAppointment(newAppt);
        message.success('Appointment created successfully');

        // For telehealth appointments, pre-create the telemedicine session
        // (and the underlying video room) on the backend so it's ready when
        // the patient or provider joins. Non-blocking — failure is logged
        // but doesn't prevent the appointment from being saved.
        if (values.isTelehealth) {
          try {
            // Wait for the store to persist the appointment via the API,
            // then find-or-create the telemedicine session using the real
            // backend appointment ID returned by the store.
            await new Promise((resolve) => setTimeout(resolve, 800));
            const created = useAppointmentStore.getState().appointments.find(
              (a) => a.patientId === newAppt.patientId && a.startTime === newAppt.startTime,
            );
            if (created) {
              await telemedicineService.findOrCreateForAppointment(created.id);
            }
          } catch (err) {
            console.warn('Telemedicine session pre-creation failed (non-blocking):', err);
          }
        }
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
    let startTime = selectedDate.hour(hour).minute(0);
    const now = dayjs();

    // If the top of the hour is in the past (but the hour itself hasn't
    // fully elapsed), round up to the next 15-minute increment so the user
    // can still book within the current hour.
    if (startTime.isBefore(now)) {
      const endOfHour = selectedDate.hour(hour).minute(59).second(59);
      if (endOfHour.isBefore(now)) {
        // The entire hour has passed — block the click
        message.warning('Cannot book an appointment in the past. Please select a future time slot.');
        return;
      }
      // Round up to the next 15-minute mark that's still in the future
      const nowPlusBuffer = now.add(1, 'minute');
      let minute = Math.ceil(nowPlusBuffer.minute() / 15) * 15;
      let roundedHour = nowPlusBuffer.hour();
      if (minute >= 60) {
        minute = 0;
        roundedHour += 1;
      }
      startTime = selectedDate.hour(roundedHour).minute(minute);
      if (startTime.isBefore(nowPlusBuffer)) {
        startTime = startTime.add(15, 'minute');
      }
    }

    const endTime = startTime.add(1, 'hour');

    form.setFieldsValue({
      date: selectedDate,
      timeRange: [startTime, endTime],
    });

    openNewAppointmentDrawer();
  };

  // Open the New Appointment drawer, refreshing patient groups so any group
  // created elsewhere (e.g. on the Patient Groups page) shows up immediately.
  const openNewAppointmentDrawer = () => {
    refreshPatientGroups();
    setSelectedPatientGroupId(undefined);
    setSelectedPatients([]);
    setIsGroupAppointment(false);
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
    const dayAppts = filtered
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
            // An hour row is fully past only when the entire hour has elapsed.
            // This keeps the current hour clickable so users can still book
            // upcoming 15-min slots within it (e.g. at 13:29 the 1 PM row
            // remains active for 13:30 / 13:45 bookings).
            const hourEnd = selectedDate.hour(hour).minute(59).second(59);
            const isPast = hourEnd.isBefore(dayjs());
            return (
              <div
                key={hour}
                style={{
                  display: 'flex',
                  minHeight: 80,
                  borderBottom: '1px solid #f0f0f0',
                  background: isPast ? '#f5f5f5' : 'transparent',
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
                    color: isPast ? '#bfbfbf' : '#8c8c8c',
                    fontSize: 12,
                    fontWeight: 500,
                    textDecoration: isPast ? 'line-through' : 'none',
                  }}
                >
                  {dayjs().hour(hour).minute(0).format('h:mm A')}
                </div>

                {/* Appointments in this hour */}
                <div
                  data-testid={`time-slot-${hour}`}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    opacity: isPast ? 0.5 : 1,
                  }}
                  onClick={() => !isPast && handleTimeSlotClick(hour)}
                >
                  {hourAppts.map((appt) => (
                    <div
                      key={appt.id}
                      data-testid="appointment-card"
                      data-appt-id={appt.id}
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
    filtered.forEach((a) => {
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
              const isPastDay = d.endOf('day').isBefore(dayjs());
              const dayCount = filtered.filter((a) => dayjs(a.startTime).isSame(d, 'day')).length;
              return (
                <div
                  key={d.format('YYYY-MM-DD')}
                  style={{
                    textAlign: 'center',
                    padding: '12px 4px',
                    borderRight: '1px solid #f0f0f0',
                    background: isToday ? '#e6f7f8' : isPastDay ? '#f0f0f0' : '#fafafa',
                    cursor: 'pointer',
                    opacity: isPastDay ? 0.6 : 1,
                  }}
                  onClick={() => { setSelectedDate(d); setView('day'); }}
                >
                  <div style={{ fontSize: 11, color: isPastDay ? '#bfbfbf' : '#8c8c8c', textTransform: 'uppercase', fontWeight: 600 }}>
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
                      color: isToday ? '#fff' : isPastDay ? '#bfbfbf' : '#1a2b3c',
                      margin: '4px auto',
                      textDecoration: isPastDay ? 'line-through' : 'none',
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
                  // Only grey out the cell when the entire hour has passed,
                  // so the current hour remains usable for partial bookings.
                  const cellEnd = d.hour(hour).minute(59).second(59);
                  const isPastCell = cellEnd.isBefore(dayjs());
                  return (
                    <div
                      key={key}
                      style={{
                        borderRight: '1px solid #f5f5f5',
                        padding: '2px 3px',
                        minHeight: 64,
                        background: isPastCell ? '#f5f5f5' : 'transparent',
                        opacity: isPastCell ? 0.5 : 1,
                      }}
                    >
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
    filtered.forEach((a) => {
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
            const isPast = cell.date.endOf('day').isBefore(dayjs());
            const dayAppts = (apptsByDay[dateStr] || []).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            return (
              <div
                key={idx}
                data-testid={`calendar-day-${dateStr}`}
                style={{
                  minHeight: 100,
                  padding: 4,
                  borderRight: '1px solid #f0f0f0',
                  borderBottom: '1px solid #f0f0f0',
                  background: isToday ? '#e6f7f8' : isPast ? '#f0f0f0' : cell.inMonth ? '#fff' : '#fafafa',
                  opacity: cell.inMonth ? (isPast ? 0.5 : 1) : 0.5,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => { setSelectedDate(cell.date); setView('day'); }}
                onMouseEnter={(e) => { if (!isToday && !isPast) e.currentTarget.style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { if (!isToday && !isPast) e.currentTarget.style.background = cell.inMonth ? '#fff' : '#fafafa'; }}
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
                      color: isToday ? '#fff' : isPast ? '#bfbfbf' : cell.inMonth ? '#1a2b3c' : '#bfbfbf',
                      textDecoration: isPast ? 'line-through' : 'none',
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
    filtered.forEach((a) => {
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
                    const isPast = month.date(day).endOf('day').isBefore(dayjs());

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
                            background: isToday ? '#0D7C8A' : isPast ? '#f0f0f0' : getHeatColor(count),
                            color: isToday ? '#fff' : isPast ? '#bfbfbf' : count > 2 ? '#fff' : '#595959',
                            cursor: 'pointer',
                            transition: 'transform 0.15s',
                            textDecoration: isPast ? 'line-through' : 'none',
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
                  <Button size="small" type="primary" ghost icon={<LoginOutlined />} data-testid="action-check-in" onClick={() => changeStatus(record.id, 'checked_in')}>Check In</Button>
                )}
                {(s === 'confirmed' || s === 'checked_in') && (
                  <Button size="small" type="primary" icon={<PlayCircleOutlined />} data-testid="action-start" onClick={() => changeStatus(record.id, 'in_progress')}>Start</Button>
                )}
                {s === 'in_progress' && (
                  <Button size="small" style={{ borderColor: '#52c41a', color: '#52c41a' }} icon={<CheckCircleOutlined />} data-testid="action-complete" onClick={() => changeStatus(record.id, 'completed')}>Complete</Button>
                )}
                {s !== 'completed' && s !== 'cancelled' && s !== 'no_show' && (
                  <Popconfirm title="Cancel this appointment?" onConfirm={() => changeStatus(record.id, 'cancelled')}>
                    <Button size="small" danger icon={<CloseCircleOutlined />} data-testid="action-cancel">Cancel</Button>
                  </Popconfirm>
                )}
              </>
            )}
            
            {record.isTelehealth && s !== 'completed' && s !== 'cancelled' && (
              <Tooltip title="Join Telehealth">
                <Button
                  size="small"
                  icon={<VideoCameraOutlined />}
                  type="link"
                  data-testid="join-call-button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      // Find-or-create the telemedicine session for this
                      // appointment, then navigate to the WebRTC call page.
                      const tmSession = await telemedicineService.findOrCreateForAppointment(record.id);
                      navigate(`/telemedicine/${tmSession.id}`);
                    } catch (err: any) {
                      message.error('Failed to start telehealth session: ' + (err?.response?.data?.message || err?.message || 'unknown error'));
                    }
                  }}
                />
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
          <Button type="primary" icon={<PlusOutlined />} onClick={openNewAppointmentDrawer} data-testid="new-appointment-button">
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
              <Select placeholder="Provider" allowClear showSearch style={{ minWidth: 180 }} value={providerFilter} onChange={setProviderFilter}
                data-testid="calendar-provider-filter"
                options={providerOptions.map((p) => ({ label: p.name, value: p.id }))}
              />
              <Select placeholder="Status" allowClear showSearch style={{ minWidth: 130 }} value={statusFilter} onChange={setStatusFilter}
                data-testid="calendar-status-filter"
                options={uniqueStatuses.map((status) => ({
                  label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                  value: status,
                }))}
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
              <Select placeholder="Provider" allowClear showSearch style={{ width: '100%' }} value={providerFilter} onChange={setProviderFilter}
                data-testid="list-provider-filter"
                options={providerOptions.map((p) => ({ label: p.name, value: p.id }))}
              />
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Select placeholder="Status" allowClear showSearch style={{ width: '100%' }} value={statusFilter} onChange={setStatusFilter}
                data-testid="list-status-filter"
                options={[
                  { label: 'Scheduled', value: 'scheduled' },
                  { label: 'Checked In', value: 'checked_in' },
                  { label: 'In Progress', value: 'in_progress' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Cancelled', value: 'cancelled' },
                  { label: 'No Show', value: 'no_show' },
                ]}
              />
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Select placeholder="Type" allowClear showSearch style={{ width: '100%' }} value={typeFilter} onChange={setTypeFilter}
                data-testid="list-type-filter"
                options={[
                  { label: 'New Patient', value: 'new_patient' },
                  { label: 'Follow Up', value: 'follow_up' },
                  { label: 'Annual Physical', value: 'annual_physical' },
                  { label: 'Urgent Care', value: 'urgent_care' },
                  { label: 'Telehealth', value: 'telehealth' },
                  { label: 'Procedure', value: 'procedure' },
                  { label: 'Consultation', value: 'consultation' },
                ]}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <RangePicker style={{ width: '100%' }} data-testid="list-date-range-picker" onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)} />
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
                onRow={(record) => ({ 'data-appointment-id': record.id, className: `appt-row-${record.id}` } as any)}
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
        onClose={() => { setDrawerOpen(false); form.resetFields(); setIsTelehealth(false); setAvailableSlots([]); setSlotsChecked(false); }}
        open={drawerOpen}
        extra={
          <Space>
            <Button onClick={() => { setDrawerOpen(false); form.resetFields(); setIsTelehealth(false); setAvailableSlots([]); setSlotsChecked(false); }}>Cancel</Button>
            <Button type="primary" onClick={() => form.submit()} data-testid="appointment-schedule-button">Schedule</Button>
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
                placeholder="Search patient by name or MRN…"
                filterOption={false}
                onSearch={searchPatients}
                loading={patientsLoading}
                options={patients.map((p) => ({ label: `${p.firstName} ${p.lastName} · MRN: ${p.mrn || 'N/A'} · DOB: ${p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : 'N/A'}`, value: p.id }))}
                notFoundContent={patientsLoading ? 'Searching…' : 'Type to search'}
                data-testid="appointment-patient-select"
              />
            </Form.Item>
          ) : (
            <>
              <Form.Item label="Patient Group" extra="Select a saved group to auto-populate patients, or pick patients manually below.">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select a patient group (optional)..."
                  optionFilterProp="label"
                  loading={patientGroupsLoading}
                  value={selectedPatientGroupId}
                  onChange={handlePatientGroupSelect}
                  options={patientGroups.map((g) => ({
                    label: `${g.name}${g.memberCount ? ` (${g.memberCount})` : ''}`,
                    value: g.id,
                  }))}
                  notFoundContent={patientGroupsLoading ? 'Loading…' : 'No patient groups found. Create one on the Patient Groups page.'}
                />
              </Form.Item>
              <Form.Item label="Patients" rules={[{ required: true, message: 'Select at least 2 patients' }]}>
                <Select
                  mode="multiple"
                  showSearch
                  placeholder="Search patients by name or MRN…"
                  filterOption={false}
                  onSearch={searchPatients}
                  loading={patientsLoading}
                  value={selectedPatients}
                  onChange={setSelectedPatients}
                  options={patients.map((p) => ({ label: `${p.firstName} ${p.lastName} · MRN: ${p.mrn || 'N/A'} · DOB: ${p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : 'N/A'}`, value: p.id }))}
                  maxTagCount={3}
                  notFoundContent={patientsLoading ? 'Searching…' : 'Type to search'}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                  {selectedPatients.length} patient(s) selected (min: 2, max: {maxParticipants})
                </div>
              </Form.Item>
            </>
          )}

          <Form.Item name="providerId" label="Provider" rules={[{ required: true, message: 'Select a provider' }]}>
            <Select
              placeholder="Select provider"
              showSearch
              optionFilterProp="label"
              loading={staffUsersLoading}
              options={providerOptions.map((p) => ({ label: p.name, value: p.id }))}
              notFoundContent={staffUsersLoading ? 'Loading…' : 'No providers found. Add users in Settings → Users & Roles.'}
              data-testid="appointment-provider-select"
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
              data-testid="appointment-type-select"
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
                <DatePicker
                  style={{ width: '100%' }}
                  data-testid="appointment-date-picker"
                  disabledDate={(current) =>
                    current && current.endOf('day') < dayjs().startOf('day')
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="timeRange" label="Time" rules={[{ required: true, message: 'Select time' }]}>
                <DatePicker.RangePicker
                  picker="time"
                  format="h:mm A"
                  minuteStep={15}
                  style={{ width: '100%' }}
                  data-testid="appointment-time-range-picker"
                  disabledTime={(current) => {
                    // Disable past hours/minutes/seconds when the selected
                    // date is today.
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
                      disabledSeconds: (selectedHour: number, selectedMinute: number) =>
                        selectedHour === now.hour() && selectedMinute === now.minute()
                          ? Array.from({ length: now.second() }, (_, i) => i)
                          : [],
                    };
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Provider availability feedback */}
          {slotsLoading && (
            <div style={{ textAlign: 'center', padding: '12px 0', marginBottom: 16 }}>
              <Spin size="small" /> <Text type="secondary" style={{ marginLeft: 8 }}>Checking provider availability…</Text>
            </div>
          )}
          {slotsChecked && !slotsLoading && availableSlots.length === 0 && selectedProviderId && selectedFormDate && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="No availability set for this provider on this day"
              description={
                <span>
                  This provider has no scheduled availability for{' '}
                  <strong>{(selectedFormDate as dayjs.Dayjs).format('dddd, MMM D')}</strong>.
                  You can still book manually, but please confirm with the provider first.
                  Set availability in <strong>Provider Availability</strong> page.
                </span>
              }
            />
          )}
          {slotsChecked && !slotsLoading && availableSlots.length > 0 && selectedProviderId && selectedFormDate && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${availableSlots.length} available slot${availableSlots.length === 1 ? '' : 's'} on ${(selectedFormDate as dayjs.Dayjs).format('dddd, MMM D')}`}
              description={
                <div style={{ maxHeight: 80, overflowY: 'auto' }}>
                  {availableSlots.slice(0, 8).map((s, i) => (
                    <Tag key={i} style={{ marginBottom: 4 }}>
                      {dayjs(s.start).format('h:mm A')} – {dayjs(s.end).format('h:mm A')}
                    </Tag>
                  ))}
                  {availableSlots.length > 8 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {' '}+{availableSlots.length - 8} more…
                    </Text>
                  )}
                </div>
              }
            />
          )}
          <Form.Item name="isTelehealth" label="Telehealth" valuePropName="checked">
            <Switch onChange={setIsTelehealth} data-testid="appointment-telehealth-switch" />
          </Form.Item>
          {isTelehealth && (
            <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8, padding: '8px 12px', marginBottom: 24, marginTop: -12 }}>
              <Space>
                <VideoCameraOutlined style={{ color: '#1890ff' }} />
                <Text style={{ color: '#1890ff' }}>A meeting link will be generated automatically</Text>
              </Space>
            </div>
          )}
          <Form.Item name="remindersEnabled" label="Send Reminders" valuePropName="checked" initialValue={true} tooltip="Email/SMS reminders to the patient before the appointment">
            <Switch />
          </Form.Item>
          <Form.Item name="reason" label="Reason for Visit">
            <TextArea rows={3} placeholder="Brief description of the visit reason..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Appointment Detail Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => { setDetailDrawerOpen(false); setSelectedAppointment(null); }}
              style={{ padding: 0, width: 28, height: 28 }}
            />
            <span style={{ fontSize: 18, fontWeight: 600 }}>Appointment Details</span>
          </div>
        }
        placement="right"
        width={520}
        onClose={() => { setDetailDrawerOpen(false); setSelectedAppointment(null); }}
        open={detailDrawerOpen}
        closable={false}
        extra={
          selectedAppointment?.status === 'scheduled' && (
            <Button type="primary" ghost icon={<LoginOutlined />} onClick={() => { changeStatus(selectedAppointment.id, 'checked_in'); setDetailDrawerOpen(false); }}>
              Check In
            </Button>
          )
        }
      >
        {selectedAppointment && (
          <div>
            {/* Header banner */}
            <div style={{
              background: typeBg[selectedAppointment.type] ?? '#f0f5ff',
              borderLeft: `4px solid ${typeBorder[selectedAppointment.type] ?? '#85a5ff'}`,
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 24,
            }}>
              <Space size="middle">
                <Tag color={typeColors[selectedAppointment.type]} style={{ textTransform: 'capitalize', fontSize: 14, margin: 0 }}>
                  {(selectedAppointment.type ?? '').replace(/_/g, ' ')}
                </Tag>
                {workflowTemplate && workflowInstances[selectedAppointment.id] ? (
                  <WorkflowStatusBadge
                    template={workflowTemplate}
                    instance={workflowInstances[selectedAppointment.id]}
                  />
                ) : (
                  <Tag color={statusColors[selectedAppointment.status]} style={{ textTransform: 'capitalize', fontSize: 14, margin: 0 }}>
                    {(selectedAppointment.status ?? '').replace(/_/g, ' ')}
                  </Tag>
                )}
              </Space>
            </div>

            {/* Details table */}
          <Descriptions
  bordered
  column={1}
  size="small"
  labelStyle={{ width: '35%', fontWeight: 500 }}
>
  <Descriptions.Item label="Patient">
    <Space>
      <Avatar
        size={28}
        icon={<UserOutlined />}
        style={{ backgroundColor: '#08979c' }}
      />
      <Text strong>{selectedAppointment.patientName}</Text>
    </Space>
  </Descriptions.Item>

  <Descriptions.Item label="Provider">
    <Space>
      <Avatar size={24} icon={<UserOutlined />} style={{ backgroundColor: '#0D7C8A' }} />
      <Text>{selectedAppointment.providerName || selectedAppointment.providerId || '—'}</Text>
    </Space>
  </Descriptions.Item>

  <Descriptions.Item label="Date">
    <Text>
      {dayjs(selectedAppointment.startTime).format('dddd, MMMM D, YYYY')}
    </Text>
  </Descriptions.Item>

  <Descriptions.Item label="Time">
    <Space>
      <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
      <Text>
        {dayjs(selectedAppointment.startTime).format('h:mm A')} -{" "}
        {dayjs(selectedAppointment.endTime).format('h:mm A')}
      </Text>
    </Space>
  </Descriptions.Item>

  <Descriptions.Item label="Duration">
    {(() => {
      const start = dayjs(selectedAppointment.startTime);
      const end = dayjs(selectedAppointment.endTime);
      const minutes = end.diff(start, "minute");
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;

      let durationText = "";

      if (hours > 0)
        durationText += `${hours} hour${hours > 1 ? "s" : ""}`;

      if (remainingMinutes > 0)
        durationText += `${hours > 0 ? " " : ""}${remainingMinutes} minute${
          remainingMinutes > 1 ? "s" : ""
        }`;

      return <Text>{durationText || "0 minutes"}</Text>;
    })()}
  </Descriptions.Item>

  <Descriptions.Item label="Type">
    <Tag
      color={typeColors[selectedAppointment.type]}
      style={{ textTransform: "capitalize" }}
    >
      {(selectedAppointment.type ?? "").replace(/_/g, " ")}
    </Tag>
  </Descriptions.Item>

  <Descriptions.Item label="Status">
    {workflowTemplate && workflowInstances[selectedAppointment.id] ? (
      <WorkflowStatusBadge
        template={workflowTemplate}
        instance={workflowInstances[selectedAppointment.id]}
      />
    ) : (
      <Tag
        color={statusColors[selectedAppointment.status]}
        style={{ textTransform: "capitalize" }}
      >
        {(selectedAppointment.status ?? "").replace(/_/g, " ")}
      </Tag>
    )}
  </Descriptions.Item>

  {selectedAppointment.isTelehealth && (
    <Descriptions.Item label="Telehealth">
      <Space direction="vertical" size={4}>
        <Tag icon={<VideoCameraOutlined />} color="processing">
          Video Call
        </Tag>

        {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
          <Button
            type="primary"
            icon={<VideoCameraOutlined />}
            onClick={async () => {
              try {
                const tmSession = await telemedicineService.findOrCreateForAppointment(selectedAppointment.id);
                navigate(`/telemedicine/${tmSession.id}`);
              } catch (err: any) {
                message.error('Failed to start telehealth session: ' + (err?.response?.data?.message || err?.message || 'unknown error'));
              }
            }}
          >
            Join Call
          </Button>
        )}
      </Space>
    </Descriptions.Item>
  )}
</Descriptions>

            {/* Group participants — shown for group sessions so assigned
                providers and participants are visible in the details view. */}
            {selectedAppointment.isGroup && (
              <div style={{ marginTop: 16 }}>
                <Space style={{ marginBottom: 8 }}>
                  <TeamOutlined style={{ color: '#0D7C8A' }} />
                  <Text strong>Group Session Participants</Text>
                  {selectedAppointment.maxParticipants && (
                    <Tag color="magenta">Max: {selectedAppointment.maxParticipants}</Tag>
                  )}
                </Space>
                {selectedAppointment.groupParticipants && selectedAppointment.groupParticipants.length > 0 ? (
                  <List
                    size="small"
                    bordered
                    dataSource={selectedAppointment.groupParticipants}
                    renderItem={(p) => (
                      <List.Item>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space>
                            <Avatar size={24} icon={<UserOutlined />} style={{ backgroundColor: '#08979c' }} />
                            <Text>{p.patientName || p.patientId}</Text>
                          </Space>
                          <Tag color={p.attended ? 'green' : 'default'}>
                            {p.attended ? 'Attended' : 'Pending'}
                          </Tag>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No participants loaded for this group session." />
                )}
              </div>
            )}

            {/* Reason for Visit */}
            <div style={{ marginTop: 24 }}>
              <Text strong>Reason for Visit</Text>
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 8 }}>
                <Text>{selectedAppointment.reason || 'No reason provided'}</Text>
              </div>
            </div>

            {/* Notes */}
            {selectedAppointment.notes && (
              <div style={{ marginTop: 24 }}>
                <Text strong>Notes</Text>
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 8 }}>
                  <Text>{selectedAppointment.notes}</Text>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 24 }}>
              <Text strong>Actions</Text>
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 8 }}>
                <Space size="middle">
                  {selectedAppointment.status === 'scheduled' && (
                    <Button type="primary" ghost icon={<LoginOutlined />} onClick={() => { changeStatus(selectedAppointment.id, 'checked_in'); setDetailDrawerOpen(false); }}>
                      Check In
                    </Button>
                  )}
                  {(selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'checked_in') && (
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => { changeStatus(selectedAppointment.id, 'in_progress'); setDetailDrawerOpen(false); }}>
                      Start Appointment
                    </Button>
                  )}
                  {selectedAppointment.status === 'in_progress' && (
                    <Button style={{ borderColor: '#52c41a', color: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => { changeStatus(selectedAppointment.id, 'completed'); setDetailDrawerOpen(false); }}>
                      Complete Appointment
                    </Button>
                  )}
                  {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'no_show' && (
                    <Popconfirm title="Cancel this appointment?" onConfirm={() => { changeStatus(selectedAppointment.id, 'cancelled'); setDetailDrawerOpen(false); }}>
                      <Button danger icon={<CloseCircleOutlined />}>Cancel Appointment</Button>
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
