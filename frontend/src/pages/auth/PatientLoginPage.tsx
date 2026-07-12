import React, { useState } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Divider,
} from 'antd';
import {
  MailOutlined,
  LockOutlined,
  MedicineBoxOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import patientAuthService from '../../services/patientAuthService';

const { Title, Text, Paragraph } = Typography;

const PatientLoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { email: string; password: string; tenantId: string }) => {
    setLoading(true);
    try {
      const data = await patientAuthService.login(values.email, values.password, values.tenantId);
      if (data.mfaRequired) {
        message.info('MFA verification required — this feature is coming soon');
      } else {
        message.success(`Welcome, ${data.patient.firstName}!`);
        navigate('/portal');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
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
          <Title level={3} style={{ marginBottom: 4, textAlign: 'center' }}>
            Sign In
          </Title>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 32 }}>
            Access your health records and appointments
          </Text>

          <Form
            name="patient-login"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="tenantId"
              label="Healthcare Provider ID"
              rules={[{ required: true, message: 'Please enter your provider ID' }]}
              extra="This is the clinic ID provided by your healthcare provider"
            >
              <Input
                prefix={<IdcardOutlined style={{ color: '#0D7C8A' }} />}
                placeholder="e.g., 00000000-0000-0000-0000-000000000000"
              />
            </Form.Item>

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

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#0D7C8A' }} />}
                placeholder="Password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16, textAlign: 'right' }}>
              <Link to="/patient/forgot-password" style={{ color: '#0D7C8A', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{ height: 48, borderRadius: 10, fontWeight: 600, fontSize: 16, background: '#0D7C8A' }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Are you a provider?
            </Text>
          </Divider>

          <div style={{ textAlign: 'center' }}>
            <Link to="/login" style={{ color: '#0D7C8A', fontWeight: 600 }}>
              Staff Login
            </Link>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Don't have an account? Contact your healthcare provider to get set up.
            </Text>
          </div>
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

export default PatientLoginPage;
