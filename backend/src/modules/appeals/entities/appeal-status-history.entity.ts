import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Appeal, AppealStatus } from './appeal.entity';

@Entity('appeal_status_history')
export class AppealStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'appeal_id', type: 'uuid' })
  @ManyToOne('Appeal', 'statusHistory', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appeal_id' })
  appeal!: Appeal;

  @Column({ type: 'enum', enum: AppealStatus })
  status!: AppealStatus;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy!: string | null;

  @Column({ name: 'changed_by_name', type: 'varchar', length: 255, nullable: true })
  changedByName!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
