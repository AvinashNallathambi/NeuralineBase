import { IsOptional, IsDateString, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAppointmentDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsEnum(['consultation', 'follow_up', 'procedure', 'emergency', 'wellness', 'mental_health', 'other', 'group_therapy', 'group_session', 'new_patient', 'annual_physical', 'urgent_care', 'telehealth'])
  appointmentType?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsEnum(['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'])
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
