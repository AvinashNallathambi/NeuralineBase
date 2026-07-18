import {
  IsString,
  IsDate,
  IsEnum,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsObject,
  Min,
  IsBoolean,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SuperbillStatus } from '../entities/superbill.entity';
import { DiagnosisType } from '../entities/superbill-diagnosis.entity';
import { ChargeType } from '../entities/superbill-charge.entity';

export class CreateSuperbillInsuranceDto {
  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsString()
  @IsNotEmpty()
  policyNumber: string;

  @IsString()
  @IsNotEmpty()
  groupNumber: string;

  @IsString()
  @IsNotEmpty()
  subscriberName: string;

  @IsString()
  @IsNotEmpty()
  subscriberRelation: string;

  @IsString()
  @IsNotEmpty()
  payerId: string;

  @IsString()
  @IsOptional()
  authorizationNumber?: string;
}

export class CreateSuperbillDiagnosisDto {
  @IsString()
  @IsNotEmpty()
  icdCode: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(DiagnosisType)
  @IsOptional()
  type?: DiagnosisType;
}

export class CreateSuperbillProcedureDto {
  @IsString()
  @IsNotEmpty()
  cptCode: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modifiers?: string[];

  @IsNumber()
  @Min(1)
  @Max(99)
  units: number;

  @IsNumber()
  @Min(0)
  charge: number;

  @IsDate()
  @Type(() => Date)
  serviceDate: Date;

  @IsArray()
  @IsString({ each: true })
  diagnosisPointer: string[];
}

export class CreateSuperbillChargeDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(ChargeType)
  @IsOptional()
  type?: ChargeType;

  @IsBoolean()
  @IsOptional()
  taxable?: boolean;
}

export class SuperbillAddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

export class CreateSuperbillDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  patientName: string;

  @IsString()
  @IsNotEmpty()
  patientDOB: string;

  @ValidateNested()
  @Type(() => SuperbillAddressDto)
  patientAddress: SuperbillAddressDto;

  @IsString()
  @IsNotEmpty()
  patientPhone: string;

  @IsString()
  @IsNotEmpty()
  providerId: string;

  @IsString()
  @IsNotEmpty()
  providerName: string;

  @IsString()
  @IsNotEmpty()
  providerNPI: string;

  @ValidateNested()
  @Type(() => SuperbillAddressDto)
  providerAddress: SuperbillAddressDto;

  @IsString()
  @IsOptional()
  encounterId?: string;

  @IsDate()
  @Type(() => Date)
  serviceDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  submissionDate?: Date;

  @IsEnum(SuperbillStatus)
  @IsOptional()
  status?: SuperbillStatus;

  @ValidateNested()
  insurance: CreateSuperbillInsuranceDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSuperbillDiagnosisDto)
  diagnoses: CreateSuperbillDiagnosisDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSuperbillProcedureDto)
  procedures: CreateSuperbillProcedureDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSuperbillChargeDto)
  charges: CreateSuperbillChargeDto[];

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsNumber()
  @Min(0)
  patientResponsibility: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  insurancePayment?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  posCode?: string;

  @IsString()
  @IsOptional()
  facilityName?: string;

  @IsString()
  @IsOptional()
  facilityNPI?: string;

  @IsString()
  @IsOptional()
  providerTaxId?: string;

  @IsString()
  @IsOptional()
  feeSchedule?: string;

  @IsString()
  @IsOptional()
  referralNumber?: string;

  @IsString()
  @IsOptional()
  claimFrequency?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  admissionDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dischargeDate?: Date;

  @IsBoolean()
  @IsOptional()
  isEmploymentRelated?: boolean;

  @IsBoolean()
  @IsOptional()
  isAutoAccident?: boolean;

  @IsBoolean()
  @IsOptional()
  isOtherAccident?: boolean;
}
