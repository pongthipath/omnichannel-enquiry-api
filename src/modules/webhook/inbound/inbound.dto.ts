import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { Channel } from '../../../common/constants/enums';

/** One normalised inbound message, whatever channel it came from. */
export interface InboundMessage {
  channel: Channel;
  /** the person's id on that channel (LINE userId, Facebook PSID, phone, email) */
  externalUserId: string;
  displayName?: string;
  text?: string;
  imageUrl?: string;
  /** the channel's own message id — the same delivery twice is stored once */
  externalMessageId?: string;
}

export class SimulateInboundDto {
  @ApiProperty({ enum: Channel, example: Channel.LINE })
  @IsEnum(Channel)
  channel: Channel;

  @ApiProperty({ example: 'U8f2a-malee', description: 'the sender id on that channel' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externalUserId: string;

  @ApiPropertyOptional({ example: 'Malee' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @ApiPropertyOptional({ example: 'ของยังไม่ถึงเลยค่ะ' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;

  @ApiPropertyOptional({ description: 'image link, kept as-is and mirrored to our bucket later' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  imageUrl?: string;
}

export class InboundResultDto {
  @ApiProperty({ description: 'messages accepted from this delivery' }) accepted: number;
  @ApiProperty({ description: 'already seen (same channel message id)' }) duplicates: number;
  @ApiProperty({ type: [String], format: 'uuid' }) chatIds: string[];
}
