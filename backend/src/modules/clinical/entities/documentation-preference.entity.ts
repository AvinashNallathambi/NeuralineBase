import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('documentation_preferences')
@Index(['tenantId', 'providerId'], { unique: true })
export class DocumentationPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId!: string;

  @Column({ name: 'preferred_language', type: 'varchar', length: 20, default: 'en' })
  preferredLanguage!: string;

  @Column({ name: 'note_style', type: 'varchar', length: 30, default: 'concise' })
  noteStyle!: 'concise' | 'detailed' | 'bullet';

  @Column({ name: 'required_sections', type: 'jsonb', default: [] })
  requiredSections!: string[];

  @Column({ name: 'do_not_infer', type: 'jsonb', default: [] })
  doNotInfer!: string[];

  @Column({ name: 'custom_instructions', type: 'text', nullable: true })
  customInstructions!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
