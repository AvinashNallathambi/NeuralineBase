import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

@Entity('portal_conversations')
@Index(['tenantId'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'providerId'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 255 })
  patientName!: string;

  @Column({ name: 'provider_id', type: 'uuid', nullable: true })
  providerId!: string | null;

  @Column({ name: 'provider_name', type: 'varchar', length: 255, nullable: true })
  providerName!: string | null;

  @Column({ name: 'subject', type: 'varchar', length: 255 })
  subject!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'open' })
  status!: string; // open, closed, archived

  @Column({ name: 'priority', type: 'varchar', length: 20, default: 'normal' })
  priority!: string; // normal, urgent

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @Column({ name: 'unread_by_patient', type: 'int', default: 0 })
  unreadByPatient!: number;

  @Column({ name: 'unread_by_provider', type: 'int', default: 0 })
  unreadByProvider!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('Message', 'conversation')
  messages!: unknown[];
}
