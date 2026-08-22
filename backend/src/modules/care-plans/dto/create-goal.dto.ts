import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGoalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  carePlanId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ example: 'Reduce HbA1c to below 7.0%' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ example: '7.0' })
  @IsString()
  @IsOptional()
  targetValue?: string;

  @ApiPropertyOptional({ example: '%' })
  @IsString()
  @IsOptional()
  targetUnit?: string;

  @ApiPropertyOptional({ example: '8.2' })
  @IsString()
  @IsOptional()
  currentValue?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metricName?: string;

  @ApiPropertyOptional({ enum: ['decrease', 'increase', 'maintain'] })
  @IsString()
  @IsOptional()
  @IsEnum(['decrease', 'increase', 'maintain'] as const)
  targetDirection?: string;

  @ApiPropertyOptional({ enum: ['active', 'achieved', 'not_achieved', 'suspended', 'cancelled'], default: 'active' })
  @IsString()
  @IsOptional()
  @IsEnum(['active', 'achieved', 'not_achieved', 'suspended', 'cancelled'] as const)
  status?: string;

  @ApiPropertyOptional({ enum: ['high', 'medium', 'low'], default: 'medium' })
  @IsString()
  @IsOptional()
  @IsEnum(['high', 'medium', 'low'] as const)
  priority?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
