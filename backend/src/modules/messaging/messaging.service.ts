import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  // ─── Patient endpoints ──────────────────────────────────────────

  async getPatientConversations(patientId: string): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: { patientId },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getPatientConversation(patientId: string, conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, patientId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    return { conversation, messages };
  }

  async startConversation(
    tenantId: string,
    patientId: string,
    patientName: string,
    data: { subject: string; body: string; priority?: string; providerId?: string },
  ): Promise<{ conversation: Conversation; message: Message }> {
    const conversation = this.conversationRepository.create({
      tenantId,
      patientId,
      patientName,
      subject: data.subject,
      priority: data.priority || 'normal',
      providerId: data.providerId || null,
      providerName: null,
      status: 'open',
      lastMessageAt: new Date(),
      unreadByPatient: 0,
      unreadByProvider: 1,
    });

    const saved = await this.conversationRepository.save(conversation);

    const message = this.messageRepository.create({
      tenantId,
      conversationId: saved.id,
      senderId: patientId,
      senderType: 'patient',
      senderName: patientName,
      body: data.body,
      isRead: false,
    });

    await this.messageRepository.save(message);

    this.logger.log(`Patient ${patientId} started conversation ${saved.id}`);

    return { conversation: saved, message };
  }

  async patientReply(
    tenantId: string,
    patientId: string,
    patientName: string,
    conversationId: string,
    body: string,
  ): Promise<Message> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, patientId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.status === 'closed') {
      throw new ForbiddenException('This conversation is closed');
    }

    const message = this.messageRepository.create({
      tenantId,
      conversationId,
      senderId: patientId,
      senderType: 'patient',
      senderName: patientName,
      body,
      isRead: false,
    });

    const saved = await this.messageRepository.save(message);

    await this.conversationRepository.update(conversationId, {
      lastMessageAt: new Date(),
      unreadByProvider: () => 'unread_by_provider + 1',
    });

    return saved;
  }

  async markConversationReadByPatient(patientId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, patientId },
    });

    if (!conversation) return;

    await this.conversationRepository.update(conversationId, { unreadByPatient: 0 });
    await this.messageRepository
      .createQueryBuilder()
      .update()
      .set({ isRead: true, readAt: new Date() })
      .where('conversationId = :conversationId AND senderType != :senderType', {
        conversationId,
        senderType: 'patient',
      })
      .execute();
  }

  // ─── Provider endpoints ─────────────────────────────────────────

  async getProviderConversations(tenantId: string, providerId?: string): Promise<Conversation[]> {
    const where: any = { tenantId };
    if (providerId) where.providerId = providerId;

    return this.conversationRepository.find({
      where,
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getProviderConversation(tenantId: string, conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    return { conversation, messages };
  }

  async providerReply(
    tenantId: string,
    providerId: string,
    providerName: string,
    conversationId: string,
    body: string,
  ): Promise<Message> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Update provider info if not set
    if (!conversation.providerId) {
      await this.conversationRepository.update(conversationId, {
        providerId,
        providerName,
      });
    }

    const message = this.messageRepository.create({
      tenantId,
      conversationId,
      senderId: providerId,
      senderType: 'provider',
      senderName: providerName,
      body,
      isRead: false,
    });

    const saved = await this.messageRepository.save(message);

    await this.conversationRepository.update(conversationId, {
      lastMessageAt: new Date(),
      unreadByPatient: () => 'unread_by_patient + 1',
    });

    return saved;
  }

  async markConversationReadByProvider(tenantId: string, conversationId: string): Promise<void> {
    await this.conversationRepository.update({ id: conversationId, tenantId }, { unreadByProvider: 0 });
    await this.messageRepository
      .createQueryBuilder()
      .update()
      .set({ isRead: true, readAt: new Date() })
      .where('conversationId = :conversationId AND senderType = :senderType', {
        conversationId,
        senderType: 'patient',
      })
      .execute();
  }

  async closeConversation(tenantId: string, conversationId: string): Promise<void> {
    await this.conversationRepository.update({ id: conversationId, tenantId }, { status: 'closed' });
  }

  async getUnreadCount(patientId: string): Promise<number> {
    const result = await this.conversationRepository
      .createQueryBuilder('c')
      .select('SUM(c.unreadByPatient)', 'total')
      .where('c.patientId = :patientId', { patientId })
      .getRawOne();

    return Number(result?.total || 0);
  }
}
