import React, { useState, useEffect, useCallback } from 'react';
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
  Spin,
  Alert,
  Input,
  Modal,
  Tooltip,
  Empty,
  Badge,
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
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
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
import {
  reportsService,
  ReportQuery,
  RevenueReport,
  AppointmentsReport,
  ClinicalReport,
  ProviderPerformanceReport,
  RcmReport,
  NarrativeInsight,
  NaturalLanguageReport,
  NoShowRiskAssessment,
  DenialRiskAssessment,
  RevenueLeakageReport,
  Anomaly,
} from '../../services/reportsService';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const COLORS = ['#0D7C8A', '#36CFC9', '#69C0FF', '#B37FEB', '#FF7A45', '#FFC53D'];
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff4d4f',
  warning: '#faad14',
  info: '#1890ff',
  high: '#ff4d4f',
  medium: '#faad14',
  low: '#52c41a',
};

const ReportsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('last30');
  const [customRange, setCustomRange] = useState<[any, any]>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('revenue');

  // Report data states
  const [revenueData, setRevenueData] = useState<RevenueReport | null>(null);
  const [apptData, setApptData] = useState<AppointmentsReport | null>(null);
  const [clinicalData, setClinicalData] = useState<ClinicalReport | null>(null);
  const [providerData, setProviderData] = useState<ProviderPerformanceReport | null>(null);
  const [rcmData, setRcmData] = useState<RcmReport | null>(null);

  // AI feature states
  const [insights, setInsights] = useState<NarrativeInsight | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [nlQuestion, setNlQuestion] = useState('');
  const [nlReport, setNlReport] = useState<NaturalLanguageReport | null>(null);
  const [nlLoading, setNlLoading] = useState(false);
  const [noShowRisk, setNoShowRisk] = useState<NoShowRiskAssessment[]>([]);
  const [denialRisk, setDenialRisk] = useState<DenialRiskAssessment[]>([]);
  const [leakage, setLeakage] = useState<RevenueLeakageReport | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const buildQuery = useCallback((): ReportQuery => {
    const q: ReportQuery = { dateRange };
    if (dateRange === 'custom' && customRange) {
      q.startDate = customRange[0]?.format('YYYY-MM-DD');
      q.endDate = customRange[1]?.format('YYYY-MM-DD');
    }
    return q;
  }, [dateRange, customRange]);

  // Fetch data when tab or date range changes
  useEffect(() => {
    const query = buildQuery();
    const fetchData = async () => {
      try {
        if (activeTab === 'revenue') {
          setLoading('revenue');
          const data = await reportsService.getRevenueReport(query);
          setRevenueData(data);
        } else if (activeTab === 'appointments') {
          setLoading('appointments');
          const data = await reportsService.getAppointmentsReport(query);
          setApptData(data);
        } else if (activeTab === 'clinical') {
          setLoading('clinical');
          const data = await reportsService.getClinicalReport(query);
          setClinicalData(data);
        } else if (activeTab === 'provider') {
          setLoading('provider');
          const data = await reportsService.getProviderPerformanceReport(query);
          setProviderData(data);
        } else if (activeTab === 'rcm') {
          setLoading('rcm');
          const data = await reportsService.getRcmReport(query);
          setRcmData(data);
        }
      } catch (err: any) {
        message.error(`Failed to load report: ${err.message}`);
      } finally {
        setLoading(null);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dateRange, customRange]);

  // Fetch anomalies on mount
  useEffect(() => {
    reportsService.getAnomalies().then(setAnomalies).catch(() => {});
  }, []);

  const handleExport = async (format: string) => {
    try {
      const blob = await reportsService.exportReport(activeTab, format, buildQuery());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'excel' ? 'xls' : format === 'pdf' ? 'html' : format;
      a.download = `${activeTab}-report.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success(`Report exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      message.error(`Export failed: ${err.message}`);
    }
  };

  const exportMenuItems = [
    { key: 'pdf', label: 'Export as PDF (Print)', icon: <FilePdfOutlined />, onClick: () => handleExport('pdf') },
    { key: 'csv', label: 'Export as CSV', icon: <FileTextOutlined />, onClick: () => handleExport('csv') },
    { key: 'excel', label: 'Export as Excel', icon: <FileExcelOutlined />, onClick: () => handleExport('excel') },
  ];

  const handleGenerateInsights = async () => {
    setInsightsLoading(true);
    try {
      const data = await reportsService.getAiInsights(activeTab, buildQuery());
      setInsights(data);
    } catch (err: any) {
      message.error(`AI insights failed: ${err.message}`);
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!nlQuestion.trim()) return;
    setNlLoading(true);
    try {
      const data = await reportsService.askNaturalLanguage(nlQuestion, buildQuery());
      setNlReport(data);
    } catch (err: any) {
      message.error(`AI query failed: ${err.message}`);
    } finally {
      setNlLoading(false);
    }
  };

  // ─── AI Insights Panel ──────────────────────────────────────────────────────
  const InsightsPanel = () => {
    if (!insights) return null;
    return (
      <Card
        title={
          <Space>
            <RobotOutlined style={{ color: '#0D7C8A' }} />
            <span>AI Insights — {insights.tab}</span>
          </Space>
        }
        bordered={false}
        style={{ marginBottom: 16, borderRadius: 12, background: '#f0f7ff' }}
      >
        <Paragraph>{insights.summary}</Paragraph>
        {insights.bullets.map((b, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <Space align="start">
              {b.severity === 'critical' ? (
                <ExclamationCircleOutlined style={{ color: SEVERITY_COLORS.critical, marginTop: 4 }} />
              ) : b.severity === 'warning' ? (
                <WarningOutlined style={{ color: SEVERITY_COLORS.warning, marginTop: 4 }} />
              ) : (
                <InfoCircleOutlined style={{ color: SEVERITY_COLORS.info, marginTop: 4 }} />
              )}
              <Text>{b.text}</Text>
            </Space>
          </div>
        ))}
        {insights.recommendedActions.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8 }}>
            <Text strong>Recommended Actions:</Text>
            <ul style={{ margin: '8px 0 0 20px' }}>
              {insights.recommendedActions.map((a, i) => (
                <li key={i}><Text>{a}</Text></li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    );
  };

  // ─── Anomaly Alerts ─────────────────────────────────────────────────────────
  const AnomalyAlerts = () => {
    if (anomalies.length === 0) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        {anomalies.map((a, i) => (
          <Alert
            key={i}
            type={a.severity === 'critical' ? 'error' : 'warning'}
            showIcon
            icon={<ThunderboltOutlined />}
            message={`${a.metric}: ${a.value} vs baseline ${a.baseline} (${a.deviation > 0 ? '+' : ''}${a.deviation}% deviation)`}
            style={{ marginBottom: 8, borderRadius: 8 }}
          />
        ))}
      </div>
    );
  };

  // ─── Tab: Revenue ───────────────────────────────────────────────────────────
  const RevenueTab = (
    <Spin spinning={loading === 'revenue'}>
      <AnomalyAlerts />
      <InsightsPanel />
      {revenueData ? (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic
                  title="Total Revenue"
                  value={revenueData.kpis.totalRevenue}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#0D7C8A' }}
                  formatter={(v) => `$${Number(v).toLocaleString()}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic
                  title="Collections Rate"
                  value={revenueData.kpis.collectionsRate}
                  suffix="%"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic
                  title="Avg Per Visit"
                  value={revenueData.kpis.avgPerVisit}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#36CFC9' }}
                  formatter={(v) => `$${Number(v).toLocaleString()}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic
                  title="Outstanding Balance"
                  value={revenueData.kpis.outstandingBalance}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#FF7A45' }}
                  formatter={(v) => `$${Number(v).toLocaleString()}`}
                />
              </Card>
            </Col>
          </Row>

          {revenueData.revenueByMonth.length > 0 ? (
            <Card title="Revenue Trend" bordered={false} style={{ marginBottom: 16, borderRadius: 12 }}>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={revenueData.revenueByMonth}>
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
          ) : (
            <Empty description="No revenue data for this period" style={{ marginBottom: 16 }} />
          )}

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card title="Revenue by Insurance Payer" bordered={false} style={{ borderRadius: 12 }}>
                {revenueData.revenueByPayer.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData.revenueByPayer}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                      <Bar dataKey="value" name="Revenue" radius={[6, 6, 0, 0]}>
                        {revenueData.revenueByPayer.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="No payer data" />}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Payment Method Breakdown" bordered={false} style={{ borderRadius: 12 }}>
                {revenueData.paymentMethodBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={revenueData.paymentMethodBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={55}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {revenueData.paymentMethodBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="No payment data" />}
              </Card>
            </Col>
          </Row>
        </div>
      ) : (
        <Empty description="Select a date range to view revenue data" />
      )}
    </Spin>
  );

  // ─── Tab: Appointments ──────────────────────────────────────────────────────
  const AppointmentsTab = (
    <Spin spinning={loading === 'appointments'}>
      <InsightsPanel />
      {apptData ? (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Total Appointments" value={apptData.kpis.totalAppointments} valueStyle={{ color: '#0D7C8A' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Completion Rate" value={apptData.kpis.completionRate} suffix="%" valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="No-Show Rate" value={apptData.kpis.noShowRate} suffix="%" valueStyle={{ color: '#FF7A45' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Telehealth" value={apptData.kpis.telehealthCount} valueStyle={{ color: '#B37FEB' }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="Appointments by Day" bordered={false} style={{ borderRadius: 12 }}>
                {apptData.appointmentsByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={apptData.appointmentsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="appointments" fill={COLORS[0]} name="Appointments" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="noShows" fill={COLORS[4]} name="No-Shows" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="No appointment data" />}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Appointment Type Distribution" bordered={false} style={{ borderRadius: 12 }}>
                {apptData.appointmentTypeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={apptData.appointmentTypeDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {apptData.appointmentTypeDistribution.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="No type data" />}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="No-Show Rate Trend" bordered={false} style={{ borderRadius: 12 }}>
                {apptData.noShowTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={apptData.noShowTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip formatter={(v: number) => `${v}%`} />
                      <Area type="monotone" dataKey="rate" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.15} strokeWidth={2} name="No-Show Rate" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <Empty description="No trend data" />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Utilization Rate by Provider" bordered={false} style={{ borderRadius: 12 }}>
                {apptData.utilizationByProvider.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={apptData.utilizationByProvider} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={80} />
                      <RechartsTooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="utilization" name="Utilization" radius={[0, 6, 6, 0]}>
                        {apptData.utilizationByProvider.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="No utilization data" />}
              </Card>
            </Col>
          </Row>
        </div>
      ) : (
        <Empty description="Select a date range to view appointment data" />
      )}
    </Spin>
  );

  // ─── Tab: Clinical ──────────────────────────────────────────────────────────
  const ClinicalTab = (
    <Spin spinning={loading === 'clinical'}>
      <InsightsPanel />
      {clinicalData ? (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Total Encounters" value={clinicalData.kpis.totalEncounters} valueStyle={{ color: '#0D7C8A' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Avg Duration" value={clinicalData.kpis.avgEncounterDuration} suffix="min" valueStyle={{ color: '#36CFC9' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Prescriptions" value={clinicalData.kpis.prescriptionsWritten} valueStyle={{ color: '#B37FEB' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Lab Orders" value={clinicalData.kpis.labOrders} valueStyle={{ color: '#FF7A45' }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="Top Diagnoses (ICD-10)" bordered={false} style={{ borderRadius: 12 }}>
                {clinicalData.topDiagnoses.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={clinicalData.topDiagnoses} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                      <RechartsTooltip />
                      <Bar dataKey="count" name="Cases" radius={[0, 6, 6, 0]}>
                        {clinicalData.topDiagnoses.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="No diagnosis data" />}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Encounters by Type" bordered={false} style={{ borderRadius: 12 }}>
                {clinicalData.encountersByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={clinicalData.encountersByType}
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={55}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {clinicalData.encountersByType.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty description="No encounter type data" />}
              </Card>
            </Col>
          </Row>

          {clinicalData.prescriptionTrends.length > 0 && (
            <Card title="Prescription Trends" bordered={false} style={{ borderRadius: 12 }}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={clinicalData.prescriptionTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="prescriptions" stroke={COLORS[3]} fill={COLORS[3]} fillOpacity={0.15} strokeWidth={2} name="Prescriptions" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      ) : (
        <Empty description="Select a date range to view clinical data" />
      )}
    </Spin>
  );

  // ─── Tab: Provider Performance ──────────────────────────────────────────────
  const providerColumns = [
    { title: 'Provider', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Specialty', dataIndex: 'specialty', key: 'specialty', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Patients Seen', dataIndex: 'patientsSeen', key: 'patientsSeen', sorter: (a: any, b: any) => a.patientsSeen - b.patientsSeen },
    {
      title: 'Revenue Generated',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (v: number) => `$${v.toLocaleString()}`,
      sorter: (a: any, b: any) => a.revenue - b.revenue,
    },
    {
      title: 'Encounters',
      dataIndex: 'encounters',
      key: 'encounters',
      sorter: (a: any, b: any) => a.encounters - b.encounters,
    },
    {
      title: 'Utilization %',
      dataIndex: 'utilization',
      key: 'utilization',
      render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 85 ? '#0D7C8A' : v >= 70 ? '#36CFC9' : '#faad14'} />,
    },
  ];

  const ProviderTab = (
    <Spin spinning={loading === 'provider'}>
      <InsightsPanel />
      {providerData ? (
        <div>
          <Card title="Provider Comparison" bordered={false} style={{ marginBottom: 16, borderRadius: 12 }}>
            {providerData.providers.length > 0 ? (
              <Table dataSource={providerData.providers} columns={providerColumns} pagination={false} size="middle" rowKey="id" />
            ) : (
              <Empty description="No provider data for this period" />
            )}
          </Card>

          {providerData.productivity.length > 0 && (
            <Card title="Provider Productivity" bordered={false} style={{ borderRadius: 12 }}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={providerData.productivity}>
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
          )}
        </div>
      ) : (
        <Empty description="Select a date range to view provider data" />
      )}
    </Spin>
  );

  // ─── Tab: RCM & Denials ─────────────────────────────────────────────────────
  const RcmTab = (
    <Spin spinning={loading === 'rcm'}>
      <InsightsPanel />
      {rcmData ? (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Total Billed" value={rcmData.kpis.totalBilled} prefix={<DollarOutlined />} valueStyle={{ color: '#0D7C8A' }} formatter={(v) => `$${Number(v).toLocaleString()}`} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Denial Rate" value={rcmData.kpis.denialRate} suffix="%" valueStyle={{ color: rcmData.kpis.denialRate > 5 ? '#ff4d4f' : '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Avg Days in A/R" value={rcmData.kpis.avgDaysInAR} valueStyle={{ color: '#36CFC9' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic title="Over 90 Days" value={rcmData.kpis.over90Days} prefix={<DollarOutlined />} valueStyle={{ color: '#ff4d4f' }} formatter={(v) => `$${Number(v).toLocaleString()}`} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <Card title="A/R Aging" bordered={false} style={{ borderRadius: 12 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={rcmData.arAging}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="bucket" />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="amount" name="Outstanding" radius={[6, 6, 0, 0]}>
                      {rcmData.arAging.map((_, i) => (
                        <Cell key={i} fill={i === 3 ? '#ff4d4f' : COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Denials by Reason" bordered={false} style={{ borderRadius: 12 }}>
                {rcmData.denialsByReason.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={rcmData.denialsByReason} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="reason" width={120} tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Bar dataKey="amount" name="Denied Amount" radius={[0, 6, 6, 0]} fill={COLORS[4]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty description="No denial data" />}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Denials by Payer" bordered={false} style={{ borderRadius: 12 }}>
                {rcmData.denialsByPayer.length > 0 ? (
                  <Table
                    dataSource={rcmData.denialsByPayer}
                    columns={[
                      { title: 'Payer', dataIndex: 'payer', key: 'payer' },
                      { title: 'Count', dataIndex: 'count', key: 'count' },
                      { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (v: number) => `$${v.toLocaleString()}` },
                    ]}
                    pagination={false}
                    size="small"
                    rowKey="payer"
                  />
                ) : <Empty description="No payer denial data" />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Top Denial Codes" bordered={false} style={{ borderRadius: 12 }}>
                {rcmData.topDenialCodes.length > 0 ? (
                  <Table
                    dataSource={rcmData.topDenialCodes}
                    columns={[
                      { title: 'Code', dataIndex: 'code', key: 'code', width: 60 },
                      { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
                      { title: 'Count', dataIndex: 'count', key: 'count', width: 60 },
                      { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (v: number) => `$${v.toLocaleString()}`, width: 90 },
                    ]}
                    pagination={false}
                    size="small"
                    rowKey="code"
                  />
                ) : <Empty description="No denial code data" />}
              </Card>
            </Col>
          </Row>
        </div>
      ) : (
        <Empty description="Select a date range to view RCM data" />
      )}
    </Spin>
  );

  // ─── Tab: AI Analytics ──────────────────────────────────────────────────────
  const AiTab = (
    <div>
      {/* Natural Language Report Builder */}
      <Card
        title={
          <Space>
            <RobotOutlined style={{ color: '#0D7C8A' }} />
            <span>Ask the Data — Natural Language Report Builder</span>
          </Space>
        }
        bordered={false}
        style={{ marginBottom: 16, borderRadius: 12 }}
      >
        <Paragraph type="secondary">
          Ask a question about your practice data in plain English. AI will interpret it, fetch the relevant data, and provide commentary.
        </Paragraph>
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            placeholder="e.g., Which providers had the highest denial rate last quarter?"
            value={nlQuestion}
            onChange={(e) => setNlQuestion(e.target.value)}
            onPressEnter={handleAskQuestion}
            prefix={<SearchOutlined />}
            size="large"
          />
          <Button type="primary" size="large" onClick={handleAskQuestion} loading={nlLoading} icon={<RobotOutlined />}>
            Ask
          </Button>
        </Space.Compact>

        {nlReport && (
          <div style={{ padding: 16, background: '#f0f7ff', borderRadius: 8 }}>
            <Text strong>Interpretation:</Text>
            <Paragraph>{nlReport.interpretation}</Paragraph>
            <Text strong>AI Commentary:</Text>
            <Paragraph>{nlReport.aiCommentary}</Paragraph>
            {nlReport.data.length > 0 && (
              <Table
                dataSource={nlReport.data}
                columns={nlReport.columns.map((c) => ({ title: c, dataIndex: c, key: c }))}
                pagination={{ pageSize: 10 }}
                size="small"
                rowKey={(_, i) => String(i)}
                style={{ marginTop: 12 }}
              />
            )}
          </div>
        )}
      </Card>

      {/* Revenue Leakage Report */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#FF7A45' }} />
            <span>Revenue Leakage Report</span>
          </Space>
        }
        bordered={false}
        style={{ marginBottom: 16, borderRadius: 12 }}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<RiseOutlined />}
            onClick={async () => {
              try {
                const data = await reportsService.getRevenueLeakage();
                setLeakage(data);
              } catch (err: any) {
                message.error(`Failed: ${err.message}`);
              }
            }}
          >
            Analyze Revenue Leakage
          </Button>
        </Space>

        {leakage && (
          <div>
            <Statistic
              title="Total Estimated Recovery"
              value={leakage.totalEstimatedRecovery}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
              formatter={(v) => `$${Number(v).toLocaleString()}`}
            />
            <Alert message={leakage.aiSummary} type="info" style={{ margin: '12px 0', borderRadius: 8 }} />
            <Row gutter={[16, 16]}>
              {leakage.categories.map((cat, i) => (
                <Col xs={24} sm={12} key={i}>
                  <Card size="small" style={{ borderRadius: 8 }}>
                    <Statistic
                      title={cat.category}
                      value={cat.estimatedRecovery}
                      prefix={<DollarOutlined />}
                      formatter={(v) => `$${Number(v).toLocaleString()}`}
                    />
                    <Text type="secondary">{cat.count} items</Text>
                  </Card>
                </Col>
              ))}
            </Row>
            {leakage.prioritizedActions.length > 0 && (
              <Card title="Prioritized Actions" size="small" style={{ marginTop: 12, borderRadius: 8 }}>
                {leakage.prioritizedActions.map((a, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <Space>
                      <Badge color={a.priority === 'high' ? '#ff4d4f' : '#faad14'} />
                      <Text>{a.action}</Text>
                    </Space>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </Card>

      {/* No-Show Risk Prediction */}
      <Card
        title={
          <Space>
            <CalendarOutlined style={{ color: '#B37FEB' }} />
            <span>No-Show Risk Prediction</span>
          </Space>
        }
        bordered={false}
        style={{ marginBottom: 16, borderRadius: 12 }}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={async () => {
              try {
                const data = await reportsService.getNoShowRisk(7);
                setNoShowRisk(data);
              } catch (err: any) {
                message.error(`Failed: ${err.message}`);
              }
            }}
          >
            Predict Next 7 Days
          </Button>
        </Space>

        {noShowRisk.length > 0 && (
          <Table
            dataSource={noShowRisk}
            columns={[
              { title: 'Patient', dataIndex: 'patientName', key: 'patientName' },
              { title: 'Appointment', dataIndex: 'appointmentDate', key: 'appointmentDate', render: (v: string) => new Date(v).toLocaleString() },
              {
                title: 'Risk Score',
                dataIndex: 'riskScore',
                key: 'riskScore',
                render: (v: number, r: any) => (
                  <Space>
                    <Progress percent={v} size="small" strokeColor={SEVERITY_COLORS[r.riskLevel]} />
                    <Tag color={SEVERITY_COLORS[r.riskLevel]}>{r.riskLevel}</Tag>
                  </Space>
                ),
              },
              {
                title: 'Risk Factors',
                dataIndex: 'factors',
                key: 'factors',
                render: (factors: string[]) => (
                  <Tooltip title={factors.join('; ')}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {factors[0]}{factors.length > 1 ? ` (+${factors.length - 1} more)` : ''}
                    </Text>
                  </Tooltip>
                ),
              },
            ]}
            pagination={{ pageSize: 10 }}
            size="small"
            rowKey="appointmentId"
          />
        )}
      </Card>

      {/* Denial Risk Prediction */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            <span>Denial Risk Prediction</span>
          </Space>
        }
        bordered={false}
        style={{ borderRadius: 12 }}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={async () => {
              try {
                const data = await reportsService.getDenialRisk();
                setDenialRisk(data);
              } catch (err: any) {
                message.error(`Failed: ${err.message}`);
              }
            }}
          >
            Analyze Unsubmitted Claims
          </Button>
        </Space>

        {denialRisk.length > 0 && (
          <Table
            dataSource={denialRisk}
            columns={[
              { title: 'Patient', dataIndex: 'patientName', key: 'patientName' },
              { title: 'Payer', dataIndex: 'payer', key: 'payer' },
              {
                title: 'Risk Score',
                dataIndex: 'riskScore',
                key: 'riskScore',
                render: (v: number, r: any) => (
                  <Space>
                    <Progress percent={v} size="small" strokeColor={SEVERITY_COLORS[r.riskLevel]} />
                    <Tag color={SEVERITY_COLORS[r.riskLevel]}>{r.riskLevel}</Tag>
                  </Space>
                ),
              },
              {
                title: 'Risk Factors',
                dataIndex: 'factors',
                key: 'factors',
                render: (factors: string[]) => (
                  <Tooltip title={factors.join('; ')}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {factors[0]}{factors.length > 1 ? ` (+${factors.length - 1} more)` : ''}
                    </Text>
                  </Tooltip>
                ),
              },
              {
                title: 'Suggested Actions',
                dataIndex: 'suggestedActions',
                key: 'suggestedActions',
                render: (actions: string[]) => (
                  <Tooltip title={actions.join('\n')}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {actions[0]}{actions.length > 1 ? ` (+${actions.length - 1} more)` : ''}
                    </Text>
                  </Tooltip>
                ),
              },
            ]}
            pagination={{ pageSize: 10 }}
            size="small"
            rowKey="claimId"
          />
        )}
      </Card>
    </div>
  );

  const tabItems = [
    { key: 'revenue', label: <span><DollarOutlined style={{ marginRight: 6 }} />Revenue</span>, children: RevenueTab },
    { key: 'appointments', label: <span><CalendarOutlined style={{ marginRight: 6 }} />Appointments</span>, children: AppointmentsTab },
    { key: 'clinical', label: <span><MedicineBoxOutlined style={{ marginRight: 6 }} />Clinical</span>, children: ClinicalTab },
    { key: 'provider', label: <span><TeamOutlined style={{ marginRight: 6 }} />Provider Performance</span>, children: ProviderTab },
    { key: 'rcm', label: <span><WarningOutlined style={{ marginRight: 6 }} />RCM & Denials</span>, children: RcmTab },
    { key: 'ai', label: <span><RobotOutlined style={{ marginRight: 6 }} />AI Analytics</span>, children: AiTab },
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
                { label: 'Last 90 Days', value: 'last90' },
                { label: 'This Month', value: 'thisMonth' },
                { label: 'This Quarter', value: 'thisQuarter' },
                { label: 'This Year', value: 'thisYear' },
                { label: 'Last Year', value: 'lastYear' },
                { label: 'Custom Range', value: 'custom' },
              ]}
            />
            {dateRange === 'custom' && <RangePicker style={{ borderRadius: 8 }} onChange={setCustomRange} />}
            {activeTab !== 'ai' && (
              <>
                <Button
                  icon={<RobotOutlined />}
                  onClick={handleGenerateInsights}
                  loading={insightsLoading}
                  style={{ borderRadius: 8 }}
                >
                  AI Insights
                </Button>
                <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
                  <Button icon={<DownloadOutlined />} style={{ borderRadius: 8 }}>Export</Button>
                </Dropdown>
              </>
            )}
          </Space>
        </Col>
      </Row>

      {/* Report Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ marginTop: -8 }}
      />
    </div>
  );
};

export default ReportsPage;
