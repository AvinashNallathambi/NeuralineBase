import { IsString, IsUUID, IsOptional, IsEnum, IsDateString, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '../entities/insurance-verification.entity';

export class QueryInsuranceVerificationDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by appointment UUID' })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'Filter by verification status', enum: VerificationStatus })
  @IsEnum(VerificationStatus)
  @IsOptional()
  status?: VerificationStatus;

  @ApiPropertyOptional({ description: 'Filter by service type' })
  @IsString()
  @IsOptional()
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Date from (ISO)', example: '2026-07-01' })
  @IsDateString()
  @IsOptional()
  verifiedFrom?: string;

  @ApiPropertyOptional({ description: 'Date to (ISO)', example: '2026-07-31' })
  @IsDateString()
  @IsOptional()
  verifiedTo?: string;

  @ApiPropertyOptional({ description: 'Search by payer, policy, or provider name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field', example: 'verifiedAt' })
  @IsIn(['createdAt', 'verifiedAt', 'status', 'payerName'])
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort direction', example: 'DESC' })
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
