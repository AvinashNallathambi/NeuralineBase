import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Button,
  Card,
  Table,
  Tag,
  Space,
  Select,
  Spin,
  Empty,
  Row,
  Col,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  ExperimentOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  laboratoryService,
  type LabResult,
} from '../../services/laboratoryService';
import { usePatientStore } from '../../store/dataStore';

const { Title, Text } = Typography;

const flagColors: Record<string, string> = {
  normal: 'green',
  high: 'orange',
  low: 'blue',
  critical_high: 'red',
  critical_low: 'red',
};

const PatientLabHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const { patients, fetchPatients } = usePatientStore();
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoinc, setSelectedLoinc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (patients.length === 0) fetchPatients();
  }, [patients.length, fetchPatients]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!patientId) return;
      setLoading(true);
      try {
        const data = await laboratoryService.getPatientLabHistory(patientId, selectedLoinc);
        setResults(data);
      } catch (error) {
        console.error('Failed to load lab history:', error);
        message.error('Failed to load lab history');
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [patientId, selectedLoinc]);

  const patient = patients.find((p) => p.id === patientId);

  // Group results by test for the trend chart
  const testGroups = useMemo(() => {
    const groups: Record<string, { name: string; loinc: string; results: LabResult[] }> = {};
    for (const r of results) {
      const testName = (r as any).testName || `Test ${r.testId.slice(0, 8)}`;
      const key = r.testId;
      if (!groups[key]) {
        groups[key] = { name: testName, loinc: (r as any).loincCode || '', results: [] };
      }
      groups[key].results.push(r);
    }
    return groups;
  }, [results]);

  // Available tests for the filter dropdown
  const testOptions = useMemo(() => {
    return Object.entries(testGroups).map(([key, g]) => ({
      value: key,
      label: g.name,
    }));
  }, [testGroups]);

  // Chart data: for the selected test (or all), build data points sorted by date
  const chartData = useMemo(() => {
    const groups = selectedLoinc
      ? { [selectedLoinc]: testGroups[selectedLoinc] }
      : testGroups;
    const allPoints: any[] = [];
    for (const [, g] of Object.entries(groups)) {
      for (const r of g.results) {
        if (r.numericValue !== null && r.numericValue !== undefined) {
          allPoints.push({
            date: new Date(r.resultedAt).toLocaleDateString(),
            value: r.numericValue,
            unit: r.unit,
            flag: r.flag,
            testName: g.name,
            referenceRange: r.referenceRange,
          });
        }
      }
    }
    allPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return allPoints;
  }, [testGroups, selectedLoinc]);

  // History table columns
  const columns: ColumnsType<LabResult> = [
    {
      title: 'Date',
      dataIndex: 'resultedAt',
      key: 'resultedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: 'Test',
      key: 'testName',
      width: 200,
      render: (_: unknown, r: any) => r.testName || `Test ${r.testId.slice(0, 8)}`,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: 120,
      render: (v: string, r: LabResult) => (
        <Space>
          <Text strong style={r.flag?.startsWith('critical') ? { color: '#ff4d4f' } : undefined}>
            {v}
          </Text>
          {r.unit && <Text type="secondary">{r.unit}</Text>}
        </Space>
      ),
    },
    {
      title: 'Flag',
      dataIndex: 'flag',
      key: 'flag',
      width: 120,
      render: (flag: string) =>
        flag && flag !== 'normal' ? (
          <Tag color={flagColors[flag] || 'default'}>
            {flag.replace('_', ' ').toUpperCase()}
          </Tag>
        ) : (
          <Tag color="green">Normal</Tag>
        ),
    },
    {
      title: 'Ref Range',
      dataIndex: 'referenceRange',
      key: 'referenceRange',
      width: 150,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'resultStatus',
      key: 'resultStatus',
      width: 100,
      render: (s: string) => <Tag>{s}</Tag>,
    },
    {
      title: 'Resulted By',
      dataIndex: 'resultedBy',
      key: 'resultedBy',
      width: 120,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
  ];

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/laboratory')}>
              Back
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              Lab History
            </Title>
          </Space>
        </Col>
      </Row>

      {/* Patient info */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <ExperimentOutlined style={{ fontSize: 24, color: '#0D7C8A' }} />
          <div>
            <Title level={5} style={{ margin: 0 }}>
              {patient
                ? `${patient.firstName} ${patient.lastName}`
                : `Patient ${patientId?.slice(0, 8)}...`}
            </Title>
            {patient && (
              <Text type="secondary">
                MRN: {patient.mrn} · DOB: {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '—'}
              </Text>
            )}
          </div>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {/* Trend Chart */}
        <Card
          title={
            <Space>
              <LineChartOutlined />
              Trend Chart
            </Space>
          }
          extra={
            <Select
              allowClear
              placeholder="Filter by test..."
              style={{ width: 250 }}
              value={selectedLoinc}
              onChange={(v) => setSelectedLoinc(v)}
              options={testOptions}
            />
          }
          style={{ marginBottom: 16 }}
        >
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RTooltip
                  formatter={(value: any) => [`Value: ${value}`, 'Result']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0D7C8A"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Result Value"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="No numeric results available for trend chart" />
          )}
        </Card>

        {/* History Table */}
        <Card title="Result History">
          <Table
            columns={columns}
            dataSource={results}
            rowKey="id"
            pagination={{ pageSize: 20, showSizeChanger: true }}
            size="small"
            scroll={{ x: 900 }}
            locale={{ emptyText: 'No lab results found for this patient' }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default PatientLabHistoryPage;
