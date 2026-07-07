import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DiagnosisCodingSystem,
  ProblemClinicalStatus,
  ProblemPriority,
  ProblemVerificationStatus,
} from '../entities/patient-problem.entity';

export class CreatePatientProblemDto {
  @ApiProperty({ example: 'J06.9' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ enum: DiagnosisCodingSystem, default: DiagnosisCodingSystem.ICD_10_CM })
  @IsEnum(DiagnosisCodingSystem)
  @IsOptional()
  codeSystem?: DiagnosisCodingSystem;

  @ApiProperty({ example: 'Acute upper respiratory infection, unspecified' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ enum: ProblemClinicalStatus, default: ProblemClinicalStatus.ACTIVE })
  @IsEnum(ProblemClinicalStatus)
  @IsOptional()
  clinicalStatus?: ProblemClinicalStatus;

  @ApiPropertyOptional({ enum: ProblemVerificationStatus, default: ProblemVerificationStatus.CONFIRMED })
  @IsEnum(ProblemVerificationStatus)
  @IsOptional()
  verificationStatus?: ProblemVerificationStatus;

  @ApiPropertyOptional({ enum: ProblemPriority })
  @IsEnum(ProblemPriority)
  @IsOptional()
  priority?: ProblemPriority;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isChronic?: boolean;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  onsetDate?: string;

  @ApiPropertyOptional({ example: '2024-02-01' })
  @IsDateString()
  @IsOptional()
  resolutionDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
