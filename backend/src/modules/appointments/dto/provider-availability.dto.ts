import { IsString, IsInt, IsBoolean, IsArray, IsOptional, IsDateString, Min, Max } from 'class-validator';

export class CreateProviderAvailabilityDto {
  @IsString()
  providerId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  startTime!: string; // HH:MM format

  @IsString()
  endTime!: string; // HH:MM format

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  appointmentTypes?: string[];

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxAppointments?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  bufferMinutes?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}

export class UpdateProviderAvailabilityDto {
  @IsString()
  @IsOptional()
  providerId?: string;

  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  appointmentTypes?: string[];

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxAppointments?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  bufferMinutes?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}

export class CreateGroupAppointmentDto {
  @IsString()
  providerId!: string;

  @IsString()
  appointmentType!: string;

  @IsString()
  startTime!: string; // ISO date string

  @IsString()
  endTime!: string; // ISO date string

  @IsArray()
  @IsString({ each: true })
  patientIds!: string[];

  @IsInt()
  @Min(2)
  @Max(50)
  maxParticipants!: number;

  @IsString()
  @IsOptional()
  location?: string; // 'in_person' | 'telehealth' | 'home_visit'

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isTelehealth?: boolean;
}

export class UpdateGroupAppointmentDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  addPatientIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  removePatientIds?: string[];

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
