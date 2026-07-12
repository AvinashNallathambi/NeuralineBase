import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LabTestDto {
  @ApiProperty({ example: 'Hemoglobin A1C', description: 'Test name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: '4548-4', description: 'LOINC code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  loincCode?: string;

  @ApiPropertyOptional({ example: '83036', description: 'CPT code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  cptCode?: string;

  @ApiPropertyOptional({ example: 'Endocrine', description: 'Test category' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'Whole blood', description: 'Specimen type' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  specimenType?: string;

  @ApiPropertyOptional({ description: 'Test notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Sort order within order', example: 0 })
  @IsOptional()
  sortOrder?: number;
}

export class CreateLabOrderDto {
  @ApiProperty({ example: 'pat-001', description: 'Patient ID' })
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ example: 'Michael Thompson', description: 'Patient display name' })
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

  @ApiProperty({ description: 'Tests to order', type: [LabTestDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabTestDto)
  tests!: LabTestDto[];

  @ApiPropertyOptional({
    description: 'Order status',
    enum: ['draft', 'ordered', 'collected', 'in_progress', 'resulted', 'completed', 'cancelled'],
    default: 'ordered',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['draft', 'ordered', 'collected', 'in_progress', 'resulted', 'completed', 'cancelled'] as const)
  status?: string;

  @ApiPropertyOptional({
    description: 'Order priority',
    enum: ['routine', 'urgent', 'stat', 'asap'],
    default: 'routine',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['routine', 'urgent', 'stat', 'asap'] as const)
  priority?: string;

  @ApiPropertyOptional({ description: 'Fasting required', default: false })
  @IsBoolean()
  @IsOptional()
  fastingRequired?: boolean;

  @ApiPropertyOptional({ description: 'Clinical notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Lab facility ID' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  labFacilityId?: string;

  @ApiPropertyOptional({ description: 'Lab facility name' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  labFacilityName?: string;

  @ApiPropertyOptional({
    description: 'ICD-10 diagnosis codes',
    example: ['E11.9', 'I10'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  diagnosisCodes?: string[];

  @ApiPropertyOptional({ description: 'Ask-at-Order-Entry questions (key/value)' })
  @IsObject()
  @IsOptional()
  aoeQuestions?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Ordered date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  orderedDate?: string;
}
