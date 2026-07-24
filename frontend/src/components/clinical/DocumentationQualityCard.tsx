import React from 'react';
import { Card, Progress, List, Tag, Button, Empty, Tooltip, Space } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import type { DocumentationQuality } from '../../services/documentationService';

interface Props {
  quality: DocumentationQuality;
  onRefresh: () => void;
  loading?: boolean;
}

const severityIcon: Record<string, React.ReactNode> = {
  critical: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  warning: <WarningOutlined style={{ color: '#faad14' }} />,
};

const DocumentationQualityCard: React.FC<Props> = ({ quality, onRefresh, loading }) => {
  const score = quality.score || 0;
  const color = score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f';
  const hasFindings = quality.findings && quality.findings.length > 0;

  return (
    <Card
      size="small"
      title="Documentation Quality"
      style={{ marginBottom: 16 }}
      extra={
        <Tooltip title="Re-check quality">
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} loading={loading} />
        </Tooltip>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: hasFindings ? 12 : 0 }}>
        <Progress
          type="circle"
          percent={score}
          size={80}
          strokeColor={color}
          format={(p) => <span style={{ fontSize: 18, fontWeight: 600, color }}>{p}</span>}
        />
        <div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {score >= 80 ? 'Good documentation quality' : score >= 60 ? 'Needs improvement' : 'Critical gaps detected'}
          </div>
          {hasFindings && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {quality.findings.filter((f) => f.severity === 'critical').length} critical,{' '}
              {quality.findings.filter((f) => f.severity === 'warning').length} warnings
            </div>
          )}
        </div>
      </div>
      {hasFindings && (
        <List
          size="small"
          dataSource={quality.findings}
          renderItem={(f) => (
            <List.Item style={{ padding: '6px 0', borderBottom: 'none' }}>
              <Space>
                {severityIcon[f.severity] || <WarningOutlined />}
                <Tag style={{ fontSize: 11 }}>{f.section}</Tag>
                <span style={{ fontSize: 12 }}>{f.message}</span>
              </Space>
            </List.Item>
          )}
        />
      )}
      {!hasFindings && score >= 80 && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
          <span style={{ marginLeft: 8, color: '#52c41a' }}>All sections complete</span>
        </div>
      )}
    </Card>
  );
};

export default DocumentationQualityCard;
