import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  List,
  Tag,
  Spin,
  Empty,
  Space,
  Collapse,
  Table,
  Button,
  Tooltip,
} from 'antd';
import { ExperimentOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text } = Typography;

const PortalLabResultsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [labs, setLabs] = useState<any[]>([]);

  useEffect(() => {
    loadLabs();
  }, []);

  const loadLabs = async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getLabResults();
      setLabs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'default',
    ordered: 'blue',
    collected: 'cyan',
    in_progress: 'processing',
    resulted: 'green',
    completed: 'green',
    cancelled: 'red',
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const renderResultTable = (tests: any[]) => {
    const columns = [
      {
        title: 'Test',
        dataIndex: 'name',
        key: 'name',
        render: (text: string, r: any) => (
          <Space>
            <Text strong>{text}</Text>
            {r.flag === 'abnormal' && <Tag color="orange">Abnormal</Tag>}
            {r.flag === 'critical' && <Tag color="red"><WarningOutlined /> Critical</Tag>}
          </Space>
        ),
      },
      {
        title: 'Result',
        dataIndex: 'value',
        key: 'value',
        render: (v: any, r: any) => v ? <Text strong style={r.flag === 'critical' ? { color: '#cf1322' } : r.flag === 'abnormal' ? { color: '#fa8c16' } : {}}>{v} {r.unit || ''}</Text> : <Text type="secondary">Pending</Text>,
      },
      {
        title: 'Reference Range',
        key: 'range',
        render: (_: any, r: any) => r.referenceRange ? <Text type="secondary">{r.referenceRange}</Text> : null,
      },
      {
        title: 'Status',
        dataIndex: 'resultStatus',
        key: 'status',
        render: (s: string) => s ? <Tag>{s}</Tag> : null,
      },
    ];
    return <Table columns={columns} dataSource={tests} rowKey="id" pagination={false} size="small" />;
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <ExperimentOutlined /> My Lab Results
      </Title>

      {labs.length ? (
        <Collapse
          items={labs.map((lab) => ({
            key: lab.id,
            label: (
              <Space>
                <Text strong>{lab.patientName || 'Lab Order'}</Text>
                <Tag color={statusColors[lab.status]}>{lab.status}</Tag>
                {lab.tests?.some((t: any) => t.flag === 'critical') && (
                  <Tag color="red"><WarningOutlined /> Has Critical</Tag>
                )}
                {lab.tests?.some((t: any) => t.flag === 'abnormal') && (
                  <Tag color="orange">Has Abnormal</Tag>
                )}
              </Space>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  <Text type="secondary">Ordered: {lab.orderedDate ? new Date(lab.orderedDate).toLocaleDateString() : 'N/A'}</Text>
                  {lab.providerName && <Text type="secondary">· Provider: {lab.providerName}</Text>}
                  {lab.priority && <Tag color={lab.priority === 'urgent' ? 'red' : 'default'}>{lab.priority}</Tag>}
                </Space>
                {lab.tests && lab.tests.length > 0 ? (
                  renderResultTable(lab.tests)
                ) : (
                  <Empty description="No test results available yet" />
                )}
              </div>
            ),
          }))}
        />
      ) : (
        <Card>
          <Empty description="No lab results available" />
        </Card>
      )}
    </div>
  );
};

export default PortalLabResultsPage;
