import React from 'react';
import { Card, Typography, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  onClick: () => void;
}

const NewTemplateCard: React.FC<Props> = ({ onClick }) => {
  return (
    <Card
      hoverable
      size="small"
      onClick={onClick}
      style={{
        height: '100%',
        borderRadius: 8,
        border: '1px dashed #d9d9d9',
        backgroundColor: '#fafafa',
        transition: 'box-shadow 0.3s ease, transform 0.2s cubic-bezier(0.25, 0.1, 0, 0.71)',
      }}
      styles={{
        body: {
          padding: 20,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        },
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#13a8a8';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#d9d9d9';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <Space direction="vertical" size="small" align="center">
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
          }}
        >
          <PlusOutlined />
        </div>
        <Text strong style={{ fontSize: 15, color: '#262626' }}>
          New Template
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Create a custom template
        </Text>
      </Space>
    </Card>
  );
};

export default NewTemplateCard;
