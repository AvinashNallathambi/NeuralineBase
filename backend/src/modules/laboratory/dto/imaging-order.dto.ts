import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateImagingOrderDto {
  @ApiProperty({ example: 'pat-001', description: 'Patient ID' })
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ example: 'John Martinez', description: 'Patient display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patientName!: string;

  @ApiProperty({ example: 'usr-001', description: 'Provider ID' })
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @ApiProperty({ example: 'Dr. Sarah Chen', description: 'Provider display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  providerName!: string;

  @ApiPropertyOptional({ example: 'enc-001', description: 'Encounter ID' })
  @IsString()
  @IsOptional()
  encounterId?: string;

  @ApiProperty({
    description: 'Imaging modality',
    enum: ['xray', 'mri', 'ct', 'ultrasound', 'mammogram', 'dexa', 'other'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['xray', 'mri', 'ct', 'ultrasound', 'mammogram', 'dexa', 'other'] as const)
  modality!: string;

  @ApiProperty({ example: 'Chest', description: 'Body part imaged' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  bodyPart!: string;

  @ApiProperty({ example: 'Chest X-Ray PA and Lateral', description: 'Study name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  studyName!: string;

  @ApiPropertyOptional({ example: '71046', description: 'CPT code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  cptCode?: string;

  @ApiPropertyOptional({
    description: 'Imaging status',
    enum: ['ordered', 'scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'ordered',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['ordered', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const)
  status?: string;

  @ApiPropertyOptional({
    description: 'Priority',
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['routine', 'urgent', 'stat'] as const)
  priority?: string;

  @ApiPropertyOptional({ description: 'Clinical notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Scheduled date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Ordered date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  orderedDate?: string;
}

export class UpdateImagingOrderDto {
  @ApiPropertyOptional({ description: 'Patient display name' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  patientName?: string;

  @ApiPropertyOptional({ description: 'Provider display name' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  providerName?: string;

  @ApiPropertyOptional({ description: 'Body part' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  bodyPart?: string;

  @ApiPropertyOptional({ description: 'Study name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  studyName?: string;

  @ApiPropertyOptional({ description: 'CPT code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  cptCode?: string;

  @ApiPropertyOptional({
    description: 'Imaging status',
    enum: ['ordered', 'scheduled', 'in_progress', 'completed', 'cancelled'],
  })
  @IsString()
  @IsOptional()
  @IsEnum(['ordered', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const)
  status?: string;

  @ApiPropertyOptional({
    description: 'Priority',
    enum: ['routine', 'urgent', 'stat'],
  })
  @IsString()
  @IsOptional()
  @IsEnum(['routine', 'urgent', 'stat'] as const)
  priority?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Scheduled date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;
}

export class ImagingFindingsDto {
  @ApiProperty({ description: 'Radiology findings' })
  @IsString()
  @IsNotEmpty()
  findings!: string;

  @ApiPropertyOptional({ description: 'Radiologist impression' })
  @IsString()
  @IsOptional()
  impression?: string;

  @ApiPropertyOptional({ description: 'Report URL' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  radiologyReportUrl?: string;
}
