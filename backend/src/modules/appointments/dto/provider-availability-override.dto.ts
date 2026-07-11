import { IsString, IsDateString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

const overrideTypes = [
  'time_off',
  'modified_hours',
  'on_call',
  'holiday',
  'break',
  'out_of_office',
] as const;

export class CreateProviderAvailabilityOverrideDto {
  @IsString()
  providerId!: string;

  @IsDateString()
  overrideDate!: string;

  @IsEnum(overrideTypes)
  overrideType!: typeof overrideTypes[number];

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}

export class UpdateProviderAvailabilityOverrideDto {
  @IsString()
  @IsOptional()
  providerId?: string;

  @IsDateString()
  @IsOptional()
  overrideDate?: string;

  @IsEnum(overrideTypes)
  @IsOptional()
  overrideType?: typeof overrideTypes[number];

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}
