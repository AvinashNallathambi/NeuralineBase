import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Alert,
  Table,
  Divider,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  FileTextOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  ShieldOutlined,
} from '@ant-design/icons';
import type { GoodFaithEstimate } from '../../types';

const { Text, Title } = Typography;

interface GfePanelProps {
  superbillId: string;
}

const GfePanel: React.FC<GfePanelProps> = ({ superbillId }) => {
  const [loading, setLoading] = useState(false);
  const [gfe, setGfe] = useState<GoodFaithEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBase = '/api/v1/superbills/ai';

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('neuraline_token');
    if (!token) throw new Error('Not authenticated');
    return `Bearer ${token}`;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/generate-gfe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({ superbillId }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setGfe(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate GFE');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
    },
    {
      title: 'CPT Code',
      dataIndex: 'cptCode',
      key: 'cptCode',
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Charge',
      dataIndex: 'charge',
      key: 'charge',
      render: (v: number) => `$${v.toFixed(2)}`,
    },
    {
      title: 'Insurance Est.',
      dataIndex: 'insuranceEstimate',
      key: 'insuranceEstimate',
      render: (v: number) => `$${v.toFixed(2)}`,
    },
    {
      title: 'Patient Est.',
      dataIndex: 'patientEstimate',
      key: 'patientEstimate',
      render: (v: number) => `$${v.toFixed(2)}`,
    },
  ];

  return (
    <Card
      title={
        <span>
          <FileTextOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          Good Faith Estimate (No Surprises Act)
        </span>
      }
      size="small"
      style={{ marginTop: 16 }}
      extra={
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerate}
          loading={loading}
          size="small"
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
        >
          Generate GFE
        </Button>
      }
    >
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

      {!gfe && !loading && !error && (
        <Alert
          type="info"
          message="Generate a Good Faith Estimate compliant with the No Surprises Act for out-of-network patients."
          showIcon
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="AI is generating Good Faith Estimate..." />
        </div>
      )}

      {gfe && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Statistic
                title="Total Charge"
                value={gfe.totalCharge}
                prefix="$"
                precision={2}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Insurance Estimate"
                value={gfe.insuranceEstimate}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Patient Estimate"
                value={gfe.patientEstimate}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={gfe.items}
            rowKey={(record: any) => record.cptCode}
            pagination={false}
            size="small"
          />

          <Divider />

          <Alert
            type="warning"
            message="No Surprises Act Disclaimers"
            description={
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {gfe.disclaimers.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            }
            showIcon
            icon={<InfoCircleOutlined />}
          />

          <Divider />

          <Alert
            type="info"
            message="Compliance Notes"
            description={
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {gfe.complianceNotes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            }
            showIcon
            icon={<ShieldOutlined />}
          />
        </>
      )}
    </Card>
  );
};

export default GfePanel;
