import React, { useState } from 'react';
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
import type { Claim, ClaimItem } from '../../types';
import { commonDiagnosisCodes } from '../../data/mockData';
import type { Payment } from '../../data/mockData';
import { useBillingStore, usePatientStore } from '../../store/dataStore';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const claimStatusColors: Record<string, string> = {
  draft: 'default',
  submitted: 'processing',
  pending: 'gold',
  approved: 'green',
  denied: 'red',
  paid: 'cyan',
  appealed: 'purple',
};

const ClaimDetailPage: React.FC = () => {
  const { claims: mockClaims, payments: mockPayments } = useBillingStore();
  const { patients: mockPatients } = usePatientStore();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [noteText, setNoteText] = useState('');

  const claim = mockClaims.find((c) => c.id === id);
  const patient = claim ? mockPatients.find((p) => p.id === claim.patientId) : null;
  const claimPayments = claim
    ? mockPayments.filter((p) => p.claimId === claim.id)
    : [];

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

  const insurance = patient?.insurance.find((i) => i.id === claim.insuranceId) ||
    patient?.insurance[0];

  // Diagnosis code lookups
  const diagnosisDetails = claim.diagnosisCodes.map((code) => {
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
          <Text type="secondary">{claim.createdAt.split('T')[0]}</Text>
        </div>
      ),
    },
  ];

  if (claim.submittedDate) {
    timelineItems.push({
      color: 'blue',
      dot: <SendOutlined />,
      children: (
        <div>
          <Text strong>Submitted to {claim.insuranceProvider}</Text>
          <br />
          <Text type="secondary">{claim.submittedDate}</Text>
        </div>
      ),
    });
  }

  if (claim.status === 'pending' || claim.status === 'submitted') {
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

  if (claim.status === 'approved' || claim.status === 'paid') {
    timelineItems.push({
      color: 'green',
      dot: <CheckCircleOutlined />,
      children: (
        <div>
          <Text strong>Approved</Text>
          <br />
          <Text type="secondary">
            Approved amount: ${claim.approvedAmount?.toFixed(2) || '0.00'}
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
            Reason: Documentation insufficient. Consider appeal.
          </Text>
        </div>
      ),
    });
  }

  if (claim.status === 'paid') {
    timelineItems.push({
      color: 'cyan',
      dot: <DollarOutlined />,
      children: (
        <div>
          <Text strong>Payment Received</Text>
          <br />
          <Text type="secondary">
            Paid: ${claim.paidAmount?.toFixed(2) || '0.00'}
          </Text>
        </div>
      ),
    });
  }

  // Service lines table
  const serviceColumns: ColumnsType<ClaimItem> = [
    { title: 'CPT Code', dataIndex: 'cptCode', key: 'cptCode', width: 100 },
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
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 110,
      align: 'right',
      render: (price: number) => <Text strong>${price.toFixed(2)}</Text>,
    },
  ];

  // Payments table
  const paymentColumns: ColumnsType<Payment> = [
    { title: 'Payment ID', dataIndex: 'id', key: 'id', width: 100 },
    { title: 'Date', dataIndex: 'paymentDate', key: 'paymentDate', width: 120 },
    {
      title: 'Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 110,
      render: (method: string) => (
        <Tag color={method === 'insurance' ? 'blue' : method === 'patient' ? 'green' : 'orange'}>
          {method.charAt(0).toUpperCase() + method.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      align: 'right',
      render: (amount: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ${amount.toFixed(2)}
        </Text>
      ),
    },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', width: 120 },
  ];

  const totalPaid = claimPayments.reduce((sum, p) => sum + p.amount, 0);
  const adjustments = (claim.totalAmount || 0) - (claim.approvedAmount || claim.totalAmount);

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
                {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
              </Tag>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                Service Date: {claim.serviceDate}
                {claim.submittedDate && ` | Submitted: ${claim.submittedDate}`}
                {` | Created: ${claim.createdAt.split('T')[0]}`}
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
            {patient ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Name">
                  {patient.firstName} {patient.lastName}
                </Descriptions.Item>
                <Descriptions.Item label="MRN">{patient.mrn}</Descriptions.Item>
                <Descriptions.Item label="DOB">{patient.dateOfBirth}</Descriptions.Item>
                <Descriptions.Item label="Phone">{patient.phone}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Text>{claim.patientName}</Text>
            )}
          </Card>

          {/* Insurance Info */}
          <Card title="Insurance Information" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Provider">{claim.insuranceProvider}</Descriptions.Item>
              <Descriptions.Item label="Policy #">{insurance?.policyNumber || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Group #">{insurance?.groupNumber || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Subscriber">{insurance?.subscriberName || 'N/A'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Provider Info */}
          <Card title="Provider Information" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Provider">{claim.providerName}</Descriptions.Item>
              <Descriptions.Item label="Encounter">{claim.encounterId}</Descriptions.Item>
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
          dataSource={claim.items}
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
                    ${claim.totalAmount.toFixed(2)}
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
                ${claim.totalAmount.toFixed(2)}
              </Text>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Approved Amount</Text>
              <br />
              <Text
                strong
                style={{
                  fontSize: 20,
                  color: claim.approvedAmount !== undefined ? '#52c41a' : '#8c8c8c',
                }}
              >
                ${claim.approvedAmount?.toFixed(2) || 'Pending'}
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
                  color: claim.patientResponsibility ? '#faad14' : '#8c8c8c',
                }}
              >
                ${claim.patientResponsibility?.toFixed(2) || 'N/A'}
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

      {/* Payment History */}
      <Card title="Payment History" size="small" style={{ marginBottom: 24 }}>
        {claimPayments.length > 0 ? (
          <>
            <Table
              columns={paymentColumns}
              dataSource={claimPayments}
              rowKey="id"
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3} align="right">
                      <Text strong>Total Paid:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                        ${totalPaid.toFixed(2)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </>
        ) : (
          <Empty description="No payments recorded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
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

        {/* Mock existing notes */}
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ marginBottom: 12 }}>
          <Space>
            <Text strong>Dr. Lisa Chen</Text>
            <Text type="secondary">2024-06-16 10:30 AM</Text>
          </Space>
          <Paragraph style={{ margin: '4px 0 0 0' }}>
            Claim submitted with all supporting documentation. Please review and process.
          </Paragraph>
        </div>
        {claim.status === 'denied' && (
          <div>
            <Space>
              <Text strong>Insurance Review Team</Text>
              <Text type="secondary">2024-06-18 2:15 PM</Text>
            </Space>
            <Paragraph style={{ margin: '4px 0 0 0', color: '#ff4d4f' }}>
              Claim denied: Insufficient documentation for medical necessity. Please provide
              additional clinical notes and resubmit or file an appeal within 90 days.
            </Paragraph>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClaimDetailPage;
