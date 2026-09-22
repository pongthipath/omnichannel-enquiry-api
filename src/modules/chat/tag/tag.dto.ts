import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Tag, TagAppliesTo, TagColor } from './tag.entity';

export class CreateTagDto {
  @ApiProperty({ example: 'ขนส่งล่าช้า', maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ enum: TagColor, default: TagColor.BLUE })
  @IsOptional()
  @IsEnum(TagColor)
  color?: TagColor;

  @ApiPropertyOptional({ enum: TagAppliesTo, default: TagAppliesTo.ENQUIRY })
  @IsOptional()
  @IsEnum(TagAppliesTo)
  appliesTo?: TagAppliesTo;

  @ApiPropertyOptional({ example: 'ของมาส่งช้ากว่าที่นัดลูกค้าไว้', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}

export class SetChatTagsDto {
  @ApiProperty({ type: [String], description: 'the full set of tags the enquiry should have' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  tagIds: string[];
}

export class TagSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'ขนส่งล่าช้า' }) name: string;
  @ApiProperty({ enum: TagColor }) color: TagColor;

  static from(t: Tag): TagSummaryDto {
    return { id: t.id, name: t.name, color: t.color };
  }
}

export class TagDto extends TagSummaryDto {
  @ApiProperty({ enum: TagAppliesTo }) appliesTo: TagAppliesTo;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ description: 'enquiries currently carrying this tag' }) usageCount: number;

  static withUsage(t: Tag, usageCount: number): TagDto {
    return { ...TagSummaryDto.from(t), appliesTo: t.appliesTo, description: t.description, usageCount };
  }
}
