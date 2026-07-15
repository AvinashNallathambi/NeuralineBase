import React, { useState } from 'react';
import {
  Button,
  Typography,
  Row,
  Col,
  Card,
  Space,
  Divider,
  Tag,
  Tooltip,
  Switch,
  Table,
  Radio,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

const { Title, Text, Paragraph } = Typography;

interface PlanFeature {
  label: string;
  solo: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}

interface Plan {
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  description: string;
  color: string;
  popular?: boolean;
  cta: string;
  highlight: string;
  features: string[];
}

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const plans: Plan[] = [
    {
      name: 'Solo',
      priceMonthly: 99,
      priceAnnual: 84,
      description: 'For solo practitioners & cash-pay practices',
      color: '#69C0FF',
      cta: 'Start Free Trial',
      highlight: 'Full EMR without the enterprise price tag',
      features: [
        '1 provider, unlimited patients',
        'Patient management & demographics',
        'Appointment scheduling',
        'Clinical documentation (SOAP notes)',
        'E-prescribing (RxNorm + pharmacy network)',
        'Lab orders & results',
        'Patient portal with secure messaging',
        'Basic billing & invoicing',
        '14-day free trial',
      ],
    },
    {
      name: 'Professional',
      priceMonthly: 249,
      priceAnnual: 212,
      description: 'For growing clinics (2–10 providers)',
      color: '#0D7C8A',
      popular: true,
      cta: 'Start Free Trial',
      highlight: 'Full EMR + complete RCM + AI scribe in one platform',
      features: [
        'Everything in Solo, plus:',
        'Up to 25 providers',
        'Full RCM: claims, ERA/835 remittance, denials, appeals',
        'Underpayment analysis & recovery',
        'Eligibility verification (270/271)',
        'Workflow engine with custom state machines',
        'AI scribe — SOAP notes via Ollama',
        'AI medical code suggestions (ICD-10/CPT)',
        'AI prescribing review & interaction checks',
        'Secure patient-provider messaging',
        'Priority support',
      ],
    },
    {
      name: 'Enterprise',
      priceMonthly: 499,
      priceAnnual: 424,
      description: 'For multi-site practices & health systems',
      color: '#B37FEB',
      cta: 'Contact Sales',
      highlight: 'Advanced AI + automation + multi-tenant at half the enterprise cost',
      features: [
        'Everything in Professional, plus:',
        'Unlimited providers & locations',
        'RCM automation engine (rules + triggers)',
        'AI lab triage with urgency scoring',
        'AI patient assistant (symptom checker, education, visit prep)',
        'Multi-tenant architecture',
        'SSO / SAML integration',
        'Custom HL7/FHIR integrations',
        'Dedicated account manager',
        '99.9% uptime SLA',
        '24/7 priority support',
      ],
    },
  ];

  const featureMatrix: PlanFeature[] = [
    { label: 'Patient management & demographics', solo: true, professional: true, enterprise: true },
    { label: 'Appointment scheduling', solo: true, professional: true, enterprise: true },
    { label: 'Clinical documentation (SOAP)', solo: true, professional: true, enterprise: true },
    { label: 'E-prescribing (RxNorm)', solo: true, professional: true, enterprise: true },
    { label: 'Lab orders & results', solo: true, professional: true, enterprise: true },
    { label: 'Patient portal', solo: true, professional: true, enterprise: true },
    { label: 'Basic billing & invoicing', solo: true, professional: true, enterprise: true },
    { label: 'Providers included', solo: '1', professional: 'Up to 25', enterprise: 'Unlimited' },
    { label: 'Claims management (837)', solo: false, professional: true, enterprise: true },
    { label: 'ERA / 835 remittance auto-posting', solo: false, professional: true, enterprise: true },
    { label: 'Denials management & CARC/RARC', solo: false, professional: true, enterprise: true },
    { label: 'Appeals generation', solo: false, professional: true, enterprise: true },
    { label: 'Underpayment analysis', solo: false, professional: true, enterprise: true },
    { label: 'Eligibility verification (270/271)', solo: false, professional: true, enterprise: true },
    { label: 'Workflow engine', solo: false, professional: true, enterprise: true },
    { label: 'AI scribe (SOAP via Ollama)', solo: false, professional: true, enterprise: true },
    { label: 'AI code suggestions (ICD-10/CPT)', solo: false, professional: true, enterprise: true },
    { label: 'AI prescribing review', solo: false, professional: true, enterprise: true },
    { label: 'Secure messaging', solo: 'Basic', professional: true, enterprise: true },
    { label: 'RCM automation engine', solo: false, professional: false, enterprise: true },
    { label: 'AI lab triage & urgency scoring', solo: false, professional: false, enterprise: true },
    { label: 'AI patient assistant', solo: false, professional: false, enterprise: true },
    { label: 'Multi-tenant / multi-location', solo: false, professional: false, enterprise: true },
    { label: 'SSO / SAML', solo: false, professional: false, enterprise: true },
    { label: 'Custom HL7/FHIR integrations', solo: false, professional: false, enterprise: true },
    { label: 'Dedicated account manager', solo: false, professional: false, enterprise: true },
    { label: 'Uptime SLA', solo: 'Best effort', professional: '99.5%', enterprise: '99.9%' },
    { label: 'Support', solo: 'Email', professional: 'Priority email', enterprise: '24/7 priority' },
  ];

  const competitorData = [
    {
      key: '1',
      vendor: 'Neuraline Professional',
      emr: true,
      rcm: true,
      aiScribe: true,
      aiCoding: true,
      patientPortal: true,
      transparentPricing: true,
      price: '$249/provider/mo',
      contract: 'Month-to-month',
    },
    {
      key: '2',
      vendor: 'Elation Health',
      emr: true,
      rcm: 'Billing only',
      aiScribe: true,
      aiCoding: true,
      patientPortal: true,
      transparentPricing: true,
      price: '$199/provider/mo',
      contract: 'Annual',
    },
    {
      key: '3',
      vendor: 'eClinicalWorks',
      emr: true,
      rcm: '$2.5K–$5K add-on',
      aiScribe: false,
      aiCoding: false,
      patientPortal: 'Basic',
      transparentPricing: true,
      price: '$449–$599/provider/mo',
      contract: '3-year',
    },
    {
      key: '4',
      vendor: 'Waystar',
      emr: false,
      rcm: true,
      aiScribe: false,
      aiCoding: false,
      patientPortal: false,
      transparentPricing: false,
      price: '$200–$300/provider/mo',
      contract: 'Multi-year',
    },
    {
      key: '5',
      vendor: 'DAX Copilot (Microsoft)',
      emr: false,
      rcm: false,
      aiScribe: true,
      aiCoding: false,
      patientPortal: false,
      transparentPricing: false,
      price: '$369–$600/provider/mo',
      contract: '3-year min',
    },
    {
      key: '6',
      vendor: 'Abridge',
      emr: false,
      rcm: false,
      aiScribe: true,
      aiCoding: 'ICD-10 only',
      patientPortal: false,
      transparentPricing: false,
      price: '$400–$600/provider/mo',
      contract: 'Enterprise',
    },
    {
      key: '7',
      vendor: 'Practice Fusion',
      emr: true,
      rcm: false,
      aiScribe: false,
      aiCoding: false,
      patientPortal: 'Basic',
      transparentPricing: true,
      price: '$149–$199/provider/mo',
      contract: 'Annual',
    },
  ];

  const renderBool = (val: boolean | string) => {
    if (val === true) return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
    if (val === false) return <CloseCircleOutlined style={{ color: '#d9d9d9', fontSize: 18 }} />;
    return <Text style={{ fontSize: 13 }}>{val}</Text>;
  };

  const competitorColumns = [
    {
      title: 'Vendor',
      dataIndex: 'vendor',
      key: 'vendor',
      render: (text: string, record: any) => (
        <Text strong={record.key === '1'} style={record.key === '1' ? { color: '#0D7C8A' } : {}}>
          {text}
        </Text>
      ),
    },
    {
      title: 'EMR',
      dataIndex: 'emr',
      key: 'emr',
      align: 'center' as const,
      render: renderBool,
    },
    {
      title: 'Full RCM',
      dataIndex: 'rcm',
      key: 'rcm',
      align: 'center' as const,
      render: renderBool,
    },
    {
      title: 'AI Scribe',
      dataIndex: 'aiScribe',
      key: 'aiScribe',
      align: 'center' as const,
      render: renderBool,
    },
    {
      title: 'AI Coding',
      dataIndex: 'aiCoding',
      key: 'aiCoding',
      align: 'center' as const,
      render: renderBool,
    },
    {
      title: 'Patient Portal',
      dataIndex: 'patientPortal',
      key: 'patientPortal',
      align: 'center' as const,
      render: renderBool,
    },
    {
      title: 'Transparent Pricing',
      dataIndex: 'transparentPricing',
      key: 'transparentPricing',
      align: 'center' as const,
      render: renderBool,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (text: string, record: any) => (
        <Text strong={record.key === '1'} style={record.key === '1' ? { color: '#0D7C8A' } : {}}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Contract',
      dataIndex: 'contract',
      key: 'contract',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
  ];

  const faqs = [
    {
      q: 'Is there a free trial?',
      a: 'Yes — Solo and Professional plans include a 14-day free trial. Enterprise includes a 30-day pilot. No credit card required to start.',
    },
    {
      q: 'What is the AI add-on?',
      a: 'AI requests (transcription, SOAP generation, lab summaries, symptom checks) are billed at $0.10–$0.25 per request. This covers compute costs for Ollama/Whisper. Professional and Enterprise include a monthly AI credit allowance.',
    },
    {
      q: 'Are there per-claim fees?',
      a: 'Clearinghouse/EDI pass-through is $0.25–$0.70 per claim, depending on volume. This is transparent pass-through pricing — we do not markup clearinghouse costs.',
    },
    {
      q: 'Can I switch plans later?',
      a: 'Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades take effect at the next billing cycle. No penalties.',
    },
    {
      q: 'Is there an implementation fee?',
      a: 'Implementation is $500 (Solo), $2,000 (Professional), and $5,000+ (Enterprise). Implementation is free with an annual prepay commitment.',
    },
    {
      q: 'Do you offer annual billing discounts?',
      a: 'Yes — annual prepay saves 15% (Solo/Professional) or 17% (Enterprise) compared to monthly billing.',
    },
    {
      q: 'Is Neuraline HIPAA compliant?',
      a: 'Yes. All plans include HIPAA-compliant infrastructure, BAA available, audit logging, 15-minute session timeout, and account lockout after 5 failed login attempts.',
    },
    {
      q: 'How does Neuraline compare to buying an EHR + AI scribe + RCM separately?',
      a: 'A typical stack (eClinicalWorks $499 + DAX Copilot $400 + Waystar RCM $200) costs ~$1,100/provider/month across 3 vendors. Neuraline Professional bundles all three for $249/provider/month — a 77% savings with a single unified platform.',
    },
  ];

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
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <img src={logo} alt="Neuraline" style={{ height: 34 }} />
            <Title level={4} style={{ margin: 0, color: '#0D7C8A', fontWeight: 700 }}>
              Neuraline
            </Title>
          </div>
          <Space size={32} style={{ display: 'flex', alignItems: 'center' }}>
            <a
              href="/#features"
              style={{ color: '#1a2b3c', fontWeight: 500, textDecoration: 'none' }}
            >
              Features
            </a>
            <Text style={{ color: '#0D7C8A', fontWeight: 600 }}>Pricing</Text>
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

      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #032D33 0%, #0D7C8A 50%, #36CFC9 100%)',
          padding: '80px 48px 60px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(54,207,201,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(105,192,255,0.1) 0%, transparent 50%)',
          }}
        />
        <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
          <Tag
            color="rgba(255,255,255,0.15)"
            style={{
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 20,
              padding: '4px 16px',
              marginBottom: 20,
            }}
          >
            <ThunderboltOutlined style={{ marginRight: 6 }} />
            Transparent Pricing — No Sales Calls Required
          </Tag>
          <Title
            style={{
              color: '#fff',
              fontSize: 48,
              fontWeight: 800,
              margin: '0 0 16px',
              lineHeight: 1.15,
            }}
          >
            One Platform. One Price.
            <br />
            EMR + RCM + AI.
          </Title>
          <Paragraph
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 18,
              maxWidth: 600,
              margin: '0 auto',
            }}
          >
            Competitors charge $1,100+/provider/month across 3 separate vendors. Neuraline bundles
            everything for less than most charge for EMR alone.
          </Paragraph>
        </div>
      </div>

      {/* ─── Billing Cycle Toggle ──────────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '40px 48px 0' }}>
        <Space size={16} align="center">
          <Text strong style={{ color: billingCycle === 'monthly' ? '#0D7C8A' : '#64748b' }}>
            Monthly
          </Text>
          <Switch
            checked={billingCycle === 'annual'}
            onChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
          />
          <Text strong style={{ color: billingCycle === 'annual' ? '#0D7C8A' : '#64748b' }}>
            Annual
          </Text>
          <Tag color="success" style={{ borderRadius: 12, marginLeft: 4 }}>
            Save 15%
          </Tag>
        </Space>
      </div>

      {/* ─── Pricing Cards ─────────────────────────────────────────────── */}
      <div style={{ padding: '32px 48px 60px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
                    boxShadow: plan.popular
                      ? `0 12px 32px ${plan.color}20`
                      : '0 2px 8px rgba(0,0,0,0.04)',
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

                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4} style={{ marginBottom: 4 }}>
                      {plan.name}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {plan.description}
                    </Text>
                    <div style={{ margin: '20px 0 8px' }}>
                      <Text style={{ fontSize: 44, fontWeight: 800, color: plan.color }}>
                        ${billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 18 }}>
                        /provider/mo
                      </Text>
                    </div>
                    {billingCycle === 'annual' && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        billed annually
                      </Text>
                    )}
                    <div
                      style={{
                        marginTop: 12,
                        padding: '8px 12px',
                        background: `${plan.color}10`,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: plan.color, fontWeight: 500 }}>
                        {plan.highlight}
                      </Text>
                    </div>
                  </div>

                  <Divider style={{ margin: '0 0 20px' }} />

                  <div style={{ marginBottom: 28, minHeight: 280 }}>
                    {plan.features.map((feature, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          marginBottom: 12,
                        }}
                      >
                        <CheckCircleOutlined
                          style={{ color: plan.color, fontSize: 15, marginTop: 3, flexShrink: 0 }}
                        />
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: feature.endsWith(':') ? 600 : 400,
                          }}
                        >
                          {feature}
                        </Text>
                      </div>
                    ))}
                  </div>

                  <Button
                    type={plan.popular ? 'primary' : 'default'}
                    size="large"
                    block
                    onClick={() => navigate(plan.cta === 'Contact Sales' ? '/register' : '/register')}
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

      {/* ─── AI Add-On Banner ──────────────────────────────────────────── */}
      <div style={{ padding: '0 48px 60px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Card
            style={{
              borderRadius: 16,
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e6fffb 100%)',
              border: '1px solid #d6f0ee',
            }}
            bodyStyle={{ padding: '32px 40px' }}
          >
            <Row align="middle" gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <Space direction="vertical" size={4}>
                  <Space>
                    <RobotOutlined style={{ fontSize: 24, color: '#0D7C8A' }} />
                    <Title level={4} style={{ margin: 0, color: '#0D7C8A' }}>
                      AI Add-On — Usage-Based
                    </Title>
                  </Space>
                  <Paragraph style={{ margin: 0, color: '#475569' }}>
                    AI requests (transcription, SOAP generation, lab summaries, symptom checks) are
                    billed at <Text strong>$0.10–$0.25 per request</Text>. Professional and
                    Enterprise include a monthly AI credit allowance. Self-hosted Ollama option
                    eliminates per-request fees entirely.
                  </Paragraph>
                </Space>
              </Col>
              <Col xs={24} lg={8} style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: 36, fontWeight: 800, color: '#0D7C8A' }}>$0.10</Text>
                <Text type="secondary" style={{ fontSize: 16 }}>
                  {' '}/ request
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Covers Ollama + Whisper compute. No markup.
                </Text>
              </Col>
            </Row>
          </Card>
        </div>
      </div>

      {/* ─── Cost Savings Calculator ───────────────────────────────────── */}
      <div style={{ padding: '0 48px 80px', background: '#f5f7fa' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <Text
              style={{
                color: '#0D7C8A',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              <DollarOutlined style={{ marginRight: 6 }} />
              Cost Comparison
            </Text>
            <Title level={2} style={{ margin: '12px 0 8px' }}>
              The Fragmented Stack vs. Neuraline
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
              Most practices buy an EHR, an AI scribe, and an RCM tool separately. Here's what that
              actually costs.
            </Paragraph>
          </div>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Card
                style={{
                  borderRadius: 16,
                  border: '1px solid #ffa39e',
                  height: '100%',
                }}
                bodyStyle={{ padding: 32 }}
              >
                <Title level={4} style={{ color: '#ff4d4f', marginBottom: 20 }}>
                  Typical Fragmented Stack
                </Title>
                <div style={{ marginBottom: 8 }}>
                  <Text>eClinicalWorks (EMR)</Text>
                  <Text strong style={{ float: 'right' }}>$499/mo</Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 8 }}>
                  <Text>DAX Copilot (AI scribe)</Text>
                  <Text strong style={{ float: 'right' }}>$400/mo</Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 8 }}>
                  <Text>Waystar (RCM)</Text>
                  <Text strong style={{ float: 'right' }}>$200/mo</Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">3 separate vendors, 3 contracts, 3 logins</Text>
                </div>
                <Divider style={{ margin: '16px 0' }} />
                <div>
                  <Text strong style={{ fontSize: 18 }}>Total: $1,099/provider/mo</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                style={{
                  borderRadius: 16,
                  border: '2px solid #0D7C8A',
                  height: '100%',
                  boxShadow: '0 12px 32px rgba(13,124,138,0.15)',
                }}
                bodyStyle={{ padding: 32 }}
              >
                <Title level={4} style={{ color: '#0D7C8A', marginBottom: 20 }}>
                  Neuraline Professional
                </Title>
                <div style={{ marginBottom: 8 }}>
                  <Text>EMR + RCM + AI Scribe + Coding + Portal</Text>
                  <Text strong style={{ float: 'right' }}>$249/mo</Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 8 }}>
                  <Text>1 vendor, 1 contract, 1 login</Text>
                </div>
                <Divider style={{ margin: '16px 0' }} />
                <div>
                  <Text strong style={{ fontSize: 18, color: '#0D7C8A' }}>
                    Total: $249/provider/mo
                  </Text>
                </div>
                <Divider style={{ margin: '16px 0' }} />
                <div
                  style={{
                    background: '#52c41a15',
                    padding: '12px 16px',
                    borderRadius: 8,
                    textAlign: 'center',
                  }}
                >
                  <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                    Save $850/provider/mo (77%)
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </div>

      {/* ─── Feature Comparison Table ──────────────────────────────────── */}
      <div style={{ padding: '80px 48px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <Text
              style={{
                color: '#0D7C8A',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              Feature Comparison
            </Text>
            <Title level={2} style={{ margin: '12px 0 8px' }}>
              Compare All Plans
            </Title>
          </div>

          <Table
            dataSource={featureMatrix}
            pagination={false}
            size="middle"
            columns={[
              {
                title: 'Feature',
                dataIndex: 'label',
                key: 'label',
                render: (text: string) => <Text strong>{text}</Text>,
              },
              {
                title: 'Solo',
                dataIndex: 'solo',
                key: 'solo',
                align: 'center' as const,
                render: renderBool,
              },
              {
                title: 'Professional',
                dataIndex: 'professional',
                key: 'professional',
                align: 'center' as const,
                render: renderBool,
              },
              {
                title: 'Enterprise',
                dataIndex: 'enterprise',
                key: 'enterprise',
                align: 'center' as const,
                render: renderBool,
              },
            ]}
            style={{ background: '#fff', borderRadius: 12 }}
          />
        </div>
      </div>

      {/* ─── Competitor Comparison ─────────────────────────────────────── */}
      <div style={{ padding: '0 48px 80px', background: '#f5f7fa' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <Text
              style={{
                color: '#0D7C8A',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              Competitor Landscape
            </Text>
            <Title level={2} style={{ margin: '12px 0 8px' }}>
              How Neuraline Compares
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
              The only platform that bundles EMR + full RCM + AI scribe + coding + patient portal in
              a single subscription.
            </Paragraph>
          </div>

          <Table
            dataSource={competitorData}
            columns={competitorColumns}
            pagination={false}
            size="middle"
            scroll={{ x: 900 }}
            rowClassName={(record) => (record.key === '1' ? 'neuraline-highlight-row' : '')}
            style={{ background: '#fff', borderRadius: 12 }}
          />
          <style>{`
            .neuraline-highlight-row td {
              background: #0D7C8A08 !important;
            }
          `}</style>
        </div>
      </div>

      {/* ─── FAQ Section ───────────────────────────────────────────────── */}
      <div style={{ padding: '80px 48px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Text
              style={{
                color: '#0D7C8A',
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              <QuestionCircleOutlined style={{ marginRight: 6 }} />
              FAQ
            </Text>
            <Title level={2} style={{ margin: '12px 0 8px' }}>
              Frequently Asked Questions
            </Title>
          </div>

          {faqs.map((faq, idx) => (
            <Card
              key={idx}
              size="small"
              style={{
                marginBottom: 12,
                borderRadius: 12,
                border: '1px solid #f0f0f0',
              }}
            >
              <Title level={5} style={{ marginBottom: 8, color: '#0D7C8A' }}>
                {faq.q}
              </Title>
              <Paragraph style={{ margin: 0, color: '#475569' }}>{faq.a}</Paragraph>
            </Card>
          ))}
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
          <Title level={2} style={{ color: '#fff', marginBottom: 16 }}>
            Ready to Get Started?
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, marginBottom: 32 }}>
            Start your 14-day free trial today. No credit card required.
          </Paragraph>
          <Space size={16}>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/register')}
              style={{
                height: 52,
                borderRadius: 10,
                fontWeight: 700,
                background: '#fff',
                color: '#0D7C8A',
                border: 'none',
                padding: '0 32px',
              }}
            >
              Start Free Trial <ArrowRightOutlined style={{ marginLeft: 8 }} />
            </Button>
            <Button
              size="large"
              onClick={() => navigate('/')}
              style={{
                height: 52,
                borderRadius: 10,
                fontWeight: 600,
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '0 32px',
              }}
            >
              Talk to Sales
            </Button>
          </Space>
          <div style={{ marginTop: 32 }}>
            <Space>
              <SafetyCertificateOutlined style={{ color: 'rgba(255,255,255,0.6)' }} />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                HIPAA Compliant · SOC 2 Ready · BAA Available
              </Text>
            </Space>
          </div>
        </div>
      </div>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <div style={{ background: '#001529', padding: '40px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <Space size={24}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              © 2026 Neuraline Health. All rights reserved.
            </Text>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
