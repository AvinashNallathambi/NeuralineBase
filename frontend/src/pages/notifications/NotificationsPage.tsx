import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Typography,
  List,
  Tag,
  Button,
  Space,
  Empty,
  Spin,
  Tabs,
  Tooltip,
  message,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  StopOutlined,
  SwapOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  notificationService,
  type Notification,
  type NotificationType,
} from '../../services/notificationService';
import { useAppStore } from '../../store';

const { Title, Text, Paragraph } = Typography;

const typeIconMap: Record<NotificationType, React.ReactNode> = {
  trial_ending: <ClockCircleOutlined style={{ color: '#faad14' }} />,
  trial_expired: <WarningOutlined style={{ color: '#fa8c16' }} />,
  payment_failed: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  payment_succeeded: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  renewal_upcoming: <CalendarOutlined style={{ color: '#1890ff' }} />,
  subscription_cancelled: <StopOutlined style={{ color: '#ff4d4f' }} />,
  plan_changed: <SwapOutlined style={{ color: '#722ed1' }} />,
  dunning_reminder: <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />,
  account_suspended: <PauseCircleOutlined style={{ color: '#ff4d4f' }} />,
  general: <BellOutlined style={{ color: '#8c8c8c' }} />,
};

const priorityTagMap: Record<string, { color: string; label: string }> = {
  low: { color: 'blue', label: 'Low' },
  medium: { color: 'default', label: 'Medium' },
  high: { color: 'orange', label: 'High' },
  urgent: { color: 'red', label: 'Urgent' },
};

const formatRelativeTime = (isoDate: string): string => {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { markNotificationRead, markAllRead } = useAppStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications({ limit: 100 });
      setNotifications(data);
    } catch {
      message.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      message.success('All notifications marked as read');
    } catch {
      message.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await notificationService.markAsRead(notification.id);
        markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        );
      } catch {
        // ignore
      }
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const filteredNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.isRead)
      : activeTab === 'urgent'
        ? notifications.filter((n) => n.priority === 'urgent' || n.priority === 'high')
        : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const urgentCount = notifications.filter(
    (n) => n.priority === 'urgent' || n.priority === 'high',
  ).length;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Space>
            <BellOutlined style={{ fontSize: 24, color: '#0D7C8A' }} />
            <Title level={4} style={{ margin: 0 }}>
              Notifications
            </Title>
          </Space>
          {unreadCount > 0 && (
            <Button
              icon={<CheckOutlined />}
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: `All (${notifications.length})`,
            },
            {
              key: 'unread',
              label: `Unread (${unreadCount})`,
            },
            {
              key: 'urgent',
              label: `High Priority (${urgentCount})`,
            },
          ]}
          style={{ marginBottom: 16 }}
        />

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              activeTab === 'unread'
                ? 'No unread notifications'
                : activeTab === 'urgent'
                  ? 'No high priority notifications'
                  : 'No notifications yet'
            }
            style={{ padding: 60 }}
          />
        ) : (
          <List
            dataSource={filteredNotifications}
            renderItem={(item) => {
              const priorityInfo = priorityTagMap[item.priority] ?? priorityTagMap.medium;
              return (
                <List.Item
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    padding: '16px 12px',
                    cursor: item.actionUrl ? 'pointer' : 'default',
                    borderBottom: '1px solid #f5f5f5',
                    background: item.isRead ? 'transparent' : '#f0f7ff',
                    borderRadius: 6,
                    marginBottom: 4,
                    transition: 'background 0.2s',
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{ fontSize: 20, paddingTop: 4 }}>
                        {typeIconMap[item.type] ?? <BellOutlined />}
                      </div>
                    }
                    title={
                      <Space size={8} style={{ width: '100%' }}>
                        {!item.isRead && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: '#0D7C8A',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <Text strong={!item.isRead} style={{ flex: 1 }}>
                          {item.title}
                        </Text>
                        <Tag
                          color={priorityInfo.color}
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          {priorityInfo.label}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Paragraph
                          style={{ margin: '4px 0', color: '#475569' }}
                        >
                          {item.message}
                        </Paragraph>
                        <Space size={12}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {formatRelativeTime(item.createdAt)}
                          </Text>
                          {item.actionUrl && item.actionLabel && (
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, fontSize: 12 }}
                            >
                              {item.actionLabel}
                            </Button>
                          )}
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default NotificationsPage;
