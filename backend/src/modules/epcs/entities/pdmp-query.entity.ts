import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('epcs_pdmp_queries')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'providerId'])
@Index(['tenantId', 'createdAt'])
export class PdmpQuery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 100 })
  patientId!: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 200 })
  patientName!: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ name: 'provider_name', type: 'varchar', length: 200 })
  providerName!: string;

  // ── Query Details ──────────────────────────────────────────────────────
  @Column({ name: 'state', type: 'varchar', length: 2 })
  state!: string;

  @Column({ name: 'query_status', type: 'varchar', length: 20, default: 'pending' })
  queryStatus!: string; // pending | success | error | no_data

  @Column({ name: 'query_id', type: 'varchar', length: 100, nullable: true })
  queryId!: string | null; // External PDMP query reference

  // ── Results ────────────────────────────────────────────────────────────
  /** Number of controlled substance prescriptions in patient's history */
  @Column({ name: 'cs_prescription_count', type: 'int', default: 0 })
  csPrescriptionCount!: number;

  /** Number of unique prescribers */
  @Column({ name: 'prescriber_count', type: 'int', default: 0 })
  prescriberCount!: number;

  /** Number of unique pharmacies */
  @Column({ name: 'pharmacy_count', type: 'int', default: 0 })
  pharmacyCount!: number;

  /** Total MME/day across all prescriptions */
  @Column({ name: 'total_mme', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalMme!: number;

  /** Number of early refills detected */
  @Column({ name: 'early_refill_count', type: 'int', default: 0 })
  earlyRefillCount!: number;

  /** Risk level: low | moderate | high | critical */
  @Column({ name: 'risk_level', type: 'varchar', length: 20, nullable: true })
  riskLevel!: string | null;

  /** Risk score 0-100 */
  @Column({ name: 'risk_score', type: 'int', default: 0 })
  riskScore!: number;

  /** Raw PDMP response (JSON) */
  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  /** AI-generated plain-language summary */
  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary!: string | null;

  /** Detected red flags (array of flag descriptions) */
  @Column({ name: 'red_flags', type: 'jsonb', nullable: true })
  redFlags!: string[] | null;

  /** Recommended actions */
  @Column({ name: 'recommendations', type: 'jsonb', nullable: true })
  recommendations!: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
