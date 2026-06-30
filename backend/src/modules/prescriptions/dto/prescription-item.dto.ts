import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrescriptionItemDto {
  @ApiProperty({ example: 'rxitem-001' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 'Metformin HCl' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  medication!: string;

  @ApiPropertyOptional({ example: '861007' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  rxNormCode?: string;

  @ApiProperty({ example: '1000mg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dosage!: string;

  @ApiProperty({ example: 'Twice daily' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  frequency!: string;

  @ApiProperty({ example: 'Oral' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  route!: string;

  @ApiProperty({ example: '90 days' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  duration!: string;

  @ApiProperty({ example: 180 })
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  refills!: number;

  @ApiPropertyOptional({ example: 'Take with meals' })
  @IsString()
  @IsOptional()
  instructions?: string;
}
