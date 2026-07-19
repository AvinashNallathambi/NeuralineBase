import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export type IntegrationStatus = 'disconnected' | 'connected' | 'error' | 'pending';

export type IntegrationCategory =
  | 'clinical'
  | 'calendar'
  | 'communication'
  | 'video'
  | 'billing'
  | 'lab'
  | 'pharmacy'
  | 'ehr'
  | 'ai'
  | 'patient_engagement'
  | 'analytics';

@Entity('integrations')
@Index(['tenantId', 'key'], { unique: true })
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 50 })
  key!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider!: string | null;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  icon!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'disconnected' })
  status!: IntegrationStatus;

  @Column({ name: 'category', type: 'varchar', length: 50, nullable: true })
  category!: IntegrationCategory | null;

  @Column({ name: 'last_connected_at', type: 'timestamptz', nullable: true })
  lastConnectedAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  config!: Record<string, unknown> | null;

  /** Encrypted credentials (OAuth tokens, API keys, etc.) — never sent to frontend */
  @Column({ type: 'jsonb', nullable: true })
  credentials!: Record<string, unknown> | null;

  /** Whether this integration requires an OAuth flow (vs. simple API key) */
  @Column({ name: 'requires_oauth', type: 'boolean', default: false })
  requiresOAuth!: boolean;

  /** Whether this integration is configurable via the UI */
  @Column({ name: 'configurable', type: 'boolean', default: false })
  configurable!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
