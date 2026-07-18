import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Steps,
  Select,
  Typography,
  Row,
  Col,
  message,
  Divider,
} from "antd";
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
  SafetyOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  CloseCircleOutlined,
  CrownOutlined as CrownFilled,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import subscriptionService from "../../services/subscriptionService";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const RegisterPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("professional");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [orgForm] = Form.useForm();
  const [userForm] = Form.useForm();
  const navigate = useNavigate();

  // Keep snapshots of form values so they survive unmount between steps
  const [orgValues, setOrgValues] = useState<Record<string, any>>({});
  const [userValues, setUserValues] = useState<Record<string, any>>({});

  // Restore form values when navigating back to a step
  useEffect(() => {
    if (currentStep === 0 && Object.keys(orgValues).length > 0) {
      orgForm.setFieldsValue(orgValues);
    } else if (currentStep === 1 && Object.keys(userValues).length > 0) {
      userForm.setFieldsValue(userValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const steps = [
    { title: "Organization", icon: <BankOutlined /> },
    { title: "Admin Account", icon: <UserOutlined /> },
    { title: "Choose Plan", icon: <CrownOutlined /> },
  ];

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        const values = await orgForm.validateFields();
        setOrgValues(values);
      } else if (currentStep === 1) {
        const values = await userForm.validateFields();
        setUserValues(values);
      }
      setCurrentStep((prev) => prev + 1);
    } catch {
      // Validation failed
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      setOrgValues(orgForm.getFieldsValue());
    } else if (currentStep === 1) {
      setUserValues(userForm.getFieldsValue());
    }
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const finalOrg = { ...orgValues, ...orgForm.getFieldsValue() };
      const finalUser = { ...userValues, ...userForm.getFieldsValue() };

      const regResponse = await api.post("/auth/register", {
        email: finalUser.email,
        password: finalUser.password,
        firstName: finalUser.firstName,
        lastName: finalUser.lastName,
        tenantName: finalOrg.orgName,
        planTier: selectedPlan,
      });

      const { accessToken, tenantId, planTier } = regResponse.data;

      if (accessToken) {
        sessionStorage.setItem("neuraline_token", accessToken);
      }

      try {
        await subscriptionService.create({
          planTier,
          billingCycle,
          tenantName: finalOrg.orgName,
          tenantEmail: finalUser.email,
        });
      } catch (subErr) {
        console.error("Subscription creation failed:", subErr);
        message.warning(
          "Account created, but subscription setup failed. You can complete it from Settings.",
        );
      }

      setLoading(false);
      message.success(
        "Registration successful! Your 14-day trial has started.",
      );
      navigate("/login");
    } catch (err: any) {
      setLoading(false);
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Registration failed. Please try again.";
      message.error(errorMsg);
    }
  };

  const plans = [
    {
      key: "solo",
      name: "Solo",
      priceMonthly: 99,
      priceAnnual: 84,
      description: "For solo practitioners & cash-pay practices",
      maxProviders: "1 provider",
      maxLocations: "1 location",
      features: [
        { label: "Unlimited patients", included: true },
        { label: "Scheduling & e-prescriptions", included: true },
        { label: "Lab orders & results", included: true },
        { label: "Patient portal", included: true },
        { label: "RCM (claims, denials, appeals)", included: false },
        { label: "AI scribe & code suggestions", included: false },
        { label: "Workflow automation", included: false },
        { label: "AI credits / month", included: true, value: "0" },
      ],
      color: "#69C0FF",
    },
    {
      key: "professional",
      name: "Professional",
      priceMonthly: 249,
      priceAnnual: 212,
      description: "For growing clinics (2–10 providers)",
      maxProviders: "Up to 25 providers",
      maxLocations: "5 locations",
      features: [
        { label: "Unlimited patients", included: true },
        { label: "Scheduling & e-prescriptions", included: true },
        { label: "Lab orders & results", included: true },
        { label: "Patient portal", included: true },
        { label: "Full RCM (claims, denials, appeals)", included: true },
        { label: "AI scribe & code suggestions", included: true },
        { label: "Workflow automation", included: false },
        { label: "AI credits / month", included: true, value: "500" },
      ],
      color: "#0D7C8A",
      popular: true,
    },
    {
      key: "enterprise",
      name: "Enterprise",
      priceMonthly: 499,
      priceAnnual: 424,
      description: "For multi-site practices & health systems",
      maxProviders: "Unlimited providers",
      maxLocations: "Unlimited locations",
      features: [
        { label: "Unlimited patients", included: true },
        { label: "Scheduling & e-prescriptions", included: true },
        { label: "Lab orders & results", included: true },
        { label: "Patient portal", included: true },
        { label: "Full RCM + automation engine", included: true },
        { label: "AI scribe, coding & lab triage", included: true },
        { label: "Workflow automation", included: true },
        { label: "AI credits / month", included: true, value: "5,000" },
      ],
      color: "#B37FEB",
    },
  ];

  // ─── Form step renderers ──────────────────────────────────────────

  const renderOrgStep = () => (
    <Form
      form={orgForm}
      layout="vertical"
      size="large"
      preserve
      className="register-form"
    >
      <Title level={3} className="register-step-title">
        Organization Details
      </Title>
      <Paragraph className="register-step-subtitle">
        Tell us about your healthcare organization
      </Paragraph>

      <Form.Item
        name="orgName"
        label="Organization Name"
        rules={[{ required: true, message: "Please enter organization name" }]}
      >
        <Input
          prefix={<BankOutlined style={{ color: "#0D7C8A" }} />}
          placeholder="e.g., Sunrise Medical Center"
        />
      </Form.Item>

      <Form.Item
        name="orgType"
        label="Organization Type"
        rules={[{ required: true, message: "Please select organization type" }]}
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
        rules={[{ required: true, message: "Please enter address" }]}
      >
        <Input
          prefix={<EnvironmentOutlined style={{ color: "#0D7C8A" }} />}
          placeholder="123 Medical Center Dr, City, State, ZIP"
        />
      </Form.Item>

      <Form.Item
        name="phone"
        label="Phone Number"
        rules={[{ required: true, message: "Please enter phone number" }]}
      >
        <Input
          prefix={<PhoneOutlined style={{ color: "#0D7C8A" }} />}
          placeholder="+1 (555) 123-4567"
        />
      </Form.Item>
    </Form>
  );

  const renderUserStep = () => (
    <Form
      form={userForm}
      layout="vertical"
      size="large"
      preserve
      className="register-form"
    >
      <Title level={3} className="register-step-title">
        Administrator Account
      </Title>
      <Paragraph className="register-step-subtitle">
        Set up the primary admin account for your organization
      </Paragraph>

      <Row gutter={20}>
        <Col span={12}>
          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#0D7C8A" }} />}
              placeholder="First name"
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="lastName"
            label="Last Name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="Last name" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="email"
        label="Email Address"
        rules={[
          { required: true, message: "Please enter email" },
          { type: "email", message: "Please enter a valid email" },
        ]}
      >
        <Input
          prefix={<MailOutlined style={{ color: "#0D7C8A" }} />}
          placeholder="admin@yourorg.com"
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="Password"
        rules={[
          { required: true, message: "Please enter password" },
          { min: 8, message: "Password must be at least 8 characters" },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined style={{ color: "#0D7C8A" }} />}
          placeholder="Create a strong password"
        />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="Confirm Password"
        dependencies={["password"]}
        rules={[
          { required: true, message: "Please confirm password" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("Passwords do not match"));
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined style={{ color: "#0D7C8A" }} />}
          placeholder="Confirm your password"
        />
      </Form.Item>
    </Form>
  );

  const renderPlanStep = () => {
    const annualSavings = Math.round(
      (1 - plans[0].priceAnnual / plans[0].priceMonthly) * 100,
    );

    return (
      <div className="register-plan-container">
        <div className="register-plan-header">
          <Title level={3} className="register-step-title">
            Choose Your Plan
          </Title>
          <Paragraph className="register-step-subtitle">
            Select the plan that best fits your organization's needs. All plans
            include a 14-day free trial.
          </Paragraph>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="register-billing-toggle-wrapper">
          <div className="register-billing-toggle">
            <button
              type="button"
              className={`register-billing-btn ${billingCycle === "monthly" ? "active" : ""}`}
              onClick={() => setBillingCycle("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`register-billing-btn ${billingCycle === "annual" ? "active" : ""}`}
              onClick={() => setBillingCycle("annual")}
            >
              Annual
              <span className="register-billing-save-badge">
                Save {annualSavings}%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <Row gutter={[20, 20]} justify="center" className="register-plan-row">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.key;
            const price =
              billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
            return (
              <Col xs={24} sm={12} lg={8} key={plan.key}>
                <div
                  className={`register-plan-card ${isSelected ? "selected" : ""} ${plan.popular ? "popular" : ""}`}
                  style={{
                    borderColor: isSelected ? plan.color : undefined,
                    boxShadow: isSelected
                      ? `0 12px 36px ${plan.color}22`
                      : undefined,
                  }}
                  onClick={() => setSelectedPlan(plan.key)}
                >
                  {plan.popular && (
                    <div
                      className="register-plan-badge"
                      style={{ background: plan.color }}
                    >
                      <CrownFilled /> Most Popular
                    </div>
                  )}

                  {/* Selection indicator */}
                  <div
                    className="register-plan-radio"
                    style={{
                      borderColor: isSelected ? plan.color : "#cbd5e1",
                      background: isSelected ? plan.color : "transparent",
                    }}
                  >
                    {isSelected && (
                      <CheckCircleOutlined
                        style={{ color: "#fff", fontSize: 16 }}
                      />
                    )}
                  </div>

                  {/* Plan name & description */}
                  <div className="register-plan-info">
                    <Text strong className="register-plan-name">
                      {plan.name}
                    </Text>
                    <Text className="register-plan-description">
                      {plan.description}
                    </Text>
                  </div>

                  {/* Price */}
                  <div className="register-plan-price-section">
                    <div className="register-plan-price-row">
                      <span
                        className="register-plan-price"
                        style={{ color: plan.color }}
                      >
                        ${price}
                      </span>
                      <span className="register-plan-period">/mo</span>
                    </div>
                    {billingCycle === "annual" && (
                      <Text className="register-plan-billed-annually">
                        Billed annually (${price * 12}/yr)
                      </Text>
                    )}
                  </div>

                  {/* Provider/location summary */}
                  <div className="register-plan-summary">
                    <div className="register-plan-summary-item">
                      <TeamOutlined style={{ color: plan.color }} />
                      <span>{plan.maxProviders}</span>
                    </div>
                    <div className="register-plan-summary-item">
                      <EnvironmentOutlined style={{ color: plan.color }} />
                      <span>{plan.maxLocations}</span>
                    </div>
                  </div>

                  <Divider className="register-plan-divider" />

                  {/* Feature list */}
                  <div className="register-plan-features">
                    {plan.features.map((feature, idx) => (
                      <div
                        key={idx}
                        className={`register-plan-feature ${!feature.included ? "excluded" : ""}`}
                      >
                        {feature.included ? (
                          <CheckCircleOutlined
                            style={{ color: plan.color, fontSize: 15 }}
                          />
                        ) : (
                          <CloseCircleOutlined
                            style={{ color: "#cbd5e1", fontSize: 15 }}
                          />
                        )}
                        <span>
                          {feature.label}
                          {feature.included && feature.value && (
                            <strong className="register-plan-feature-value">
                              {" "}
                              {feature.value}
                            </strong>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Select CTA */}
                  <div
                    className="register-plan-cta"
                    style={{
                      background: isSelected ? plan.color : "transparent",
                      color: isSelected ? "#fff" : plan.color,
                      borderColor: isSelected ? plan.color : `${plan.color}40`,
                    }}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircleOutlined /> Selected
                      </>
                    ) : (
                      "Select this plan"
                    )}
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>

        {/* Trial note */}
        <div className="register-plan-trial-note">
          <SafetyOutlined /> No credit card required · Cancel anytime · 14-day
          free trial on all plans
        </div>
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────

  return (
    <div className="register-page">
      {/* Left Panel — Branding (40%) */}
      <div className="register-left-panel">
        {/* Decorative circles */}
        <div className="register-deco-circle register-deco-circle-1" />
        <div className="register-deco-circle register-deco-circle-2" />
        <div className="register-deco-circle register-deco-circle-3" />

        <div className="register-left-content">
          <div className="register-brand">
            <MedicineBoxOutlined className="register-brand-icon" />
            <span className="register-brand-name">Neuraline</span>
          </div>

          <Title level={2} className="register-left-headline">
            Transform your practice with intelligent healthcare
          </Title>

          <Text className="register-left-tagline">
            Join hundreds of clinics using Neuraline's AI-powered EHR platform
          </Text>

          <div className="register-features-list">
            {[
              {
                icon: <ThunderboltOutlined />,
                text: "AI-Powered Clinical Decision Support",
              },
              { icon: <SafetyOutlined />, text: "HIPAA Compliant & Secure" },
              {
                icon: <TeamOutlined />,
                text: "Real-time Care Team Collaboration",
              },
              {
                icon: <CheckCircleOutlined />,
                text: "14-Day Free Trial — No Credit Card Required",
              },
            ].map((feature, index) => (
              <div key={index} className="register-feature-item">
                <span className="register-feature-icon">{feature.icon}</span>
                <span className="register-feature-text">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="register-left-footer">
          &copy; {new Date().getFullYear()} Neuraline Health Technologies
        </div>
      </div>

      {/* Right Panel — Form Area (60%) */}
      <div className="register-right-panel">
        <div className="register-form-wrapper">
          {/* Mobile logo (hidden on desktop) */}
          <div className="register-mobile-logo">
            <MedicineBoxOutlined className="register-brand-icon" />
            <span className="register-brand-name">Neuraline</span>
          </div>

          {/* Steps Indicator */}
          <Steps
            current={currentStep}
            items={steps.map((s) => ({
              title: s.title,
              icon: s.icon,
            }))}
            className="register-steps"
          />

          {/* Step Content */}
          <div className="register-step-content">
            {currentStep === 0 && renderOrgStep()}
            {currentStep === 1 && renderUserStep()}
            {currentStep === 2 && renderPlanStep()}
          </div>

          {/* Navigation Buttons */}
          <div className="register-nav-buttons">
            {currentStep > 0 ? (
              <Button
                size="large"
                icon={<ArrowLeftOutlined />}
                onClick={handleBack}
                className="register-back-btn"
              >
                Back
              </Button>
            ) : (
              <span />
            )}

            {currentStep < steps.length - 1 ? (
              <Button
                type="primary"
                size="large"
                onClick={handleNext}
                className="register-next-btn"
              >
                Continue <ArrowRightOutlined />
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleSubmit}
                className="register-submit-btn"
              >
                Create Account & Start Trial
              </Button>
            )}
          </div>

          <Divider className="register-divider" />

          <div className="register-login-link">
            <Text>
              Already have an account?{" "}
              <Link to="/login" className="register-signin-link">
                Sign in
              </Link>
            </Text>
          </div>
        </div>
      </div>

      {/* Scoped styles for the registration page */}
      <style>{`
        /* ─── Layout: 40/60 split-screen ─── */
        .register-page {
          display: flex;
          min-height: 100vh;
          background: #f8fafb;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ─── Left Branding Panel (40%) ─── */
        .register-left-panel {
          flex: 0 0 40%;
          background: linear-gradient(150deg, #0D7C8A 0%, #064E57 60%, #032D33 100%);
          display: flex;
          flex-direction: row;
          justify-content: center;
          padding: 120px 56px;
          position: relative;
          overflow: hidden;
        }

        .register-deco-circle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .register-deco-circle-1 {
          top: -100px; right: -100px;
          width: 360px; height: 360px;
          background: rgba(255,255,255,0.05);
        }
        .register-deco-circle-2 {
          bottom: -80px; left: -80px;
          width: 280px; height: 280px;
          background: rgba(255,255,255,0.03);
        }
        .register-deco-circle-3 {
          top: 45%; left: 15%;
          width: 180px; height: 180px;
          background: rgba(255,255,255,0.02);
        }

        .register-left-content {
          position: relative;
          z-index: 1;
          max-width: 420px;
        }

        .register-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 48px;
        }
        .register-brand-icon {
          font-size: 32px;
          color: #36CFC9;
        }
        .register-brand-name {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.5px;
        }

        .register-left-headline {
          color: #fff !important;
          font-weight: 700 !important;
          font-size: 30px !important;
          line-height: 1.3 !important;
          margin-bottom: 16px !important;
        }

        .register-left-tagline {
          color: rgba(255,255,255,0.7) !important;
          font-size: 15px;
          line-height: 1.6;
          display: block;
          margin-bottom: 48px;
        }

        .register-features-list {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .register-feature-item {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .register-feature-icon {
          font-size: 18px;
          color: #36CFC9;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .register-feature-text {
          color: rgba(255,255,255,0.8);
          font-size: 14px;
          font-weight: 400;
        }

        .register-left-footer {
          position: absolute;
          bottom: 32px;
          left: 56px;
          color: rgba(255,255,255,0.35);
          font-size: 12px;
          z-index: 1;
        }

        /* ─── Right Form Panel (60%) ─── */
        .register-right-panel {
          flex: 0 0 60%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          overflow-y: auto;
          background: #f8fafb;
        }

        .register-form-wrapper {
          width: 100%;
          background: #ffffff;
          border-radius: 20px;
          padding: 48px 48px 40px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          border: 1px solid #eef1f4;
        }

        .register-mobile-logo {
          display: none;
          align-items: center;
          gap: 10px;
          justify-content: center;
          margin-bottom: 24px;
        }

        /* ─── Steps ─── */
        .register-steps {
          margin-bottom: 40px !important;
          // max-width: 480px;
          margin: 0 auto 40px !important;
        }

        /* ─── Step Content ─── */
        .register-step-content {
          min-height: 320px;
        }

        .register-step-title {
          font-size: 24px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          margin-bottom: 6px !important;
        }
        .register-step-subtitle {
          color: #64748b !important;
          font-size: 14px !important;
          margin-bottom: 32px !important;
        }

        /* ─── Form Inputs ─── */
        .register-form .ant-form-item {
          margin-bottom: 24px;
        }
        .register-form .ant-form-item-label > label {
          color: #475569;
          font-weight: 500;
          font-size: 13px;
        }
        .register-form .ant-input-affix-wrapper,
        .register-form .ant-input,
        .register-form .ant-select .ant-select-selector {
          border-radius: 10px !important;
          padding: 8px 14px;
          border: 1.5px solid #e2e8f0 !important;
          transition: all 0.2s ease;
          background: #fff;
        }
        .register-form .ant-input-affix-wrapper:hover,
        .register-form .ant-input:hover,
        .register-form .ant-select:hover .ant-select-selector {
          border-color: #0D7C8A !important;
        }
        .register-form .ant-input-affix-wrapper-focused,
        .register-form .ant-input-affix-wrapper:focus-within,
        .register-form .ant-input:focus,
        .register-form .ant-select-focused .ant-select-selector {
          border-color: #0D7C8A !important;
          box-shadow: 0 0 0 3px rgba(13, 124, 138, 0.12) !important;
        }
        .register-form .ant-input-affix-wrapper .ant-input {
          border: none !important;
          padding: 0;
          box-shadow: none !important;
        }

        /* ─── Plan Selection ─── */
        .register-plan-container {
          max-width: 100%;
        }
        .register-plan-header {
          text-align: center;
          margin-bottom: 24px;
        }

        /* ─── Billing Cycle Toggle ─── */
        .register-billing-toggle-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 32px;
        }
        .register-billing-toggle {
          display: inline-flex;
          background: #f1f5f9;
          border-radius: 12px;
          padding: 4px;
          gap: 4px;
        }
        .register-billing-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border: none !important;
          border-radius: 9px !important;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          color: #64748b;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .register-billing-btn.active {
          background: #fff;
          color: #0D7C8A;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .register-billing-btn:not(.active):hover {
          color: #475569;
        }
        .register-billing-save-badge {
          background: #0D7C8A;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
          letter-spacing: 0.3px;
        }

        /* ─── Plan Cards ─── */
        .register-plan-row {
          margin-top: 8px;
        }

        .register-plan-card {
          background: #fff;
          border: 2px solid #e8ecf0;
          border-radius: 16px;
          padding: 28px 22px 20px;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .register-plan-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          transform: translateY(-3px);
        }
        .register-plan-card.popular {
          border-color: #0D7C8A30;
        }
        .register-plan-card.selected {
          border-width: 2px;
        }

        /* "Most Popular" badge */
        .register-plan-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          color: #fff;
          padding: 5px 18px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        /* Radio-style selection indicator */
        .register-plan-radio {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        /* Plan name & description */
        .register-plan-info {
          margin-bottom: 16px;
          padding-right: 32px;
        }
        .register-plan-name {
          font-size: 20px;
          display: block;
          margin-bottom: 4px;
          color: #0f172a;
        }
        .register-plan-description {
          font-size: 13px;
          color: #94a3b8;
          display: block;
        }

        /* Price section */
        .register-plan-price-section {
          margin-bottom: 16px;
        }
        .register-plan-price-row {
          display: flex;
          align-items: baseline;
          gap: 2px;
          margin-bottom: 4px;
        }
        .register-plan-price {
          font-size: 38px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -1px;
        }
        .register-plan-period {
          font-size: 15px;
          color: #94a3b8;
          font-weight: 500;
        }
        .register-plan-billed-annually {
          font-size: 12px;
          color: #94a3b8;
        }

        /* Provider/location summary */
        .register-plan-summary {
          display: flex;
          gap: 16px;
          margin-bottom: 4px;
        }
        .register-plan-summary-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: #64748b;
          font-weight: 500;
        }

        .register-plan-divider {
          margin: 14px 0 !important;
          border-color: #eef1f4 !important;
        }

        /* Feature list */
        .register-plan-features {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          margin-bottom: 20px;
        }
        .register-plan-feature {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          color: #475569;
          line-height: 1.4;
        }
        .register-plan-feature.excluded {
          color: #cbd5e1;
        }
        .register-plan-feature.excluded span {
          text-decoration: none;
        }
        .register-plan-feature-value {
          font-weight: 700;
          color: #0f172a;
        }

        /* CTA button at bottom of card */
        .register-plan-cta {
          text-align: center;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          border: 1.5px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s ease;
          margin-top: auto;
        }

        /* Trial note below cards */
        .register-plan-trial-note {
          text-align: center;
          margin-top: 28px;
          font-size: 13px;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .register-plan-trial-note .anticon {
          color: #0D7C8A;
        }

        /* ─── Navigation Buttons ─── */
        .register-nav-buttons {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 32px;
          gap: 16px;
        }

        .register-back-btn {
          border-radius: 10px !important;
          font-weight: 500;
          padding: 0 24px;
          border: 1.5px solid #e2e8f0 !important;
          color: #475569 !important;
        }
        .register-back-btn:hover {
          border-color: #0D7C8A !important;
          color: #0D7C8A !important;
          background: #f0fbfc !important;
        }

        .register-next-btn,
        .register-submit-btn {
          border-radius: 10px !important;
          font-weight: 600;
          min-width: 180px;
          height: 46px;
          background: #0D7C8A !important;
          border: none !important;
          font-size: 15px;
          transition: all 0.2s ease !important;
        }
        .register-next-btn:hover,
        .register-submit-btn:hover {
          background: #0a6772 !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(13,124,138,0.25) !important;
        }

        /* ─── Divider & Login Link ─── */
        .register-divider {
          margin: 28px 0 20px !important;
          border-color: #eef1f4 !important;
        }

        .register-login-link {
          text-align: center;
        }
        .register-login-link .ant-typography {
          color: #64748b;
          font-size: 14px;
        }
        .register-signin-link {
          color: #0D7C8A !important;
          font-weight: 600;
        }
        .register-signin-link:hover {
          text-decoration: underline;
        }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .register-left-panel {
            display: none;
          }
          .register-right-panel {
            flex: 1 1 100%;
            padding: 24px 16px;
          }
          .register-form-wrapper {
            padding: 32px 24px;
            border-radius: 16px;
          }
          .register-mobile-logo {
            display: flex;
          }
          .register-mobile-logo .register-brand-name {
            color: #0D7C8A;
          }
          .register-mobile-logo .register-brand-icon {
            color: #0D7C8A;
          }
        }

        @media (max-width: 480px) {
          .register-form-wrapper {
            padding: 24px 20px;
            box-shadow: none;
            border: none;
            background: transparent;
          }
          .register-next-btn,
          .register-submit-btn {
            min-width: 140px;
            width: 100%;
          }
          .register-back-btn {
            width: 100%;
          }
          .register-nav-buttons {
            flex-direction: column-reverse;
          }
        }
      `}</style>
    </div>
  );
};

export default RegisterPage;
