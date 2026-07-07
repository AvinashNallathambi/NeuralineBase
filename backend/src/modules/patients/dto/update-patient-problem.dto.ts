import { PartialType } from '@nestjs/mapped-types';
import { CreatePatientProblemDto } from './create-patient-problem.dto';

export class UpdatePatientProblemDto extends PartialType(CreatePatientProblemDto) {}
