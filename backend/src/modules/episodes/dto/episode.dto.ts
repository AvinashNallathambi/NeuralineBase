import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EpisodeStatus, EpisodeType } from '../entities/episode.entity';

export class EpisodeConditionDto {
  @IsString()
  code!: string;

  @IsString()
  codeSystem!: string;

  @IsString()
  description!: string;

  @IsNotEmpty()
  isPrimary!: boolean;
}

export class EpisodeCareTeamMemberDto {
  @IsString()
  providerId!: string;

  @IsString()
  name!: string;

  @IsString()
  role!: string;

  @IsNotEmpty()
  isActive!: boolean;

  @IsDateString()
  joinedAt!: string;
}

export class CreateEpisodeDto {
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @IsString()
  patientName!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EpisodeType)
  episodeType!: EpisodeType;

  @IsEnum(EpisodeStatus)
  @IsOptional()
  status?: EpisodeStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EpisodeConditionDto)
  @IsOptional()
  conditions?: EpisodeConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EpisodeCareTeamMemberDto)
  @IsOptional()
  careTeam?: EpisodeCareTeamMemberDto[];

  @IsString()
  @IsOptional()
  managingProviderId?: string;

  @IsString()
  @IsOptional()
  managingProviderName?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  encounterIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  carePlanIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateEpisodeDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EpisodeType)
  @IsOptional()
  episodeType?: EpisodeType;

  @IsEnum(EpisodeStatus)
  @IsOptional()
  status?: EpisodeStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EpisodeConditionDto)
  @IsOptional()
  conditions?: EpisodeConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EpisodeCareTeamMemberDto)
  @IsOptional()
  careTeam?: EpisodeCareTeamMemberDto[];

  @IsString()
  @IsOptional()
  managingProviderId?: string;

  @IsString()
  @IsOptional()
  managingProviderName?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  encounterIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  carePlanIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class LinkEncounterDto {
  @IsString()
  @IsNotEmpty()
  encounterId!: string;
}

export class LinkCarePlanDto {
  @IsString()
  @IsNotEmpty()
  carePlanId!: string;
}

export class AssessOutcomeDto {
  @IsString()
  clinicalOutcome!: string;

  @IsOptional()
  patientSatisfaction?: number;

  @IsOptional()
  qualityMeasureCompliance?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  assessedBy!: string;
}
