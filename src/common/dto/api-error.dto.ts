import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One error shape for the whole API. `code` doubles as the i18n key in the app. */
export class ApiErrorDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({
    example: 'chat.notAssigned',
    description: 'error code — the app uses it as an i18n key',
  })
  code: string;

  @ApiProperty({ example: 'Assign an owner before changing status' })
  message: string;

  @ApiPropertyOptional({ example: [{ field: 'email', message: 'must be an email' }] })
  errors?: { field: string; message: string }[];
}
