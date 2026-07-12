import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber } from 'class-validator';
import { PatientAiService } from './patient-ai.service';
import { PatientJwtAuthGuard } from './patient-jwt-auth.guard';

class ExplainLabResultDto {
  @IsString()
  @IsNotEmpty()
  testName!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() referenceRange?: string;
  @IsOptional() @IsString() flag?: string;
  @IsOptional() @IsNumber() patientAge?: number;
  @IsOptional() @IsString() patientGender?: string;
}

class AssessSymptomsDto {
  @IsString()
  @IsNotEmpty()
  symptoms!: string;

  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsNumber() patientAge?: number;
  @IsOptional() @IsString() patientGender?: string;
  @IsOptional() @IsArray() knownConditions?: string[];
  @IsOptional() @IsArray() currentMedications?: string[];
}

class CheckInteractionsDto {
  @IsArray()
  medications!: { name: string; dosage?: string; frequency?: string }[];

  @IsOptional()
  newMedication?: { name: string; dosage?: string };

  @IsOptional() @IsNumber() patientAge?: number;
  @IsOptional() @IsString() patientGender?: string;
  @IsOptional() @IsArray() knownConditions?: string[];
}

class GenerateEducationDto {
  @IsOptional() @IsArray() conditions?: string[];
  @IsOptional() @IsArray() medications?: string[];
  @IsOptional() @IsArray() recentLabs?: { testName: string; value: string; flag?: string }[];
  @IsOptional() @IsArray() interests?: string[];
}

class GenerateQuestionsDto {
  @IsOptional() @IsArray() conditions?: string[];
  @IsOptional() @IsArray() medications?: string[];
  @IsOptional() @IsArray() recentLabs?: { testName: string; value: string; flag?: string }[];
  @IsOptional() @IsString() upcomingAppointmentReason?: string;
}

interface AuthenticatedPatientRequest {
  user: { id: string; email: string; tenantId: string; role: string };
}

@ApiTags('Patient Portal AI')
@ApiBearerAuth('JWT-auth')
@UseGuards(PatientJwtAuthGuard)
@Controller('patients/portal/ai')
export class PatientAiController {
  constructor(private readonly patientAiService: PatientAiService) {}

  @Post('explain-lab-result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI explains a lab result in plain language' })
  @ApiResponse({ status: 200, description: 'Plain-language lab result explanation' })
  async explainLabResult(@Body() dto: ExplainLabResultDto) {
    return this.patientAiService.explainLabResult(dto);
  }

  @Post('assess-symptoms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI symptom checker and care navigator' })
  @ApiResponse({ status: 200, description: 'Symptom assessment with care recommendation' })
  async assessSymptoms(@Body() dto: AssessSymptomsDto) {
    return this.patientAiService.assessSymptoms(dto);
  }

  @Post('check-interactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI medication interaction checker' })
  @ApiResponse({ status: 200, description: 'Medication interaction analysis' })
  async checkInteractions(@Body() dto: CheckInteractionsDto) {
    return this.patientAiService.checkMedicationInteractions(dto);
  }

  @Post('health-education')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI generates personalized health education' })
  @ApiResponse({ status: 200, description: 'Personalized educational articles' })
  async generateHealthEducation(@Body() dto: GenerateEducationDto) {
    return this.patientAiService.generateHealthEducation(dto);
  }

  @Post('visit-questions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI generates questions to ask your doctor' })
  @ApiResponse({ status: 200, description: 'Questions for upcoming doctor visit' })
  async generateVisitQuestions(@Body() dto: GenerateQuestionsDto) {
    return this.patientAiService.generateVisitQuestions(dto);
  }
}
