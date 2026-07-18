import React, { useState, useEffect } from 'react';
import { Modal, Spin, message, Alert, Radio, Space, Typography, Input, Form } from 'antd';
import {
  useStripe,
  useElements,
  PaymentElement,
} from '@stripe/react-stripe-js';
import subscriptionService from '../../services/subscriptionService';

const { Text } = Typography;

interface UpdatePaymentMethodModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentMethodType = 'card' | 'us_bank_account';

// ── Stripe Elements confirm button (real Stripe mode) ────────────────
const StripeConfirmButton: React.FC<{
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      setError('Stripe has not loaded yet. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Failed to confirm payment method');
        return;
      }

      if (setupIntent && setupIntent.status === 'succeeded' && setupIntent.payment_method) {
        const pmId =
          typeof setupIntent.payment_method === 'string'
            ? setupIntent.payment_method
            : setupIntent.payment_method;

        await subscriptionService.attachPaymentMethod(pmId, true);
        message.success('Payment method updated successfully');
        onSuccess();
      } else if (setupIntent && setupIntent.status === 'requires_action') {
        setError('Additional authentication required. Please complete the verification.');
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || 'Failed to update payment method',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}
      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: {
            billingDetails: {
              name: '',
            },
          },
        }}
      />
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: '1px solid #d9d9d9',
            background: 'white',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !stripe}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            background: loading || !stripe ? '#0D7C8A80' : '#0D7C8A',
            color: 'white',
            cursor: loading || !stripe ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {loading ? 'Processing...' : 'Save Payment Method'}
        </button>
      </div>
    </div>
  );
};

// ── Mock form (development mode without Stripe API key) ───────────────
const MockPaymentForm: React.FC<{
  paymentMethodType: PaymentMethodType;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ paymentMethodType, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Generate a mock Stripe payment method ID
      const mockPmId = `pm_mock_${Date.now()}`;

      // Attach via backend (mock provider will create a mock payment method)
      await subscriptionService.attachPaymentMethod(mockPmId, true);
      message.success(
        `Mock ${paymentMethodType === 'card' ? 'card' : 'bank account'} saved (dev mode)`,
      );
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return; // Form validation error
      message.error(
        err?.response?.data?.message || err?.message || 'Failed to save payment method',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        message="Development Mode"
        description="Stripe API key is not configured. You can add a mock payment method for testing purposes."
        style={{ marginBottom: 16 }}
        showIcon
      />
      <Form form={form} layout="vertical">
        {paymentMethodType === 'card' ? (
          <>
            <Form.Item
              name="cardNumber"
              label="Card Number"
              rules={[
                { required: true, message: 'Please enter a card number' },
                { pattern: /^[0-9\s]{13,19}$/, message: 'Enter a valid card number' },
              ]}
            >
              <Input placeholder="4242 4242 4242 4242" maxLength={19} />
            </Form.Item>
            <Space style={{ width: '100%' }} size="middle">
              <Form.Item
                name="expMonth"
                label="Expiry Month"
                rules={[{ required: true, message: 'Required' }]}
                style={{ flex: 1 }}
              >
                <Input placeholder="MM" maxLength={2} />
              </Form.Item>
              <Form.Item
                name="expYear"
                label="Expiry Year"
                rules={[{ required: true, message: 'Required' }]}
                style={{ flex: 1 }}
              >
                <Input placeholder="YYYY" maxLength={4} />
              </Form.Item>
              <Form.Item
                name="cvc"
                label="CVC"
                rules={[{ required: true, message: 'Required' }]}
                style={{ flex: 1 }}
              >
                <Input placeholder="123" maxLength={4} />
              </Form.Item>
            </Space>
            <Form.Item name="name" label="Name on Card">
              <Input placeholder="John Doe" />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              name="routingNumber"
              label="Routing Number"
              rules={[
                { required: true, message: 'Please enter a routing number' },
                { pattern: /^[0-9]{9}$/, message: 'Routing number must be 9 digits' },
              ]}
            >
              <Input placeholder="110000000" maxLength={9} />
            </Form.Item>
            <Form.Item
              name="accountNumber"
              label="Account Number"
              rules={[
                { required: true, message: 'Please enter an account number' },
                { pattern: /^[0-9]{4,17}$/, message: 'Enter a valid account number' },
              ]}
            >
              <Input placeholder="000123456789" maxLength={17} />
            </Form.Item>
            <Form.Item name="accountType" label="Account Type" initialValue="checking">
              <Radio.Group>
                <Radio value="checking">Checking</Radio>
                <Radio value="savings">Savings</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="name" label="Account Holder Name">
              <Input placeholder="John Doe" />
            </Form.Item>
          </>
        )}
      </Form>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: '1px solid #d9d9d9',
            background: 'white',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            background: loading ? '#0D7C8A80' : '#0D7C8A',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {loading ? 'Saving...' : 'Save Payment Method'}
        </button>
      </div>
    </div>
  );
};

