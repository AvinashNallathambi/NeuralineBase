import { PartialType } from '@nestjs/mapped-types';
import { CreateSuperbillDto } from './create-superbill.dto';

export class UpdateSuperbillDto extends PartialType(CreateSuperbillDto) {}
