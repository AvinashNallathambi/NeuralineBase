import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  Tabs,
  DatePicker,
  Space,
  Statistic,
  Table,
  Tag,
  Dropdown,
  Select,
  Progress,
  message,
} from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DollarOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ─── Chart Colors ───────────────────────────────────────────────────────────────
const COLORS = ['#0D7C8A', '#36CFC9', '#69C0FF', '#B37FEB', '#FF7A45', '#FFC53D'];

// ─── Mock Chart Data ────────────────────────────────────────────────────────────
const revenueByMonth = [
  { name: 'Jan', revenue: 62400, collections: 58100 },
  { name: 'Feb', revenue: 58900, collections: 55200 },
  { name: 'Mar', revenue: 71200, collections: 67800 },
  { name: 'Apr', revenue: 68500, collections: 64300 },
  { name: 'May', revenue: 74100, collections: 70500 },
  { name: 'Jun', revenue: 69800, collections: 66200 },
  { name: 'Jul', revenue: 76300, collections: 72100 },
  { name: 'Aug', revenue: 72900, collections: 69400 },
  { name: 'Sep', revenue: 79500, collections: 75800 },
  { name: 'Oct', revenue: 81200, collections: 77600 },
  { name: 'Nov', revenue: 78400, collections: 74900 },
  { name: 'Dec', revenue: 84100, collections: 80200 },
];

const revenueByPayer = [
  { name: 'BCBS', value: 245000 },
  { name: 'Aetna', value: 187000 },
  { name: 'UnitedHealth', value: 198000 },
  { name: 'Cigna', value: 142000 },
  { name: 'Medicare', value: 165000 },
  { name: 'Self-Pay', value: 38000 },
];

const paymentMethodBreakdown = [
  { name: 'Insurance', value: 72 },
  { name: 'Co-Pay', value: 15 },
  { name: 'Self-Pay', value: 8 },
  { name: 'Medicaid', value: 5 },
];

const appointmentsByDay = [
  { name: 'Mon', appointments: 24, noShows: 2 },
  { name: 'Tue', appointments: 28, noShows: 1 },
  { name: 'Wed', appointments: 22, noShows: 3 },
  { name: 'Thu', appointments: 26, noShows: 2 },
  { name: 'Fri', appointments: 20, noShows: 1 },
  { name: 'Sat', appointments: 8, noShows: 0 },
  { name: 'Sun', appointments: 0, noShows: 0 },
];

const appointmentTypeDistribution = [
  { name: 'Follow-Up', value: 35 },
  { name: 'New Patient', value: 18 },
  { name: 'Annual Physical', value: 15 },
  { name: 'Telehealth', value: 22 },
  { name: 'Urgent Care', value: 10 },
];

const noShowTrend = [
  { name: 'Jan', rate: 8.2 },
  { name: 'Feb', rate: 7.5 },
  { name: 'Mar', rate: 9.1 },
  { name: 'Apr', rate: 6.8 },
  { name: 'May', rate: 7.2 },
  { name: 'Jun', rate: 5.9 },
  { name: 'Jul', rate: 6.4 },
  { name: 'Aug', rate: 5.5 },
  { name: 'Sep', rate: 4.8 },
  { name: 'Oct', rate: 5.2 },
  { name: 'Nov', rate: 4.5 },
  { name: 'Dec', rate: 4.1 },
];

const utilizationByProvider = [
  { name: 'Dr. Chen', utilization: 92 },
  { name: 'Dr. Wilson', utilization: 87 },
  { name: 'Dr. Patel', utilization: 78 },
  { name: 'NP Adams', utilization: 85 },
];

const topDiagnoses = [
  { name: 'I10 - Hypertension', count: 142 },
  { name: 'E11.9 - T2 Diabetes', count: 98 },
  { name: 'J06.9 - Acute URI', count: 87 },
  { name: 'M54.5 - Low Back Pain', count: 76 },
  { name: 'J45.20 - Asthma', count: 64 },
  { name: 'F32.9 - Depression', count: 58 },
  { name: 'E78.5 - Hyperlipidemia', count: 52 },
  { name: 'K21.0 - GERD', count: 45 },
];

const encountersByType = [
  { name: 'Office Visit', value: 58 },
  { name: 'Telehealth', value: 25 },
  { name: 'Procedure', value: 10 },
  { name: 'Emergency', value: 4 },
  { name: 'Inpatient', value: 3 },
];

const prescriptionTrends = [
  { name: 'Jan', prescriptions: 185 },
  { name: 'Feb', prescriptions: 192 },
  { name: 'Mar', prescriptions: 210 },
  { name: 'Apr', prescriptions: 198 },
  { name: 'May', prescriptions: 225 },
  { name: 'Jun', prescriptions: 218 },
  { name: 'Jul', prescriptions: 232 },
  { name: 'Aug', prescriptions: 228 },
  { name: 'Sep', prescriptions: 245 },
  { name: 'Oct', prescriptions: 256 },
  { name: 'Nov', prescriptions: 248 },
  { name: 'Dec', prescriptions: 262 },
];

