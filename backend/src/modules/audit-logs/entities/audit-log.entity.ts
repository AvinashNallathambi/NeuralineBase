import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SUBMIT = 'submit',
  RESUBMIT = 'resubmit',
  VOID = 'void',
  CORRECTED = 'corrected',
  PAYMENT = 'payment',
  ADJUSTMENT = 'adjustment',
  VIEW = 'view',
}

@Entity('audit_logs')
@Index(['tenantId', 'entityType'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'performedBy'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  @Index()
  tenantId: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @Column({ type: 'varchar', nullable: true })
  performedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  performedByName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  // ── HTTP request context (populated by AuditInterceptor) ──────────────
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
