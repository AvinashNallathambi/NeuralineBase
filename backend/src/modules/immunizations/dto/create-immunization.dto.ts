import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsDateString,
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateImmunizationDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ example: 'Influenza, quadrivalent' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  vaccineName!: string;

  @ApiPropertyOptional({ example: '141', description: 'CVX code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  cvxCode?: string;

  @ApiPropertyOptional({ example: '90686', description: 'CPT code for billing' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  cptCode?: string;

  @ApiPropertyOptional({ example: '00006-4047-70', description: 'NDC code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  ndcCode?: string;

  @ApiPropertyOptional({ example: 'Sanofi Pasteur' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'U12345' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lotNumber?: string;

  @ApiPropertyOptional({ description: 'Expiration date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @ApiProperty({ description: 'Date administered (ISO 8601)' })
  @IsDateString()
  @IsNotEmpty()
  administeredDate!: string;

  @ApiPropertyOptional({ example: 1, description: 'Dose number in the series' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  doseNumber?: number;

  @ApiPropertyOptional({ example: '0.5' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  doseAmount?: string;

  @ApiPropertyOptional({ example: 'mL' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  doseUnit?: string;

  @ApiPropertyOptional({ example: 'intramuscular', description: 'Route of administration' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  route?: string;

  @ApiPropertyOptional({ example: 'left arm', description: 'Anatomical site' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  site?: string;

  @ApiPropertyOptional({ enum: ['completed', 'entered-in-error', 'not-done'], default: 'completed' })
  @IsString()
  @IsOptional()
  @IsEnum(['completed', 'entered-in-error', 'not-done'] as const)
  status?: string;

  @ApiPropertyOptional({
    enum: ['administered', 'historical', 'registry', 'patient_reported'],
    default: 'administered',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['administered', 'historical', 'registry', 'patient_reported'] as const)
  source?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  providerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(200)
  providerName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  facilityName?: string;

  @ApiPropertyOptional({ description: 'VIS edition date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  visDate?: string;

  @ApiPropertyOptional({ description: 'VFC eligibility category' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  vfcEligibility?: string;

  @ApiPropertyOptional({ description: 'Funding source' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  fundingSource?: string;

  @ApiPropertyOptional({ description: 'Adverse reaction notes' })
  @IsString()
  @IsOptional()
  reactionNotes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
