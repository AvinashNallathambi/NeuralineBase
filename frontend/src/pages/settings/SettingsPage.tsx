import React, { useState, useEffect, useCallback } from "react";
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  Tabs,
  Form,
  Input,
  Switch,
  Upload,
  Avatar,
  Table,
  Tag,
  Space,
  Descriptions,
  List,
  Badge,
  Divider,
  TimePicker,
  Modal,
  Select,
  Alert,
  message,
  Spin,
  Radio,
  Empty,
  Statistic,
  Tooltip,
} from "antd";
import {
  SettingOutlined,
  UserOutlined,
  BankOutlined,
  TeamOutlined,
  SafetyOutlined,
  BellOutlined,
  DollarOutlined,
  ApiOutlined,
  AuditOutlined,
  CloudServerOutlined,
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExportOutlined,
  DatabaseOutlined,
  ToolOutlined,
  MailOutlined,
  MobileOutlined,
  NotificationOutlined,
  CrownOutlined,
  LockOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ArrowUpOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { mockUsers, mockAuditLog } from "../../data/mockData";
import type { User } from "../../types";
import { useIntegrations } from "../../hooks/useIntegrations";
import {
  integrationService,
  type Integration,
} from "../../services/integrationService";
import subscriptionService, {
  type SubscriptionPlan,
  type SubscriptionWithPlan,
  type SubscriptionInvoice,
  type PaymentMethod,
  type CardExpiryCheck,
  type FeeEstimate,
  type PaymentOptimizationSuggestion,
} from "../../services/subscriptionService";
import UpdatePaymentMethodModal from "./UpdatePaymentMethodModal";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const IntegrationCard: React.FC<{ integration: Integration }> = ({
  integration,
}) => {
  const [enabled, setEnabled] = useState(integration.enabled);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      await integrationService.update(integration.key, { enabled: checked });
      setEnabled(checked);
      message.success(
        `${integration.name} ${checked ? "enabled" : "disabled"}`,
      );
    } catch (err: any) {
      message.error(
        err?.response?.data?.message || "Failed to update integration",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Row align="middle" gutter={16}>
        <Col>
          <div style={{ fontSize: 36 }}>{integration.icon || "🔌"}</div>
        </Col>
        <Col flex={1}>
          <Text strong style={{ fontSize: 16 }}>
            {integration.name}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {integration.description}
          </Text>
          <br />
          <Tag color="blue" style={{ marginTop: 4 }}>
            {integration.provider || "Internal"}
          </Tag>
        </Col>
        <Col>
          <Switch
            checked={enabled}
            onChange={handleToggle}
            loading={saving}
            disabled={saving}
          />
        </Col>
      </Row>
    </Card>
  );
};

const IntegrationsTabContent: React.FC = () => {
  const { integrations, loading, error } = useIntegrations();

  if (loading) {
    return <Card loading bordered={false} style={{ borderRadius: 12 }} />;
  }

  if (error) {
    return (
      <Alert
        message="Could not load integrations"
        description={error.message}
        type="error"
        showIcon
      />
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {integrations.map((integration) => (
        <Col xs={24} md={12} key={integration.key}>
          <IntegrationCard integration={integration} />
        </Col>
      ))}
    </Row>
  );
};

// ─── Billing & Subscription Tab Content ─────────────────────────────────────────
const SUB_STATUS_COLORS: Record<string, string> = {
  trialing: "processing",
  active: "success",
  past_due: "warning",
  cancelled: "error",
  expired: "default",
  paused: "default",
};

const SUB_STATUS_LABELS: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past Due",
  cancelled: "Cancelled",
  expired: "Expired",
  paused: "Paused",
};

const PLAN_COLORS: Record<string, string> = {
  solo: "#69C0FF",
  professional: "#0D7C8A",
  enterprise: "#B37FEB",
};

const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getCardBrandIcon = (brand: string | null): string => {
  switch (brand?.toLowerCase()) {
    case "visa":
      return "💳";
    case "mastercard":
      return "💳";
    case "amex":
    case "american express":
      return "💳";
    case "discover":
      return "💳";
    case "jcb":
      return "💳";
    case "diners":
    case "diners club":
      return "💳";
    case "unionpay":
      return "💳";
    default:
      return "💳";
  }
};

const BillingSettingsTabContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentSub, setCurrentSub] = useState<SubscriptionWithPlan | null>(
    null,
  );
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cardExpiry, setCardExpiry] = useState<CardExpiryCheck | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<
    PaymentOptimizationSuggestion[]
  >([]);
  const [changePlanModal, setChangePlanModal] = useState(false);
  const [updatePmModal, setUpdatePmModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [changing, setChanging] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pmLoading, setPmLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, invoicesData] = await Promise.all([
        subscriptionService.getPlans(),
        subscriptionService.getInvoices().catch(() => []),
      ]);
      setPlans(plansData);
      setInvoices(invoicesData);

      try {
        const subData = await subscriptionService.getCurrent();
        setCurrentSub(subData);
        setSelectedPlan(subData.subscription.planTier);
        setBillingCycle(subData.subscription.billingCycle);

        // Load payment methods and card expiry if subscription exists
        try {
          const [pmData, expiryData, feeData, optData] = await Promise.all([
            subscriptionService.getPaymentMethods().catch(() => []),
            subscriptionService.checkCardExpiry().catch(() => null),
            subscriptionService.getFeeEstimate().catch(() => null),
            subscriptionService
              .getPaymentOptimization()
              .catch(() => ({ suggestions: [] })),
          ]);
          setPaymentMethods(pmData);
          setCardExpiry(expiryData);
          setFeeEstimate(feeData);
          setOptimizationSuggestions(optData.suggestions ?? []);
        } catch {
          // Payment methods not available yet
        }
      } catch {
        // No subscription yet — show available plans
      }
    } catch {
      message.error("Failed to load subscription data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChangePlan = async () => {
    if (!selectedPlan) return;
    setChanging(true);
    try {
      await subscriptionService.changePlan({
        planTier: selectedPlan,
        billingCycle,
      });
      message.success("Plan updated successfully!");
      setChangePlanModal(false);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to change plan");
    } finally {
      setChanging(false);
    }
  };

  const handleCancel = () => {
    Modal.confirm({
      title: "Cancel Subscription?",
      icon: <ExclamationCircleOutlined />,
      content: currentSub?.subscription.cancelAtPeriodEnd
        ? "Your subscription is already set to cancel at the end of the current billing period."
        : "You can cancel immediately or at the end of the current billing period. Your data will be preserved for 30 days.",
      okText: "Cancel at Period End",
      cancelText: "Cancel Immediately",
      okType: "default",
      cancelType: "danger",
      onOk: async () => {
        setCancelling(true);
        try {
          await subscriptionService.cancel(true);
          message.success(
            "Subscription will cancel at the end of the billing period",
          );
          loadData();
        } catch (err: any) {
          message.error(err.response?.data?.message || "Failed to cancel");
        } finally {
          setCancelling(false);
        }
      },
      onCancel: async () => {
        setCancelling(true);
        try {
          await subscriptionService.cancel(false);
          message.success("Subscription cancelled");
          loadData();
        } catch (err: any) {
          message.error(err.response?.data?.message || "Failed to cancel");
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  const handleReactivate = async () => {
    try {
      await subscriptionService.reactivate();
      message.success("Subscription reactivated!");
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to reactivate");
    }
  };

  const handlePmModalSuccess = () => {
    setUpdatePmModal(false);
    loadData();
  };

  const handleSetDefaultPm = async (pmId: string) => {
    setPmLoading(true);
    try {
      await subscriptionService.setDefaultPaymentMethod(pmId);
      message.success("Default payment method updated");
      loadData();
    } catch (err: any) {
      message.error(
        err.response?.data?.message || "Failed to set default payment method",
      );
    } finally {
      setPmLoading(false);
    }
  };

  const handleRemovePm = async (pm: PaymentMethod) => {
    Modal.confirm({
      title: "Remove Payment Method?",
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to remove the ${pm.cardBrand ?? "card"} ending in ${pm.cardLast4 ?? pm.bankLast4 ?? "****"}? This cannot be undone.`,
      okText: "Remove",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        setPmLoading(true);
        try {
          await subscriptionService.detachPaymentMethod(pm.id);
          message.success("Payment method removed");
          loadData();
        } catch (err: any) {
          message.error(
            err.response?.data?.message || "Failed to remove payment method",
          );
        } finally {
          setPmLoading(false);
        }
      },
    });
  };

  const handleRetryPayment = async () => {
    setRetrying(true);
    try {
      const result = await subscriptionService.retryFailedPayment();
      if (result.success) {
        message.success(
          "Payment retry successful! Your subscription is now active.",
        );
        loadData();
      } else {
        message.error(
          "Payment retry failed. Please update your payment method and try again.",
        );
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to retry payment");
    } finally {
      setRetrying(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    try {
      const result = await subscriptionService.createCustomerPortalSession(
        window.location.href,
      );
      window.open(result.url, "_blank");
    } catch (err: any) {
      message.error(
        err.response?.data?.message || "Failed to open billing portal",
      );
    }
  };

  const renderFeatureIcon = (included: boolean) =>
    included ? (
      <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />
    ) : (
      <CloseCircleOutlined style={{ color: "#d9d9d9", fontSize: 16 }} />
    );

  const trialDaysLeft = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return 0;
    const diff = new Date(trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}
      >
        <Spin size="large" tip="Loading subscription..." />
      </div>
    );
  }

  const sub = currentSub?.subscription;
  const plan = currentSub?.plan;

  const invoiceColumns = [
    {
      title: "Invoice #",
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Plan",
      dataIndex: "planTier",
      key: "planTier",
      render: (tier: string) => (
        <Tag color={PLAN_COLORS[tier] || "#0D7C8A"}>{tier}</Tag>
      ),
    },
    {
      title: "Period",
      key: "period",
      render: (_: unknown, record: SubscriptionInvoice) =>
        `${formatDate(record.periodStart)} — ${formatDate(record.periodEnd)}`,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (amount: number, record: SubscriptionInvoice) =>
        `$${amount.toFixed(2)} ${record.currency.toUpperCase()}`,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const colors: Record<string, string> = {
          paid: "success",
          open: "processing",
          failed: "error",
          void: "default",
          refunded: "warning",
        };
        return (
          <Tag color={colors[status] || "default"}>{status.toUpperCase()}</Tag>
        );
      },
    },
    {
      title: "Date",
      dataIndex: "paidAt",
      key: "paidAt",
      render: (paidAt: string | null, record: SubscriptionInvoice) =>
        formatDate(paidAt || record.createdAt),
    },
  ];

  return (
    <div>
      {/* ─── Current Plan Card ───────────────────────────────────── */}
      {sub && plan ? (
        <Card
          style={{
            marginBottom: 16,
            borderRadius: 12,
            border: `2px solid ${PLAN_COLORS[sub.planTier] || "#0D7C8A"}40`,
            padding: 0,
          }}
          bodyStyle={{ padding: 0 }}
        >
          {/* 1. Top Alert Banner (Full Width) */}
          {sub.status === "trialing" && sub.trialEndsAt && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#faad1415",
                padding: "14px 24px",
                borderBottom: "1px solid #faad1430",
                borderRadius: "10px 10px 0 0",
              }}
            >
              <ThunderboltOutlined style={{ fontSize: 22, color: "#faad14" }} />
              <div>
                <Text strong style={{ color: "#faad14", fontSize: 15 }}>
                  {trialDaysLeft(sub.trialEndsAt)} days left in trial
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Trial ends {formatDate(sub.trialEndsAt)}. Add a payment method
                  to continue after trial.
                </Text>
              </div>
            </div>
          )}
          {sub.cancelAtPeriodEnd && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#ff4d4f15",
                padding: "14px 24px",
                borderBottom: "1px solid #ff4d4f30",
                borderRadius: sub.status === "trialing" ? "0" : "10px 10px 0 0",
              }}
            >
              <ExclamationCircleOutlined
                style={{ fontSize: 22, color: "#ff4d4f" }}
              />
              <Text strong style={{ color: "#ff4d4f", fontSize: 15 }}>
                Cancels on {formatDate(sub.currentPeriodEnd)}
              </Text>
            </div>
          )}

          {/* 2. Main Flex Container (Two-Column Split) */}
          <div style={{ padding: 24 }}>
            <Row gutter={[24, 24]} align="top">
              {/* Left Side — Plan Identity */}
              <Col xs={24} lg={12}>
                <Space direction="vertical" size={6}>
                  <Space>
                    <Tag
                      color={PLAN_COLORS[sub.planTier] || "#0D7C8A"}
                      style={{
                        borderRadius: 6,
                        padding: "2px 12px",
                        fontSize: 14,
                      }}
                    >
                      {plan.name}
                    </Tag>
                    <Tag
                      color={SUB_STATUS_COLORS[sub.status]}
                      style={{ borderRadius: 6 }}
                    >
                      {SUB_STATUS_LABELS[sub.status] || sub.status}
                    </Tag>
                  </Space>
                  <Title level={2} style={{ margin: 0 }}>
                    {formatCurrency(sub.priceCents)}
                    <Text
                      type="secondary"
                      style={{ fontSize: 16, fontWeight: 400 }}
                    >
                      {" "}
                      /{" "}
                      {sub.billingCycle === "annual"
                        ? "mo (billed annually)"
                        : "mo"}
                    </Text>
                  </Title>
                  <Text type="secondary">{plan.description}</Text>
                </Space>
              </Col>

              {/* Right Side — Admin & Actions */}
              <Col
                xs={24}
                lg={12}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 16,
                }}
              >
                {/* Billing Cycle & Current Period — horizontal */}
                <Row gutter={32} style={{ width: "100%" }} justify="end">
                  <Col>
                    <Statistic
                      title="Billing Cycle"
                      value={
                        sub.billingCycle === "annual" ? "Annual" : "Monthly"
                      }
                      prefix={<DollarOutlined />}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Current Period"
                      value={formatDate(sub.currentPeriodEnd)}
                      prefix={<CloudServerOutlined />}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                </Row>

                {/* Action Buttons — side-by-side */}
                <Space
                  size={12}
                  style={{ width: "100%", justifyContent: "flex-end" }}
                >
                  <Button
                    type="primary"
                    icon={<ArrowUpOutlined />}
                    onClick={() => {
                      setSelectedPlan(sub.planTier);
                      setBillingCycle(sub.billingCycle);
                      setChangePlanModal(true);
                    }}
                    disabled={sub.status === "cancelled"}
                    style={{ borderRadius: 8 }}
                  >
                    Change Plan
                  </Button>
                  {sub.cancelAtPeriodEnd || sub.status === "cancelled" ? (
                    <Button
                      onClick={handleReactivate}
                      disabled={sub.status === "expired"}
                      style={{ borderRadius: 8 }}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      danger
                      onClick={handleCancel}
                      loading={cancelling}
                      style={{ borderRadius: 8 }}
                    >
                      Cancel Subscription
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>

            {/* 3. Divider */}
            <Divider style={{ margin: "20px 0" }} />

            {/* 4. Feature List (Grid Layout — 2-col mobile, 3-col desktop) */}
            <Row gutter={[24, 16]}>
              <Col xs={12} md={8}>
                <Space align="center">
                  {renderFeatureIcon(plan.includesRcm)}
                  <Text>Full RCM</Text>
                </Space>
              </Col>
              <Col xs={12} md={8}>
                <Space align="center">
                  {renderFeatureIcon(plan.includesAiScribe)}
                  <Text>AI Scribe</Text>
                </Space>
              </Col>
              <Col xs={12} md={8}>
                <Space align="center">
                  {renderFeatureIcon(plan.includesAiCoding)}
                  <Text>AI Coding</Text>
                </Space>
              </Col>
              <Col xs={12} md={8}>
                <Space align="center">
                  {renderFeatureIcon(plan.includesPatientPortal)}
                  <Text>Patient Portal</Text>
                </Space>
              </Col>
              <Col xs={12} md={8}>
                <Space align="center">
                  {renderFeatureIcon(plan.includesAutomation)}
                  <Text>RCM Automation</Text>
                </Space>
              </Col>
              <Col xs={12} md={8}>
                <Space align="center">
                  <TeamOutlined style={{ color: "#0D7C8A" }} />
                  <Text>
                    {plan.maxProviders === null
                      ? "Unlimited"
                      : plan.maxProviders}{" "}
                    providers
                  </Text>
                </Space>
              </Col>
              <Col xs={12} md={8}>
                <Space align="center">
                  <RobotOutlined style={{ color: "#0D7C8A" }} />
                  <Text>{plan.aiCreditsMonthly} AI credits/mo</Text>
                </Space>
              </Col>
              <Col xs={12} md={8}>
                <Space align="center">
                  <SafetyOutlined style={{ color: "#0D7C8A" }} />
                  <Text>HIPAA Compliant</Text>
                </Space>
              </Col>
            </Row>
          </div>
        </Card>
      ) : (
        <Card style={{ marginBottom: 16, borderRadius: 12 }}>
          <Empty
            description="No active subscription. Choose a plan below to get started."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}

      {/* ─── Payment Methods (Phase 1, 2, 3) ─────────────────────── */}
      <Card
        bordered={false}
        style={{ borderRadius: 12, marginBottom: 16 }}
        title={
          <Space>
            <Text strong>Payment Methods</Text>
            {paymentMethods.length > 0 && (
              <Tag color="blue">{paymentMethods.length} saved</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => setUpdatePmModal(true)}
              style={{ borderRadius: 8 }}
            >
              Add / Update Payment Method
            </Button>
            <Button
              type="link"
              icon={<ExportOutlined />}
              onClick={handleOpenCustomerPortal}
              style={{ padding: 0 }}
            >
              Billing Portal
            </Button>
          </Space>
        }
      >
        {/* Card Expiry Warnings (Phase 2) */}
        {cardExpiry && cardExpiry.expired.length > 0 && (
          <Alert
            type="error"
            message="Expired Card Detected"
            description={
              <Space direction="vertical" size={2}>
                {cardExpiry.expired.map((pm) => (
                  <Text key={pm.id}>
                    Your {pm.cardBrand} ending in {pm.cardLast4} has expired.
                    Please update your payment method to avoid service
                    interruption.
                  </Text>
                ))}
              </Space>
            }
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}
        {cardExpiry && cardExpiry.expiringSoon.length > 0 && (
          <Alert
            type="warning"
            message="Card Expiring Soon"
            description={
              <Space direction="vertical" size={2}>
                {cardExpiry.expiringSoon.map((pm) => (
                  <Text key={pm.id}>
                    Your {pm.cardBrand} ending in {pm.cardLast4} expires in{" "}
                    {pm.cardExpMonth}/{pm.cardExpYear}. Consider updating it
                    soon.
                  </Text>
                ))}
              </Space>
            }
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        {/* Past Due Retry Banner (Phase 2) */}
        {sub?.status === "past_due" && (
          <Alert
            type="error"
            message="Payment Action Required"
            description="Your last payment failed. Update your payment method and retry the charge to avoid account suspension."
            style={{ marginBottom: 16 }}
            showIcon
            action={
              <Button
                type="primary"
                danger
                size="small"
                onClick={handleRetryPayment}
                loading={retrying}
              >
                Retry Payment
              </Button>
            }
          />
        )}

        {/* Payment Methods List */}
        {paymentMethods.length === 0 ? (
          <Empty
            description="No payment method on file. Add a payment method to continue your subscription after the trial."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: "24px 0" }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUpdatePmModal(true)}
              style={{ borderRadius: 8 }}
            >
              Add Payment Method
            </Button>
          </Empty>
        ) : (
          <Spin spinning={pmLoading}>
            <List
              dataSource={paymentMethods}
              renderItem={(pm) => (
                <List.Item
                  actions={[
                    !pm.isDefault && (
                      <Button
                        key="set-default"
                        size="small"
                        onClick={() => handleSetDefaultPm(pm.id)}
                      >
                        Set as Default
                      </Button>
                    ),
                    !pm.isDefault && (
                      <Button
                        key="remove"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemovePm(pm)}
                      >
                        Remove
                      </Button>
                    ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{ fontSize: 28, width: 40, textAlign: "center" }}
                      >
                        {pm.type === "card"
                          ? getCardBrandIcon(pm.cardBrand)
                          : "🏦"}
                      </div>
                    }
                    title={
                      <Space>
                        <Text strong>
                          {pm.type === "card"
                            ? `${(pm.cardBrand ?? "Card").toUpperCase()} •••• ${pm.cardLast4 ?? "****"}`
                            : `${pm.bankName ?? "Bank"} •••• ${pm.bankLast4 ?? "****"}`}
                        </Text>
                        {pm.isDefault && <Tag color="green">Default</Tag>}
                        {pm.isHsaFsa && <Tag color="blue">HSA/FSA</Tag>}
                        {pm.cardFunding === "prepaid" && !pm.isHsaFsa && (
                          <Tag color="orange">Prepaid</Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        {pm.type === "card" &&
                          pm.cardExpMonth &&
                          pm.cardExpYear && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Expires{" "}
                              {pm.cardExpMonth.toString().padStart(2, "0")}/
                              {pm.cardExpYear}
                            </Text>
                          )}
                        {pm.type === "us_bank_account" && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {pm.bankAccountType ?? "Checking"} account • ACH
                          </Text>
                        )}
                        {pm.billingAddress && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {pm.billingName && `${pm.billingName}, `}
                            {pm.billingAddress.line1}
                            {pm.billingAddress.city &&
                              `, ${pm.billingAddress.city}`}
                            {pm.billingAddress.state &&
                              `, ${pm.billingAddress.state}`}
                            {pm.billingAddress.postalCode &&
                              ` ${pm.billingAddress.postalCode}`}
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Spin>
        )}
      </Card>

      {/* ─── AI Payment Optimization Suggestions (Phase 4) ─────────── */}
      {optimizationSuggestions.length > 0 && (
        <Card
          bordered={false}
          style={{ borderRadius: 12, marginBottom: 16 }}
          title={
            <Space>
              <RobotOutlined style={{ color: "#0D7C8A" }} />
              <Text strong>Payment Optimization</Text>
            </Space>
          }
        >
          <List
            dataSource={optimizationSuggestions}
            renderItem={(suggestion) => {
              const priorityColor =
                suggestion.priority === "high"
                  ? "red"
                  : suggestion.priority === "medium"
                    ? "orange"
                    : "blue";
              return (
                <List.Item
                  actions={[
                    <Button
                      key="action"
                      type="link"
                      onClick={() => setUpdatePmModal(true)}
                    >
                      {suggestion.actionLabel}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Tag color={priorityColor} style={{ marginTop: 4 }}>
                        {suggestion.priority.toUpperCase()}
                      </Tag>
                    }
                    title={
                      <Space>
                        <Text strong>{suggestion.title}</Text>
                        {suggestion.potentialSavings && (
                          <Tag color="green">
                            Save ${suggestion.potentialSavings.toFixed(2)}/yr
                          </Tag>
                        )}
                      </Space>
                    }
                    description={suggestion.description}
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      )}

      {/* ─── Transaction Fee Transparency (Phase 4) ────────────────── */}
      {feeEstimate && (
        <Card
          bordered={false}
          style={{ borderRadius: 12, marginBottom: 16 }}
          title={
            <Space>
              <DollarOutlined style={{ color: "#0D7C8A" }} />
              <Text strong>Processing Fee Breakdown</Text>
            </Space>
          }
        >
          {feeEstimate.potentialSavings > 0 && (
            <Alert
              type="info"
              message={`Save $${feeEstimate.potentialSavings.toFixed(2)}/month with ACH`}
              description="Switching to ACH bank transfer can reduce your processing fees. ACH costs 0.8% (max $5) vs 2.9% + $0.30 for cards."
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}
          <Row gutter={[24, 16]}>
            {feeEstimate.feeBreakdown.map((item) => (
              <Col xs={24} sm={12} key={item.method}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    border:
                      item.estimatedFee === feeEstimate.currentMethodFee
                        ? "2px solid #0D7C8A"
                        : "1px solid #f0f0f0",
                  }}
                >
                  <Space
                    direction="vertical"
                    size={2}
                    style={{ width: "100%" }}
                  >
                    <Text strong>{item.method}</Text>
                    {item.estimatedFee === feeEstimate.currentMethodFee && (
                      <Tag color="green" style={{ alignSelf: "flex-start" }}>
                        Current Method
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Rate: {item.rate}
                    </Text>
                    <Statistic
                      title="Estimated Fee"
                      value={`$${item.estimatedFee.toFixed(2)}`}
                      valueStyle={{ fontSize: 18, color: "#0D7C8A" }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Net amount: ${item.estimatedNet.toFixed(2)}
                    </Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* ─── Available Plans ─────────────────────────────────────── */}
      <Title level={5} style={{ marginBottom: 16 }}>
        Available Plans
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {plans.map((p) => {
          const isCurrent = sub?.planTier === p.tier;
          return (
            <Col xs={24} sm={12} lg={8} key={p.id}>
              <Card
                hoverable={!isCurrent}
                style={{
                  borderRadius: 12,
                  border: isCurrent
                    ? `2px solid ${PLAN_COLORS[p.tier] || "#0D7C8A"}`
                    : "1px solid #f0f0f0",
                  height: "100%",
                }}
              >
                {isCurrent && (
                  <Tag
                    color={PLAN_COLORS[p.tier] || "#0D7C8A"}
                    style={{
                      position: "absolute",
                      top: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      borderRadius: 12,
                    }}
                  >
                    Current Plan
                  </Tag>
                )}
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <Title level={4} style={{ marginBottom: 4 }}>
                    {p.name}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {p.description}
                  </Text>
                  <div style={{ margin: "16px 0" }}>
                    <Text
                      style={{
                        fontSize: 36,
                        fontWeight: 800,
                        color: PLAN_COLORS[p.tier] || "#0D7C8A",
                      }}
                    >
                      {formatCurrency(p.priceMonthlyCents)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 16 }}>
                      /mo
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    or {formatCurrency(p.priceAnnualCents)}/mo billed annually
                    (save 15%)
                  </Text>
                </div>
                <Divider style={{ margin: "12px 0" }} />
                <div style={{ minHeight: 180 }}>
                  {[
                    {
                      label: `${p.maxProviders === null ? "Unlimited" : p.maxProviders} providers`,
                      included: true,
                    },
                    {
                      label: `${p.maxPatients === null ? "Unlimited" : p.maxPatients} patients`,
                      included: true,
                    },
                    {
                      label: "Full RCM (claims, denials, appeals)",
                      included: p.includesRcm,
                    },
                    {
                      label: "AI Scribe (SOAP notes)",
                      included: p.includesAiScribe,
                    },
                    {
                      label: "AI Code Suggestions",
                      included: p.includesAiCoding,
                    },
                    {
                      label: "Patient Portal",
                      included: p.includesPatientPortal,
                    },
                    {
                      label: "RCM Automation Engine",
                      included: p.includesAutomation,
                    },
                    {
                      label: `${p.aiCreditsMonthly} AI credits/month`,
                      included: p.aiCreditsMonthly > 0,
                    },
                  ].map((feat, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      {renderFeatureIcon(feat.included)}
                      <Text
                        style={{
                          fontSize: 13,
                          color: feat.included ? "#1a2b3c" : "#bfbfbf",
                        }}
                      >
                        {feat.label}
                      </Text>
                    </div>
                  ))}
                </div>
                {!isCurrent && (
                  <Button
                    type="primary"
                    block
                    disabled={sub?.status === "cancelled"}
                    onClick={() => {
                      setSelectedPlan(p.tier);
                      setBillingCycle(sub?.billingCycle || "monthly");
                      setChangePlanModal(true);
                    }}
                  >
                    {sub ? "Switch" : "Get Started"}
                  </Button>
                )}
                {isCurrent && (
                  <Button block disabled>
                    Current Plan
                  </Button>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* ─── Billing History ─────────────────────────────────────── */}
      <Card
        title="Billing History"
        style={{ borderRadius: 12, marginBottom: 16 }}
      >
        {invoices.length > 0 ? (
          <Table
            dataSource={invoices}
            columns={invoiceColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        ) : (
          <Empty
            description="No invoices yet. Your first invoice will appear after your trial ends."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* ─── Change Plan Modal ───────────────────────────────────── */}
      <Modal
        title="Change Your Plan"
        open={changePlanModal}
        onCancel={() => setChangePlanModal(false)}
        onOk={handleChangePlan}
        confirmLoading={changing}
        okText="Confirm Change"
        width={600}
      >
        <Paragraph type="secondary" style={{ marginBottom: 20 }}>
          Select a new plan and billing cycle. Changes take effect immediately.
          Prorations are calculated automatically.
        </Paragraph>

        <Text strong style={{ display: "block", marginBottom: 12 }}>
          Select Plan
        </Text>
        <Radio.Group
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          style={{ width: "100%", marginBottom: 20 }}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            {plans.map((p) => (
              <Radio key={p.id} value={p.tier} style={{ width: "100%" }}>
                <Space>
                  <Text strong>{p.name}</Text>
                  <Text type="secondary">
                    {formatCurrency(
                      billingCycle === "annual"
                        ? p.priceAnnualCents
                        : p.priceMonthlyCents,
                    )}
                    /mo
                  </Text>
                </Space>
              </Radio>
            ))}
          </Space>
        </Radio.Group>

        <Text strong style={{ display: "block", marginBottom: 12 }}>
          Billing Cycle
        </Text>
        <Radio.Group
          value={billingCycle}
          onChange={(e) => setBillingCycle(e.target.value)}
          style={{ width: "100%" }}
        >
          <Space direction="vertical">
            <Radio value="monthly">Monthly — pay each month</Radio>
            <Radio value="annual">
              Annual — save 15% (billed yearly)
              <Tag color="success" style={{ marginLeft: 8, borderRadius: 12 }}>
                Save 15%
              </Tag>
            </Radio>
          </Space>
        </Radio.Group>

        {selectedPlan && plans.find((p) => p.tier === selectedPlan) && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: "#f5f7fa",
              borderRadius: 8,
            }}
          >
            <Space>
              <DollarOutlined style={{ color: "#0D7C8A" }} />
              <Text strong>
                New price:{" "}
                {formatCurrency(
                  billingCycle === "annual"
                    ? plans.find((p) => p.tier === selectedPlan)!
                        .priceAnnualCents
                    : plans.find((p) => p.tier === selectedPlan)!
                        .priceMonthlyCents,
                )}
                /mo
              </Text>
              {billingCycle === "annual" && (
                <Text type="secondary">
                  (
                  {formatCurrency(
                    plans.find((p) => p.tier === selectedPlan)!
                      .priceAnnualCents * 12,
                  )}{" "}
                  billed annually)
                </Text>
              )}
            </Space>
          </div>
        )}
      </Modal>

      {/* ─── Update Payment Method Modal (Phase 1, 3) ────────────── */}
      <UpdatePaymentMethodModal
        open={updatePmModal}
        onClose={() => setUpdatePmModal(false)}
        onSuccess={handlePmModalSuccess}
      />
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const handleSave = (section: string) => {
    message.success(`${section} settings saved successfully.`);
  };

  // ─── Profile Tab ──────────────────────────────────────────────────────────────
  const ProfileTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Row gutter={32}>
        <Col xs={24} md={6} style={{ textAlign: "center", marginBottom: 24 }}>
          <Upload
            showUploadList={false}
            beforeUpload={() => {
              message.success("Avatar uploaded.");
              return false;
            }}
          >
            <div style={{ cursor: "pointer" }}>
              <Avatar
                size={120}
                icon={<UserOutlined />}
                style={{ backgroundColor: "#0D7C8A", marginBottom: 12 }}
              />
              <br />
              <Button icon={<UploadOutlined />} size="small">
                Change Avatar
              </Button>
            </div>
          </Upload>
        </Col>
        <Col xs={24} md={18}>
          <Form
            layout="vertical"
            initialValues={{
              firstName: "Sarah",
              lastName: "Chen",
              email: "dr.sarah.chen@neuraline.health",
              phone: "(555) 100-2001",
              specialization: "Internal Medicine",
              department: "Primary Care",
              bio: "Board-certified Internal Medicine physician with over 15 years of experience in primary care and chronic disease management.",
            }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="First Name"
                  name="firstName"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Last Name"
                  name="lastName"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ required: true, type: "email" }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Phone" name="phone">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Specialization" name="specialization">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Department" name="department">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Bio" name="bio">
              <TextArea rows={3} />
            </Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => handleSave("Profile")}
              style={{ borderRadius: 8 }}
            >
              Save Changes
            </Button>
          </Form>
        </Col>
      </Row>
    </Card>
  );

  // ─── Organization Tab ─────────────────────────────────────────────────────────
  const OrganizationTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Form
        layout="vertical"
        initialValues={{
          clinicName: "Neuraline Medical Center",
          address: "100 Healthcare Blvd, Springfield, IL 62701",
          phone: "(555) 100-2000",
          email: "info@neuraline.health",
          website: "https://neuraline.health",
          taxId: "12-3456789",
        }}
      >
        <Row gutter={32}>
          <Col xs={24} md={6} style={{ textAlign: "center", marginBottom: 24 }}>
            <Upload
              showUploadList={false}
              beforeUpload={() => {
                message.success("Logo uploaded.");
                return false;
              }}
            >
              <div
                style={{
                  cursor: "pointer",
                  padding: 24,
                  border: "2px dashed #d9d9d9",
                  borderRadius: 12,
                  background: "#fafafa",
                }}
              >
                <BankOutlined
                  style={{ fontSize: 48, color: "#0D7C8A", marginBottom: 8 }}
                />
                <br />
                <Text type="secondary">Upload Logo</Text>
              </div>
            </Upload>
          </Col>
          <Col xs={24} md={18}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Clinic Name"
                  name="clinicName"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Tax ID" name="taxId">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Address" name="address">
              <Input />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Phone" name="phone">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Email" name="email">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Website" name="website">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </Col>
        </Row>
        <Divider />
        <Title level={5}>Operating Hours</Title>
        <Row gutter={[16, 8]}>
          {[
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ].map((day) => (
            <Col xs={24} sm={12} md={8} lg={6} key={day}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Space
                    style={{ justifyContent: "space-between", width: "100%" }}
                  >
                    <Text strong style={{ fontSize: 13 }}>
                      {day}
                    </Text>
                    <Switch defaultChecked={day !== "Sunday"} size="small" />
                  </Space>
                  {day !== "Sunday" && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {day === "Saturday"
                        ? "9:00 AM - 1:00 PM"
                        : "8:00 AM - 5:00 PM"}
                    </Text>
                  )}
                  {day === "Sunday" && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Closed
                    </Text>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => handleSave("Organization")}
            style={{ borderRadius: 8 }}
          >
            Save Changes
          </Button>
        </div>
      </Form>
    </Card>
  );

  // ─── Users & Roles Tab ────────────────────────────────────────────────────────
  const UsersTab = <UsersRolesTab />;

  // ─── Security Tab ─────────────────────────────────────────────────────────────
  const activeSessions = [
    {
      id: "s1",
      device: "Chrome on Windows",
      ip: "192.168.1.105",
      location: "Springfield, IL",
      lastActive: "2024-12-20 09:15 AM",
      current: true,
    },
    {
      id: "s2",
      device: "Safari on iPhone",
      ip: "10.0.0.42",
      location: "Springfield, IL",
      lastActive: "2024-12-20 08:30 AM",
      current: false,
    },
    {
      id: "s3",
      device: "Firefox on macOS",
      ip: "172.16.0.15",
      location: "Chicago, IL",
      lastActive: "2024-12-19 04:22 PM",
      current: false,
    },
  ];

  const SecurityTab = (
    <div>
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={5}>
          <LockOutlined style={{ marginRight: 8 }} />
          Two-Factor Authentication
        </Title>
        <Row align="middle" justify="space-between">
          <Col>
            <Text>
              Protect your account with 2FA. A verification code will be
              required on each login.
            </Text>
          </Col>
          <Col>
            <Switch defaultChecked />
          </Col>
        </Row>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={5}>
          <SafetyOutlined style={{ marginRight: 8 }} />
          Change Password
        </Title>
        <Form layout="vertical" style={{ maxWidth: 400 }}>
          <Form.Item label="Current Password">
            <Input.Password />
          </Form.Item>
          <Form.Item label="New Password">
            <Input.Password />
          </Form.Item>
          <Form.Item label="Confirm New Password">
            <Input.Password />
          </Form.Item>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => handleSave("Password")}
            style={{ borderRadius: 8 }}
          >
            Update Password
          </Button>
        </Form>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Title level={5}>Active Sessions</Title>
        <List
          dataSource={activeSessions}
          renderItem={(session) => (
            <List.Item
              actions={
                session.current
                  ? [<Tag color="green">Current Session</Tag>]
                  : [
                      <Button
                        size="small"
                        danger
                        onClick={() => message.success("Session revoked.")}
                        style={{ borderRadius: 6 }}
                      >
                        Revoke
                      </Button>,
                    ]
              }
            >
              <List.Item.Meta
                title={<Text strong>{session.device}</Text>}
                description={
                  <Space split={<Divider type="vertical" />}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {session.ip}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {session.location}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Last active: {session.lastActive}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  // ─── Notifications Tab ────────────────────────────────────────────────────────
  const notificationCategories = [
    {
      key: "appointments",
      label: "Appointment Reminders",
      desc: "Notifications for upcoming and changed appointments",
      email: true,
      sms: true,
      inApp: true,
    },
    {
      key: "labResults",
      label: "Lab Results",
      desc: "Alerts when lab results are available",
      email: true,
      sms: false,
      inApp: true,
    },
    {
      key: "prescriptions",
      label: "Prescription Updates",
      desc: "Refill requests and pharmacy notifications",
      email: true,
      sms: true,
      inApp: true,
    },
    {
      key: "messages",
      label: "Patient Messages",
      desc: "New messages from patients",
      email: false,
      sms: false,
      inApp: true,
    },
    {
      key: "billing",
      label: "Billing Alerts",
      desc: "Claim updates and payment notifications",
      email: true,
      sms: false,
      inApp: true,
    },
    {
      key: "system",
      label: "System Notifications",
      desc: "Maintenance updates and system alerts",
      email: true,
      sms: false,
      inApp: true,
    },
  ];

  const NotificationsTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Configure how you want to receive notifications for each category.
        </Text>
      </div>
      <Table
        dataSource={notificationCategories}
        rowKey="key"
        pagination={false}
        columns={[
          {
            title: "Category",
            key: "category",
            render: (
              _: unknown,
              record: (typeof notificationCategories)[0],
            ) => (
              <div>
                <Text strong>{record.label}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.desc}
                </Text>
              </div>
            ),
          },
          {
            title: (
              <Space>
                <MailOutlined /> Email
              </Space>
            ),
            key: "email",
            width: 100,
            align: "center" as const,
            render: (
              _: unknown,
              record: (typeof notificationCategories)[0],
            ) => <Switch defaultChecked={record.email} size="small" />,
          },
          {
            title: (
              <Space>
                <MobileOutlined /> SMS
              </Space>
            ),
            key: "sms",
            width: 100,
            align: "center" as const,
            render: (
              _: unknown,
              record: (typeof notificationCategories)[0],
            ) => <Switch defaultChecked={record.sms} size="small" />,
          },
          {
            title: (
              <Space>
                <NotificationOutlined /> In-App
              </Space>
            ),
            key: "inApp",
            width: 100,
            align: "center" as const,
            render: (
              _: unknown,
              record: (typeof notificationCategories)[0],
            ) => <Switch defaultChecked={record.inApp} size="small" />,
          },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => handleSave("Notifications")}
          style={{ borderRadius: 8 }}
        >
          Save Changes
        </Button>
      </div>
    </Card>
  );

  // ─── Billing Settings Tab ─────────────────────────────────────────────────────
  const BillingSettingsTab = <BillingSettingsTabContent />;

  // ─── Integrations Tab ─────────────────────────────────────────────────────────
  const IntegrationsTab = <IntegrationsTabContent />;

  // ─── Audit Log Tab ────────────────────────────────────────────────────────────
  const auditColumns = [
    {
      title: "User",
      dataIndex: "userName",
      key: "user",
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      render: (v: string) => {
        const colors: Record<string, string> = {
          VIEW: "blue",
          CREATE: "green",
          UPDATE: "orange",
          DELETE: "red",
          EXPORT: "purple",
          LOGIN: "cyan",
        };
        return <Tag color={colors[v] || "default"}>{v}</Tag>;
      },
    },
    { title: "Resource", dataIndex: "resource", key: "resource" },
    { title: "Details", dataIndex: "details", key: "details", ellipsis: true },
    { title: "IP Address", dataIndex: "ipAddress", key: "ip" },
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  const AuditLogTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Table
        dataSource={mockAuditLog}
        columns={auditColumns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  // ─── System Tab ───────────────────────────────────────────────────────────────
  const SystemTab = (
    <div>
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={5}>
          <ExportOutlined style={{ marginRight: 8 }} />
          Data Export
        </Title>
        <Paragraph type="secondary">
          Export all clinic data in a machine-readable format for migration or
          backup.
        </Paragraph>
        <Space>
          <Button icon={<ExportOutlined />} style={{ borderRadius: 8 }}>
            Export All Data (JSON)
          </Button>
          <Button icon={<ExportOutlined />} style={{ borderRadius: 8 }}>
            Export Patient Records (CSV)
          </Button>
        </Space>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={5}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          Backup Status
        </Title>
        <Descriptions column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Last Backup">
            Dec 20, 2024 at 3:00 AM
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Badge status="success" text="Completed" />
          </Descriptions.Item>
          <Descriptions.Item label="Backup Size">2.4 GB</Descriptions.Item>
          <Descriptions.Item label="Next Scheduled">
            Dec 21, 2024 at 3:00 AM
          </Descriptions.Item>
          <Descriptions.Item label="Retention Period">
            90 days
          </Descriptions.Item>
          <Descriptions.Item label="Storage Location">
            AWS S3 (us-east-1)
          </Descriptions.Item>
        </Descriptions>
        <Button
          type="primary"
          icon={<DatabaseOutlined />}
          onClick={() => message.success("Manual backup initiated.")}
          style={{ marginTop: 8, borderRadius: 8 }}
        >
          Run Manual Backup
        </Button>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Title level={5}>
          <ToolOutlined style={{ marginRight: 8 }} />
          Maintenance Mode
        </Title>
        <Paragraph type="secondary">
          When enabled, the system will show a maintenance page to all users.
          Only administrators can access the system.
        </Paragraph>
        <Row align="middle" justify="space-between">
          <Col>
            <Text>Enable Maintenance Mode</Text>
          </Col>
          <Col>
            <Switch />
          </Col>
        </Row>
      </Card>
    </div>
  );

  // ─── All Tabs ─────────────────────────────────────────────────────────────────
  const tabItems = [
    {
      key: "profile",
      label: (
        <span>
          <UserOutlined style={{ marginRight: 6 }} />
          Profile
        </span>
      ),
      children: ProfileTab,
    },
    {
      key: "organization",
      label: (
        <span>
          <BankOutlined style={{ marginRight: 6 }} />
          Organization
        </span>
      ),
      children: OrganizationTab,
    },
    {
      key: "users",
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 6 }} />
          Users & Roles
        </span>
      ),
      children: UsersTab,
    },
    {
      key: "security",
      label: (
        <span>
          <SafetyOutlined style={{ marginRight: 6 }} />
          Security
        </span>
      ),
      children: SecurityTab,
    },
    {
      key: "notifications",
      label: (
        <span>
          <BellOutlined style={{ marginRight: 6 }} />
          Notifications
        </span>
      ),
      children: NotificationsTab,
    },
    {
      key: "billing",
      label: (
        <span>
          <DollarOutlined style={{ marginRight: 6 }} />
          Billing & Subscription
        </span>
      ),
      children: BillingSettingsTab,
    },
    {
      key: "integrations",
      label: (
        <span>
          <ApiOutlined style={{ marginRight: 6 }} />
          Integrations
        </span>
      ),
      children: IntegrationsTab,
    },
    {
      key: "audit",
      label: (
        <span>
          <AuditOutlined style={{ marginRight: 6 }} />
          Audit Log
        </span>
      ),
      children: AuditLogTab,
    },
    {
      key: "system",
      label: (
        <span>
          <CloudServerOutlined style={{ marginRight: 6 }} />
          System
        </span>
      ),
      children: SystemTab,
    },
  ];

  return (
    <div>
      {/* Header */}
      <Title level={3} style={{ marginBottom: 24 }}>
        <SettingOutlined style={{ marginRight: 12, color: "#0D7C8A" }} />
        Settings & Administration
      </Title>

      {/* Vertical Tabs */}
      <Tabs
        tabPosition="left"
        items={tabItems}
        style={{ minHeight: 500 }}
        defaultActiveKey="profile"
      />
    </div>
  );
};

export default SettingsPage;
