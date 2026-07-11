import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsObject,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationType } from '../entities/insurance-verification.entity';

export class CreateInsuranceVerificationDto {
  @ApiProperty({ description: 'Patient UUID', example: '387d6bd8-09b3-4b39-8e43-4e96534f4636' })
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Appointment UUID', example: '12345678-1234-1234-1234-123456789abc' })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'Patient insurance policy UUID', example: '12345678-1234-1234-1234-123456789abc' })
  @IsUUID()
  @IsOptional()
  patientInsuranceId?: string;

  @ApiPropertyOptional({ description: 'Insurance payer UUID', example: '12345678-1234-1234-1234-123456789abc' })
  @IsUUID()
  @IsOptional()
  insurancePayerId?: string;

  @ApiPropertyOptional({ description: 'Verification type', enum: VerificationType, example: 'real-time' })
  @IsEnum(VerificationType)
  @IsOptional()
  verificationType?: VerificationType = VerificationType.REALTIME;

  @ApiPropertyOptional({ description: 'Service type code', example: '30' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  serviceType?: string = '30';

  @ApiPropertyOptional({ description: 'Policy number override', example: 'BCBS-GA123456' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  policyNumber?: string;

  @ApiPropertyOptional({ description: 'Group number override', example: 'GRP-001' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  groupNumber?: string;

  @ApiPropertyOptional({ description: 'Date of service to verify', example: '2026-07-07' })
  @IsDateString()
  @IsOptional()
  serviceDate?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Provider metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
