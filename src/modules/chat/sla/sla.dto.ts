import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EnquiryType, Priority } from '../../../common/constants/enums';
import { SlaPolicy } from './sla-policy.entity';

export class SlaPolicyDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiPropertyOptional({ enum: EnquiryType, nullable: true, description: 'null = every type' })
  enquiryType: EnquiryType | null;
  @ApiPropertyOptional({ enum: Priority, nullable: true, description: 'null = every priority' })
  priority: Priority | null;
  @ApiProperty({ example: 240, description: 'minutes to the first reply' }) targetMinutes: number;
  @ApiProperty({ description: 'the clock stops while waiting for the customer' }) isPauseWhenWaiting: boolean;
  @ApiProperty() isActive: boolean;

  static from(p: SlaPolicy): SlaPolicyDto {
    return {
      id: p.id,
      enquiryType: p.enquiryType,
      priority: p.priority,
      targetMinutes: p.targetMinutes,
      isPauseWhenWaiting: p.isPauseWhenWaiting,
      isActive: p.isActive,
    };
  }
}

export class CreateSlaPolicyDto {
  @ApiPropertyOptional({ enum: EnquiryType, nullable: true })
  @IsOptional()
  @IsEnum(EnquiryType)
  enquiryType?: EnquiryType | null;

  @ApiPropertyOptional({ enum: Priority, nullable: true })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority | null;

  @ApiProperty({ example: 240, minimum: 5, maximum: 20160 })
  @IsInt()
  @Min(5)
  @Max(20160) // 14 days
  targetMinutes: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPauseWhenWaiting?: boolean;
}

export class UpdateSlaPolicyDto {
  @ApiPropertyOptional({ minimum: 5, maximum: 20160 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(20160)
  targetMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPauseWhenWaiting?: boolean;

  @ApiPropertyOptional({ description: 'off = the rule is ignored; open enquiries keep their snapshot' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
