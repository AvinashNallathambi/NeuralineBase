import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVaccineInventoryDto {
  @ApiProperty({ example: 'Influenza quadrivalent' })
  @IsString()
  @IsNotEmpty()
  vaccineName!: string;

  @ApiPropertyOptional({ example: '141' })
  @IsOptional()
  @IsString()
  cvxCode?: string;

  @ApiPropertyOptional({ example: '00006-4093-10' })
  @IsOptional()
  @IsString()
  ndcCode?: string;

  @ApiPropertyOptional({ example: 'Sanofi Pasteur' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiProperty({ example: 'U12345AA' })
  @IsString()
  @IsNotEmpty()
  lotNumber!: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  expirationDate!: string;

  @ApiPropertyOptional({ example: 100, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantityReceived?: number;

  @ApiPropertyOptional({ example: 'vfc', default: 'private' })
  @IsOptional()
  @IsString()
  fundingSource?: 'vfc' | 'private' | 'state' | 'section317';

  @ApiPropertyOptional({ example: 'Fridge A' })
  @IsOptional()
  @IsString()
  storageLocation?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  storageTempMin?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  storageTempMax?: number;

  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustQuantityDto {
  @ApiProperty({ example: -1, description: 'Positive to add, negative to subtract' })
  @IsInt()
  adjustment!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
