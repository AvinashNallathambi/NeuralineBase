import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('portal_messages')
@Index(['tenantId'])
@Index(['conversationId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ name: 'sender_type', type: 'varchar', length: 20 })
  senderType!: string; // patient, provider, system

  @Column({ name: 'sender_name', type: 'varchar', length: 255 })
  senderName!: string;

  @Column({ name: 'body', type: 'text' })
  body!: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'attachments', type: 'jsonb', nullable: true })
  attachments!: { name: string; url: string; size: number; type: string }[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('Conversation', 'messages')
  @JoinColumn({ name: 'conversation_id' })
  conversation!: unknown;
}
