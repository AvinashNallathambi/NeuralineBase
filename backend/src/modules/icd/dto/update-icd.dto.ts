import { IsOptional, IsString, IsBoolean, IsInt } from 'class-validator';

export class UpdateIcdDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @IsOptional()
  @IsBoolean()
  isHeader?: boolean;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  chapter?: number;

  @IsOptional()
  @IsString()
  chapterTitle?: string;
}
