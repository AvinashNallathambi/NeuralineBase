import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDate,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SuperbillPaymentType {
  COPAY = 'copay',
  INSURANCE_PAYMENT = 'insurance_payment',
  WRITE_OFF = 'write_off',
  ADJUSTMENT = 'adjustment',
}

export class CreateSuperbillPaymentDto {
  @IsEnum(SuperbillPaymentType)
  type: SuperbillPaymentType;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  date?: Date;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  source?: string;
}
