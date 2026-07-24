import React from 'react';
import { Card, Alert, Empty, Tag, Space, Typography } from 'antd';
import { DollarOutlined, WarningOutlined } from '@ant-design/icons';
import type { PayerRiskPrompt } from '../../services/documentationService';

const { Text } = Typography;

interface Props {
  payerPrompts: PayerRiskPrompt[];
}

const DocumentationPayerPromptsCard: React.FC<Props> = ({ payerPrompts }) => {
  if (!payerPrompts || payerPrompts.length === 0) return null;

  return (
    <Card
      size="small"
      title={
        <Space>
          <DollarOutlined style={{ color: '#0D7C8A' }} />
          <span>Payer Documentation Prompts</span>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {payerPrompts.map((prompt, idx) => {
        const hasRisk = prompt.denialCount > 0 || prompt.underpaymentCount > 0;
        return (
          <div key={idx} style={{ marginBottom: idx < payerPrompts.length - 1 ? 12 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Tag color={hasRisk ? 'red' : 'green'} style={{ fontWeight: 600 }}>
                {prompt.payerName}
              </Tag>
              <Space size="middle">
                {prompt.denialCount > 0 && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    <WarningOutlined /> {prompt.denialCount} denials
                  </Text>
                )}
                {prompt.unresolvedDeniedAmount > 0 && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    ${prompt.unresolvedDeniedAmount.toLocaleString()} unresolved
                  </Text>
                )}
                {prompt.underpaymentCount > 0 && (
                  <Text type="warning" style={{ fontSize: 12 }}>
                    {prompt.underpaymentCount} underpayments
                  </Text>
                )}
              </Space>
            </div>
            {prompt.documentationPrompts && prompt.documentationPrompts.length > 0 && (
              <Alert
                type={hasRisk ? 'warning' : 'info'}
                showIcon
                style={{ marginTop: 4 }}
                message={
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                    {prompt.documentationPrompts.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                }
              />
            )}
          </div>
        );
      })}
    </Card>
  );
};

export default DocumentationPayerPromptsCard;
