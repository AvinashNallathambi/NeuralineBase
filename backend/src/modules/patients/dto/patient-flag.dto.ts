import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PatientFlagSeverity,
  PatientFlagCategory,
} from '../entities/patient-flag.entity';

export class CreatePatientFlagDto {
  @ApiProperty({ example: 'risk_of_violence', description: 'Tenant-defined flag type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @ApiPropertyOptional({ enum: PatientFlagCategory, default: PatientFlagCategory.GENERAL })
  @IsEnum(PatientFlagCategory)
  @IsOptional()
  category?: PatientFlagCategory;

  @ApiPropertyOptional({ enum: PatientFlagSeverity, default: PatientFlagSeverity.WARNING })
  @IsEnum(PatientFlagSeverity)
  @IsOptional()
  severity?: PatientFlagSeverity;

  @ApiPropertyOptional({ default: false, description: 'Show as banner at top of chart' })
  @IsBoolean()
  @IsOptional()
  showAsBanner?: boolean;

  @ApiPropertyOptional({ description: 'Free-text note describing the flag' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdatePatientFlagDto {
  @ApiPropertyOptional({ enum: PatientFlagSeverity })
  @IsEnum(PatientFlagSeverity)
  @IsOptional()
  severity?: PatientFlagSeverity;

  @ApiPropertyOptional({ enum: PatientFlagCategory })
  @IsEnum(PatientFlagCategory)
  @IsOptional()
  category?: PatientFlagCategory;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  showAsBanner?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}

export class ResolvePatientFlagDto {
  @ApiProperty({ description: 'Reason the flag is being resolved (required for critical flags)' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  resolutionReason?: string;
}

export class AcknowledgePatientFlagDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userEmail?: string;
}

export class QueryPatientFlagDto {
  @ApiPropertyOptional({ enum: PatientFlagSeverity })
  @IsEnum(PatientFlagSeverity)
  @IsOptional()
  severity?: PatientFlagSeverity;

  @ApiPropertyOptional({ enum: PatientFlagCategory })
  @IsEnum(PatientFlagCategory)
  @IsOptional()
  category?: PatientFlagCategory;

  @ApiPropertyOptional({ enum: ['active', 'resolved'], default: 'active' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Filter banner-only flags' })
  @IsBoolean()
  @IsOptional()
  showAsBanner?: boolean;
}

// Re-export for convenience
export { PatientFlagSeverity, PatientFlagCategory };
