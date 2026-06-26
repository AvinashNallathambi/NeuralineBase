import React, { useState } from 'react';
import {
  Form,
  Input,
  Button,
  Steps,
  Select,
  Card,
  Typography,
  Row,
  Col,
  message,
  Divider,
} from 'antd';
import {
  BankOutlined,
  UserOutlined,
  CrownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  MailOutlined,
  LockOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const RegisterPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('professional');
  const [orgForm] = Form.useForm();
  const [userForm] = Form.useForm();
  const navigate = useNavigate();

  const steps = [
    { title: 'Organization', icon: <BankOutlined /> },
    { title: 'Admin Account', icon: <UserOutlined /> },
    { title: 'Choose Plan', icon: <CrownOutlined /> },
  ];

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await orgForm.validateFields();
      } else if (currentStep === 1) {
        await userForm.validateFields();
      }
      setCurrentStep((prev) => prev + 1);
    } catch {
      // Validation failed
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
    message.success('Registration successful! Please check your email to verify your account.');
    navigate('/login');
  };

  const plans = [
    {
      key: 'basic',
      name: 'Basic',
      price: '$99',
      period: '/month',
      description: 'For small practices getting started',
      features: [
        'Up to 5 providers',
        '500 patient records',
        'Basic scheduling',
        'E-prescriptions',
        'Email support',
      ],
      color: '#69C0FF',
    },
    {
      key: 'professional',
      name: 'Professional',
      price: '$249',
      period: '/month',
      description: 'For growing clinics and practices',
      features: [
        'Up to 25 providers',
        'Unlimited patients',
        'Advanced scheduling',
        'E-prescriptions & lab orders',
        'Billing & claims',
        'Telehealth',
        'Priority support',
      ],
      color: '#0D7C8A',
      popular: true,
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For hospitals and health systems',
      features: [
        'Unlimited providers',
        'Unlimited patients',
        'All features included',
        'Custom integrations',
        'HL7/FHIR support',
        'Dedicated account manager',
        'SLA guarantee',
        '24/7 phone support',
      ],
      color: '#B37FEB',
    },
  ];

  const renderOrgStep = () => (
    <Form
      form={orgForm}
      layout="vertical"
      size="large"
      style={{ maxWidth: 560, margin: '0 auto' }}
    >
      <Title level={4} style={{ marginBottom: 4 }}>
        Organization Details
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Tell us about your healthcare organization
      </Paragraph>

      <Form.Item
        name="orgName"
        label="Organization Name"
        rules={[{ required: true, message: 'Please enter organization name' }]}
      >
        <Input prefix={<BankOutlined style={{ color: '#0D7C8A' }} />} placeholder="e.g., Sunrise Medical Center" />
      </Form.Item>

      <Form.Item
        name="orgType"
        label="Organization Type"
        rules={[{ required: true, message: 'Please select organization type' }]}
      >
        <Select placeholder="Select organization type">
          <Option value="private_practice">Private Practice</Option>
          <Option value="clinic">Clinic</Option>
          <Option value="hospital">Hospital</Option>
          <Option value="urgent_care">Urgent Care</Option>
          <Option value="specialty_center">Specialty Center</Option>
          <Option value="telehealth">Telehealth Provider</Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="address"
        label="Address"
        rules={[{ required: true, message: 'Please enter address' }]}
      >
        <Input prefix={<EnvironmentOutlined style={{ color: '#0D7C8A' }} />} placeholder="123 Medical Center Dr, City, State, ZIP" />
      </Form.Item>

      <Form.Item
        name="phone"
        label="Phone Number"
        rules={[{ required: true, message: 'Please enter phone number' }]}
      >
        <Input prefix={<PhoneOutlined style={{ color: '#0D7C8A' }} />} placeholder="+1 (555) 123-4567" />
      </Form.Item>
    </Form>
  );

  const renderUserStep = () => (
    <Form
      form={userForm}
      layout="vertical"
      size="large"
      style={{ maxWidth: 560, margin: '0 auto' }}
    >
      <Title level={4} style={{ marginBottom: 4 }}>
        Administrator Account
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Set up the primary admin account for your organization
      </Paragraph>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input prefix={<UserOutlined style={{ color: '#0D7C8A' }} />} placeholder="First name" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="lastName"
            label="Last Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Last name" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="email"
        label="Email Address"
        rules={[
          { required: true, message: 'Please enter email' },
          { type: 'email', message: 'Please enter a valid email' },
        ]}
      >
        <Input prefix={<MailOutlined style={{ color: '#0D7C8A' }} />} placeholder="admin@yourorg.com" />
      </Form.Item>

      <Form.Item
        name="password"
        label="Password"
        rules={[
          { required: true, message: 'Please enter password' },
          { min: 8, message: 'Password must be at least 8 characters' },
        ]}
      >
        <Input.Password prefix={<LockOutlined style={{ color: '#0D7C8A' }} />} placeholder="Create a strong password" />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="Confirm Password"
        dependencies={['password']}
        rules={[
          { required: true, message: 'Please confirm password' },
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
        <Input.Password prefix={<LockOutlined style={{ color: '#0D7C8A' }} />} placeholder="Confirm your password" />
      </Form.Item>
    </Form>
  );

  const renderPlanStep = () => (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          Choose Your Plan
        </Title>
        <Paragraph type="secondary">
          Select the plan that best fits your organization's needs
        </Paragraph>
      </div>

      <Row gutter={[24, 24]} justify="center">
        {plans.map((plan) => (
          <Col xs={24} sm={12} md={8} key={plan.key}>
            <Card
              hoverable
              onClick={() => setSelectedPlan(plan.key)}
              style={{
                borderRadius: 16,
                border: selectedPlan === plan.key ? `2px solid ${plan.color}` : '2px solid transparent',
                boxShadow: selectedPlan === plan.key ? `0 8px 24px ${plan.color}30` : '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'visible',
              }}
              bodyStyle={{ padding: '28px 24px' }}
            >
              {plan.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: plan.color,
                    color: '#fff',
                    padding: '4px 16px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Most Popular
                </div>
              )}

              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <Text
                  strong
                  style={{ fontSize: 20, display: 'block', marginBottom: 4 }}
                >
                  {plan.name}
                </Text>
                <div style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 36, fontWeight: 700, color: plan.color }}>
                    {plan.price}
                  </Text>
                  {plan.period && (
                    <Text type="secondary" style={{ fontSize: 16 }}>
                      {plan.period}
                    </Text>
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {plan.description}
                </Text>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div>
                {plan.features.map((feature, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <CheckCircleOutlined style={{ color: plan.color, fontSize: 14 }} />
                    <Text style={{ fontSize: 13 }}>{feature}</Text>
                  </div>
                ))}
              </div>

              {selectedPlan === plan.key && (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: 16,
                    padding: '8px',
                    background: `${plan.color}10`,
                    borderRadius: 8,
                  }}
                >
                  <CheckCircleOutlined style={{ color: plan.color, marginRight: 6 }} />
                  <Text style={{ color: plan.color, fontWeight: 600 }}>Selected</Text>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0D7C8A 0%, #064E57 50%, #032D33 100%)',
        padding: '40px 24px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8,
            }}
          >
            <MedicineBoxOutlined style={{ fontSize: 32, color: '#36CFC9' }} />
            <Title level={3} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
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
          {/* Steps Indicator */}
          <Steps
            current={currentStep}
            items={steps.map((s) => ({
              title: s.title,
              icon: s.icon,
            }))}
            style={{ marginBottom: 40, maxWidth: 600, margin: '0 auto 40px' }}
          />

          {/* Step Content */}
          <div style={{ minHeight: 360 }}>
            {currentStep === 0 && renderOrgStep()}
            {currentStep === 1 && renderUserStep()}
            {currentStep === 2 && renderPlanStep()}
          </div>

          {/* Navigation Buttons */}
          <Divider />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              maxWidth: 560,
              margin: '0 auto',
            }}
          >
            <div>
              {currentStep > 0 && (
                <Button
                  size="large"
                  icon={<ArrowLeftOutlined />}
                  onClick={handleBack}
                  style={{ borderRadius: 10 }}
                >
                  Back
                </Button>
              )}
            </div>
            <div>
              {currentStep < steps.length - 1 ? (
                <Button
                  type="primary"
                  size="large"
                  onClick={handleNext}
                  style={{
                    borderRadius: 10,
                    minWidth: 140,
                    background: '#0D7C8A',
                    fontWeight: 600,
                  }}
                >
                  Next <ArrowRightOutlined />
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  loading={loading}
                  onClick={handleSubmit}
                  style={{
                    borderRadius: 10,
                    minWidth: 180,
                    background: '#0D7C8A',
                    fontWeight: 600,
                  }}
                >
                  Create Account
                </Button>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Text type="secondary">
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#0D7C8A', fontWeight: 600 }}>
                Sign in
              </Link>
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

export default RegisterPage;
