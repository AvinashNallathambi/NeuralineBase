import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  List,
  Tag,
  Button,
  Modal,
  Form,
  InputNumber,
  Select,
  Input,
  message,
  Spin,
  Empty,
  Space,
  Statistic,
  Row,
  Col,
} from 'antd';
import { DollarOutlined, CreditCardOutlined, CheckCircleOutlined } from '@ant-design/icons';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text } = Typography;

const PortalBillingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getInvoices();
      setInvoices(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await patientPortalService.payInvoice(selectedInvoice.id, {
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        reference: values.reference,
      });
      message.success('Payment submitted successfully!');
      setPayModalVisible(false);
      form.resetFields();
      loadInvoices();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'default',
    sent: 'blue',
    paid: 'green',
    partially_paid: 'gold',
    overdue: 'red',
    void: 'default',
    cancelled: 'red',
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const unpaid = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue' || i.status === 'partially_paid');
  const totalOutstanding = unpaid.reduce((sum, i) => sum + Number(i.balanceDue || i.totalAmount || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <DollarOutlined /> Billing & Payments
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="Outstanding Balance"
              value={totalOutstanding}
              prefix="$"
              precision={2}
              valueStyle={{ color: totalOutstanding > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="Unpaid Invoices"
              value={unpaid.length}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="Total Paid"
              value={totalPaid}
              prefix="$"
              precision={2}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Outstanding Invoices" style={{ marginBottom: 16 }}>
        {unpaid.length ? (
          <List
            dataSource={unpaid}
            renderItem={(inv) => (
              <List.Item
                actions={[
                  <Button
                    type="primary"
                    size="small"
                    icon={<CreditCardOutlined />}
                    onClick={() => { setSelectedInvoice(inv); setPayModalVisible(true); form.setFieldsValue({ amount: Number(inv.balanceDue || inv.totalAmount) }); }}
                  >
                    Pay Now
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>Invoice #{inv.invoiceNumber || inv.id.slice(0, 8)}</Text>
                      <Tag color={statusColors[inv.status]}>{inv.status}</Tag>
                    </Space>
                  }
                  description={
                    <Space>
                      <Text>Amount: ${Number(inv.totalAmount || 0).toFixed(2)}</Text>
                      {inv.balanceDue > 0 && <Text type="danger">Balance Due: ${Number(inv.balanceDue).toFixed(2)}</Text>}
                      <Text type="secondary">Issued: {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> All invoices are paid!</>} />
        )}
      </Card>

      <Card title="Payment History">
        {invoices.filter((i) => i.status === 'paid').length ? (
          <List
            dataSource={invoices.filter((i) => i.status === 'paid')}
            renderItem={(inv) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>Invoice #{inv.invoiceNumber || inv.id.slice(0, 8)}</Text>
                      <Tag color="green">Paid</Tag>
                    </Space>
                  }
                  description={
                    <Space>
                      <Text>Amount: ${Number(inv.totalAmount || 0).toFixed(2)}</Text>
                      <Text type="secondary">Paid: {inv.updatedAt ? new Date(inv.updatedAt).toLocaleDateString() : 'N/A'}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No payment history" />
        )}
      </Card>

      <Modal
        title="Make a Payment"
        open={payModalVisible}
        onCancel={() => { setPayModalVisible(false); form.resetFields(); }}
        onOk={handlePay}
        confirmLoading={submitting}
        okText="Submit Payment"
      >
        {selectedInvoice && (
          <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <Space direction="vertical">
              <Text>Invoice #{selectedInvoice.invoiceNumber || selectedInvoice.id.slice(0, 8)}</Text>
              <Text>Balance Due: <Text strong style={{ color: '#cf1322' }}>${Number(selectedInvoice.balanceDue || selectedInvoice.totalAmount || 0).toFixed(2)}</Text></Text>
            </Space>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="amount" label="Payment Amount ($)" rules={[{ required: true }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} prefix="$" />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true }]}>
            <Select placeholder="Select payment method">
              <Select.Option value="credit_card">Credit Card</Select.Option>
              <Select.Option value="debit_card">Debit Card</Select.Option>
              <Select.Option value="bank_transfer">Bank Transfer (ACH)</Select.Option>
              <Select.Option value="check">Check</Select.Option>
              <Select.Option value="cash">Cash</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Reference / Confirmation #">
            <Input placeholder="Payment reference number (optional)" />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Note: This is a payment recording system. For actual card processing, a payment gateway integration (Stripe, etc.) is required.
        </Text>
      </Modal>
    </div>
  );
};

export default PortalBillingPage;
