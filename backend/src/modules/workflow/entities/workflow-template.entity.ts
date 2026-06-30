import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';

export interface WorkflowStepConfig {
  name: string;
  label: string;
  order: number;
  color: string;
  icon: string;
  allowedTransitions: string[];
  requiredFields?: string[];
  assignableRoles?: string[];
}

export interface WorkflowTransition {
  fromStep: string;
  toStep: string;
  label: string;
  requireConfirmation?: boolean;
  requireNote?: boolean;
}

@Entity('workflow_templates')
export class WorkflowTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'entity_type', length: 100 })
  @Index()
  entityType!: string;

  @Column({ type: 'jsonb' })
  steps!: WorkflowStepConfig[];

  @Column({ type: 'jsonb', nullable: true })
  transitions?: WorkflowTransition[];

  @Column({ default: 1 })
  version!: number;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => WorkflowInstance, (instance) => instance.template)
  instances?: WorkflowInstance[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
