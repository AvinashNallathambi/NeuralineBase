import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Alert,
  Tag,
  Typography,
  Divider,
  message,
  Spin,
  InputNumber,
  Tooltip,
  Timeline,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import {
  integrationService,
  type Integration,
  type IntegrationConfigSchema,
  type ConfigField,
  type AuditLogEntry,
} from '../../services/integrationService';

const { Text, Paragraph } = Typography;

interface IntegrationConfigDrawerProps {
  integration: Integration | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  connected: { color: 'success', text: 'Connected', icon: <CheckCircleOutlined /> },
  disconnected: { color: 'default', text: 'Disconnected', icon: <CloseCircleOutlined /> },
  error: { color: 'error', text: 'Error', icon: <ExclamationCircleOutlined /> },
  pending: { color: 'processing', text: 'Pending', icon: <ClockCircleOutlined /> },
};

const IntegrationConfigDrawer: React.FC<IntegrationConfigDrawerProps> = ({
  integration,
  open,
  onClose,
  onUpdated,
}) => {
  const [form] = Form.useForm();
  const [schema, setSchema] = useState<IntegrationConfigSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const loadSchema = useCallback(async (key: string) => {
    try {
      const s = await integrationService.getConfigSchema(key);
      setSchema(s);
    } catch {
      setSchema(null);
    }
  }, []);

  const loadAuditLogs = useCallback(async (key: string) => {
    try {
      const logs = await integrationService.getAuditLogs(key, 20);
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    }
  }, []);

  useEffect(() => {
    if (integration && open) {
      setLoading(true);
      loadSchema(integration.key);
      loadAuditLogs(integration.key);
      // Initialize form with existing config values
      const formValues: Record<string, unknown> = {};
      if (integration.config) {
        for (const [k, v] of Object.entries(integration.config)) {
          formValues[k] = v;
        }
      }
      form.setFieldsValue(formValues);
      setLoading(false);
    }
  }, [integration, open, form, loadSchema, loadAuditLogs]);

  const handleSave = async () => {
    if (!integration) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await integrationService.update(integration.key, { config: values });
      message.success(`${integration.name} configuration saved`);
      onUpdated();
    } catch (err: any) {
      if (err?.errorFields) return; // validation error, don't show
      message.error(err?.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!integration) return;
    setTesting(true);
    try {
      const result = await integrationService.testConnection(integration.key);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
      onUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Test connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleOAuthConnect = async () => {
    if (!integration) return;
    setOauthLoading(true);
    try {
      const redirectUri = `${window.location.origin}/settings/integrations/oauth/callback`;
      const result = await integrationService.getOAuthUrl(integration.key, redirectUri);
      // Open OAuth URL in a new window
      window.open(result.authUrl, '_blank', 'width=600,height=700');
      message.info('Complete the OAuth flow in the popup window. After authorization, paste the code below.');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to start OAuth flow');
    } finally {
      setOauthLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    if (!integration) return;
    try {
      const redirectUri = `${window.location.origin}/settings/integrations/oauth/callback`;
      const result = await integrationService.handleOAuthCallback(integration.key, code, redirectUri);
      if (result.success) {
        message.success(result.message);
        onUpdated();
      } else {
        message.error(result.message);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'OAuth callback failed');
    }
  };

  if (!integration) return null;

  const status = statusConfig[integration.status] || statusConfig.disconnected;

  const renderField = (field: ConfigField) => {
    switch (field.type) {
      case 'boolean':
        return (
          <Form.Item key={field.key} name={field.key} label={field.label} valuePropName="checked">
            <Switch />
          </Form.Item>
        );

      case 'select':
        return (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
            extra={field.helpText}
          >
            <Select
              placeholder={field.placeholder || `Select ${field.label}`}
              options={field.options}
              allowClear={!field.required}
            />
          </Form.Item>
        );

      case 'password':
        return (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
            extra={field.helpText}
          >
            <Input.Password placeholder={field.placeholder || `Enter ${field.label}`} />
          </Form.Item>
        );

      case 'textarea':
        return (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
            extra={field.helpText}
          >
            <Input.TextArea rows={3} placeholder={field.placeholder} />
          </Form.Item>
        );

      case 'number':
        return (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
            extra={field.helpText}
          >
            <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />
          </Form.Item>
        );

      case 'url':
        return (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={[
              ...(field.required ? [{ required: true, message: `${field.label} is required` }] : []),
              { type: 'url', message: 'Please enter a valid URL' },
            ]}
            extra={field.helpText}
          >
            <Input placeholder={field.placeholder || 'https://...'} />
          </Form.Item>
        );

      case 'phone':
        return (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
            extra={field.helpText || 'E.164 format: +12345678900'}
          >
            <Input placeholder={field.placeholder || '+12345678900'} />
          </Form.Item>
        );

      default:
        return (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
            extra={field.helpText}
          >
            <Input placeholder={field.placeholder || `Enter ${field.label}`} />
          </Form.Item>
        );
    }
  };

  return (
    <Drawer
      title={
        <Space>
          <span style={{ fontSize: 24 }}>{integration.icon || '🔌'}</span>
          <span>{integration.name}</span>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={520}
      extra={
        <Space>
          <Tag color={status.color} icon={status.icon}>
            {status.text}
          </Tag>
        </Space>
      }
      footer={
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            {schema?.testable && (
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleTest}
                loading={testing}
                disabled={saving}
              >
                Test Connection
              </Button>
            )}
            {schema?.requiresOAuth && (
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={handleOAuthConnect}
                loading={oauthLoading}
                disabled={saving || testing}
              >
                Connect via OAuth
              </Button>
            )}
          </Space>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={testing || oauthLoading}
            >
              Save
            </Button>
          </Space>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {/* Description */}
        <Paragraph type="secondary">{integration.description}</Paragraph>

        {/* Status info */}
        {integration.status === 'error' && integration.errorMessage && (
          <Alert
            type="error"
            message="Connection Error"
            description={integration.errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        {integration.status === 'connected' && integration.lastConnectedAt && (
          <Alert
            type="success"
            message={`Last connected: ${new Date(integration.lastConnectedAt).toLocaleString()}`}
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Help text */}
        {schema?.helpText && (
          <Alert
            type="info"
            message="Setup Instructions"
            description={schema.helpText}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Provider tag */}
        <Space style={{ marginBottom: 16 }}>
          <Tag color="blue">{integration.provider}</Tag>
          {integration.category && (
            <Tag>{integration.category.replace(/_/g, ' ').toUpperCase()}</Tag>
          )}
          {integration.requiresOAuth && <Tag color="orange">OAuth Required</Tag>}
        </Space>

        <Divider />

        {/* Config Form */}
        {schema && schema.fields.length > 0 ? (
          <Form form={form} layout="vertical" preserve={false}>
            {schema.fields.filter((f) => !f.hidden).map(renderField)}
          </Form>
        ) : (
          !loading && (
            <Empty
              description={
                integration.configurable
                  ? 'No configuration fields required'
                  : 'This integration is not configurable'
              }
            />
          )
        )}

        <Divider />

        {/* Audit Log */}
        <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
          <Text strong>
            <HistoryOutlined style={{ marginRight: 6 }} />
            Recent Activity
          </Text>
          <Button
            type="link"
            size="small"
            onClick={() => setShowAuditLog(!showAuditLog)}
          >
            {showAuditLog ? 'Hide' : 'Show'}
          </Button>
        </Space>
        {showAuditLog && (
          auditLogs.length > 0 ? (
            <Timeline
              items={auditLogs.map((log) => ({
                color: log.newStatus === 'connected' ? 'green' : log.newStatus === 'error' ? 'red' : 'blue',
                children: (
                  <div>
                    <Text strong>{log.action.replace(/_/g, ' ')}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(log.createdAt).toLocaleString()}
                      {log.performedBy && ` • by ${log.performedBy}`}
                    </Text>
                    {log.detail && (
                      <>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{log.detail}</Text>
                      </>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty description="No activity recorded" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )
        )}
      </Spin>
    </Drawer>
  );
};

export default IntegrationConfigDrawer;
