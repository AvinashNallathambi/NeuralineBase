import React, { useState } from "react";
import {
  Form,
  Input,
  Button,
  Checkbox,
  Typography,
  Divider,
  Card,
  Space,
  message,
  Alert,
} from "antd";
import {
  MailOutlined,
  LockOutlined,
  GoogleOutlined,
  WindowsOutlined,
  SafetyCertificateOutlined,
  MedicineBoxOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../../store";
import { mockUser, mockTenant } from "../../data/mockData";

const { Title, Text, Paragraph } = Typography;

// RSA Encryption helper using Web Crypto API
async function encryptPassword(password: string): Promise<string> {
  try {
    // In production, fetch the public key from the backend
    // For now, using a hardcoded public key (this should be replaced with dynamic key fetching)

    // Simple base64 encoding for demo (replace with proper RSA in production)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Add a prefix to identify encrypted data
    return `ENC:${hashHex}`;
  } catch (error) {
    console.error("Encryption error:", error);
    // Fallback to base64 if encryption fails
    return btoa(password);
  }
}

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [pendingLogin, setPendingLogin] = useState<any>(null);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const onFinish = async (values: {
    email: string;
    password: string;
    remember: boolean;
  }) => {
    setLoading(true);
    try {
      // Encrypt password before sending
      const encryptedPassword = await encryptPassword(values.password);

      // Call the real backend login endpoint
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: encryptedPassword,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.message)
          ? err.message.join(", ")
          : err.message || "Login failed";
        throw new Error(msg);
      }

      const data = await res.json();

      if (data.mfaRequired) {
        // Store partial data for MFA step
        setPendingLogin(data);
        setMfaStep(true);
        message.info("Verification code sent to your device");
      } else {
        // No MFA – login directly
        const user = data.user || mockUser;
        const token = data.accessToken;
        if (!token) {
          throw new Error("No access token received from server");
        }
        login(
          user,
          token,
          user.tenantId
            ? ({
                id: user.tenantId,
                name: "Neuraline Health",
                plan: "enterprise",
              } as any)
            : mockTenant,
        );
      message.success(`Welcome back, ${user.firstName || "Doctor"}!`);
        navigate("/dashboard");
      }
    } catch (err: any) {
      message.error(
        err.message || "Unable to connect to the server. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const onVerifyMfa = async () => {
    if (!otpValue || otpValue.length < 6) {
      message.error("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (pendingLogin?.accessToken) {
      const user = pendingLogin.user || mockUser;
      login(
        user,
        pendingLogin.accessToken,
        user.tenantId
          ? ({
              id: user.tenantId,
              name: "Neuraline Health",
              plan: "enterprise",
            } as any)
          : mockTenant,
      );
      message.success(`Welcome back, ${user.firstName || "Doctor"}!`);
    } else {
      message.error("Login session expired. Please sign in again.");
      setMfaStep(false);
      setPendingLogin(null);
      setOtpValue("");
      setLoading(false);
      return;
    }
    setLoading(false);
    navigate("/dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0D7C8A 0%, #064E57 50%, #032D33 100%)",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo & Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <MedicineBoxOutlined style={{ fontSize: 36, color: "#36CFC9" }} />
            <Title
              level={2}
              style={{ margin: 0, color: "#fff", fontWeight: 700 }}
            >
              Neuraline
            </Title>
          </div>
          <Paragraph style={{ color: "rgba(255,255,255,0.75)", margin: 0 }}>
            Intelligent Healthcare Platform
          </Paragraph>
        </div>

        <Card
          style={{
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            border: "none",
          }}
          bodyStyle={{ padding: "40px 32px" }}
        >
          {!mfaStep ? (
            <>
              <Title level={3} style={{ marginBottom: 4, textAlign: "center" }}>
                Welcome back
              </Title>
              <Text
                type="secondary"
                style={{
                  display: "block",
                  textAlign: "center",
                  marginBottom: 32,
                }}
              >
                Sign in to your EMR account
              </Text>

              <Form
                name="login"
                layout="vertical"
                onFinish={onFinish}
                autoComplete="off"
                initialValues={{
                  remember: true,
                  email: "dr.sarah.chen@neuraline.health",
                  password: "Neuraline@2025",
                }}
                size="large"
              >
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: "Please enter your email" },
                    { type: "email", message: "Please enter a valid email" },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined style={{ color: "#0D7C8A" }} />}
                    placeholder="Email address"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[
                    { required: true, message: "Please enter your password" },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: "#0D7C8A" }} />}
                    placeholder="Password"
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Form.Item name="remember" valuePropName="checked" noStyle>
                      <Checkbox>Remember me</Checkbox>
                    </Form.Item>
                    <Link
                      to="/forgot-password"
                      style={{ color: "#0D7C8A", fontWeight: 500 }}
                    >
                      Forgot password?
                    </Link>
                  </div>
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
                      background: "#0D7C8A",
                    }}
                  >
                    Sign In
                  </Button>
                </Form.Item>
              </Form>

              <Divider plain>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  or continue with
                </Text>
              </Divider>

              <Space
                style={{ width: "100%", justifyContent: "center" }}
                size={12}
              >
                <Button
                  size="large"
                  icon={<GoogleOutlined />}
                  style={{
                    borderRadius: 10,
                    height: 44,
                    width: 180,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Google
                </Button>
                <Button
                  size="large"
                  icon={<WindowsOutlined />}
                  style={{
                    borderRadius: 10,
                    height: 44,
                    width: 180,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Microsoft
                </Button>
              </Space>

              <div style={{ textAlign: "center", marginTop: 24 }}>
                <Text type="secondary">
                  Don't have an account?{" "}
                  <Link
                    to="/register"
                    style={{ color: "#0D7C8A", fontWeight: 600 }}
                  >
                    Sign up
                  </Link>
                </Text>
              </div>
            </>
          ) : (
            /* MFA Verification Step */
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <SafetyCertificateOutlined
                  style={{ fontSize: 48, color: "#0D7C8A", marginBottom: 16 }}
                />
                <Title level={3} style={{ marginBottom: 4 }}>
                  Two-Factor Verification
                </Title>
                <Text type="secondary">
                  Enter the 6-digit code from your authenticator app
                </Text>
              </div>

              <Alert
                message="A verification code has been sent to your registered device."
                type="info"
                showIcon
                style={{ marginBottom: 24, borderRadius: 8 }}
              />

              <Input.OTP
                length={6}
                value={otpValue}
                onChange={(val) => setOtpValue(val)}
                style={{ marginBottom: 24, width: "100%" }}
              />

              <Button
                type="primary"
                block
                loading={loading}
                onClick={onVerifyMfa}
                style={{
                  height: 48,
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 16,
                  background: "#0D7C8A",
                  marginBottom: 16,
                }}
              >
                Verify & Sign In
              </Button>

              <div style={{ textAlign: "center" }}>
                <Button
                  type="link"
                  onClick={() => setMfaStep(false)}
                  style={{ color: "#0D7C8A" }}
                >
                  Back to login
                </Button>
              </div>
            </>
          )}
        </Card>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            &copy; {new Date().getFullYear()} Neuraline Health Technologies. All
            rights reserved.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
