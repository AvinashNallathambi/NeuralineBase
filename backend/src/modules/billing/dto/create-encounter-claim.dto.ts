import { IsString, IsDate, IsEnum, IsNumber, IsOptional, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ClaimStatus } from '../entities/encounter-claim.entity';

export class CreateClaimLineItemDto {
  @IsString()
  codeType!: string;

  @IsString()
  code!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsArray()
  modifiers?: string[];

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  serviceDate?: Date;

  @IsOptional()
  @IsArray()
  diagnosisPointer?: string[];
}

export class CreateEncounterClaimDto {
  @IsUUID()
  tenantId!: string;

  @IsString()
  patientId!: string;

  @IsString()
  patientName!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsString()
  providerId!: string;

  @IsString()
  providerName!: string;

  @IsString()
  providerNPI!: string;

  @IsOptional()
  @IsUUID()
  insurancePayerId?: string;

  @IsOptional()
  @IsString()
  insurancePayerName?: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsString()
  groupNumber?: string;

  @IsDate()
  @Type(() => Date)
  serviceDate!: Date;

  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClaimLineItemDto)
  lineItems!: CreateClaimLineItemDto[];
}
