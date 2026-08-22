import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsObject,
  IsNotEmpty,
  IsNumber,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InstrumentCategory, QuestionType, InstrumentQuestion, ScoringRule, AdministrationRule } from '../entities/screening-instrument.entity';

export class AnswerItemDto {
  @IsString()
  questionId!: string;

  @IsString()
  answerValue!: string;
}

export class QuestionOptionDto {
  @IsString()
  value!: string;

  @IsString()
  label!: string;

  @IsNumber()
  score!: number;

  @IsString()
  @IsOptional()
  loincAnswerCode?: string;
}

export class QuestionDto {
  @IsString()
  id!: string;

  @IsString()
  text!: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  @IsOptional()
  loincCode?: string;

  @IsString()
  @IsOptional()
  helpText?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsBoolean()
  required!: boolean;
}

export class CreateCustomInstrumentDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(InstrumentCategory)
  category!: InstrumentCategory;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];

  @IsObject()
  @IsOptional()
  scoringRules?: ScoringRule;

  @IsObject()
  @IsOptional()
  administrationRules?: AdministrationRule;

  @IsInt()
  @IsOptional()
  estimatedMinutes?: number;
}

export class UpdateInstrumentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  administrationRules?: AdministrationRule;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions?: QuestionDto[];
}

export class StartScreeningDto {
  @IsString()
  @IsNotEmpty()
  instrumentId!: string;

  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @IsString()
  @IsNotEmpty()
  patientName!: string;

  @IsString()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  administrationContext?: 'pre_visit_portal' | 'in_visit_tablet' | 'in_visit_staff' | 'telehealth';
}

export class SubmitAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers!: AnswerItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SaveProgressDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers!: AnswerItemDto[];
}
