import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateInvoiceDto } from './create-invoice.dto';

export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ['tenantId', 'patientId', 'providerId'] as const)
) {}
