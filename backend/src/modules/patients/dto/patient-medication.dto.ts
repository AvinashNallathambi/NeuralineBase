import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PatientMedicationSource,
  PatientMedicationStatus,
  PatientMedicationTakingStatus,
} from '../entities/patient-medication.entity';

export class CreatePatientMedicationDto {
  @ApiProperty({ example: 'Metformin', description: 'Medication name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'RxNorm code' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  rxNormCode?: string;

  @ApiPropertyOptional({ example: '500mg' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  dosage?: string;

  @ApiPropertyOptional({ example: 'twice daily' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  frequency?: string;

  @ApiPropertyOptional({ example: 'oral' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  route?: string;

  @ApiPropertyOptional({ enum: PatientMedicationSource, default: PatientMedicationSource.PATIENT_REPORTED })
  @IsEnum(PatientMedicationSource)
  @IsOptional()
  source?: PatientMedicationSource;

  @ApiPropertyOptional({ enum: PatientMedicationStatus, default: PatientMedicationStatus.ACTIVE })
  @IsEnum(PatientMedicationStatus)
  @IsOptional()
  status?: PatientMedicationStatus;

  @ApiPropertyOptional({ enum: PatientMedicationTakingStatus, default: PatientMedicationTakingStatus.TAKING })
  @IsEnum(PatientMedicationTakingStatus)
  @IsOptional()
  takingStatus?: PatientMedicationTakingStatus;

  @ApiPropertyOptional({ description: 'Date the patient started the medication' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date the patient stopped the medication' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Linked prescription UUID' })
  @IsUUID()
  @IsOptional()
  prescriptionId?: string;

  @ApiPropertyOptional({ description: 'Originating encounter ID' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  encounterId?: string;

  @ApiPropertyOptional({ example: 'Dr. Sarah Chen' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  prescriberName?: string;

  @ApiPropertyOptional({ example: 'Type 2 diabetes' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  indication?: string;

  @ApiPropertyOptional({ description: 'Sig / patient instructions' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Clinical notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePatientMedicationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(50)
  rxNormCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  dosage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  frequency?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(50)
  route?: string;

  @ApiPropertyOptional({ enum: PatientMedicationSource })
  @IsEnum(PatientMedicationSource)
  @IsOptional()
  source?: PatientMedicationSource;

  @ApiPropertyOptional({ enum: PatientMedicationStatus })
  @IsEnum(PatientMedicationStatus)
  @IsOptional()
  status?: PatientMedicationStatus;

  @ApiPropertyOptional({ enum: PatientMedicationTakingStatus })
  @IsEnum(PatientMedicationTakingStatus)
  @IsOptional()
  takingStatus?: PatientMedicationTakingStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(200)
  prescriberName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  indication?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class DiscontinuePatientMedicationDto {
  @ApiPropertyOptional({ description: 'Reason the medication is being discontinued' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}

export class QueryPatientMedicationDto {
  @ApiPropertyOptional({ enum: PatientMedicationStatus })
  @IsEnum(PatientMedicationStatus)
  @IsOptional()
  status?: PatientMedicationStatus;

  @ApiPropertyOptional({ enum: PatientMedicationSource })
  @IsEnum(PatientMedicationSource)
  @IsOptional()
  source?: PatientMedicationSource;
}

// Re-export for convenience
export {
  PatientMedicationSource,
  PatientMedicationStatus,
  PatientMedicationTakingStatus,
};
