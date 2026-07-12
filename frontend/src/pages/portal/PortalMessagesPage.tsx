import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Typography,
  List,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Empty,
  Space,
  Avatar,
  Badge,
  Select,
} from 'antd';
import {
  MessageOutlined,
  PlusOutlined,
  SendOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import messagingService, { Conversation, Message } from '../../services/messagingService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const PortalMessagesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [newConvModalVisible, setNewConvModalVisible] = useState(false);
  const [form] = Form.useForm();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await messagingService.getConversations();
      setConversations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setLoadingMessages(true);
    try {
      const { messages: msgs } = await messagingService.getConversation(conv.id);
      setMessages(msgs);
      // Refresh conversation list to update unread counts
      loadConversations();
    } catch {
      message.error('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedConversation) return;
    setSending(true);
    try {
      const newMsg = await messagingService.reply(selectedConversation.id, replyText);
      setMessages([...messages, newMsg]);
      setReplyText('');
      loadConversations();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async () => {
    try {
      const values = await form.validateFields();
      setSending(true);
      const { conversation, message: msg } = await messagingService.startConversation({
        subject: values.subject,
        body: values.body,
        priority: values.priority || 'normal',
      });
      message.success('Message sent!');
      setNewConvModalVisible(false);
      form.resetFields();
      loadConversations();
      openConversation(conversation);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <MessageOutlined /> Messages
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewConvModalVisible(true)}>
          New Message
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
        {/* Conversation List */}
        <Card
          title="Inbox"
          style={{ width: 350, overflow: 'auto' }}
          bodyStyle={{ padding: 0 }}
        >
          {conversations.length ? (
            <List
              dataSource={conversations}
              renderItem={(conv) => (
                <List.Item
                  onClick={() => openConversation(conv)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 16px',
                    background: selectedConversation?.id === conv.id ? '#e6f7ff' : 'transparent',
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge count={conv.unreadByPatient} size="small">
                        <Avatar icon={<MessageOutlined />} style={{ backgroundColor: '#0D7C8A' }} />
                      </Badge>
                    }
                    title={
                      <Space>
                        <Text strong ellipsis style={{ maxWidth: 180 }}>{conv.subject}</Text>
                        {conv.priority === 'urgent' && <Tag color="red">Urgent</Tag>}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {conv.providerName || 'Awaiting response'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : new Date(conv.createdAt).toLocaleString()}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="No messages" style={{ padding: 40 }} />
          )}
        </Card>

        {/* Message Thread */}
        <Card
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}
          title={selectedConversation ? (
            <Space>
              <Text strong>{selectedConversation.subject}</Text>
              <Tag color={selectedConversation.status === 'open' ? 'green' : 'default'}>
                {selectedConversation.status}
              </Tag>
            </Space>
          ) : 'Select a conversation'}
        >
          {!selectedConversation ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="Select a conversation to view messages" />
            </div>
          ) : loadingMessages ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin />
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: 16,
                      display: 'flex',
                      flexDirection: msg.senderType === 'patient' ? 'row-reverse' : 'row',
                      gap: 8,
                    }}
                  >
                    <Avatar
                      size="small"
                      icon={<UserOutlined />}
                      style={{
                        backgroundColor: msg.senderType === 'patient' ? '#0D7C8A' : '#52c41a',
                      }}
                    />
                    <div
                      style={{
                        maxWidth: '70%',
                        background: msg.senderType === 'patient' ? '#e6f7ff' : '#f5f5f5',
                        borderRadius: 12,
                        padding: '10px 14px',
                      }}
                    >
                      <div style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 12 }}>{msg.senderName}</Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                          {new Date(msg.createdAt).toLocaleString()}
                        </Text>
                      </div>
                      <Paragraph style={{ margin: 0 }}>{msg.body}</Paragraph>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {selectedConversation.status === 'open' ? (
                <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                  <TextArea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    onPressEnter={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={sending}
                    onClick={handleReply}
                    disabled={!replyText.trim()}
                  >
                    Send
                  </Button>
                </div>
              ) : (
                <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                  <Text type="secondary">This conversation is closed</Text>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Modal
        title="New Message"
        open={newConvModalVisible}
        onCancel={() => { setNewConvModalVisible(false); form.resetFields(); }}
        onOk={handleStartConversation}
        confirmLoading={sending}
        okText="Send Message"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label="Subject" rules={[{ required: true, message: 'Please enter a subject' }]}>
            <Input placeholder="What is this about?" />
          </Form.Item>
          <Form.Item name="priority" label="Priority">
            <Select defaultValue="normal">
              <Select.Option value="normal">Normal</Select.Option>
              <Select.Option value="urgent">Urgent</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="body" label="Message" rules={[{ required: true, message: 'Please enter your message' }]}>
            <TextArea rows={5} placeholder="Type your message to your care team..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalMessagesPage;
