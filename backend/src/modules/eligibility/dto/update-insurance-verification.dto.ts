import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateInsuranceVerificationDto } from './create-insurance-verification.dto';

export class UpdateInsuranceVerificationDto extends PartialType(
  OmitType(CreateInsuranceVerificationDto, ['patientId'] as const),
) {}
