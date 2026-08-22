import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
  IsEnum,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCarePlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patientName!: string;

  @ApiProperty({ example: 'Diabetes Management Plan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['active', 'completed', 'suspended', 'cancelled'], default: 'active' })
  @IsString()
  @IsOptional()
  @IsEnum(['active', 'completed', 'suspended', 'cancelled'] as const)
  status?: string;

  @ApiPropertyOptional({ enum: ['plan', 'order', 'proposal'], default: 'plan' })
  @IsString()
  @IsOptional()
  @IsEnum(['plan', 'order', 'proposal'] as const)
  intent?: string;

  @ApiPropertyOptional({ default: 'chronic_care' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ type: 'array' })
  @IsArray()
  @IsOptional()
  addresses?: any[];

  @ApiPropertyOptional({ type: 'array' })
  @IsArray()
  @IsOptional()
  careTeam?: any[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  providerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  providerName?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isAiGenerated?: boolean;

  @ApiPropertyOptional({ type: 'array' })
  @IsArray()
  @IsOptional()
  patientEducation?: any[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
