import { PartialType } from '@nestjs/swagger';
import { IsString, IsUUID, IsDateString, IsEnum, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAppointmentDto, AppointmentLocationDto } from './create-appointment.dto';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentLocationDto)
  location?: AppointmentLocationDto;
}
