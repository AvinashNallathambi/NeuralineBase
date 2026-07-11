import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CoverageSummaryDto {
  @ApiProperty({ description: 'Verification UUID' })
  id!: string;

  @ApiProperty({ description: 'Patient UUID' })
  patientId!: string;

  @ApiPropertyOptional({ description: 'Appointment UUID' })
  appointmentId?: string | null;

  @ApiProperty({ description: 'Overall verification status' })
  status!: string;

  @ApiProperty({ description: 'Coverage status' })
  coverageStatus!: string;

  @ApiPropertyOptional({ description: 'Payer name' })
  payerName?: string | null;

  @ApiPropertyOptional({ description: 'Provider name' })
  providerName?: string | null;

  @ApiPropertyOptional({ description: 'Policy number' })
  policyNumber?: string | null;

  @ApiPropertyOptional({ description: 'Group number' })
  groupNumber?: string | null;

  @ApiPropertyOptional({ description: 'Plan name' })
  planName?: string | null;

  @ApiPropertyOptional({ description: 'Plan type (HMO, PPO, POS, EPO, Medicare)' })
  planType?: string | null;

  @ApiPropertyOptional({ description: 'Network status (In-Network, Out-of-Network, Participating)' })
  network?: string | null;

  @ApiPropertyOptional({ description: 'Subscriber name' })
  subscriberName?: string | null;

  @ApiPropertyOptional({ description: 'Subscriber relation to patient' })
  subscriberRelation?: string | null;

  @ApiPropertyOptional({ description: 'Patient name (denormalized)' })
  patientName?: string | null;

  @ApiPropertyOptional({ description: 'Coverage effective date' })
  effectiveDate?: string | null;

  @ApiPropertyOptional({ description: 'Coverage expiration date' })
  expirationDate?: string | null;

  @ApiPropertyOptional({ description: 'Individual deductible' })
  deductibleIndividual?: number | null;

  @ApiPropertyOptional({ description: 'Family deductible' })
  deductibleFamily?: number | null;

  @ApiPropertyOptional({ description: 'Remaining deductible' })
  deductibleRemaining?: number | null;

  @ApiPropertyOptional({ description: 'Individual out-of-pocket maximum' })
  outOfPocketIndividual?: number | null;

  @ApiPropertyOptional({ description: 'Family out-of-pocket maximum' })
  outOfPocketFamily?: number | null;

  @ApiPropertyOptional({ description: 'Remaining out-of-pocket' })
  outOfPocketRemaining?: number | null;

  @ApiPropertyOptional({ description: 'Copay amount' })
  copayAmount?: number | null;

  @ApiPropertyOptional({ description: 'Coinsurance percentage' })
  coinsurancePercentage?: number | null;

  @ApiProperty({ description: 'Prior authorization required' })
  authorizationRequired!: boolean;

  @ApiProperty({ description: 'Referral required' })
  referralRequired!: boolean;

  @ApiPropertyOptional({ description: 'Benefit limitations' })
  benefitLimitations?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Structured coverage benefits' })
  benefits?: Record<string, unknown>[] | null;

  @ApiPropertyOptional({ description: 'Last verification timestamp' })
  verifiedAt?: string | null;

  @ApiPropertyOptional({ description: 'Verifier name' })
  verifiedByName?: string | null;

  @ApiPropertyOptional({ description: 'Error code' })
  errorCode?: string | null;

  @ApiPropertyOptional({ description: 'Error message' })
  errorMessage?: string | null;
}
