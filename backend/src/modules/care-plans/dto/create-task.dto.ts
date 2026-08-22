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

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  carePlanId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ example: 'Check blood pressure daily' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: ['monitoring', 'lab_order', 'imaging_order', 'medication_adherence', 'patient_education', 'questionnaire', 'appointment', 'care_team_action', 'lifestyle', 'follow_up', 'referral', 'custom'],
    default: 'custom',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['monitoring', 'lab_order', 'imaging_order', 'medication_adherence', 'patient_education', 'questionnaire', 'appointment', 'care_team_action', 'lifestyle', 'follow_up', 'referral', 'custom'] as const)
  taskType?: string;

  @ApiPropertyOptional({ enum: ['pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'no_response'], default: 'pending' })
  @IsString()
  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'no_response'] as const)
  status?: string;

  @ApiPropertyOptional({ enum: ['patient', 'care_team', 'system'], default: 'patient' })
  @IsString()
  @IsOptional()
  @IsEnum(['patient', 'care_team', 'system'] as const)
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedProviderId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedProviderName?: string;

  @ApiPropertyOptional({ enum: ['one_time', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'as_needed'], default: 'one_time' })
  @IsString()
  @IsOptional()
  @IsEnum(['one_time', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'as_needed'] as const)
  frequency?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metricName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  targetValue?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  targetUnit?: string;

  @ApiPropertyOptional({ enum: ['high', 'medium', 'low'], default: 'medium' })
  @IsString()
  @IsOptional()
  @IsEnum(['high', 'medium', 'low'] as const)
  priority?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isAiSuggested?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  goalId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
