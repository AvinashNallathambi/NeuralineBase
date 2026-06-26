import React from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Table,
  Tag,
  Badge,
  Timeline,
  Button,
  Space,
  Avatar,
} from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  ExperimentOutlined,
  DollarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  UserAddOutlined,
  ScheduleOutlined,
  MedicineBoxOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  MessageOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import {
  mockDashboardStats,
  mockRevenueData,
  mockPatientDemographics,
} from '../../data/mockData';
import { useAppointmentStore } from '../../store/dataStore';
import type { Appointment } from '../../types';

const { Title, Text } = Typography;

const COLORS = ['#0D7C8A', '#36CFC9', '#69C0FF', '#B37FEB'];

const statusColorMap: Record<string, string> = {
  scheduled: 'blue',
  confirmed: 'cyan',
  checked_in: 'orange',
  in_progress: 'processing',
  completed: 'green',
  cancelled: 'red',
  no_show: 'default',
};

const activityIconMap: Record<string, React.ReactNode> = {
  appointment: <CalendarOutlined style={{ color: '#0D7C8A' }} />,
  prescription: <MedicineBoxOutlined style={{ color: '#52c41a' }} />,
  lab_result: <ExperimentOutlined style={{ color: '#faad14' }} />,
  patient: <UserAddOutlined style={{ color: '#1890ff' }} />,
  billing: <DollarOutlined style={{ color: '#B37FEB' }} />,
  message: <MessageOutlined style={{ color: '#36CFC9' }} />,
};

