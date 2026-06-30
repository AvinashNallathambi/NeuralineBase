import { IsString, IsOptional, IsArray, IsObject, IsNotEmpty } from 'class-validator';

export class ScrubSuperbillDto {
  @IsString()
  @IsNotEmpty()
  superbillId: string;

  @IsString()
  @IsOptional()
  clinicalNotes?: string;
}

export class PredictDenialDto {
  @IsString()
  @IsNotEmpty()
  superbillId: string;

  @IsString()
  @IsOptional()
  payerHistory?: string;
}

export class GenerateGfeDto {
  @IsString()
  @IsNotEmpty()
  superbillId: string;

  @IsString()
  @IsOptional()
  patientNotes?: string;
}

export class SmartCodeFromNotesDto {
  @IsString()
  @IsNotEmpty()
  clinicalNotes: string;

  @IsArray()
  @IsOptional()
  existingDiagnoses?: Array<{ icdCode: string; description: string }>;

  @IsArray()
  @IsOptional()
  existingProcedures?: Array<{ cptCode: string; description: string }>;
}
