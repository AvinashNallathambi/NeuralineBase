import React, { useEffect, useState, useCallback } from 'react';
import { Badge, Dropdown, List, Typography, Button, Empty, Spin, Tag, Space } from 'antd';
import { BellOutlined, CheckOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { notificationService, type Notification, priorityColors } from '../../services/notificationService';
import { useAppStore } from '../../store';

const { Text, Paragraph } = Typography;

const priorityTagColors: Record<string, string> = {
  low: 'blue',
  medium: 'default',
  high: 'orange',
  urgent: 'red',
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
  return new Date(isoDate).toLocaleDateString();
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { unreadCount, markNotificationRead, markAllRead } = useAppStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications({ limit: 10 });
      setNotifications(data);
    } catch {
      // silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Poll for unread count every 60 seconds
    const interval = setInterval(async () => {
      try {
        const count = await notificationService.getUnreadCount();
        // Update store unread count
        useAppStore.setState({ unreadCount: count });
      } catch {
        // ignore
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.markAllAsRead();
      markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
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
    setOpen(false);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const dropdownContent = (
    <div
      style={{
        width: 380,
        maxHeight: 500,
        overflow: 'auto',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Text strong>Notifications</Text>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleMarkAllRead}
          >
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : notifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No notifications"
          style={{ padding: 40 }}
        />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f5f5f5',
                background: item.isRead ? 'transparent' : '#f0f7ff',
                transition: 'background 0.2s',
              }}
            >
              <List.Item.Meta
                title={
                  <Space size={6} style={{ width: '100%' }}>
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
                    <Text
                      strong={!item.isRead}
                      style={{ fontSize: 13, flex: 1 }}
                      ellipsis
                    >
                      {item.title}
                    </Text>
                    {item.priority === 'urgent' && (
                      <Tag color="red" style={{ fontSize: 10, margin: 0 }}>
                        URGENT
                      </Tag>
                    )}
                    {item.priority === 'high' && item.priority !== 'urgent' && (
                      <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>
                        HIGH
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <div>
                    <Paragraph
                      style={{ margin: '4px 0', fontSize: 12, color: '#64748b' }}
                      ellipsis={{ rows: 2 }}
                    >
                      {item.message}
                    </Paragraph>
                    <Text
                      type="secondary"
                      style={{ fontSize: 11 }}
                    >
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center',
        }}
      >
        <Button
          type="link"
          size="small"
          onClick={() => {
            setOpen(false);
            navigate('/notifications');
          }}
        >
          View all notifications
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <BellOutlined
          style={{
            fontSize: 20,
            cursor: 'pointer',
            color: '#64748b',
            padding: 8,
            borderRadius: 8,
            transition: 'all 0.2s',
          }}
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