// ── Lazy Stripe provider wrapper ──────────────────────────────────────
const StripeLazyProvider: React.FC<{
  clientSecret: string;
  children: React.ReactNode;
}> = ({ clientSecret, children }) => {
  const [Provider, setProvider] = React.useState<React.ComponentType<any> | null>(
    null,
  );

  useEffect(() => {
    import('../../providers/StripeProvider').then((mod) => {
      setProvider(() => mod.StripeSetupProvider);
    });
  }, []);

  if (!Provider) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Provider clientSecret={clientSecret}>{children}</Provider>
  );
};

// ── Main Modal ────────────────────────────────────────────────────────
const UpdatePaymentMethodModal: React.FC<UpdatePaymentMethodModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethodType, setPaymentMethodType] =
    useState<PaymentMethodType>('card');
  const [isMockMode, setIsMockMode] = useState(false);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setIsMockMode(false);
      return;
    }

    const fetchSetupIntent = async () => {
      setLoading(true);
      try {
        const types =
          paymentMethodType === 'us_bank_account'
            ? ['us_bank_account']
            : ['card'];
        const result = await subscriptionService.createSetupIntent(types);

        // Detect mock mode: mock client secrets start with "mock_"
        if (result.clientSecret.startsWith('mock_')) {
          setIsMockMode(true);
          setClientSecret(null);
        } else {
          setIsMockMode(false);
          setClientSecret(result.clientSecret);
        }
      } catch (err: any) {
        message.error(
          err?.response?.data?.message || 'Failed to initialize payment form',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSetupIntent();
  }, [open, paymentMethodType]);

  const handleClose = () => {
    setClientSecret(null);
    setIsMockMode(false);
    onClose();
  };

  const handleSuccess = () => {
    setClientSecret(null);
    setIsMockMode(false);
    onSuccess();
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title="Update Payment Method"
      width={520}
      destroyOnClose
    >
      {/* Payment method type selector (Phase 3: card + ACH) */}
      <Radio.Group
        value={paymentMethodType}
        onChange={(e) => setPaymentMethodType(e.target.value)}
        style={{ marginBottom: 16 }}
        optionType="button"
        buttonStyle="solid"
      >
        <Radio.Button value="card">Credit / Debit Card</Radio.Button>
        <Radio.Button value="us_bank_account">Bank Account (ACH)</Radio.Button>
      </Radio.Group>

      {paymentMethodType === 'us_bank_account' && !isMockMode && (
        <Alert
          type="info"
          message="ACH Bank Transfer"
          description="You'll need your bank routing number and account number. ACH payments typically take 3-5 business days to process and have lower fees than card payments."
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <br />
          <Text type="secondary">Initializing secure payment form...</Text>
        </div>
      ) : isMockMode ? (
        // Mock mode: show simple form instead of Stripe Elements
        <MockPaymentForm
          paymentMethodType={paymentMethodType}
          onSuccess={handleSuccess}
          onCancel={handleClose}
        />
      ) : clientSecret ? (
        // Real Stripe mode: use Stripe Elements
        <StripeLazyProvider clientSecret={clientSecret}>
          <StripeConfirmButton
            onSuccess={handleSuccess}
            onCancel={handleClose}
          />
        </StripeLazyProvider>
      ) : (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Text type="secondary">Failed to load payment form. Please try again.</Text>
        </div>
      )}
    </Modal>
  );
};

export default UpdatePaymentMethodModal;
