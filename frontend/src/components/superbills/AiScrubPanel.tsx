import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Alert,
  List,
  Progress,
  Collapse,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import type { SuperbillScrubResult } from '../../types';

const { Text } = Typography;
const { Panel } = Collapse;

interface AiScrubPanelProps {
  superbillId: string;
  clinicalNotes?: string;
  onFixSuggestion?: (field: string, suggestion: string) => void;
}

const AiScrubPanel: React.FC<AiScrubPanelProps> = ({ superbillId, clinicalNotes, onFixSuggestion }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuperbillScrubResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
  const apiBase = `${API_BASE_URL}/superbills/ai`;

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('neuraline_token');
    if (!token) throw new Error('Not authenticated');
    return `Bearer ${token}`;
  };

  const handleScrub = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/scrub`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({ superbillId, clinicalNotes }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to scrub superbill');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'orange';
      default:
        return 'blue';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'normal';
    if (score >= 50) return 'warning';
    return 'exception';
  };

  return (
    <Card
      title={
        <span>
          <SafetyCertificateOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          AI Superbill Scrubber
        </span>
      }
      size="small"
      style={{ marginTop: 16 }}
      extra={
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleScrub}
          loading={loading}
          size="small"
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
        >
          Run AI Scrub
        </Button>
      }
    >
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

      {!result && !loading && !error && (
        <Alert
          type="info"
          message="Run AI scrubbing to check for missing fields, coding errors, documentation gaps, and compliance issues before submission."
          showIcon
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="AI is scrubbing your superbill..." />
        </div>
      )}

      {result && (
        <>
          <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
            <Col span={8} style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={result.qualityScore}
                status={getScoreColor(result.qualityScore) as any}
                format={(percent) => <Text strong style={{ fontSize: 24 }}>{percent}</Text>}
                width={80}
              />
              <br />
              <Text type="secondary">Quality Score</Text>
            </Col>
            <Col span={16}>
              <Alert
                type={result.isClean ? 'success' : result.qualityScore >= 70 ? 'warning' : 'error'}
                message={result.isClean ? 'Superbill is clean and ready for submission!' : 'Issues found — review before submitting'}
                description={result.summary}
                showIcon
                icon={<FileProtectOutlined />}
              />
            </Col>
          </Row>

          <Divider />

          <Collapse defaultActiveKey={['findings']}>
            <Panel header={`Findings (${result.findings.length})`} key="findings">
              <List
                dataSource={result.findings}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={getSeverityIcon(item.severity)}
                      title={
                        <Space>
                          <Tag color={getSeverityColor(item.severity)}>{item.severity.toUpperCase()}</Tag>
                          <Tag>{item.category.toUpperCase()}</Tag>
                          <Text strong>{item.message}</Text>
                        </Space>
                      }
                      description={
                        <>
                          <Text type="secondary">Suggestion: {item.suggestion}</Text>
                          {item.field && onFixSuggestion && (
                            <>
                              <br />
                              <Button
                                type="link"
                                size="small"
                                onClick={() => onFixSuggestion(item.field!, item.suggestion)}
                              >
                                Apply Fix
                              </Button>
                            </>
                          )}
                        </>
                      }
                    />
                  </List.Item>
                )}
                size="small"
              />
            </Panel>
          </Collapse>
        </>
      )}
    </Card>
  );
};

export default AiScrubPanel;
