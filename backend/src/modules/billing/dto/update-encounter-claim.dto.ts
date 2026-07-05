import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateEncounterClaimDto } from './create-encounter-claim.dto';

export class UpdateEncounterClaimDto extends PartialType(
  OmitType(CreateEncounterClaimDto, ['tenantId', 'patientId', 'providerId'] as const)
) {}
