import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  Min,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class StepConfigDto {
  @ApiProperty({ description: 'Step identifier (snake_case)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Human-readable label' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ description: 'Display order (0-based)' })
  @IsNumber()
  @Min(0)
  order!: number;

  @ApiProperty({ description: 'Ant Design color name' })
  @IsString()
  @IsNotEmpty()
  color!: string;

  @ApiProperty({ description: 'Ant Design icon name' })
  @IsString()
  @IsNotEmpty()
  icon!: string;

  @ApiProperty({ description: 'Allowed next step names' })
  @IsArray()
  @IsString({ each: true })
  allowedTransitions!: string[];

  @ApiPropertyOptional({ description: 'Fields required before transition' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @ApiPropertyOptional({ description: 'Roles allowed to perform transition' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignableRoles?: string[];
}

class TransitionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fromStep!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toStep!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireConfirmation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireNote?: boolean;
}

export class CreateWorkflowTemplateDto {
  @ApiProperty({ description: 'Workflow name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Entity type this workflow applies to (e.g. appointment)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entityType!: string;

  @ApiProperty({ type: [StepConfigDto], description: 'Ordered list of workflow steps' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepConfigDto)
  steps!: StepConfigDto[];

  @ApiPropertyOptional({ type: [TransitionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransitionDto)
  transitions?: TransitionDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
