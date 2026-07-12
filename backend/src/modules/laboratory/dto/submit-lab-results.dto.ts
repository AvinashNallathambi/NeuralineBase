import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LabResultEntryDto {
  @ApiProperty({ description: 'Test ID this result is for' })
  @IsString()
  @IsNotEmpty()
  testId!: string;

  @ApiProperty({ example: '7.2', description: 'Result value (string form)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  value!: string;

  @ApiPropertyOptional({ example: 7.2, description: 'Numeric result value' })
  @IsNumber()
  @IsOptional()
  numericValue?: number;

  @ApiPropertyOptional({ example: '%', description: 'Unit of measurement' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Abnormal flag',
    enum: ['normal', 'high', 'low', 'critical_high', 'critical_low'],
  })
  @IsString()
  @IsOptional()
  @IsEnum(['normal', 'high', 'low', 'critical_high', 'critical_low'] as const)
  flag?: string;

  @ApiPropertyOptional({ example: '4.0-5.6%', description: 'Reference range text' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  referenceRange?: string;

  @ApiPropertyOptional({ description: 'AI or human interpretation' })
  @IsString()
  @IsOptional()
  interpretation?: string;

  @ApiPropertyOptional({
    description: 'Result status',
    enum: ['preliminary', 'final', 'corrected', 'amended'],
    default: 'final',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['preliminary', 'final', 'corrected', 'amended'] as const)
  resultStatus?: string;

  @ApiPropertyOptional({ description: 'Resulted timestamp (ISO 8601)', example: '2025-01-15T10:30:00Z' })
  @IsDateString()
  @IsOptional()
  resultedAt?: string;
}

export class SubmitLabResultsDto {
  @ApiProperty({ description: 'Results to submit', type: [LabResultEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabResultEntryDto)
  results!: LabResultEntryDto[];

  @ApiPropertyOptional({ description: 'Resulted by (user name)' })
  @IsString()
  @IsOptional()
  resultedBy?: string;
}
