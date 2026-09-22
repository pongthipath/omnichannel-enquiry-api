import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { Channel, ChatStatus } from '../../../common/constants/enums';
import { EnquiryDto } from '../enquiry/enquiry.dto';

export class DashboardQuery {
  @ApiPropertyOptional({ enum: [1, 7, 30], description: 'only enquiries created in the last N days' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn([1, 7, 30])
  days?: number;
}

export class DashboardTotalsDto {
  @ApiProperty({ description: 'not RESOLVED / CLOSED' }) notClosed: number;
  @ApiProperty() unassigned: number;
  @ApiProperty() slaBreached: number;
  @ApiProperty({ description: 'reopened and still not closed' }) reopened: number;
  @ApiProperty() waitingForCustomer: number;
  @ApiPropertyOptional({ nullable: true, description: 'average minutes to the first staff reply' })
  avgFirstResponseMinutes: number | null;
}

export class StatusCountDto {
  @ApiProperty({ enum: ChatStatus }) status: ChatStatus;
  @ApiProperty() count: number;
}

export class DepartmentCountDto {
  @ApiProperty({ format: 'uuid' }) departmentId: string;
  @ApiProperty() name: string;
  @ApiProperty() count: number;
}

export class ChannelCountDto {
  @ApiProperty({ enum: Channel }) channel: Channel;
  @ApiProperty() count: number;
}

export class TeamLoadDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'null = unassigned' })
  staffId: string | null;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) departmentName: string | null;
  @ApiProperty({ description: 'owned and not closed' }) active: number;
  @ApiProperty() waiting: number;
}

export class DashboardSummaryDto {
  @ApiProperty({ type: DashboardTotalsDto }) totals: DashboardTotalsDto;
  @ApiProperty({ type: [StatusCountDto] }) byStatus: StatusCountDto[];
  @ApiProperty({ type: [DepartmentCountDto], description: 'not closed' }) byDepartment: DepartmentCountDto[];
  @ApiProperty({ type: [ChannelCountDto] }) byChannel: ChannelCountDto[];
  @ApiProperty({ type: [TeamLoadDto] }) team: TeamLoadDto[];
  @ApiProperty({ type: [EnquiryDto], description: 'breached, urgent or reopened — most urgent first' })
  urgent: EnquiryDto[];
}
