import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Typography,
  Button,
  Row,
  Col,
  Tag,
  Space,
  Spin,
  message,
  Modal,
  Radio,
  Divider,
  Table,
  Statistic,
  Empty,
  Tooltip,
} from "antd";
import {
  CrownOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  CloudServerOutlined,
  ArrowUpOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import subscriptionService, {
  SubscriptionPlan,
  SubscriptionWithPlan,
  SubscriptionInvoice,
} from "../../services/subscriptionService";

const { Title, Text, Paragraph } = Typography;

const STATUS_COLORS: Record<string, string> = {
  trialing: "processing",
  active: "success",
  past_due: "warning",
  cancelled: "error",
  expired: "default",
  paused: "default",
};

const STATUS_LABELS: Record<string, string> = {
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

const SubscriptionPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentSub, setCurrentSub] = useState<SubscriptionWithPlan | null>(
    null,
  );
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [changePlanModal, setChangePlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [changing, setChanging] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
      } catch {
        // No subscription yet — show available plans
      }
    } catch (err) {
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

  const renderFeatureIcon = (included: boolean, color: string) =>
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
      render: (_: any, record: SubscriptionInvoice) =>
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
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            <CrownOutlined style={{ color: "#0D7C8A", marginRight: 8 }} />
            Subscription & Billing
          </Title>
          <Text type="secondary">
            Manage your plan, billing cycle, and payment history
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* ─── Current Plan Card ───────────────────────────────────── */}
      {sub && plan ? (
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 12,
            border: `2px solid ${PLAN_COLORS[sub.planTier] || "#0D7C8A"}40`,
          }}
        >
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} lg={10}>
              <Space direction="vertical" size={4}>
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
                    color={STATUS_COLORS[sub.status]}
                    style={{ borderRadius: 6 }}
                  >
                    {STATUS_LABELS[sub.status] || sub.status}
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

            <Col xs={24} lg={8}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Billing Cycle"
                    value={sub.billingCycle === "annual" ? "Annual" : "Monthly"}
                    prefix={<DollarOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Current Period"
                    value={formatDate(sub.currentPeriodEnd)}
                    prefix={<CloudServerOutlined />}
                  />
                </Col>
                {sub.status === "trialing" && sub.trialEndsAt && (
                  <Col span={24}>
                    <div
                      style={{
                        background: "#faad1415",
                        padding: "12px 16px",
                        borderRadius: 8,
                        border: "1px solid #faad1430",
                      }}
                    >
                      <Space>
                        <ThunderboltOutlined style={{ color: "#faad14" }} />
                        <Text strong style={{ color: "#faad14" }}>
                          {trialDaysLeft(sub.trialEndsAt)} days left in trial
                        </Text>
                      </Space>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Trial ends {formatDate(sub.trialEndsAt)}. Add a payment
                        method to continue after trial.
                      </Text>
                    </div>
                  </Col>
                )}
                {sub.cancelAtPeriodEnd && (
                  <Col span={24}>
                    <div
                      style={{
                        background: "#ff4d4f15",
                        padding: "12px 16px",
                        borderRadius: 8,
                        border: "1px solid #ff4d4f30",
                      }}
                    >
                      <Space>
                        <ExclamationCircleOutlined
                          style={{ color: "#ff4d4f" }}
                        />
                        <Text strong style={{ color: "#ff4d4f" }}>
                          Cancels on {formatDate(sub.currentPeriodEnd)}
                        </Text>
                      </Space>
                    </div>
                  </Col>
                )}
              </Row>
            </Col>

            <Col xs={24} lg={6} style={{ textAlign: "right" }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  icon={<ArrowUpOutlined />}
                  block
                  onClick={() => {
                    setSelectedPlan(sub.planTier);
                    setBillingCycle(sub.billingCycle);
                    setChangePlanModal(true);
                  }}
                  disabled={sub.status === "cancelled"}
                >
                  Change Plan
                </Button>
                {sub.cancelAtPeriodEnd || sub.status === "cancelled" ? (
                  <Button
                    block
                    onClick={handleReactivate}
                    disabled={sub.status === "expired"}
                  >
                    Reactivate
                  </Button>
                ) : (
                  <Button
                    block
                    danger
                    onClick={handleCancel}
                    loading={cancelling}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </Space>
            </Col>
          </Row>

          {/* Feature summary */}
          <Divider style={{ margin: "20px 0" }} />
          <Row gutter={[16, 12]}>
            <Col xs={12} md={6}>
              <Space>
                {renderFeatureIcon(plan.includesRcm, "#0D7C8A")}
                <Text>Full RCM</Text>
              </Space>
            </Col>
            <Col xs={12} md={6}>
              <Space>
                {renderFeatureIcon(plan.includesAiScribe, "#0D7C8A")}
                <Text>AI Scribe</Text>
              </Space>
            </Col>
            <Col xs={12} md={6}>
              <Space>
                {renderFeatureIcon(plan.includesAiCoding, "#0D7C8A")}
                <Text>AI Coding</Text>
              </Space>
            </Col>
            <Col xs={12} md={6}>
              <Space>
                {renderFeatureIcon(plan.includesPatientPortal, "#0D7C8A")}
                <Text>Patient Portal</Text>
              </Space>
            </Col>
            <Col xs={12} md={6}>
              <Space>
                {renderFeatureIcon(plan.includesAutomation, "#0D7C8A")}
                <Text>RCM Automation</Text>
              </Space>
            </Col>
            <Col xs={12} md={6}>
              <Space>
                <TeamOutlined style={{ color: "#0D7C8A" }} />
                <Text>
                  {plan.maxProviders === null ? "Unlimited" : plan.maxProviders}{" "}
                  providers
                </Text>
              </Space>
            </Col>
            <Col xs={12} md={6}>
              <Space>
                <RobotOutlined style={{ color: "#0D7C8A" }} />
                <Text>{plan.aiCreditsMonthly} AI credits/mo</Text>
              </Space>
            </Col>
            <Col xs={12} md={6}>
              <Space>
                <SafetyCertificateOutlined style={{ color: "#0D7C8A" }} />
                <Text>HIPAA Compliant</Text>
              </Space>
            </Col>
          </Row>
        </Card>
      ) : (
        <Card style={{ marginBottom: 24, borderRadius: 12 }}>
          <Empty
            description="No active subscription. Choose a plan below to get started."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}

      {/* ─── Available Plans ─────────────────────────────────────── */}
      <Title level={4} style={{ marginBottom: 16 }}>
        Available Plans
      </Title>
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
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
                      {renderFeatureIcon(
                        feat.included,
                        PLAN_COLORS[p.tier] || "#0D7C8A",
                      )}
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
                    {sub
                      ? PLAN_COLORS[p.tier] > PLAN_COLORS[sub.planTier]
                        ? "Upgrade"
                        : "Switch"
                      : "Get Started"}
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
      <Card title="Billing History" style={{ borderRadius: 12 }}>
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
    </div>
  );
};

export default SubscriptionPage;
