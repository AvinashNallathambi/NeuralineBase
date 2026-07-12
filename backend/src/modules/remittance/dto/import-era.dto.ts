import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportEraDto {
  @ApiProperty({ description: 'Raw X12 835 file content' })
  @IsString()
  fileContent!: string;

  @ApiPropertyOptional({ description: 'Original file name' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ description: 'Tenant ID (defaults to request tenant)' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class ImportEobDto {
  @ApiPropertyOptional({ description: 'EOB document reference (file path or base64)' })
  @IsOptional()
  @IsString()
  documentRef?: string;

  @ApiPropertyOptional({ description: 'Patient ID' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Patient name' })
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiPropertyOptional({ description: 'Claim ID' })
  @IsOptional()
  @IsUUID()
  claimId?: string;

  @ApiPropertyOptional({ description: 'Claim number' })
  @IsOptional()
  @IsString()
  claimNumber?: string;

  @ApiPropertyOptional({ description: 'Payer name' })
  @IsOptional()
  @IsString()
  payerName?: string;

  @ApiPropertyOptional({ description: 'EOB date (ISO string)' })
  @IsOptional()
  @IsString()
  eobDate?: string;

  @ApiPropertyOptional({ description: 'Service date (ISO string)' })
  @IsOptional()
  @IsString()
  serviceDate?: string;

  @ApiPropertyOptional({ description: 'EOB format', enum: ['pdf', 'image', 'html', 'json'] })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ description: 'Structured data extracted from EOB' })
  @IsOptional()
  structuredData?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Total billed amount' })
  @IsOptional()
  totalBilled?: number;

  @ApiPropertyOptional({ description: 'Total paid amount' })
  @IsOptional()
  totalPaid?: number;

  @ApiPropertyOptional({ description: 'Patient responsibility amount' })
  @IsOptional()
  patientResponsibility?: number;

  @ApiPropertyOptional({ description: 'Adjustment amount' })
  @IsOptional()
  adjustmentAmount?: number;

  @ApiPropertyOptional({ description: 'Is denied' })
  @IsOptional()
  isDenied?: boolean;

  @ApiPropertyOptional({ description: 'Denial codes (CARC codes)' })
  @IsOptional()
  denialCodes?: string[];

  @ApiPropertyOptional({ description: 'Denial reason text' })
  @IsOptional()
  @IsString()
  denialReasonText?: string;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
