import React from 'react';
import { Card, Typography, Space, Tag } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { ClinicalTemplate } from '../../types';

const { Text } = Typography;

interface Props {
  template: ClinicalTemplate;
  onClick: (template: ClinicalTemplate) => void;
}

const ClinicalTemplateCard: React.FC<Props> = ({ template, onClick }) => {
  return (
    <Card
      hoverable
      size="small"
      onClick={() => onClick(template)}
      style={{
        height: '100%',
        borderRadius: 8,
        border: '1px solid #e8e8e8',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        transition: 'box-shadow 0.3s ease, transform 0.2s cubic-bezier(0.25, 0.1, 0, 0.71)',
      }}
      styles={{
        body: { padding: 20, height: '100%', display: 'flex', flexDirection: 'column' },
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%', height: '100%' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#e6fffb',
            color: '#13a8a8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            marginBottom: 8,
          }}
        >
          <FileTextOutlined />
        </div>
        <Text strong style={{ fontSize: 15, color: '#262626', display: 'block' }}>
          {template.name}
        </Text>
        <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.4, display: 'block', minHeight: 36 }}>
          {template.description}
        </Text>
        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
          <Tag color="default" style={{ margin: 0, fontSize: 12, borderRadius: 4, color: '#595959', backgroundColor: '#f5f5f5', border: 'none' }}>
            {template.specialty}
          </Tag>
        </div>
        <div style={{ paddingTop: 8 }}>
          <Text
            style={{
              fontSize: 13,
              color: '#13a8a8',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Use Template
          </Text>
        </div>
      </Space>
    </Card>
  );
};

export default ClinicalTemplateCard;
