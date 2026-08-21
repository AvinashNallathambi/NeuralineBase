import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Tag,
  Spin,
  Empty,
  Space,
  Collapse,
  Button,
  Tooltip,
} from 'antd';
import { ExperimentOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text, Paragraph } = Typography;

const PortalImagingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [imaging, setImaging] = useState<any[]>([]);

  useEffect(() => {
    loadImaging();
  }, []);

  const loadImaging = async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getImagingResults();
      setImaging(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    ordered: 'blue',
    scheduled: 'cyan',
    in_progress: 'processing',
    completed: 'green',
    cancelled: 'red',
  };

  const modalityLabels: Record<string, string> = {
    xray: 'X-Ray',
    mri: 'MRI',
    ct: 'CT Scan',
    ultrasound: 'Ultrasound',
    mammogram: 'Mammogram',
    dexa: 'DEXA Scan',
    other: 'Other',
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <ExperimentOutlined /> My Imaging Results
      </Title>

      {imaging.length ? (
        <Collapse
          items={imaging.map((img) => ({
            key: img.id,
            label: (
              <Space>
                <Text strong>{img.studyName}</Text>
                <Tag color={statusColors[img.status]}>{img.status.replace(/_/g, ' ')}</Tag>
                {img.modality && <Tag>{modalityLabels[img.modality] || img.modality}</Tag>}
                {img.bodyPart && <Text type="secondary">· {img.bodyPart}</Text>}
              </Space>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  <Text type="secondary">
                    Ordered: {img.orderedDate ? new Date(img.orderedDate).toLocaleDateString() : 'N/A'}
                  </Text>
                  {img.providerName && <Text type="secondary">· Provider: {img.providerName}</Text>}
                  {img.priority && img.priority !== 'routine' && (
                    <Tag color={img.priority === 'stat' ? 'red' : 'orange'}>{img.priority}</Tag>
                  )}
                </Space>

                {img.status === 'completed' && img.findings ? (
                  <div style={{ marginBottom: 16 }}>
                    <Card size="small" title="Findings" style={{ marginBottom: 8 }}>
                      <Paragraph style={{ marginBottom: 0 }}>{img.findings}</Paragraph>
                    </Card>
                    {img.impression && (
                      <Card size="small" title="Impression" style={{ marginBottom: 8 }}>
                        <Paragraph style={{ marginBottom: 0 }}>{img.impression}</Paragraph>
                      </Card>
                    )}
                    {img.radiologyReportUrl && (
                      <Button
                        type="link"
                        href={img.radiologyReportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Full Radiology Report
                      </Button>
                    )}
                  </div>
                ) : img.status === 'completed' ? (
                  <Empty description="Imaging completed but findings not yet available" />
                ) : (
                  <Empty description={`Status: ${img.status.replace(/_/g, ' ')} — results will appear here when ready`} />
                )}
              </div>
            ),
          }))}
        />
      ) : (
        <Card>
          <Empty description="No imaging orders available" />
        </Card>
      )}
    </div>
  );
};

export default PortalImagingPage;
