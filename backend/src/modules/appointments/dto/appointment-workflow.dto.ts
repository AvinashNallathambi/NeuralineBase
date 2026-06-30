import { IsString, IsOptional } from 'class-validator';

export class CreateAppointmentWithWorkflowDto {
  @IsString()
  initialStep?: string = 'scheduled';

  @IsOptional()
  @IsString()
  note?: string;
}

export class TransitionAppointmentDto {
  @IsString()
  toStep!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
