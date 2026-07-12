import React, { useEffect, useState } from 'react';
import { Card, Typography, List, Tag, Spin, Empty, Space, Descriptions, Row, Col } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text } = Typography;

const PortalInsurancePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<any[]>([]);

  useEffect(() => {
    loadInsurance();
  }, []);

  const loadInsurance = async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getInsurance();
      setPolicies(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const orderColors: Record<string, string> = {
    primary: 'blue',
    secondary: 'green',
    tertiary: 'orange',
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <SafetyOutlined /> My Insurance
      </Title>

      {policies.length ? (
        <Row gutter={[16, 16]}>
          {policies.map((policy) => (
            <Col xs={24} md={12} key={policy.id}>
              <Card
                title={
                  <Space>
                    <Text strong>{policy.payerName || policy.insurancePayerName || 'Insurance Policy'}</Text>
                    <Tag color={orderColors[policy.order] || 'default'}>{policy.order || 'policy'}</Tag>
                    <Tag color={policy.status === 'active' ? 'green' : 'default'}>{policy.status}</Tag>
                  </Space>
                }
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Policy Number">{policy.policyNumber || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Group Number">{policy.groupNumber || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Subscriber">{policy.subscriberName || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Relationship">{policy.subscriberRelationship || 'Self'}</Descriptions.Item>
                  <Descriptions.Item label="Effective Date">
                    {policy.effectiveDate ? new Date(policy.effectiveDate).toLocaleDateString() : 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Expiration Date">
                    {policy.expirationDate ? new Date(policy.expirationDate).toLocaleDateString() : 'N/A'}
                  </Descriptions.Item>
                  {policy.copay && <Descriptions.Item label="Copay">${Number(policy.copay).toFixed(2)}</Descriptions.Item>}
                  {policy.deductible && <Descriptions.Item label="Deductible">${Number(policy.deductible).toFixed(2)}</Descriptions.Item>}
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Empty description="No insurance policies on file" />
        </Card>
      )}
    </div>
  );
};

export default PortalInsurancePage;
