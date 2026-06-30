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
  Collapse,
  Divider,
} from 'antd';
import {
  MedicineBoxOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { SmartCodeResult, SmartCodeSuggestion } from '../../types';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface AiCodingAssistantProps {
  clinicalNotes: string;
  onApplyDiagnosis: (code: string, description: string) => void;
  onApplyProcedure: (code: string, description: string, modifiers?: string[]) => void;
}

const AiCodingAssistant: React.FC<AiCodingAssistantProps> = ({
  clinicalNotes,
  onApplyDiagnosis,
  onApplyProcedure,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmartCodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
  const apiBase = `${API_BASE_URL}/superbills/ai`;

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('neuraline_token');
    if (!token) throw new Error('Not authenticated');
    return `Bearer ${token}`;
  };

  const handleSmartCode = async () => {
    if (!clinicalNotes.trim()) {
      setError('Please provide clinical notes or a SOAP summary first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/smart-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({ clinicalNotes }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to get smart coding suggestions');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (c: number) => {
    if (c >= 0.85) return 'success';
    if (c >= 0.6) return 'warning';
    return 'default';
  };

  const renderSuggestion = (s: SmartCodeSuggestion, type: 'diagnosis' | 'procedure') => (
    <List.Item
      actions={[
        <Button
          key="apply"
          size="small"
          type="primary"
          onClick={() =>
            type === 'diagnosis'
              ? onApplyDiagnosis(s.code, s.description)
              : onApplyProcedure(s.code, s.description, s.suggestedModifiers)
          }
        >
          Apply
        </Button>,
      ]}
    >
      <List.Item.Meta
        title={
          <Space>
            <Tag color={type === 'diagnosis' ? 'blue' : 'green'}>{s.code}</Tag>
            <Text strong>{s.description}</Text>
            <Tag color={getConfidenceColor(s.confidence)}>{Math.round(s.confidence * 100)}% confidence</Tag>
          </Space>
        }
        description={
          <>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              <InfoCircleOutlined /> {s.rationale}
            </Paragraph>
            {s.suggestedModifiers && s.suggestedModifiers.length > 0 && (
              <Text type="secondary">
                Suggested modifiers: {s.suggestedModifiers.join(', ')}
              </Text>
            )}
          </>
        }
      />
    </List.Item>
  );

  return (
    <Card
      title={
        <span>
          <MedicineBoxOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
          AI Smart Coding Assistant
        </span>
      }
      size="small"
      style={{ marginTop: 16 }}
      extra={
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleSmartCode}
          loading={loading}
          size="small"
          style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
        >
          Suggest Codes
        </Button>
      }
    >
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

      {!result && !loading && !error && (
        <Alert
          type="info"
          message="Paste clinical notes in the Notes section above, then click Suggest Codes to get AI-powered ICD-10 and CPT recommendations."
          showIcon
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="AI is analyzing clinical notes..." />
        </div>
      )}

      {result && (
        <>
          <Collapse ghost defaultActiveKey={['diagnoses', 'procedures']}>
            <Panel
              header={<Text strong>Suggested Diagnoses ({result.suggestedDiagnoses.length})</Text>}
              key="diagnoses"
            >
              <List
                dataSource={result.suggestedDiagnoses}
                renderItem={(item) => renderSuggestion(item, 'diagnosis')}
                size="small"
              />
            </Panel>
            <Panel
              header={<Text strong>Suggested Procedures ({result.suggestedProcedures.length})</Text>}
              key="procedures"
            >
              <List
                dataSource={result.suggestedProcedures}
                renderItem={(item) => renderSuggestion(item, 'procedure')}
                size="small"
              />
            </Panel>
          </Collapse>

          {result.missingDocumentation.length > 0 && (
            <>
              <Divider />
              <Alert
                type="warning"
                message="Missing Documentation"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {result.missingDocumentation.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                }
                showIcon
              />
            </>
          )}

          {result.codingTips.length > 0 && (
            <>
              <Divider />
              <Alert
                type="info"
                message="Coding Tips"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {result.codingTips.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                }
                showIcon
              />
            </>
          )}
        </>
      )}
    </Card>
  );
};

export default AiCodingAssistant;
