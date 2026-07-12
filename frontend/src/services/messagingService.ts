import { api } from './api';

export interface Conversation {
  id: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  providerId: string | null;
  providerName: string | null;
  subject: string;
  status: string;
  priority: string;
  lastMessageAt: string | null;
  unreadByPatient: number;
  unreadByProvider: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  senderType: string;
  senderName: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  attachments: { name: string; url: string; size: number; type: string }[] | null;
  createdAt: string;
}

class MessagingService {
  private baseUrl = '/messaging';

  // Patient endpoints
  async getConversations(): Promise<Conversation[]> {
    const response = await api.get(`${this.baseUrl}/patient/conversations`);
    return response.data;
  }

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const response = await api.get(`${this.baseUrl}/patient/conversations/${id}`);
    return response.data;
  }

  async startConversation(data: {
    subject: string;
    body: string;
    priority?: string;
    providerId?: string;
  }): Promise<{ conversation: Conversation; message: Message }> {
    const response = await api.post(`${this.baseUrl}/patient/conversations`, data);
    return response.data;
  }

  async reply(conversationId: string, body: string): Promise<Message> {
    const response = await api.post(`${this.baseUrl}/patient/conversations/${conversationId}/reply`, { body });
    return response.data;
  }

  async getUnreadCount(): Promise<number> {
    const response = await api.get(`${this.baseUrl}/patient/unread-count`);
    return response.data.count;
  }

  // Provider endpoints
  async getProviderConversations(providerId?: string): Promise<Conversation[]> {
    const params = new URLSearchParams();
    if (providerId) params.append('providerId', providerId);
    const response = await api.get(`${this.baseUrl}/provider/conversations?${params.toString()}`);
    return response.data;
  }

  async getProviderConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const response = await api.get(`${this.baseUrl}/provider/conversations/${id}`);
    return response.data;
  }

  async providerReply(conversationId: string, body: string): Promise<Message> {
    const response = await api.post(`${this.baseUrl}/provider/conversations/${conversationId}/reply`, { body });
    return response.data;
  }

  async closeConversation(conversationId: string): Promise<void> {
    await api.post(`${this.baseUrl}/provider/conversations/${conversationId}/close`);
  }
}

export const messagingService = new MessagingService();
export default messagingService;
