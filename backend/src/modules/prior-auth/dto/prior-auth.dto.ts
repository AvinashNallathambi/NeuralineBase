import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsInt,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PriorAuthBenefitType,
  PriorAuthUrgency,
  PriorAuthSubmissionMethod,
} from '../entities/prior-auth-request.entity';

export class PriorAuthCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  description!: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;
}

export class PriorAuthDiagnosisDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  description!: string;

  @IsBoolean()
  isPrimary!: boolean;
}

export class CreatePriorAuthRequestDto {
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @IsString()
  @IsOptional()
  patientName?: string;

  @IsString()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  superbillId?: string;

  @IsString()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  providerName?: string;

  @IsEnum(PriorAuthBenefitType)
  @IsOptional()
  benefitType?: PriorAuthBenefitType;

  @IsEnum(PriorAuthUrgency)
  @IsOptional()
  urgency?: PriorAuthUrgency;

  @IsString()
  @IsOptional()
  payerName?: string;

  @IsString()
  @IsOptional()
  payerId?: string;

  @IsString()
  @IsOptional()
  planName?: string;

  @IsString()
  @IsOptional()
  policyNumber?: string;

  @IsString()
  @IsOptional()
  groupNumber?: string;

  @IsString()
  @IsOptional()
  eligibilityVerificationId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriorAuthCodeDto)
  procedureCodes!: PriorAuthCodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriorAuthDiagnosisDto)
  @IsOptional()
  diagnosisCodes?: PriorAuthDiagnosisDto[];

  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @IsDateString()
  @IsOptional()
  serviceDate?: string;

  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @IsString()
  @IsOptional()
  assignedTo?: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  autoTriggered?: boolean;

  @IsString()
  @IsOptional()
  autoTriggerSource?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePriorAuthRequestDto {
  @IsEnum(PriorAuthUrgency)
  @IsOptional()
  urgency?: PriorAuthUrgency;

  @IsString()
  @IsOptional()
  payerName?: string;

  @IsString()
  @IsOptional()
  payerId?: string;

  @IsString()
  @IsOptional()
  planName?: string;

  @IsString()
  @IsOptional()
  policyNumber?: string;

  @IsString()
  @IsOptional()
  groupNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriorAuthCodeDto)
  @IsOptional()
  procedureCodes?: PriorAuthCodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriorAuthDiagnosisDto)
  @IsOptional()
  diagnosisCodes?: PriorAuthDiagnosisDto[];

  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @IsString()
  @IsOptional()
  authLetter?: string;

  @IsDateString()
  @IsOptional()
  serviceDate?: string;

  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @IsString()
  @IsOptional()
  assignedTo?: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubmitPriorAuthDto {
  @IsEnum(PriorAuthSubmissionMethod)
  submissionMethod!: PriorAuthSubmissionMethod;

  @IsString()
  @IsOptional()
  authLetter?: string;
}

export class PayerResponseDto {
  @IsString()
  @IsNotEmpty()
  status!: 'approved' | 'denied' | 'pending' | 'p2p_scheduled';

  @IsString()
  @IsOptional()
  authNumber?: string;

  @IsDateString()
  @IsOptional()
  approvedStartDate?: string;

  @IsDateString()
  @IsOptional()
  approvedEndDate?: string;

  @IsInt()
  @IsOptional()
  visitCountApproved?: number;

  @IsString()
  @IsOptional()
  denialReason?: string;

  @IsString()
  @IsOptional()
  denialCode?: string;

  @IsString()
  @IsOptional()
  payerDecisionNotes?: string;

  @IsDateString()
  @IsOptional()
  p2pScheduledAt?: string;
}

export class AssignPriorAuthDto {
  @IsString()
  @IsNotEmpty()
  assignedTo!: string;
}

export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty()
  attachmentType!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsDateString()
  @IsOptional()
  evidenceDate?: string;

  @IsBoolean()
  @IsOptional()
  isAiGenerated?: boolean;

  @IsString()
  @IsOptional()
  satisfiesCriterion?: string;
}

export class CheckRequirementDto {
  @IsString()
  @IsNotEmpty()
  payerName!: string;

  @IsArray()
  @IsString({ each: true })
  procedureCodes!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  diagnosisCodes?: string[];

  @IsString()
  @IsOptional()
  patientId?: string;

  @IsString()
  @IsOptional()
  encounterId?: string;
}

export class AutoTriggerPaDto {
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @IsString()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  payerName?: string;

  @IsString()
  @IsOptional()
  policyNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriorAuthCodeDto)
  procedureCodes!: PriorAuthCodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriorAuthDiagnosisDto)
  @IsOptional()
  diagnosisCodes?: PriorAuthDiagnosisDto[];

  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @IsDateString()
  @IsOptional()
  serviceDate?: string;
}
