import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentationConsentStatus } from '../entities/documentation-session.entity';

export class CreateDocumentationSessionDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsEnum(DocumentationConsentStatus)
  consentStatus!: DocumentationConsentStatus;

  @IsOptional()
  @IsString()
  consentMethod?: string;
}