const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { appointments: mockAppointments } = useAppointmentStore();

  const firstName = user?.firstName || 'Doctor';
  const today = dayjs().format('dddd, MMMM D, YYYY');

  const appointmentColumns = [
    {
      title: 'Time',
      dataIndex: 'startTime',
      key: 'time',
      width: 100,
      render: (time: string) => (
        <Text strong style={{ color: '#0D7C8A' }}>
          {dayjs(time).format('h:mm A')}
        </Text>
      ),
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patient',
      render: (name: string) => (
        <Space>
          <Avatar size="small" style={{ background: '#0D7C8A' }}>
            {name.charAt(0)}
          </Avatar>
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const labels: Record<string, { label: string; icon: React.ReactNode }> = {
          follow_up: { label: 'Follow-up', icon: <SyncOutlined /> },
          new_patient: { label: 'New Patient', icon: <UserAddOutlined /> },
          telehealth: { label: 'Telehealth', icon: <VideoCameraOutlined /> },
          annual_physical: { label: 'Annual Physical', icon: <FileTextOutlined /> },
          urgent_care: { label: 'Urgent', icon: <ExclamationCircleOutlined /> },
          consultation: { label: 'Consultation', icon: <MessageOutlined /> },
          procedure: { label: 'Procedure', icon: <MedicineBoxOutlined /> },
        };
        const item = labels[type] || { label: type, icon: null };
        return (
          <Space size={4}>
            {item.icon}
            <Text>{item.label}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColorMap[status] || 'default'}>
          {status.replace(/_/g, ' ').toUpperCase()}
        </Tag>
      ),
    },
  ];

  const statCards = [
    {
      title: "Today's Appointments",
      value: mockDashboardStats.todayAppointments,
      icon: <CalendarOutlined style={{ fontSize: 28, color: '#0D7C8A' }} />,
      color: '#0D7C8A',
      bgColor: '#E6F7F8',
      trend: 12,
      trendUp: true,
    },
    {
      title: 'Total Patients',
      value: mockDashboardStats.totalPatients,
      icon: <TeamOutlined style={{ fontSize: 28, color: '#36CFC9' }} />,
      color: '#36CFC9',
      bgColor: '#E6FFFB',
      trend: 8,
      trendUp: true,
      formatter: (val: number | string) => val.toLocaleString(),
    },
    {
      title: 'Pending Lab Results',
      value: mockDashboardStats.pendingLabResults,
      icon: <ExperimentOutlined style={{ fontSize: 28, color: '#faad14' }} />,
      color: '#faad14',
      bgColor: '#FFF8E6',
      trend: 3,
      trendUp: false,
    },
    {
      title: 'Revenue This Month',
      value: mockDashboardStats.revenue.thisMonth,
      icon: <DollarOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
      color: '#52c41a',
      bgColor: '#F0FFF0',
      trend: 15,
      trendUp: true,
      prefix: '$',
      formatter: (val: number | string) => Number(val).toLocaleString(),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Welcome Banner */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #0D7C8A 0%, #064E57 100%)',
          border: 'none',
        }}
        bodyStyle={{ padding: '28px 32px' }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 4 }}>
              Good {dayjs().hour() < 12 ? 'morning' : dayjs().hour() < 17 ? 'afternoon' : 'evening'}, Dr. {firstName}!
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              {today}
            </Text>
          </Col>
          <Col>
            <Space>
              <Badge count={mockDashboardStats.todayAppointments} offset={[-4, 4]}>
                <Button
                  type="default"
                  size="large"
                  icon={<CalendarOutlined />}
                  style={{
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    border: 'none',
                  }}
                >
                  Today's Schedule
                </Button>
              </Badge>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stat Cards */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              style={{ borderRadius: 14, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              bodyStyle={{ padding: '20px 24px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                    {stat.title}
                  </Text>
                  <Statistic
                    value={stat.value}
                    prefix={stat.prefix}
                    formatter={stat.formatter}
                    valueStyle={{ fontSize: 28, fontWeight: 700, color: '#1a2b3c' }}
                  />
                  <div style={{ marginTop: 8 }}>
                    {stat.trendUp ? (
                      <ArrowUpOutlined style={{ color: '#52c41a', fontSize: 12, marginRight: 4 }} />
                    ) : (
                      <ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 12, marginRight: 4 }} />
                    )}
                    <Text style={{ color: stat.trendUp ? '#52c41a' : '#ff4d4f', fontSize: 13, fontWeight: 600 }}>
                      {stat.trend}%
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                      vs last month
                    </Text>
                  </div>
                </div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: stat.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main Content Row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {/* Appointments Today */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <CalendarOutlined style={{ color: '#0D7C8A' }} />
                <span>Appointments Today</span>
              </Space>
            }
            extra={
              <Button type="link" style={{ color: '#0D7C8A', fontWeight: 600 }}>
                View All
              </Button>
            }
            style={{ borderRadius: 14, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '0 0 8px' }}
          >
            <Table<Appointment>
              dataSource={mockAppointments}
              columns={appointmentColumns}
              rowKey="id"
              pagination={false}
              size="middle"
              showHeader
            />
          </Card>
        </Col>

        {/* Quick Actions + Demographics */}
        <Col xs={24} lg={8}>
          {/* Quick Actions */}
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#0D7C8A' }} />
                <span>Quick Actions</span>
              </Space>
            }
            style={{
              borderRadius: 14,
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              marginBottom: 20,
            }}
          >
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Button
                  block
                  icon={<UserAddOutlined />}
                  style={{
                    height: 72,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={() => navigate('/patients/new')}
                >
                  New Patient
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  block
                  icon={<ScheduleOutlined />}
                  style={{
                    height: 72,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={() => navigate('/appointments/new')}
                >
                  New Appointment
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  block
                  icon={<MedicineBoxOutlined />}
                  style={{
                    height: 72,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={() => navigate('/prescriptions/new')}
                >
                  New Prescription
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  block
                  icon={<ExperimentOutlined />}
                  style={{
                    height: 72,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={() => navigate('/lab-orders/new')}
                >
                  New Lab Order
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Patient Demographics */}
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: '#0D7C8A' }} />
                <span>Patient Demographics</span>
              </Space>
            }
            style={{
              borderRadius: 14,
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={mockPatientDemographics}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {mockPatientDemographics.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
              {mockPatientDemographics.map((item, index) => (
                <Space size={6} key={item.name}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: COLORS[index % COLORS.length],
                    }}
                  />
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {item.name}: {item.value}
                  </Text>
                </Space>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts & Timeline Row */}
      <Row gutter={[20, 20]}>
        {/* Revenue Chart */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <DollarOutlined style={{ color: '#0D7C8A' }} />
                <span>Revenue - Last 7 Days</span>
              </Space>
            }
            style={{ borderRadius: 14, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 13, fill: '#64748b' }}
                  axisLine={{ stroke: '#e8e8e8' }}
                />
                <YAxis
                  tick={{ fontSize: 13, fill: '#64748b' }}
                  axisLine={{ stroke: '#e8e8e8' }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0D7C8A"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#0D7C8A', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, fill: '#0D7C8A' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Recent Activities */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <AuditOutlined style={{ color: '#0D7C8A' }} />
                <span>Recent Activities</span>
              </Space>
            }
            extra={
              <Button type="link" style={{ color: '#0D7C8A', fontWeight: 600 }}>
                View All
              </Button>
            }
            style={{ borderRadius: 14, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            bodyStyle={{ maxHeight: 360, overflowY: 'auto' }}
          >
            <Timeline
              items={mockDashboardStats.recentActivities.map((activity) => ({
                dot: activityIconMap[activity.type] || <ClockCircleOutlined />,
                children: (
                  <div>
                    <Text style={{ fontSize: 14 }}>{activity.description}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {activity.user} &middot; {dayjs(activity.timestamp).format('h:mm A')}
                    </Text>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
