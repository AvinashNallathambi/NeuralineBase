import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkflowTemplate } from './workflow-template.entity';

export interface WorkflowTransitionLog {
  fromStep: string;
  toStep: string;
  timestamp: string;
  userId: string;
  userName: string;
  note?: string;
}

@Entity('workflow_instances')
@Index(['tenantId', 'entityType', 'entityId'], { unique: true })
export class WorkflowInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'entity_type', length: 100 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'current_step', length: 255 })
  currentStep!: string;

  @Column({ type: 'jsonb', default: [] })
  history!: WorkflowTransitionLog[];

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ length: 50, default: 'active' })
  status!: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

  @ManyToOne(() => WorkflowTemplate, (template) => template.instances)
  @JoinColumn({ name: 'template_id' })
  template!: WorkflowTemplate;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
