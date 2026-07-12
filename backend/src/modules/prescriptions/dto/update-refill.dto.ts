import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRefillDto {
  @ApiProperty({
    description: 'New refill status',
    enum: ['pending', 'approved', 'denied', 'completed'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['pending', 'approved', 'denied', 'completed'] as const)
  status!: string;

  @ApiPropertyOptional({ description: 'Notes update' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
