import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsInt,
  Min,
  IsObject,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClinicalTemplateStatus } from '../entities/clinical-template.entity';

class SoapTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plan?: string;
}

class VitalsTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heartRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  temperature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  temperatureRoute?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weight?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weightUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  height?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heightUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bmi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oxygenSaturation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  respiratoryRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  painScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  painLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodGlucose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodGlucoseContext?: string;
}

class DiagnosisTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty()
  @IsBoolean()
  isPrimary!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: 'chronic' | 'acute' | 'rule_out';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: 'active' | 'resolved' | 'ruled_out';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class MedicationTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dosage!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  frequency!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  refills?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;
}

class ProcedureTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cptCode?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;
}

class OrderLabDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loincCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: 'routine' | 'stat' | 'asap';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class OrderImagingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyPart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: 'routine' | 'stat' | 'asap';
}

class OrderReferralDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  specialty!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  urgency?: 'routine' | 'urgent' | 'emergent';
}

class OrdersTemplateDto {
  @ApiPropertyOptional({ type: [OrderLabDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLabDto)
  labs?: OrderLabDto[];

  @ApiPropertyOptional({ type: [OrderImagingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderImagingDto)
  imaging?: OrderImagingDto[];

  @ApiPropertyOptional({ type: [OrderReferralDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderReferralDto)
  referrals?: OrderReferralDto[];

  @ApiPropertyOptional({ type: [ProcedureTemplateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcedureTemplateDto)
  procedures?: ProcedureTemplateDto[];
}

class TreatmentPlanTemplateDto {
  @ApiPropertyOptional({ type: [MedicationTemplateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationTemplateDto)
  medications?: MedicationTemplateDto[];

  @ApiPropertyOptional({ type: [ProcedureTemplateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcedureTemplateDto)
  procedures?: ProcedureTemplateDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  followUp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  followUpProviderName?: string;

  @ApiPropertyOptional({ type: [OrderReferralDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderReferralDto)
  referrals?: OrderReferralDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interventions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  homeInstructions?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patientEducation?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restrictions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recallReminder?: string;
}

class BillingCodeDto {
  @ApiProperty()
  @IsEnum(['CPT', 'ICD10', 'HCPCS', 'SNOMED'])
  codeType!: 'CPT' | 'ICD10' | 'HCPCS' | 'SNOMED';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateClinicalTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  specialty!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  visitType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'FileTextOutlined' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional({ enum: ClinicalTemplateStatus, default: ClinicalTemplateStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ClinicalTemplateStatus)
  status?: ClinicalTemplateStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({ type: SoapTemplateDto })
  @IsOptional()
  @IsObject()
  soapTemplate?: SoapTemplateDto;

  @ApiPropertyOptional({ type: VitalsTemplateDto })
  @IsOptional()
  @IsObject()
  vitalsTemplate?: VitalsTemplateDto;

  @ApiPropertyOptional({ type: [DiagnosisTemplateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisTemplateDto)
  diagnosisTemplate?: DiagnosisTemplateDto[];

  @ApiPropertyOptional({ type: [MedicationTemplateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationTemplateDto)
  medicationTemplate?: MedicationTemplateDto[];

  @ApiPropertyOptional({ type: OrdersTemplateDto })
  @IsOptional()
  @IsObject()
  ordersTemplate?: OrdersTemplateDto;

  @ApiPropertyOptional({ type: TreatmentPlanTemplateDto })
  @IsOptional()
  @IsObject()
  treatmentPlanTemplate?: TreatmentPlanTemplateDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientInstructions?: string;

  @ApiPropertyOptional({ type: [BillingCodeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingCodeDto)
  billingCodes?: BillingCodeDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerNotes?: string;
}
