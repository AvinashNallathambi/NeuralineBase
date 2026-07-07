import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiagnosisCodingSystem } from '../entities/favorite-diagnosis.entity';

export class CreateFavoriteDiagnosisDto {
  @ApiProperty({ example: 'J06.9' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ enum: DiagnosisCodingSystem, default: DiagnosisCodingSystem.ICD_10_CM })
  @IsEnum(DiagnosisCodingSystem)
  @IsOptional()
  codeSystem?: DiagnosisCodingSystem;

  @ApiProperty({ example: 'Acute upper respiratory infection, unspecified' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isBillable?: boolean;
}
