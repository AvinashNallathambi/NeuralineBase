import React, { useEffect, useState } from 'react';
import { Card, Typography, List, Tag, Spin, Empty, Space, Descriptions, Collapse } from 'antd';
import { FileTextOutlined, DollarOutlined } from '@ant-design/icons';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text } = Typography;

const PortalEobsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [eobs, setEobs] = useState<any[]>([]);

  useEffect(() => {
    loadEobs();
  }, []);

  const loadEobs = async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getEobs();
      setEobs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <FileTextOutlined /> Insurance EOBs
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Explanation of Benefits (EOB) statements show how your insurance processed each claim.
          You can see what was billed, what insurance paid, and your responsibility.
        </Text>
      </Card>

      {eobs.length ? (
        <Collapse
          items={eobs.map((eob) => ({
            key: eob.id,
            label: (
              <Space>
                <Text strong>{eob.payerName || 'Insurance Company'}</Text>
                <Tag>{eob.claimStatus || eob.status || 'processed'}</Tag>
                {eob.serviceDate && (
                  <Text type="secondary">{new Date(eob.serviceDate).toLocaleDateString()}</Text>
                )}
              </Space>
            ),
            children: (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Payer">{eob.payerName || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Claim Status">{eob.claimStatus || eob.status || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Service Date">
                  {eob.serviceDate ? new Date(eob.serviceDate).toLocaleDateString() : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Patient Name">{eob.patientName || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Billed Amount">
                  <Text>${Number(eob.billedAmount || 0).toFixed(2)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Allowed Amount">
                  <Text>${Number(eob.allowedAmount || 0).toFixed(2)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Insurance Paid">
                  <Text style={{ color: '#3f8600' }}>${Number(eob.paidAmount || 0).toFixed(2)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Patient Responsibility">
                  <Text style={{ color: '#cf1322' }}>${Number(eob.patientResponsibilityAmount || 0).toFixed(2)}</Text>
                </Descriptions.Item>
                {eob.adjustments && eob.adjustments.length > 0 && (
                  <Descriptions.Item label="Adjustments" span={2}>
                    {eob.adjustments.map((adj: any, i: number) => (
                      <div key={i}>
                        <Tag color="orange">{adj.carcCode || 'ADJ'}</Tag>
                        {adj.reason}: -${Number(adj.amount || 0).toFixed(2)}
                      </div>
                    ))}
                  </Descriptions.Item>
                )}
              </Descriptions>
            ),
          }))}
        />
      ) : (
        <Card>
          <Empty description="No EOBs available yet" />
        </Card>
      )}
    </div>
  );
};

export default PortalEobsPage;
