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
  Table,
  Statistic,
} from 'antd';
import {
  FundOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { SuperbillDenialRisk, GoodFaithEstimate } from '../../types';

const { Text, Title } = Typography;
const { Panel } = Collapse;

interface DenialRiskPanelProps {
  superbillId: string;
}

const DenialRiskPanel: React.FC<DenialRiskPanelProps> = ({ superbillId }) => {
  const [loading, setLoading] = useState(false);
  const [riskResult, setRiskResult] = useState<SuperbillDenialRisk | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
  const apiBase = `${API_BASE_URL}/superbills/ai`;

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('neuraline_token');
    if (!token) throw new Error('Not authenticated');
    return `Bearer ${token}`;
  };

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/predict-denial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({ superbillId }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setRiskResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to predict denial risk');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'orange';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card
      title={
        <span>
          <FundOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          AI Denial Risk Predictor
        </span>
      }
      size="small"
      style={{ marginTop: 16 }}
      extra={
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handlePredict}
          loading={loading}
          size="small"
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
        >
          Predict Risk
        </Button>
      }
    >
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

      {!riskResult && !loading && !error && (
        <Alert
          type="info"
          message="Predict claim denial risk before submission using AI analysis of payer rules, NCCI edits, and documentation quality."
          showIcon
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="AI is analyzing denial risk..." />
        </div>
      )}

      {riskResult && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8} style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={riskResult.riskScore}
                status={riskResult.riskLevel === 'low' ? 'success' : riskResult.riskLevel === 'critical' ? 'exception' : 'normal'}
                format={(percent) => (
                  <Text strong style={{ fontSize: 20 }}>{percent}%</Text>
                )}
                width={100}
              />
              <br />
              <Tag color={getRiskColor(riskResult.riskLevel)} style={{ fontSize: 14, padding: '4px 12px' }}>
                {riskResult.riskLevel.toUpperCase()} RISK
              </Tag>
            </Col>
            <Col span={16}>
              <Alert
                type={riskResult.riskLevel === 'low' ? 'success' : riskResult.riskLevel === 'critical' ? 'error' : 'warning'}
                message={
                  riskResult.riskLevel === 'low'
                    ? 'Low denial risk — claim likely to pass'
                    : riskResult.riskLevel === 'critical'
                    ? 'Critical risk — fix before submitting'
                    : 'Elevated risk — review recommended actions'
                }
                showIcon
              />
              <div style={{ marginTop: 12 }}>
                <Statistic
                  title="Estimated Reimbursement"
                  value={riskResult.estimatedReimbursement}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#0D7C8A' }}
                />
              </div>
            </Col>
          </Row>

          <Divider />

          <Collapse defaultActiveKey={['reasons', 'actions']}>
            <Panel header={`Top Risk Factors (${riskResult.topReasons.length})`} key="reasons">
              <List
                dataSource={riskResult.topReasons}
                renderItem={(item, i) => (
                  <List.Item>
                    <Space>
                      <WarningOutlined style={{ color: '#faad14' }} />
                      <Text>{item}</Text>
                    </Space>
                  </List.Item>
                )}
                size="small"
              />
            </Panel>
            <Panel header={`Recommended Actions (${riskResult.recommendedActions.length})`} key="actions">
              <List
                dataSource={riskResult.recommendedActions}
                renderItem={(item, i) => (
                  <List.Item>
                    <Space>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      <Text>{item}</Text>
                    </Space>
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

export default DenialRiskPanel;
