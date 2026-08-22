import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Button,
  Modal,
  Descriptions,
  Alert,
  Row,
  Col,
  Statistic,
  Divider,
  Space,
  message,
  Spin,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  SafetyOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { GoodFaithEstimate } from '../types';
import { patientPortalService } from '../services/patientPortalService';

const { Title, Text, Paragraph } = Typography;

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  delivered: 'processing',
  acknowledged: 'success',
  disputed: 'error',
  expired: 'warning',
  superseded: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  delivered: 'Delivered',
  acknowledged: 'Acknowledged',
  disputed: 'Disputed',
  expired: 'Expired',
  superseded: 'Superseded',
};

const PortalGfePage: React.FC = () => {
  const [gfes, setGfes] = useState<GoodFaithEstimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGfe, setSelectedGfe] = useState<GoodFaithEstimate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadGfes = async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getGfeEstimates();
      setGfes(data);
    } catch (err: any) {
      message.error(err.message || 'Failed to load estimates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGfes();
  }, []);

  const handleAcknowledge = async () => {
    if (!selectedGfe?.id) return;
    try {
      await patientPortalService.acknowledgeGfe(selectedGfe.id);
      message.success('Thank you for acknowledging your Good Faith Estimate');
      setModalOpen(false);
      loadGfes();
    } catch (err: any) {
      message.error(err.message || 'Failed to acknowledge');
    }
  };

  const columns = [
    {
      title: 'Service Date',
      dataIndex: 'serviceDate',
      key: 'serviceDate',
      render: (d: string) => d ? new Date(d).toLocaleDateString() : '-',
    },
    {
      title: 'Type',
      dataIndex: 'gfeType',
      key: 'gfeType',
      render: (t: string) => {
        const labels: Record<string, string> = { insured_oon: 'Out-of-Network', self_pay: 'Self-Pay', uninsured: 'Uninsured' };
        return <Tag>{labels[t] || t}</Tag>;
      },
    },
    {
      title: 'Total Charge',
      dataIndex: 'totalCharge',
      key: 'totalCharge',
      render: (v: number) => `$${Number(v || 0).toFixed(2)}`,
    },
    {
      title: 'Patient Estimate',
      dataIndex: 'patientEstimate',
      key: 'patientEstimate',
      render: (v: number) => <Text strong style={{ color: '#cf1322' }}>${Number(v || 0).toFixed(2)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s] || s}</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: GoodFaithEstimate) => (
        <Button type="link" onClick={() => { setSelectedGfe(record); setModalOpen(true); }}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Title level={2}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        Good Faith Estimates
      </Title>

      <Alert
        type="info"
        message="Your Rights Under the No Surprises Act"
        description={
          <div>
            <p>Under the No Surprises Act, you have the right to receive a Good Faith Estimate of expected charges before receiving medical services.</p>
            <p>If your final bill exceeds your Good Faith Estimate by $400 or more, you have the right to dispute the bill through the federal Independent Dispute Resolution (IDR) process.</p>
          </div>
        }
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={gfes}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: 'No Good Faith Estimates available' }}
        />
      </Card>

      {/* GFE Detail Modal */}
      <Modal
        title="Good Faith Estimate Details"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={700}
        footer={
          selectedGfe?.status === 'delivered' ? (
            <Space>
              <Button onClick={() => setModalOpen(false)}>Close</Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleAcknowledge}>
                Acknowledge Receipt
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setModalOpen(false)}>Close</Button>
          )
        }
      >
        {selectedGfe && (
          <>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Service Date">{selectedGfe.serviceDate ? new Date(selectedGfe.serviceDate).toLocaleDateString() : '-'}</Descriptions.Item>
              <Descriptions.Item label="Type">{selectedGfe.gfeType === 'self_pay' ? 'Self-Pay' : selectedGfe.gfeType === 'uninsured' ? 'Uninsured' : 'Out-of-Network'}</Descriptions.Item>
              <Descriptions.Item label="Provider">{selectedGfe.providerName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[selectedGfe.status || '']}>{STATUS_LABELS[selectedGfe.status || ''] || selectedGfe.status}</Tag></Descriptions.Item>
              {selectedGfe.deliveredAt && <Descriptions.Item label="Delivered">{new Date(selectedGfe.deliveredAt).toLocaleString()}</Descriptions.Item>}
              {selectedGfe.acknowledgedAt && <Descriptions.Item label="Acknowledged">{new Date(selectedGfe.acknowledgedAt).toLocaleString()}</Descriptions.Item>}
            </Descriptions>

            <Divider />

            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="Total Charge" value={selectedGfe.totalCharge} prefix="$" precision={2} />
              </Col>
              <Col span={8}>
                <Statistic title="Insurance Estimate" value={selectedGfe.insuranceEstimate} prefix="$" precision={2} valueStyle={{ color: '#1890ff' }} />
              </Col>
              <Col span={8}>
                <Statistic title="Your Cost" value={selectedGfe.patientEstimate} prefix="$" precision={2} valueStyle={{ color: '#cf1322' }} />
              </Col>
            </Row>

            <Divider />

            <Title level={5}>Services Included</Title>
            <Table
              size="small"
              pagination={false}
              dataSource={selectedGfe.items}
              rowKey="cptCode"
              columns={[
                { title: 'Service', dataIndex: 'service', key: 'service' },
                { title: 'CPT', dataIndex: 'cptCode', key: 'cptCode', render: (c: string) => <Tag color="blue">{c}</Tag> },
                { title: 'Charge', dataIndex: 'charge', key: 'charge', render: (v: number) => `$${Number(v).toFixed(2)}` },
                { title: 'Your Cost', dataIndex: 'patientEstimate', key: 'patientEstimate', render: (v: number) => `$${Number(v).toFixed(2)}` },
              ]}
            />

            {/* Patient-friendly explanation */}
            {selectedGfe.patientFriendlyExplanation && (
              <>
                <Divider />
                <Card size="small" title={<span><InfoCircleOutlined style={{ marginRight: 8 }} />What This Means For You</span>}>
                  <Paragraph>{selectedGfe.patientFriendlyExplanation}</Paragraph>
                </Card>
              </>
            )}

            {/* Disclaimers */}
            <Divider />
            <Alert
              type="warning"
              message="Important Disclaimers"
              description={<ul style={{ margin: 0, paddingLeft: 16 }}>{selectedGfe.disclaimers.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              showIcon
              icon={<SafetyOutlined />}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default PortalGfePage;
