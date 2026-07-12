import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRefillDto {
  @ApiPropertyOptional({ description: 'Notes for the refill request' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
