import {
  IsUUID,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  IsObject,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InsurancePriority, InsuranceRelation } from '../entities/patient-insurance.entity';

export class CreatePatientInsuranceDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  insurancePayerId!: string;

  @IsEnum(InsurancePriority)
  @IsOptional()
  priority?: InsurancePriority;

  @IsString()
  @IsNotEmpty()
  policyNumber!: string;

  @IsString()
  @IsOptional()
  groupNumber?: string;

  @IsString()
  @IsNotEmpty()
  subscriberName!: string;

  @IsEnum(InsuranceRelation)
  @IsOptional()
  subscriberRelation?: InsuranceRelation;

  @IsDateString()
  @IsOptional()
  subscriberDob?: string;

  @IsString()
  @IsOptional()
  subscriberSsn?: string;

  @IsString()
  @IsOptional()
  authorizationNumber?: string;

  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  copayAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deductibleAmount?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  coinsurancePercentage?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
