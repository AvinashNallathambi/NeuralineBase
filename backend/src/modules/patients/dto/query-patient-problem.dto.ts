import { IsOptional, IsString, IsEnum, IsBooleanString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProblemClinicalStatus } from '../entities/patient-problem.entity';

export class QueryPatientProblemDto {
  @ApiPropertyOptional({ enum: ProblemClinicalStatus })
  @IsEnum(ProblemClinicalStatus)
  @IsOptional()
  clinicalStatus?: ProblemClinicalStatus;

  @ApiPropertyOptional()
  @IsBooleanString()
  @IsOptional()
  isChronic?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}

