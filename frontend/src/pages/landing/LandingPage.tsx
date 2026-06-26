import React from 'react';
import {
  Button,
  Typography,
  Row,
  Col,
  Card,
  Space,
  Divider,
} from 'antd';
import {
  TeamOutlined,
  CalendarOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  DollarOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  CloudServerOutlined,
  GlobalOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

const { Title, Text, Paragraph } = Typography;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <TeamOutlined style={{ fontSize: 32, color: '#0D7C8A' }} />,
      title: 'Patient Management',
      description:
        'Comprehensive patient records with demographics, medical history, allergies, and insurance management.',
    },
    {
      icon: <CalendarOutlined style={{ fontSize: 32, color: '#36CFC9' }} />,
      title: 'Smart Scheduling',
      description:
        'Intelligent appointment scheduling with automated reminders, waitlist management, and conflict detection.',
    },
    {
      icon: <FileTextOutlined style={{ fontSize: 32, color: '#69C0FF' }} />,
      title: 'Clinical Documentation',
      description:
        'SOAP notes, encounter documentation, and AI-assisted clinical templates for efficient charting.',
    },
    {
      icon: <MedicineBoxOutlined style={{ fontSize: 32, color: '#B37FEB' }} />,
      title: 'E-Prescriptions',
      description:
        'Electronic prescribing with drug interaction checks, formulary verification, and pharmacy integration.',
    },
    {
      icon: <DollarOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      title: 'Billing & Claims',
      description:
        'Automated claims submission, insurance verification, payment processing, and revenue cycle management.',
    },
    {
      icon: <VideoCameraOutlined style={{ fontSize: 32, color: '#faad14' }} />,
      title: 'Telemedicine',
      description:
        'Built-in video consultations with screen sharing, chat, and seamless integration with patient records.',
    },
  ];

  const stats = [
    { value: '500+', label: 'Healthcare Clinics' },
    { value: '2M+', label: 'Patient Records' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '50+', label: 'Integrations' },
  ];

  const steps = [
    {
      number: '01',
      title: 'Sign Up & Configure',
      description:
        'Create your account, set up your organization, and customize workflows in minutes.',
      icon: <ThunderboltOutlined style={{ fontSize: 28, color: '#0D7C8A' }} />,
    },
    {
      number: '02',
      title: 'Import & Onboard',
      description:
        'Migrate existing data seamlessly and onboard your team with guided setup and training.',
      icon: <CloudServerOutlined style={{ fontSize: 28, color: '#36CFC9' }} />,
    },
    {
      number: '03',
      title: 'Go Live',
      description:
        'Start managing patients, scheduling appointments, and processing claims immediately.',
      icon: <GlobalOutlined style={{ fontSize: 28, color: '#B37FEB' }} />,
    },
  ];

  const plans = [
    {
      name: 'Basic',
      price: '$99',
      period: '/mo',
      description: 'For small practices',
      features: [
        'Up to 5 providers',
        '500 patient records',
        'Basic scheduling',
        'E-prescriptions',
        'Email support',
      ],
      color: '#69C0FF',
      cta: 'Start Free Trial',
    },
    {
      name: 'Professional',
      price: '$249',
      period: '/mo',
      description: 'For growing clinics',
      features: [
        'Up to 25 providers',
        'Unlimited patients',
        'Advanced scheduling',
        'Billing & claims',
        'Telehealth',
        'Priority support',
        'Analytics dashboard',
      ],
      color: '#0D7C8A',
      popular: true,
      cta: 'Start Free Trial',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For health systems',
      features: [
        'Unlimited everything',
        'Custom integrations',
        'HL7/FHIR support',
        'Dedicated manager',
        'SLA guarantee',
        '24/7 phone support',
        'On-premise option',
      ],
      color: '#B37FEB',
      cta: 'Contact Sales',
    },
  ];

  const footerLinks = {
    Product: ['Features', 'Pricing', 'Integrations', 'API Documentation', 'Changelog'],
    Company: ['About Us', 'Careers', 'Blog', 'Press', 'Contact'],
    Resources: ['Help Center', 'Community', 'Webinars', 'Case Studies', 'Partners'],
    Legal: ['Privacy Policy', 'Terms of Service', 'HIPAA Compliance', 'Security', 'BAA'],
  };

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      {/* ─── Navigation Bar ───────────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 48px',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 68,
          }}
        >
          {/* Logo */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <img src={logo} alt="Neuraline" style={{ height: 34 }} />
            <Title level={4} style={{ margin: 0, color: '#0D7C8A', fontWeight: 700 }}>
              Neuraline
            </Title>
          </div>

          {/* Nav Links */}
          <Space size={32} style={{ display: 'flex', alignItems: 'center' }}>
            <a href="#features" style={{ color: '#1a2b3c', fontWeight: 500, textDecoration: 'none' }}>
              Features
            </a>
            <a href="#pricing" style={{ color: '#1a2b3c', fontWeight: 500, textDecoration: 'none' }}>
              Pricing
            </a>
            <a href="#how-it-works" style={{ color: '#1a2b3c', fontWeight: 500, textDecoration: 'none' }}>
              About
            </a>
            <Button
              size="large"
              onClick={() => navigate('/login')}
              style={{ borderRadius: 10, fontWeight: 600 }}
            >
              Login
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/register')}
              style={{ borderRadius: 10, fontWeight: 600, background: '#0D7C8A' }}
            >
              Sign Up
            </Button>
          </Space>
        </div>
      </div>

      {/* ─── Hero Section ──────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #032D33 0%, #0D7C8A 50%, #36CFC9 100%)',
          padding: '100px 48px 120px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(54,207,201,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(105,192,255,0.1) 0%, transparent 50%)',
          }}
        />
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <Title
            style={{
              color: '#fff',
              fontSize: 56,
              fontWeight: 800,
              margin: '0 0 20px',
              lineHeight: 1.15,
            }}
          >
            Intelligent Healthcare
            <br />
            Platform
          </Title>
          <Paragraph
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 20,
              maxWidth: 680,
              margin: '0 auto 40px',
              lineHeight: 1.6,
            }}
          >
            The modern, cloud-native EMR designed for today's healthcare providers. Streamline
            patient care, automate workflows, and grow your practice with AI-powered insights.
          </Paragraph>
          <Space size={16}>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/register')}
              style={{
                height: 52,
                padding: '0 36px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                background: '#fff',
                color: '#0D7C8A',
                border: 'none',
              }}
            >
              Get Started Free <ArrowRightOutlined />
            </Button>
            <Button
              size="large"
              ghost
              style={{
                height: 52,
                padding: '0 36px',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 16,
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.5)',
              }}
            >
              Request Demo
            </Button>
          </Space>
        </div>
      </div>

      {/* ─── Stats Section ─────────────────────────────────────────────── */}
      <div
        style={{
          background: '#f8fafc',
          padding: '48px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Row gutter={[48, 24]} justify="center" align="middle">
            {stats.map((stat, index) => (
              <Col xs={12} sm={6} key={index} style={{ textAlign: 'center' }}>
                <Title
                  level={2}
                  style={{ color: '#0D7C8A', margin: '0 0 4px', fontWeight: 800 }}
                >
                  {stat.value}
                </Title>
                <Text type="secondary" style={{ fontSize: 15 }}>
                  {stat.label}
                </Text>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* ─── Features Section ──────────────────────────────────────────── */}
      <div id="features" style={{ padding: '80px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Text
              style={{
                color: '#0D7C8A',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              Features
            </Text>
            <Title level={2} style={{ margin: '12px 0 8px' }}>
              Everything You Need to Run Your Practice
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
              A comprehensive suite of tools designed for modern healthcare delivery
            </Paragraph>
          </div>

          <Row gutter={[32, 32]}>
            {features.map((feature, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 16,
                    border: '1px solid #f0f0f0',
                    height: '100%',
                    transition: 'all 0.3s ease',
                  }}
                  bodyStyle={{ padding: '32px 28px' }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 16,
                      background: '#f0fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 20,
                    }}
                  >
                    {feature.icon}
                  </div>
                  <Title level={4} style={{ marginBottom: 8 }}>
                    {feature.title}
                  </Title>
                  <Paragraph type="secondary" style={{ margin: 0, lineHeight: 1.7 }}>
                    {feature.description}
                  </Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* ─── How it Works ──────────────────────────────────────────────── */}
      <div
        id="how-it-works"
        style={{ background: '#f8fafc', padding: '80px 48px' }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Text
              style={{
                color: '#0D7C8A',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              How It Works
            </Text>
            <Title level={2} style={{ margin: '12px 0 8px' }}>
              Get Started in Three Simple Steps
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
              From sign-up to your first patient visit in under an hour
            </Paragraph>
          </div>

          <Row gutter={[48, 32]} justify="center">
            {steps.map((step, index) => (
              <Col xs={24} sm={8} key={index}>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0D7C8A15, #36CFC920)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px',
                      position: 'relative',
                    }}
                  >
                    {step.icon}
                    <div
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#0D7C8A',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {step.number}
                    </div>
                  </div>
                  <Title level={4} style={{ marginBottom: 8 }}>
                    {step.title}
                  </Title>
                  <Paragraph type="secondary" style={{ fontSize: 15, lineHeight: 1.7 }}>
                    {step.description}
                  </Paragraph>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* ─── Pricing Section ───────────────────────────────────────────── */}
      <div id="pricing" style={{ padding: '80px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Text
              style={{
                color: '#0D7C8A',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              Pricing
            </Text>
            <Title level={2} style={{ margin: '12px 0 8px' }}>
              Simple, Transparent Pricing
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
              No hidden fees. Cancel anytime. All plans include a 14-day free trial.
            </Paragraph>
          </div>

          <Row gutter={[32, 32]} justify="center">
            {plans.map((plan, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 16,
                    border: plan.popular ? `2px solid ${plan.color}` : '1px solid #f0f0f0',
                    height: '100%',
                    position: 'relative',
                    overflow: 'visible',
                    boxShadow: plan.popular ? `0 12px 32px ${plan.color}20` : '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                  bodyStyle={{ padding: '36px 28px' }}
                >
                  {plan.popular && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -14,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: plan.color,
                        color: '#fff',
                        padding: '5px 20px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Most Popular
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <Title level={4} style={{ marginBottom: 4 }}>
                      {plan.name}
                    </Title>
                    <Text type="secondary">{plan.description}</Text>
                    <div style={{ margin: '20px 0' }}>
                      <Text style={{ fontSize: 44, fontWeight: 800, color: plan.color }}>
                        {plan.price}
                      </Text>
                      {plan.period && (
                        <Text type="secondary" style={{ fontSize: 18 }}>
                          {plan.period}
                        </Text>
                      )}
                    </div>
                  </div>

                  <Divider style={{ margin: '0 0 20px' }} />

                  <div style={{ marginBottom: 28 }}>
                    {plan.features.map((feature, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 14,
                        }}
                      >
                        <CheckCircleOutlined style={{ color: plan.color, fontSize: 15 }} />
                        <Text style={{ fontSize: 14 }}>{feature}</Text>
                      </div>
                    ))}
                  </div>

                  <Button
                    type={plan.popular ? 'primary' : 'default'}
                    size="large"
                    block
                    onClick={() => navigate('/register')}
                    style={{
                      height: 48,
                      borderRadius: 10,
                      fontWeight: 600,
                      ...(plan.popular
                        ? { background: plan.color, borderColor: plan.color }
                        : {}),
                    }}
                  >
                    {plan.cta}
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* ─── CTA Section ───────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0D7C8A 0%, #064E57 100%)',
          padding: '80px 48px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <SafetyCertificateOutlined style={{ fontSize: 48, color: '#36CFC9', marginBottom: 24 }} />
          <Title level={2} style={{ color: '#fff', marginBottom: 16 }}>
            Ready to Transform Your Practice?
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, marginBottom: 36 }}>
            Join hundreds of healthcare providers who trust Neuraline for their EMR needs. 
            HIPAA compliant, SOC 2 certified, and built for scale.
          </Paragraph>
          <Space size={16}>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/register')}
              style={{
                height: 52,
                padding: '0 36px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                background: '#fff',
                color: '#0D7C8A',
                border: 'none',
              }}
            >
              Start Free Trial
            </Button>
            <Button
              size="large"
              ghost
              style={{
                height: 52,
                padding: '0 36px',
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 16,
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.5)',
              }}
            >
              Schedule a Demo
            </Button>
          </Space>
        </div>
      </div>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <div style={{ background: '#032D33', padding: '64px 48px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Row gutter={[48, 40]}>
            {/* Brand Column */}
            <Col xs={24} sm={24} md={8}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <MedicineBoxOutlined style={{ fontSize: 24, color: '#36CFC9' }} />
                <Title level={4} style={{ margin: 0, color: '#fff' }}>
                  Neuraline
                </Title>
              </div>
              <Paragraph style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: 20 }}>
                The intelligent healthcare platform that empowers providers 
                to deliver exceptional patient care.
              </Paragraph>
              <Space size={16}>
                <EnvironmentOutlined style={{ color: 'rgba(255,255,255,0.5)' }} />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                  San Francisco, CA
                </Text>
              </Space>
              <br />
              <Space size={16} style={{ marginTop: 8 }}>
                <MailOutlined style={{ color: 'rgba(255,255,255,0.5)' }} />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                  hello@neuraline.health
                </Text>
              </Space>
              <br />
              <Space size={16} style={{ marginTop: 8 }}>
                <PhoneOutlined style={{ color: 'rgba(255,255,255,0.5)' }} />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                  +1 (555) 100-2000
                </Text>
              </Space>
            </Col>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <Col xs={12} sm={6} md={4} key={category}>
                <Title
                  level={5}
                  style={{
                    color: '#fff',
                    marginBottom: 20,
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {category}
                </Title>
                {links.map((link) => (
                  <div key={link} style={{ marginBottom: 10 }}>
                    <a
                      href="#"
                      style={{
                        color: 'rgba(255,255,255,0.55)',
                        fontSize: 14,
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#36CFC9')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                    >
                      {link}
                    </a>
                  </div>
                ))}
              </Col>
            ))}
          </Row>

          <Divider style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '40px 0 24px' }} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              &copy; {new Date().getFullYear()} Neuraline Health Technologies, Inc. All rights reserved.
            </Text>
            <Space size={24}>
              <a href="#" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
                Privacy
              </a>
              <a href="#" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
                Terms
              </a>
              <a href="#" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
                HIPAA
              </a>
            </Space>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
