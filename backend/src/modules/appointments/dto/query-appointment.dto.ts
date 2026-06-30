import { IsOptional, IsDateString, IsEnum, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAppointmentDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsEnum(['consultation', 'follow_up', 'procedure', 'emergency', 'wellness', 'mental_health', 'other'])
  appointmentType?: string;

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
