import { IsOptional, IsString, IsInt, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchCodesDto {
  @ApiProperty({ example: 'diabetes' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of code systems to search. Default: all',
    example: 'ICD-10-CM,CPT,HCPCS',
  })
  @IsString()
  @IsOptional()
  types?: string;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
