import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLabOrderStatusDto {
  @ApiProperty({
    description: 'New lab order status',
    enum: ['draft', 'ordered', 'collected', 'in_progress', 'resulted', 'completed', 'cancelled'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['draft', 'ordered', 'collected', 'in_progress', 'resulted', 'completed', 'cancelled'] as const)
  status!: string;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
