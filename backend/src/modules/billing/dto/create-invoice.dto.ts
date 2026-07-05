import { IsString, IsDate, IsEnum, IsNumber, IsOptional, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus, InvoiceType } from '../entities/invoice.entity';
import { CreateClaimLineItemDto } from './create-encounter-claim.dto';

export class CreateInvoiceDto {
  @IsUUID()
  tenantId!: string;

  @IsString()
  patientId!: string;

  @IsString()
  patientName!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsOptional()
  @IsUUID()
  claimId?: string;

  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @IsString()
  providerId!: string;

  @IsString()
  providerName!: string;

  @IsDate()
  @Type(() => Date)
  serviceDate!: Date;

  @IsDate()
  @Type(() => Date)
  invoiceDate!: Date;

  @IsDate()
  @Type(() => Date)
  dueDate!: Date;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClaimLineItemDto)
  lineItems!: CreateClaimLineItemDto[];
}
