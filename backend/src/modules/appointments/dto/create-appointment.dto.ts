import { IsString, IsUUID, IsDateString, IsEnum, IsOptional, IsObject, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AppointmentLocationDto {
  @IsEnum(['in_person', 'telehealth', 'home_visit'])
  type!: 'in_person' | 'telehealth' | 'home_visit';

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsString()
  meetingId?: string;
}

export class CreateAppointmentDto {
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @IsUUID()
  @IsNotEmpty()
  providerId!: string;

  @IsEnum(['consultation', 'follow_up', 'procedure', 'emergency', 'wellness', 'mental_health', 'other'])
  @IsNotEmpty()
  appointmentType!: 'consultation' | 'follow_up' | 'procedure' | 'emergency' | 'wellness' | 'mental_health' | 'other';

  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentLocationDto)
  location?: AppointmentLocationDto;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  reasonForVisit?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
