import { ValueTransformer } from 'typeorm';

/**
 * TypeORM transformer that converts PostgreSQL `decimal`/`numeric` columns
 * (which the `pg` driver returns as strings) to JavaScript `number` values.
 *
 * Usage:
 *   @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
 *   amount!: number;
 */
export const DecimalTransformer: ValueTransformer = {
  to(value: number | null | undefined): string | number | null {
    if (value === null || value === undefined) return null;
    return value;
  },
  from(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isNaN(num) ? null : num;
  },
};
