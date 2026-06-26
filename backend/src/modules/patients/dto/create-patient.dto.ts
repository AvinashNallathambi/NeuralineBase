import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsObject,
  ValidateNested,
  IsPhoneNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AddressDto {
  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  @IsNotEmpty()
  street1!: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsString()
  @IsOptional()
  street2?: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ example: 'NY' })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  @IsNotEmpty()
  zipCode!: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @IsNotEmpty()
  country!: string;
}

class EmergencyContactDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Spouse' })
  @IsString()
  @IsNotEmpty()
  relationship!: string;

  @ApiProperty({ example: '+1-555-0199' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'jane.doe@email.com' })
  @IsEmail()
  @IsOptional()
  email?: string;
}

export class CreatePatientDto {
  @ApiPropertyOptional({
    description: 'Medical Record Number (auto-generated if not provided)',
    example: 'MRN-2024-00001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  mrn?: string;

  @ApiProperty({ description: 'Patient first name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ description: 'Patient last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    description: 'Date of birth in ISO format',
    example: '1990-05-15',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;

  @ApiProperty({
    description: 'Gender',
    enum: ['male', 'female', 'other', 'unknown'],
    example: 'male',
  })
  @IsString()
  @IsNotEmpty()
  gender!: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@email.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1-555-0100',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Patient address' })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({ description: 'Emergency contact information' })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;

  @ApiPropertyOptional({
    description: 'Blood type',
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    example: 'O+',
  })
  @IsString()
  @IsOptional()
  @MaxLength(5)
  bloodType?: string;

  @ApiPropertyOptional({
    description: 'Patient status',
    enum: ['active', 'inactive', 'deceased'],
    default: 'active',
  })
  @IsString()
  @IsOptional()
  status?: string;
}
