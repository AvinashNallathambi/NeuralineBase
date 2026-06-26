import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Result } from 'antd';
import {
  MailOutlined,
  ArrowLeftOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

const ForgotPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    setEmail(values.email);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setLoading(false);
    setSubmitted(true);
  };

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
        {/* Logo & Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8,
            }}
          >
            <MedicineBoxOutlined style={{ fontSize: 36, color: '#36CFC9' }} />
            <Title level={2} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
              Neuraline
            </Title>
          </div>
        </div>

        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            border: 'none',
          }}
          bodyStyle={{ padding: '40px 32px' }}
        >
          {!submitted ? (
            <>
              <Title level={3} style={{ marginBottom: 4, textAlign: 'center' }}>
                Reset Password
              </Title>
              <Paragraph
                type="secondary"
                style={{ textAlign: 'center', marginBottom: 32 }}
              >
                Enter your email address and we'll send you a link to reset your
                password.
              </Paragraph>

              <Form
                name="forgot-password"
                layout="vertical"
                onFinish={onFinish}
                size="large"
              >
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: 'Please enter your email' },
                    { type: 'email', message: 'Please enter a valid email' },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined style={{ color: '#0D7C8A' }} />}
                    placeholder="Email address"
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{
                      height: 48,
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 16,
                      background: '#0D7C8A',
                    }}
                  >
                    Send Reset Link
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ textAlign: 'center' }}>
                <Link
                  to="/login"
                  style={{
                    color: '#0D7C8A',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ArrowLeftOutlined /> Back to login
                </Link>
              </div>
            </>
          ) : (
            <Result
              status="success"
              title="Check Your Email"
              subTitle={
                <>
                  We've sent a password reset link to{' '}
                  <Text strong>{email}</Text>. Please check your inbox and
                  follow the instructions to reset your password.
                </>
              }
              extra={[
                <Link to="/login" key="login">
                  <Button
                    type="primary"
                    size="large"
                    icon={<ArrowLeftOutlined />}
                    style={{
                      borderRadius: 10,
                      background: '#0D7C8A',
                      fontWeight: 600,
                    }}
                  >
                    Back to Login
                  </Button>
                </Link>,
                <Button
                  key="resend"
                  size="large"
                  style={{ borderRadius: 10 }}
                  onClick={() => setSubmitted(false)}
                >
                  Resend Email
                </Button>,
              ]}
            />
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

export default ForgotPasswordPage;
