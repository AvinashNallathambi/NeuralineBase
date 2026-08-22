import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GfeType, DeliveryMethod } from '../entities/good-faith-estimate.entity';

export class CreateGfeItemDto {
  @IsString()
  service!: string;

  @IsString()
  cptCode!: string;

  @IsNumber()
  charge!: number;

  @IsNumber()
  insuranceEstimate!: number;

  @IsNumber()
  patientEstimate!: number;
}

export class CreateGfeDto {
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @IsString()
  patientName!: string;

  @IsString()
  @IsOptional()
  superbillId?: string;

  @IsString()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  providerName?: string;

  @IsEnum(GfeType)
  gfeType!: GfeType;

  @IsDateString()
  serviceDate!: string;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsNumber()
  totalCharge!: number;

  @IsNumber()
  insuranceEstimate!: number;

  @IsNumber()
  patientEstimate!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGfeItemDto)
  items!: CreateGfeItemDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  disclaimers?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  complianceNotes?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class GenerateGfeFromSuperbillDto {
  @IsString()
  @IsNotEmpty()
  superbillId!: string;

  @IsEnum(GfeType)
  @IsOptional()
  gfeType?: GfeType;

  @IsString()
  @IsOptional()
  patientNotes?: string;
}

export class DeliverGfeDto {
  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsString()
  @IsOptional()
  deliveredBy?: string;
}

export class AcknowledgeGfeDto {
  @IsString()
  @IsOptional()
  acknowledgedBy?: string;
}

export class UpdateGfeDto {
  @IsNumber()
  @IsOptional()
  totalCharge?: number;

  @IsNumber()
  @IsOptional()
  insuranceEstimate?: number;

  @IsNumber()
  @IsOptional()
  patientEstimate?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGfeItemDto)
  @IsOptional()
  items?: CreateGfeItemDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  disclaimers?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  complianceNotes?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateIdrCaseDto {
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @IsString()
  @IsOptional()
  patientName?: string;

  @IsString()
  @IsOptional()
  claimId?: string;

  @IsString()
  @IsOptional()
  gfeId?: string;

  @IsString()
  @IsOptional()
  varianceRecordId?: string;

  @IsString()
  @IsOptional()
  payerName?: string;

  @IsNumber()
  @IsOptional()
  billedAmount?: number;

  @IsString()
  @IsOptional()
  encounterNotes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cptCodes?: string[];
}

export class UpdateIdrCaseDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  qpaAmount?: number;

  @IsNumber()
  @IsOptional()
  initialOffer?: number;

  @IsNumber()
  @IsOptional()
  finalOffer?: number;

  @IsNumber()
  @IsOptional()
  determinedAmount?: number;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}
