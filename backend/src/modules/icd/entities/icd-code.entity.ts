import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('icd_codes')
export class IcdCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 20 })
  code!: string;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({ name: 'category', type: 'varchar', length: 10, nullable: true })
  category!: string | null;

  @Column({ name: 'chapter', type: 'int', nullable: true })
  chapter!: number | null;

  @Column({ name: 'chapter_title', type: 'varchar', length: 255, nullable: true })
  chapterTitle!: string | null;

  @Column({ name: 'is_billable', type: 'boolean', default: false })
  isBillable!: boolean;

  @Column({ name: 'is_header', type: 'boolean', default: false })
  isHeader!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
