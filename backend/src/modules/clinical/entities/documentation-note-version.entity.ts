import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentationSoapNote } from './documentation-session.entity';

export enum DocumentationNoteVersionSource {
  AI_GENERATED = 'ai_generated',
  CLINICIAN_EDITED = 'clinician_edited',
  SIGNED = 'signed',
}

@Entity('documentation_note_versions')
@Index(['sessionId', 'versionNumber'], { unique: true })
export class DocumentationNoteVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  @Index()
  sessionId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ type: 'enum', enum: DocumentationNoteVersionSource })
  source!: DocumentationNoteVersionSource;

  @Column({ name: 'soap_note', type: 'jsonb' })
  soapNote!: DocumentationSoapNote;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'ai_model', type: 'varchar', length: 255, nullable: true })
  aiModel!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
