import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Immutable HIPAA audit log entity.
 *
 * Tracks every access, modification, or export of Protected Health
 * Information (PHI) as required by 45 CFR 164.312(b).
 *
 * Records in this table MUST NOT be updated or deleted.
 */
@Entity('hipaa_audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['resourceType', 'resourceId'])
@Index(['action'])
export class HipaaAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'user_email_hash', type: 'varchar', length: 64, nullable: true })
  userEmailHash!: string | null;

  @Column({ name: 'user_role', type: 'varchar', length: 50, nullable: true })
  userRole!: string | null;

  /** CREATE | READ | UPDATE | DELETE | EXPORT | LOGIN | LOGOUT | FAILED_LOGIN */
  @Column({ name: 'action', type: 'varchar', length: 50 })
  action!: string;

  /** e.g. Patient, Encounter, Prescription, LabOrder, Claim */
  @Column({ name: 'resource_type', type: 'varchar', length: 100, nullable: true })
  resourceType!: string | null;

  /** ID of the resource that was accessed/modified */
  @Column({ name: 'resource_id', type: 'varchar', length: 255, nullable: true })
  resourceId!: string | null;

  /** Human-readable summary (PHI-free) */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** HTTP method */
  @Column({ name: 'http_method', type: 'varchar', length: 10, nullable: true })
  httpMethod!: string | null;

  /** Request URL (query params stripped) */
  @Column({ name: 'endpoint', type: 'varchar', length: 500, nullable: true })
  endpoint!: string | null;

  /** HTTP status code */
  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode!: number | null;

  /** Client IP address */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  /** User-Agent header */
  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null;

  /** Correlation ID for request tracing */
  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId!: string | null;

  /** Duration of the request in ms */
  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  /** Additional metadata (PHI-free) */
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
