import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Descriptions,
  Timeline,
  Divider,
  Input,
  message,
  Empty,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  DollarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { billingService, EncounterClaim, ClaimLineItem } from '../../services/billingService';
import { commonDiagnosisCodes } from '../../data/mockData';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const claimStatusColors: Record<string, string> = {
  draft: 'default',
  ready_to_bill: 'gold',
  submitted: 'processing',
  partially_paid: 'blue',
  paid: 'cyan',
  denied: 'red',
  appealed: 'purple',
  cancelled: 'default',
};

const ClaimDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState<EncounterClaim | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (id) {
      fetchClaim(id);
    }
  }, [id]);

  const fetchClaim = async (claimId: string) => {
    setLoading(true);
    try {
      const data = await billingService.findOneClaim(claimId);
      setClaim(data);
    } catch (error) {
      message.error('Failed to load claim');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/billing')}
          style={{ marginBottom: 24 }}
        >
          Back to Billing
        </Button>
        <Empty description="Claim not found" />
      </div>
    );
  }

  // Diagnosis code lookups from line items
  const diagnosisCodes = claim.lineItems
    .filter((item) => item.codeType === 'ICD-10')
    .map((item) => item.code);

  const diagnosisDetails = diagnosisCodes.map((code) => {
    const found = commonDiagnosisCodes.find((d) => d.code === code);
    return { code, description: found?.description || 'Unknown' };
  });

  // Build timeline
  const timelineItems = [
    {
      color: 'blue',
      dot: <FileTextOutlined />,
      children: (
        <div>
          <Text strong>Claim Created</Text>
          <br />
          <Text type="secondary">{new Date(claim.createdAt).toLocaleDateString()}</Text>
        </div>
      ),
    },
  ];

  if (claim.submissionDate) {
    timelineItems.push({
      color: 'blue',
      dot: <SendOutlined />,
      children: (
        <div>
          <Text strong>Submitted to {claim.insurancePayerName || 'Payer'}</Text>
          <br />
          <Text type="secondary">{new Date(claim.submissionDate).toLocaleDateString()}</Text>
        </div>
      ),
    });
  }

  if (claim.status === 'ready_to_bill' || claim.status === 'submitted') {
    timelineItems.push({
      color: 'gold',
      dot: <ClockCircleOutlined />,
      children: (
        <div>
          <Text strong>Under Review</Text>
          <br />
          <Text type="secondary">Awaiting decision</Text>
        </div>
      ),
    });
  }

  if (claim.status === 'paid' || claim.status === 'partially_paid') {
    timelineItems.push({
      color: 'green',
      dot: <CheckCircleOutlined />,
      children: (
        <div>
          <Text strong>Payment Received</Text>
          <br />
          <Text type="secondary">
            Paid: ${claim.totalPaid.toFixed(2)}
          </Text>
        </div>
      ),
    });
  }

  if (claim.status === 'denied') {
    timelineItems.push({
      color: 'red',
      dot: <CloseCircleOutlined />,
      children: (
        <div>
          <Text strong>Denied</Text>
          <br />
          <Text type="secondary">
            Reason: {claim.denialReason || 'Documentation insufficient. Consider appeal.'}
          </Text>
        </div>
      ),
    });
  }

  // Service lines table
  const serviceColumns: ColumnsType<ClaimLineItem> = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 60, align: 'center' },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 110,
      align: 'right',
      render: (price: number) => `$${price.toFixed(2)}`,
    },
    {
      title: 'Total',
      dataIndex: 'totalCharge',
      key: 'totalCharge',
      width: 110,
      align: 'right',
      render: (price: number) => <Text strong>${price.toFixed(2)}</Text>,
    },
  ];

  const adjustments = claim.adjustmentAmount;

  return (
    <div>
      {/* Back Button */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/billing')}
        style={{ marginBottom: 16 }}
      >
        Back to Billing
      </Button>

      {/* Claim Header */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space size={16} align="center">
              <Title level={3} style={{ margin: 0 }}>
                Claim {claim.claimNumber}
              </Title>
              <Tag
                color={claimStatusColors[claim.status]}
                style={{ fontSize: 14, padding: '4px 12px' }}
              >
                {claim.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Tag>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                Service Date: {new Date(claim.serviceDate).toLocaleDateString()}
                {claim.submissionDate && ` | Submitted: ${new Date(claim.submissionDate).toLocaleDateString()}`}
                {` | Created: ${new Date(claim.createdAt).toLocaleDateString()}`}
              </Text>
            </div>
          </Col>
          <Col>
            <Space>
              {claim.status === 'denied' && (
                <Button icon={<ExclamationCircleOutlined />} type="primary" danger>
                  Appeal
                </Button>
              )}
              {(claim.status === 'denied' || claim.status === 'draft') && (
                <Button icon={<ReloadOutlined />} onClick={() => message.info('Resubmitting claim...')}>
                  Resubmit
                </Button>
              )}
              <Button icon={<PrinterOutlined />} onClick={() => message.info('Printing...')}>
                Print
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => message.info('Downloading PDF...')}>
                Download PDF
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Two-Column Layout */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        {/* Left Column */}
        <Col xs={24} lg={14}>
          {/* Patient Info */}
          <Card title="Patient Information" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Name">
                {claim.patientName}
              </Descriptions.Item>
              <Descriptions.Item label="Patient ID">{claim.patientId}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Insurance Info */}
          <Card title="Insurance Information" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Provider">{claim.insurancePayerName || 'Self-Pay'}</Descriptions.Item>
              <Descriptions.Item label="Policy #">{claim.policyNumber || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Group #">{claim.groupNumber || 'N/A'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Provider Info */}
          <Card title="Provider Information" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Provider">{claim.providerName}</Descriptions.Item>
              <Descriptions.Item label="NPI">{claim.providerNPI}</Descriptions.Item>
              <Descriptions.Item label="Encounter">{claim.encounterId || 'N/A'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Right Column - Timeline */}
        <Col xs={24} lg={10}>
          <Card title="Claim Timeline" size="small">
            <Timeline items={timelineItems} />
          </Card>
        </Col>
      </Row>

      {/* Diagnosis Codes */}
      <Card title="Diagnosis Codes (ICD-10)" size="small" style={{ marginBottom: 24 }}>
        <Space wrap>
          {diagnosisDetails.map((d) => (
            <Tag key={d.code} color="blue" style={{ padding: '4px 10px', fontSize: 13 }}>
              <Text strong>{d.code}</Text> - {d.description}
            </Tag>
          ))}
        </Space>
      </Card>

      {/* Service Lines */}
      <Card title="Service Lines" size="small" style={{ marginBottom: 24 }}>
        <Table
          columns={serviceColumns}
          dataSource={claim.lineItems}
          rowKey="id"
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4} align="right">
                  <Text strong>Total:</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ fontSize: 16 }}>
                    ${claim.totalBilled.toFixed(2)}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* Financial Summary */}
      <Card title="Financial Summary" size="small" style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]}>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Total Billed</Text>
              <br />
              <Text strong style={{ fontSize: 20 }}>
                ${claim.totalBilled.toFixed(2)}
              </Text>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Total Allowed</Text>
              <br />
              <Text
                strong
                style={{
                  fontSize: 20,
                  color: claim.totalAllowed ? '#52c41a' : '#8c8c8c',
                }}
              >
                ${claim.totalAllowed?.toFixed(2) || 'Pending'}
              </Text>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Patient Responsibility</Text>
              <br />
              <Text
                strong
                style={{
                  fontSize: 20,
                  color: claim.patientResponsibility > 0 ? '#faad14' : '#8c8c8c',
                }}
              >
                ${claim.patientResponsibility.toFixed(2)}
              </Text>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Adjustments</Text>
              <br />
              <Text
                strong
                style={{
                  fontSize: 20,
                  color: adjustments > 0 ? '#ff4d4f' : '#8c8c8c',
                }}
              >
                {adjustments > 0 ? `-$${adjustments.toFixed(2)}` : '$0.00'}
              </Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Notes / Comments */}
      <Card title="Notes & Comments" size="small">
        <div style={{ marginBottom: 16 }}>
          <TextArea
            rows={3}
            placeholder="Add a note or comment about this claim..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <Button
            type="primary"
            size="small"
            style={{ marginTop: 8 }}
            onClick={() => {
              if (noteText.trim()) {
                message.success('Note added');
                setNoteText('');
              }
            }}
            disabled={!noteText.trim()}
          >
            Add Note
          </Button>
        </div>

        {claim.notes && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Paragraph style={{ margin: 0 }}>{claim.notes}</Paragraph>
          </>
        )}
      </Card>
    </div>
  );
};

export default ClaimDetailPage;
