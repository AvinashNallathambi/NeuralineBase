import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('documentation_evidence')
@Index(['sessionId', 'noteSection'])
export class DocumentationEvidence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'note_section', type: 'varchar', length: 30 })
  noteSection!: 'subjective' | 'objective' | 'assessment' | 'plan';

  @Column({ name: 'note_text', type: 'text' })
  noteText!: string;

  @Column({ name: 'speaker_label', type: 'varchar', length: 50, nullable: true })
  speakerLabel!: string | null;

  @Column({ name: 'transcript_start_ms', type: 'int', nullable: true })
  transcriptStartMs!: number | null;

  @Column({ name: 'transcript_end_ms', type: 'int', nullable: true })
  transcriptEndMs!: number | null;

  @Column({ name: 'source_text', type: 'text' })
  sourceText!: string;

  @Column({ name: 'match_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  matchScore!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
