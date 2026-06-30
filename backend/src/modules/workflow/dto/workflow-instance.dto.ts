import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkflowInstanceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  entityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentStep!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  templateId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class TransitionWorkflowDto {
  @ApiProperty({ description: 'Target step name' })
  @IsString()
  @IsNotEmpty()
  toStep!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
