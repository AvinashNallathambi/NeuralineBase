import { IsOptional, IsString, IsDateString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportDateRange {
  LAST_7_DAYS = 'last7',
  LAST_30_DAYS = 'last30',
  LAST_90_DAYS = 'last90',
  THIS_MONTH = 'thisMonth',
  THIS_QUARTER = 'thisQuarter',
  THIS_YEAR = 'thisYear',
  LAST_YEAR = 'lastYear',
  CUSTOM = 'custom',
}

export enum ReportExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf',
  JSON = 'json',
}

export class ReportQueryDto {
  @ApiPropertyOptional({ enum: ReportDateRange, default: ReportDateRange.LAST_30_DAYS })
  @IsEnum(ReportDateRange)
  @IsOptional()
  dateRange?: ReportDateRange;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Custom start date (ISO string)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Custom end date (ISO string)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by provider ID' })
  @IsString()
  @IsOptional()
  providerId?: string;

  @ApiPropertyOptional({ description: 'Filter by insurance payer ID' })
  @IsUUID()
  @IsOptional()
  payerId?: string;

  @ApiPropertyOptional({ description: 'Filter by department/location' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ enum: ReportExportFormat, description: 'Export format (only used by export endpoint)' })
  @IsEnum(ReportExportFormat)
  @IsOptional()
  format?: ReportExportFormat;
}

export class AiReportQueryDto {
  @ApiPropertyOptional({ enum: ReportDateRange, default: ReportDateRange.LAST_30_DAYS })
  @IsEnum(ReportDateRange)
  @IsOptional()
  dateRange?: ReportDateRange;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class NaturalLanguageReportDto {
  @ApiProperty({ example: 'Which providers had the highest denial rate last quarter, broken down by payer?' })
  @IsString()
  question!: string;

  @ApiPropertyOptional({ enum: ReportDateRange })
  @IsEnum(ReportDateRange)
  @IsOptional()
  dateRange?: ReportDateRange;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
