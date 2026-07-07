import { IsString, IsUUID, IsDateString, IsEnum, IsOptional, IsObject, IsNotEmpty, ValidateNested, IsNumber, IsBoolean, Min, Max, IsArray } from 'class-validator';
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
  @IsString()
  @IsOptional()
  patientId?: string;

  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @IsEnum(['consultation', 'follow_up', 'procedure', 'emergency', 'wellness', 'mental_health', 'other', 'group_therapy', 'group_session', 'new_patient', 'annual_physical', 'urgent_care', 'telehealth'])
  @IsOptional()
  appointmentType?: 'consultation' | 'follow_up' | 'procedure' | 'emergency' | 'wellness' | 'mental_health' | 'other' | 'group_therapy' | 'group_session' | 'new_patient' | 'annual_physical' | 'urgent_care' | 'telehealth';

  @IsString()
  @IsOptional()
  type?: string;

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

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isTelehealth?: boolean;

  @IsNumber()
  @IsOptional()
  durationMinutes?: number;

  @IsBoolean()
  @IsOptional()
  remindersEnabled?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // Group Appointment Fields
  @IsBoolean()
  @IsOptional()
  isGroup?: boolean;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsNumber()
  @IsOptional()
  @Min(2)
  @Max(50)
  maxParticipants?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  groupPatientIds?: string[];
}
