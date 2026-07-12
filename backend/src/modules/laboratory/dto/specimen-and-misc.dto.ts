import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CollectSpecimenDto {
  @ApiProperty({ description: 'Specimen type', example: 'Whole blood' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  specimenType!: string;

  @ApiPropertyOptional({ description: 'Collection method', example: 'Venipuncture' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  collectionMethod?: string;

  @ApiPropertyOptional({ description: 'Volume collected', example: '5 mL' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  volume?: string;

  @ApiPropertyOptional({ description: 'Container type', example: 'Lavender top (EDTA)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  containerType?: string;

  @ApiPropertyOptional({ description: 'Collected by (user name)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  collectedBy?: string;

  @ApiPropertyOptional({
    description: 'Specimen condition',
    enum: ['good', 'hemolyzed', 'clotted', 'insufficient', 'rejected'],
    default: 'good',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['good', 'hemolyzed', 'clotted', 'insufficient', 'rejected'] as const)
  condition?: string;

  @ApiPropertyOptional({ description: 'Rejection reason (if rejected)' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Tracking number' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Test ID (if specimen is for a specific test)' })
  @IsString()
  @IsOptional()
  testId?: string;
}

export class CancelLabOrderDto {
  @ApiProperty({ description: 'Cancellation reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class AcknowledgeResultDto {
  @ApiPropertyOptional({ description: 'Acknowledgment note' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}
