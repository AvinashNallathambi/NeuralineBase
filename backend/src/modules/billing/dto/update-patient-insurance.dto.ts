import { PartialType } from '@nestjs/mapped-types';
import { CreatePatientInsuranceDto } from './create-patient-insurance.dto';

export class UpdatePatientInsuranceDto extends PartialType(CreatePatientInsuranceDto) {}
