import api from './api';

export type NotificationType =
  | 'trial_ending'
  | 'trial_expired'
  | 'payment_failed'
  | 'payment_succeeded'
  | 'renewal_upcoming'
  | 'subscription_cancelled'
  | 'plan_changed'
  | 'dunning_reminder'
  | 'account_suspended'
  | 'general';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  tenantId: string;
  userId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  actionUrl: string | null;
  actionLabel: string | null;
  isRead: boolean;
  readAt: string | null;
  emailSent: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

const NOTIFICATION_BASE = '/notifications';

export const notificationService = {
  async getNotifications(options?: {
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<Notification[]> {
    const params: Record<string, string> = {};
    if (options?.unreadOnly) params.unreadOnly = 'true';
    if (options?.limit) params.limit = String(options.limit);
    const res = await api.get<Notification[]>(NOTIFICATION_BASE, { params });
    return res.data;
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get<UnreadCountResponse>(`${NOTIFICATION_BASE}/unread-count`);
    return res.data.count;
  },

  async markAsRead(id: string): Promise<void> {
    await api.post(`${NOTIFICATION_BASE}/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.post(`${NOTIFICATION_BASE}/mark-all-read`);
  },
};

// Priority → color mapping for UI
export const priorityColors: Record<NotificationPriority, string> = {
  low: 'blue',
  medium: 'default',
  high: 'orange',
  urgent: 'red',
};

// Type → icon mapping for UI
export const typeIcons: Record<NotificationType, string> = {
  trial_ending: 'ClockCircleOutlined',
  trial_expired: 'WarningOutlined',
  payment_failed: 'CloseCircleOutlined',
  payment_succeeded: 'CheckCircleOutlined',
  renewal_upcoming: 'CalendarOutlined',
  subscription_cancelled: 'StopOutlined',
  plan_changed: 'SwapOutlined',
  dunning_reminder: 'ExclamationCircleOutlined',
  account_suspended: 'PauseCircleOutlined',
  general: 'BellOutlined',
};
