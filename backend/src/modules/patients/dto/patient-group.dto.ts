import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  IsArray,
  IsBoolean,
  IsObject,
  IsInt,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PatientGroupType,
  PatientGroupCategory,
  GroupRule,
  GroupRuleSet,
} from '../entities/patient-group.entity';

export class CreatePatientGroupDto {
  @ApiProperty({ description: 'Group name', example: 'Diabetic Patients' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Group description', example: 'All patients with active diabetes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Group type',
    enum: PatientGroupType,
    example: PatientGroupType.DYNAMIC,
  })
  @IsEnum(PatientGroupType)
  type!: PatientGroupType;

  @ApiPropertyOptional({
    description: 'Group category',
    enum: PatientGroupCategory,
    example: PatientGroupCategory.CHRONIC_DISEASE,
  })
  @IsEnum(PatientGroupCategory)
  @IsOptional()
  category?: PatientGroupCategory;

  @ApiPropertyOptional({ description: 'Color tag for UI', example: '#1890ff' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon name for UI', example: 'HeartOutlined' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Tags', example: ['diabetes', 'chronic'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Rule set for dynamic/smart groups',
    type: 'object',
  })
  @IsObject()
  @IsOptional()
  rules?: GroupRuleSet;

  @ApiPropertyOptional({
    description: 'Manual member IDs (for manual groups)',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberIds?: string[];

  @ApiPropertyOptional({ description: 'Whether the group is shared with all users', default: true })
  @IsBoolean()
  @IsOptional()
  isShared?: boolean;
}

export class UpdatePatientGroupDto {
  @ApiPropertyOptional({ description: 'Group name' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Group description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Group type', enum: PatientGroupType })
  @IsEnum(PatientGroupType)
  @IsOptional()
  type?: PatientGroupType;

  @ApiPropertyOptional({ description: 'Group category', enum: PatientGroupCategory })
  @IsEnum(PatientGroupCategory)
  @IsOptional()
  category?: PatientGroupCategory;

  @ApiPropertyOptional({ description: 'Color tag' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon name' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Rule set for dynamic groups' })
  @IsObject()
  @IsOptional()
  rules?: GroupRuleSet;

  @ApiPropertyOptional({ description: 'Manual member IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberIds?: string[];

  @ApiPropertyOptional({ description: 'Group status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Is shared' })
  @IsBoolean()
  @IsOptional()
  isShared?: boolean;
}

export class QueryPatientGroupDto {
  @ApiPropertyOptional({ description: 'Search by name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by type', enum: PatientGroupType })
  @IsEnum(PatientGroupType)
  @IsOptional()
  type?: PatientGroupType;

  @ApiPropertyOptional({ description: 'Filter by category', enum: PatientGroupCategory })
  @IsEnum(PatientGroupCategory)
  @IsOptional()
  category?: PatientGroupCategory;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by tag' })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}

export class AddMembersDto {
  @ApiProperty({ description: 'Patient IDs to add', example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  patientIds!: string[];
}

export class RemoveMembersDto {
  @ApiProperty({ description: 'Patient IDs to remove', example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  patientIds!: string[];
}

export class BulkActionDto {
  @ApiProperty({
    description: 'Bulk action type',
    example: 'message',
  })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiPropertyOptional({ description: 'Action payload (message body, task details, etc.)' })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class NaturalLanguageSearchDto {
  @ApiProperty({
    description: 'Natural language query',
    example: 'Show diabetic patients with A1C > 8',
  })
  @IsString()
  @IsNotEmpty()
  query!: string;
}
