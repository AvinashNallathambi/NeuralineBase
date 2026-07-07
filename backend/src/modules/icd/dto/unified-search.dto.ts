import { IsOptional, IsString, IsUUID, IsInt, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UnifiedSearchDto {
  @ApiProperty({ example: 'diabetes' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({ name: 'patient_id' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ name: 'provider_id' })
  @IsUUID()
  @IsOptional()
  providerId?: string;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
