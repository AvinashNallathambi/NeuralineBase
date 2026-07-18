import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum PatientGroupType {
  MANUAL = 'manual',
  DYNAMIC = 'dynamic',
  SMART = 'smart',
}

export enum PatientGroupCategory {
  CHRONIC_DISEASE = 'chronic_disease',
  PREVENTIVE_CARE = 'preventive_care',
  RISK_STRATIFICATION = 'risk_stratification',
  INSURANCE = 'insurance',
  DEMOGRAPHIC = 'demographic',
  APPOINTMENT = 'appointment',
  BILLING = 'billing',
  CARE_MANAGEMENT = 'care_management',
  REFERRAL = 'referral',
  BEHAVIORAL_HEALTH = 'behavioral_health',
  PEDIATRIC = 'pediatric',
  TELEHEALTH = 'telehealth',
  VIP = 'vip',
  CUSTOM = 'custom',
}

export type RuleFieldType =
  | 'age'
  | 'gender'
  | 'diagnosis'
  | 'insurance'
  | 'provider'
  | 'location'
  | 'last_visit'
  | 'next_appointment'
  | 'outstanding_balance'
  | 'risk_score'
  | 'lab_value'
  | 'medication'
  | 'allergy'
  | 'encounter_count'
  | 'status'
  | 'custom_field';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'between'
  | 'is_null'
  | 'is_not_null'
  | 'before'
  | 'after'
  | 'within_last'
  | 'within_next'
  | 'older_than_days';

export interface GroupRule {
  field: RuleFieldType;
  operator: RuleOperator;
  value?: string | number | boolean | Array<string | number>;
  valueTo?: string | number;
  unit?: 'days' | 'weeks' | 'months' | 'years';
}

export interface GroupRuleSet {
  combinator: 'AND' | 'OR';
  rules: GroupRule[];
}

@Entity('patient_groups')
@Index(['tenantId', 'name'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'category'])
@Index(['tenantId', 'status'])
export class PatientGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'type',
    type: 'varchar',
    length: 20,
    default: PatientGroupType.MANUAL,
  })
  type!: PatientGroupType;

  @Column({
    name: 'category',
    type: 'varchar',
    length: 40,
    default: PatientGroupCategory.CUSTOM,
  })
  category!: PatientGroupCategory;

  @Column({ name: 'color', type: 'varchar', length: 20, nullable: true })
  color!: string | null;

  @Column({ name: 'icon', type: 'varchar', length: 50, nullable: true })
  icon!: string | null;

  @Column({ name: 'tags', type: 'jsonb', nullable: true })
  tags!: string[] | null;

  @Column({ name: 'rules', type: 'jsonb', nullable: true })
  rules!: GroupRuleSet | null;

  @Column({ name: 'member_ids', type: 'jsonb', nullable: true })
  memberIds!: string[] | null;

  @Column({ name: 'member_count', type: 'int', default: 0 })
  memberCount!: number;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status!: string;

  @Column({ name: 'is_shared', type: 'boolean', default: true })
  isShared!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @Column({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true })
  lastRefreshedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}

@Entity('patient_group_audit_logs')
@Index(['tenantId', 'groupId'])
@Index(['tenantId', 'action'])
@Index(['tenantId', 'createdAt'])
export class PatientGroupAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'action', type: 'varchar', length: 50 })
  action!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true })
  userEmail!: string | null;

  @Column({ name: 'user_role', type: 'varchar', length: 50, nullable: true })
  userRole!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
