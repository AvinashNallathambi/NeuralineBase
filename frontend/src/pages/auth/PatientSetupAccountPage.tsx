import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Result,
  Spin,
} from 'antd';
import {
  LockOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import patientAuthService from '../../services/patientAuthService';

const { Title, Text, Paragraph } = Typography;

const PatientSetupAccountPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const patientId = searchParams.get('patientId');
  const tenantId = searchParams.get('tenantId');
  const token = searchParams.get('token');

  useEffect(() => {
    // Validate that all required query params are present
    if (!patientId || !tenantId || !token) {
      setError(
        'Invalid setup link. Please use the link sent to you by your healthcare provider.',
      );
    }
    setValidating(false);
  }, [patientId, tenantId, token]);

  const onFinish = async (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await patientAuthService.setupAccount(
        patientId!,
        values.password,
        tenantId!,
        token!,
      );
      setSuccess(true);
      message.success('Account set up successfully! You can now sign in.');
      // tenantId is saved to localStorage by setupAccount(), so the login
      // page will pre-fill it automatically — no need to pass it in the URL.
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Setup failed';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0D7C8A 0%, #064E57 50%, #032D33 100%)',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0D7C8A 0%, #064E57 50%, #032D33 100%)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <MedicineBoxOutlined style={{ fontSize: 36, color: '#36CFC9' }} />
            <Title level={2} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
              Neuraline
            </Title>
          </div>
          <Paragraph style={{ color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            Patient Portal
          </Paragraph>
        </div>

        <Card
          style={{ borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: 'none' }}
          bodyStyle={{ padding: '40px 32px' }}
        >
          {success ? (
            <Result
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              title="Account Set Up!"
              subTitle="Your patient portal account is ready. You can now sign in with your email and new password."
              extra={
                <Button
                  type="primary"
                  size="large"
                  onClick={() => navigate('/patient/login')}
                  style={{ height: 48, borderRadius: 10, fontWeight: 600, background: '#0D7C8A' }}
                >
                  Continue to Sign In
                </Button>
              }
            />
          ) : error ? (
            <Result
              status="error"
              title="Invalid Setup Link"
              subTitle={error}
              extra={
                <Link to="/patient/login" style={{ color: '#0D7C8A', fontWeight: 600 }}>
                  Go to Patient Login
                </Link>
              }
            />
          ) : (
            <>
              <Title level={3} style={{ marginBottom: 4, textAlign: 'center' }}>
                Set Up Your Account
              </Title>
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 32 }}>
                Create a password to access your patient portal
              </Text>

              <Form
                name="setup-account"
                layout="vertical"
                onFinish={onFinish}
                autoComplete="off"
                size="large"
              >
                <Form.Item
                  name="password"
                  label="New Password"
                  rules={[
                    { required: true, message: 'Please enter a password' },
                    { min: 8, message: 'Password must be at least 8 characters' },
                  ]}
                  extra="Minimum 8 characters"
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#0D7C8A' }} />}
                    placeholder="Create a password"
                    autoFocus
                  />
                </Form.Item>

                <Form.Item
                  name="confirmPassword"
                  label="Confirm Password"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Please confirm your password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#0D7C8A' }} />}
                    placeholder="Re-enter password"
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{ height: 48, borderRadius: 10, fontWeight: 600, fontSize: 16, background: '#0D7C8A' }}
                  >
                    Set Up Account
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Already have an account?{' '}
                  <Link to="/patient/login" style={{ color: '#0D7C8A', fontWeight: 600 }}>
                    Sign in
                  </Link>
                </Text>
              </div>
            </>
          )}
        </Card>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            &copy; {new Date().getFullYear()} Neuraline Health Technologies. All rights reserved.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default PatientSetupAccountPage;
