import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorDto } from '../dto/api-error.dto';

/**
 * Converts every thrown error into ApiErrorDto.
 * Services throw Nest exceptions with an error code as the message, e.g. new ConflictException('chat.notAssigned').
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) this.logger.error(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorDto {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'common.internal',
        message: 'Internal error',
      };
    }
    const statusCode = exception.getStatus();
    const res = exception.getResponse();
    if (typeof res === 'string') return { statusCode, code: res, message: res };

    const { message, errors } = res as {
      message?: string | string[];
      errors?: ApiErrorDto['errors'];
    };
    // class-validator returns an array of messages
    if (Array.isArray(message)) {
      return {
        statusCode,
        code: 'common.validation',
        message: 'Validation failed',
        errors: message.map((m) => ({ field: '', message: m })),
      };
    }
    return {
      statusCode,
      code: message ?? exception.message,
      message: message ?? exception.message,
      errors,
    };
  }
}