const providerPerformance = [
  { key: '1', name: 'Dr. Sarah Chen', specialty: 'Internal Medicine', patientsSeen: 312, revenue: 142500, avgRating: 4.9, utilization: 92 },
  { key: '2', name: 'Dr. James Wilson', specialty: 'Cardiology', patientsSeen: 248, revenue: 185200, avgRating: 4.7, utilization: 87 },
  { key: '3', name: 'Dr. Priya Patel', specialty: 'Pediatrics', patientsSeen: 285, revenue: 118900, avgRating: 4.8, utilization: 78 },
  { key: '4', name: 'NP Rachel Adams', specialty: 'Family Medicine', patientsSeen: 198, revenue: 82400, avgRating: 4.6, utilization: 85 },
];

const providerProductivity = [
  { name: 'Dr. Chen', patients: 312, encounters: 345 },
  { name: 'Dr. Wilson', patients: 248, encounters: 280 },
  { name: 'Dr. Patel', patients: 285, encounters: 310 },
  { name: 'NP Adams', patients: 198, encounters: 215 },
];

// ─── Component ──────────────────────────────────────────────────────────────────
const ReportsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('last30');

  const handleExport = (format: string) => {
    message.success(`Report exported as ${format.toUpperCase()}`);
  };

  const exportMenuItems = [
    { key: 'pdf', label: 'Export as PDF', icon: <FilePdfOutlined />, onClick: () => handleExport('pdf') },
    { key: 'csv', label: 'Export as CSV', icon: <FileTextOutlined />, onClick: () => handleExport('csv') },
    { key: 'excel', label: 'Export as Excel', icon: <FileExcelOutlined />, onClick: () => handleExport('excel') },
  ];

  const providerColumns = [
    { title: 'Provider', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Specialty', dataIndex: 'specialty', key: 'specialty', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Patients Seen', dataIndex: 'patientsSeen', key: 'patientsSeen', sorter: (a: (typeof providerPerformance)[0], b: (typeof providerPerformance)[0]) => a.patientsSeen - b.patientsSeen },
    {
      title: 'Revenue Generated',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (v: number) => `$${v.toLocaleString()}`,
      sorter: (a: (typeof providerPerformance)[0], b: (typeof providerPerformance)[0]) => a.revenue - b.revenue,
    },
    {
      title: 'Avg Rating',
      dataIndex: 'avgRating',
      key: 'avgRating',
      render: (v: number) => (
        <Space>
          <Text strong style={{ color: v >= 4.5 ? '#52c41a' : '#faad14' }}>{v}</Text>
          <Text type="secondary">/ 5.0</Text>
        </Space>
      ),
    },
    {
      title: 'Utilization %',
      dataIndex: 'utilization',
      key: 'utilization',
      render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 85 ? '#0D7C8A' : v >= 70 ? '#36CFC9' : '#faad14'} />,
    },
  ];

  // ─── Tab: Revenue ─────────────────────────────────────────────────────────────
  const RevenueTab = (
    <div>
      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Total Revenue"
              value={877300}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#0D7C8A' }}
              formatter={(v) => `$${Number(v).toLocaleString()}`}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ArrowUpOutlined style={{ color: '#52c41a' }} /> 12.5% vs last year
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Collections Rate"
              value={94.8}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ArrowUpOutlined style={{ color: '#52c41a' }} /> 2.1% improvement
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Average Per Visit"
              value={245}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#36CFC9' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ArrowUpOutlined style={{ color: '#52c41a' }} /> $12 from last month
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic
              title="Outstanding Balance"
              value={42800}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#FF7A45' }}
              formatter={(v) => `$${Number(v).toLocaleString()}`}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ArrowDownOutlined style={{ color: '#52c41a' }} /> 8.3% decrease
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Revenue Trend */}
      <Card title="Revenue Trend (Last 12 Months)" bordered={false} style={{ marginBottom: 16, borderRadius: 12 }}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={revenueByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <RechartsTooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
            <Line type="monotone" dataKey="collections" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 4 }} name="Collections" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Revenue by Payer */}
        <Col xs={24} lg={14}>
          <Card title="Revenue by Insurance Payer" bordered={false} style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByPayer}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="value" name="Revenue" radius={[6, 6, 0, 0]}>
                  {revenueByPayer.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        {/* Payment Method Breakdown */}
        <Col xs={24} lg={10}>
          <Card title="Payment Method Breakdown" bordered={false} style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={55}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {paymentMethodBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );

  // ─── Tab: Appointments ────────────────────────────────────────────────────────
  const AppointmentsTab = (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic title="Total Appointments" value={1024} valueStyle={{ color: '#0D7C8A' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic title="Completion Rate" value={91.2} suffix="%" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic title="No-Show Rate" value={4.1} suffix="%" valueStyle={{ color: '#FF7A45' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic title="Avg Wait Time" value={12} suffix="min" valueStyle={{ color: '#B37FEB' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Appointments by Day" bordered={false} style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={appointmentsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="appointments" fill={COLORS[0]} name="Appointments" radius={[6, 6, 0, 0]} />
                <Bar dataKey="noShows" fill={COLORS[4]} name="No-Shows" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Appointment Type Distribution" bordered={false} style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={appointmentTypeDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {appointmentTypeDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="No-Show Rate Trend" bordered={false} style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={noShowTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${v}%`} />
                <RechartsTooltip formatter={(v: number) => `${v}%`} />
                <Area type="monotone" dataKey="rate" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.15} strokeWidth={2} name="No-Show Rate" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Utilization Rate by Provider" bordered={false} style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={utilizationByProvider} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={80} />
                <RechartsTooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="utilization" name="Utilization" radius={[0, 6, 6, 0]}>
                  {utilizationByProvider.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );

  // ─── Tab: Clinical ────────────────────────────────────────────────────────────
  const ClinicalTab = (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic title="Total Encounters" value={1843} valueStyle={{ color: '#0D7C8A' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic title="Avg Encounter Duration" value={24} suffix="min" valueStyle={{ color: '#36CFC9' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic title="Prescriptions Written" value={2499} valueStyle={{ color: '#B37FEB' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <Statistic title="Unique Diagnoses" value={156} valueStyle={{ color: '#FF7A45' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Top Diagnoses (ICD-10)" bordered={false} style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topDiagnoses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Bar dataKey="count" name="Cases" radius={[0, 6, 6, 0]}>
                  {topDiagnoses.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Encounters by Type" bordered={false} style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={encountersByType}
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={55}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {encountersByType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="Prescription Trends" bordered={false} style={{ borderRadius: 12 }}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={prescriptionTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Area type="monotone" dataKey="prescriptions" stroke={COLORS[3]} fill={COLORS[3]} fillOpacity={0.15} strokeWidth={2} name="Prescriptions" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );

  // ─── Tab: Provider Performance ────────────────────────────────────────────────
  const ProviderTab = (
    <div>
      <Card title="Provider Comparison" bordered={false} style={{ marginBottom: 16, borderRadius: 12 }}>
        <Table
          dataSource={providerPerformance}
          columns={providerColumns}
          pagination={false}
          size="middle"
        />
      </Card>

      <Card title="Provider Productivity" bordered={false} style={{ borderRadius: 12 }}>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={providerProductivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar dataKey="patients" fill={COLORS[0]} name="Patients Seen" radius={[6, 6, 0, 0]} />
            <Bar dataKey="encounters" fill={COLORS[1]} name="Total Encounters" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );

  const tabItems = [
    {
      key: 'revenue',
      label: (
        <span>
          <DollarOutlined style={{ marginRight: 6 }} />
          Revenue
        </span>
      ),
      children: RevenueTab,
    },
    {
      key: 'appointments',
      label: (
        <span>
          <CalendarOutlined style={{ marginRight: 6 }} />
          Appointments
        </span>
      ),
      children: AppointmentsTab,
    },
    {
      key: 'clinical',
      label: (
        <span>
          <MedicineBoxOutlined style={{ marginRight: 6 }} />
          Clinical
        </span>
      ),
      children: ClinicalTab,
    },
    {
      key: 'provider',
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 6 }} />
          Provider Performance
        </span>
      ),
      children: ProviderTab,
    },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 12, color: '#0D7C8A' }} />
            Reports & Analytics
          </Title>
        </Col>
        <Col>
          <Space>
            <Select
              value={dateRange}
              onChange={setDateRange}
              style={{ width: 160 }}
              options={[
                { label: 'Last 7 Days', value: 'last7' },
                { label: 'Last 30 Days', value: 'last30' },
                { label: 'This Month', value: 'thisMonth' },
                { label: 'This Quarter', value: 'thisQuarter' },
                { label: 'Custom Range', value: 'custom' },
              ]}
            />
            {dateRange === 'custom' && <RangePicker style={{ borderRadius: 8 }} />}
            <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
              <Button icon={<DownloadOutlined />} style={{ borderRadius: 8 }}>
                Export Report
              </Button>
            </Dropdown>
          </Space>
        </Col>
      </Row>

      {/* Report Tabs */}
      <Tabs
        defaultActiveKey="revenue"
        items={tabItems}
        size="large"
        style={{ marginTop: -8 }}
      />
    </div>
  );
};

export default ReportsPage;
