import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ description: 'Whether the integration is enabled' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Integration provider name' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  provider?: string;

  @ApiPropertyOptional({ description: 'Additional integration configuration' })
  @IsOptional()
  config?: Record<string, unknown>;
}
