import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ValidateNested,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionItemDto } from './prescription-item.dto';

export class CreatePrescriptionDto {
  @ApiProperty({ example: 'pat-001', description: 'Patient ID' })
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ example: 'Michael Thompson', description: 'Patient display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patientName!: string;

  @ApiProperty({ example: 'usr-001', description: 'Provider ID' })
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @ApiProperty({ example: 'Dr. Sarah Chen', description: 'Provider display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  providerName!: string;

  @ApiPropertyOptional({ example: 'enc-001', description: 'Encounter ID' })
  @IsString()
  @IsOptional()
  encounterId?: string;

  @ApiProperty({
    description: 'List of prescribed medications',
    type: [PrescriptionItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  medications!: PrescriptionItemDto[];

  @ApiPropertyOptional({
    description: 'Prescription status',
    enum: ['draft', 'active', 'completed', 'cancelled', 'expired'],
    default: 'draft',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['draft', 'active', 'completed', 'cancelled', 'expired'] as const)
  status?: string;

  @ApiPropertyOptional({
    description: 'Date prescribed (ISO 8601)',
    example: '2025-01-15',
  })
  @IsDateString()
  @IsOptional()
  prescribedDate?: string;

  @ApiPropertyOptional({
    description: 'Destination pharmacy',
    example: 'CVS Pharmacy - Main St',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  pharmacy?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Lisinopril increased from 20mg to 40mg',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
