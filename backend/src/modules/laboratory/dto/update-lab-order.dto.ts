import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LabTestDto } from './create-lab-order.dto';

export class UpdateLabOrderDto {
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

  @ApiPropertyOptional({ description: 'Encounter ID' })
  @IsString()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Tests in this order', type: [LabTestDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabTestDto)
  tests?: LabTestDto[];

  @ApiPropertyOptional({
    description: 'Order priority',
    enum: ['routine', 'urgent', 'stat', 'asap'],
  })
  @IsString()
  @IsOptional()
  @IsEnum(['routine', 'urgent', 'stat', 'asap'] as const)
  priority?: string;

  @ApiPropertyOptional({ description: 'Fasting required' })
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

  @ApiPropertyOptional({ description: 'ICD-10 diagnosis codes' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  diagnosisCodes?: string[];

  @ApiPropertyOptional({ description: 'Ask-at-Order-Entry questions' })
  @IsObject()
  @IsOptional()
  aoeQuestions?: Record<string, string>;
}
