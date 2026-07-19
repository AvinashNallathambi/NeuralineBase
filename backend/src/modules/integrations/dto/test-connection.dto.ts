import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TestConnectionDto {
  @ApiPropertyOptional({ description: 'OAuth code (for OAuth callback flow)' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'Redirect URI used in the OAuth flow' })
  @IsString()
  @IsOptional()
  redirectUri?: string;
}
