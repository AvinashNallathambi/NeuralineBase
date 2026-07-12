import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LabPanelTestDto {
  @ApiProperty({ example: 'WBC', description: 'Test name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: '6690-2', description: 'LOINC code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  loincCode?: string;

  @ApiPropertyOptional({ example: 'Hematology', description: 'Category' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;
}

export class CreateLabPanelDto {
  @ApiProperty({ example: 'Complete Blood Count (CBC)', description: 'Panel name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: '85025', description: 'Panel code (CPT)' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: '58410-2', description: 'LOINC panel code' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  loincCode?: string;

  @ApiPropertyOptional({ example: 'Hematology', description: 'Category' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiProperty({ description: 'Tests in this panel', type: [LabPanelTestDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabPanelTestDto)
  tests!: LabPanelTestDto[];

  @ApiPropertyOptional({
    description: 'Default priority',
    enum: ['routine', 'urgent', 'stat', 'asap'],
    default: 'routine',
  })
  @IsString()
  @IsOptional()
  defaultPriority?: string;

  @ApiPropertyOptional({ description: 'Fasting required', default: false })
  @IsBoolean()
  @IsOptional()
  fastingRequired?: boolean;

  @ApiPropertyOptional({ description: 'Panel description' })
  @IsString()
  @IsOptional()
  description?: string;
}
