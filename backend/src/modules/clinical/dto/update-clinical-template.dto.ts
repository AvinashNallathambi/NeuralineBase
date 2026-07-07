import { PartialType } from '@nestjs/swagger';
import { CreateClinicalTemplateDto } from './create-clinical-template.dto';

export class UpdateClinicalTemplateDto extends PartialType(CreateClinicalTemplateDto) {}
