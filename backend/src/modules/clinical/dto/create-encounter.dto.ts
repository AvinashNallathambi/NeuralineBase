import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EncounterType, EncounterStatus } from '../entities/encounter.entity';

class SoapNoteDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subjective?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  objective?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assessment?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  plan?: string;
}

class VitalsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bloodPressure?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heartRate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  temperature?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  temperatureRoute?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  weight?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  weightUnit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  height?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heightUnit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bmi?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  oxygenSaturation?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  respiratoryRate?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  painScore?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  painLocation?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bloodGlucose?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bloodGlucoseContext?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  headCircumference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  waistCircumference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  intraocularPressureLeft?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  intraocularPressureRight?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recordedDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recordedBy?: string;
}

class DiagnosisDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  problemListId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ enum: ['ICD-10-CM', 'SNOMED CT', 'ICD-11'], default: 'ICD-10-CM' })
  @IsString()
  @IsOptional()
  codeSystem?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: ['chronic', 'acute', 'rule_out'] })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ enum: ['active', 'resolved', 'ruled_out', 'inactive'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  onsetDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resolvedDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isBillable?: boolean;
}

class MedicationDto {
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
  @IsString()
  @IsOptional()
  route?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  duration?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  refills?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isNew?: boolean;
}

class ProcedureDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cptCode?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}

class ReferralDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  specialty!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  urgency?: string;
}

class TreatmentPlanDto {
  @ApiPropertyOptional({ type: [MedicationDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications?: MedicationDto[];

  @ApiPropertyOptional({ type: [ProcedureDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProcedureDto)
  procedures?: ProcedureDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  followUp?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  followUpProviderId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  followUpProviderName?: string;

  @ApiPropertyOptional({ type: [ReferralDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReferralDto)
  referrals?: ReferralDto[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  goals?: string[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  interventions?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  homeInstructions?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  patientEducation?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  restrictions?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recallReminder?: string;
}

class AllergyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  allergen!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reaction!: string;

  @ApiProperty({ enum: ['mild', 'moderate', 'severe', 'life_threatening'] })
  @IsString()
  @IsNotEmpty()
  severity!: string;

  @ApiPropertyOptional({ enum: ['drug', 'food', 'environmental', 'other'] })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  onsetDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateEncounterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  room?: string;

  @ApiProperty({
    enum: EncounterType,
    default: EncounterType.OFFICE_VISIT,
  })
  @IsEnum(EncounterType)
  @IsOptional()
  type?: EncounterType;

  @ApiProperty({
    enum: EncounterStatus,
    default: EncounterStatus.SCHEDULED,
  })
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  visitCategory?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  visitReason?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  clinicalTemplateId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  arrivalTime?: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SoapNoteDto)
  soapNote?: SoapNoteDto;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => VitalsDto)
  vitals?: VitalsDto;

  @ApiPropertyOptional({ type: [DiagnosisDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  diagnoses?: DiagnosisDto[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => TreatmentPlanDto)
  treatmentPlan?: TreatmentPlanDto;

  @ApiPropertyOptional({ type: [AllergyDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllergyDto)
  allergies?: AllergyDto[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  orders?: {
    labs?: Array<{ name: string; loincCode?: string; status: string; priority?: string; orderedDate: string; notes?: string }>;
    imaging?: Array<{ name: string; modality?: string; bodyPart?: string; status: string; priority?: string; orderedDate: string; notes?: string }>;
    referrals?: Array<{ specialty: string; provider?: string; reason: string; urgency?: string; status: string; notes?: string }>;
    procedures?: Array<{ name: string; cptCode?: string; description: string; status: string; scheduledDate?: string; notes?: string }>;
  };

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  attachments?: Array<{
    fileName: string;
    fileType: string;
    url: string;
    description?: string;
    category?: string;
    uploadedAt: string;
    uploadedBy?: string;
  }>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
