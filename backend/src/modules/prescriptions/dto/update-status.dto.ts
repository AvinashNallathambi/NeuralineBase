import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePrescriptionStatusDto {
  @ApiProperty({
    description: 'New prescription status',
    enum: ['draft', 'active', 'sent', 'completed', 'cancelled', 'discontinued', 'expired'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['draft', 'active', 'sent', 'completed', 'cancelled', 'discontinued', 'expired'] as const)
  status!: string;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
