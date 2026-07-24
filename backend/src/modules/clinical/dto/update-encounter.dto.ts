import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateEncounterDto } from './create-encounter.dto';

export class UpdateEncounterDto extends PartialType(
  OmitType(CreateEncounterDto, ['patientId', 'providerId'] as const)
) {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  documentationSessionId?: string;
}
