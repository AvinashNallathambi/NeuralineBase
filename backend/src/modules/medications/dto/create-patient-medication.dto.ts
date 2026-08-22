import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePatientMedicationDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ description: 'Patient display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patientName!: string;

  @ApiProperty({ example: 'Lisinopril 10mg', description: 'Medication name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  medicationName!: string;

  @ApiPropertyOptional({ example: '314231' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  rxNormCode?: string;

  @ApiPropertyOptional({ example: '10mg' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  dosage?: string;

  @ApiPropertyOptional({ example: 'Once daily' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  frequency?: string;

  @ApiPropertyOptional({ example: 'Oral' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  route?: string;

  @ApiPropertyOptional({ example: 'Ongoing' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  duration?: string;

  @ApiPropertyOptional({ description: 'Instructions / SIG' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({
    enum: ['prescription', 'patient_reported', 'pbm_history', 'encounter'],
    default: 'patient_reported',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['prescription', 'patient_reported', 'pbm_history', 'encounter'] as const)
  source?: string;

  @ApiPropertyOptional({
    enum: ['taking', 'taking_differently', 'not_taking', 'unknown', 'completed'],
    default: 'taking',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['taking', 'taking_differently', 'not_taking', 'unknown', 'completed'] as const)
  takingStatus?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'discontinued', 'completed'], default: 'active' })
  @IsString()
  @IsOptional()
  @IsEnum(['active', 'inactive', 'discontinued', 'completed'] as const)
  status?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Stop date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  stopDate?: string;

  @ApiPropertyOptional({ description: 'Notes about how patient is taking differently' })
  @IsString()
  @IsOptional()
  takingNotes?: string;

  @ApiPropertyOptional({ description: 'Originating prescription ID' })
  @IsString()
  @IsOptional()
  prescriptionId?: string;

  @ApiPropertyOptional({ description: 'Originating encounter ID' })
  @IsString()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Provider ID' })
  @IsString()
  @IsOptional()
  providerId?: string;

  @ApiPropertyOptional({ description: 'Provider name' })
  @IsString()
  @IsOptional()
  providerName?: string;

  @ApiPropertyOptional({ description: 'Who reported this medication' })
  @IsString()
  @IsOptional()
  reportedBy?: string;

  @ApiPropertyOptional({ description: 'PBM source name' })
  @IsString()
  @IsOptional()
  pbmSource?: string;

  @ApiPropertyOptional({ description: 'General notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Whether reviewed during med reconciliation', default: false })
  @IsBoolean()
  @IsOptional()
  isReviewed?: boolean;
}
