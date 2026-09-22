import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserType } from '../../../common/constants/enums';

export class LoginDto {
  @ApiProperty({ example: 'cs.agent@foodlink.test' })
  @IsEmail()
  @MaxLength(200)
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;

  @ApiProperty({ enum: UserType, example: UserType.STAFF })
  @IsEnum(UserType)
  userType: UserType;

  @ApiPropertyOptional({ default: true, description: 'keep me signed in on this device' })
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

export class RefreshDto {
  @ApiProperty({ description: 'refresh token returned by login/refresh' })
  @IsString()
  @MinLength(20)
  refreshToken: string;
}

export class TokenPairDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
}

export class MeDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: UserType }) userType: UserType;
  @ApiProperty({ example: 'สุดา (CS)' }) name: string;
  @ApiProperty({
    example: '3643094387',
    description: 'permission bitmask as a decimal string (staff) — "0" for customers',
  })
  permissions: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) departmentId: string | null;
}
