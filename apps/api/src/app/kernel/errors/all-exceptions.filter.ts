import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException, AppExceptionResponse } from './app-exception';
import { ErrorCode } from './error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as AppExceptionResponse;
      code = exceptionResponse.code;
      message = exceptionResponse.message;
      details = exceptionResponse.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) || exception.message;
        details = resp['details'];
      }

      // Map HTTP status to appropriate error code
      switch (status) {
        case HttpStatus.UNAUTHORIZED:
          code = ErrorCode.INVALID_CREDENTIALS;
          break;
        case HttpStatus.FORBIDDEN:
          code = ErrorCode.FORBIDDEN;
          break;
        case HttpStatus.NOT_FOUND:
          code = ErrorCode.RESOURCE_NOT_FOUND;
          break;
        case HttpStatus.BAD_REQUEST:
          code = ErrorCode.VALIDATION_FAILED;
          break;
        case HttpStatus.CONFLICT:
          code = ErrorCode.RESOURCE_CONFLICT;
          break;
        default:
          code = ErrorCode.INTERNAL_ERROR;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // Log unexpected errors
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack
      );
    }

    const errorResponse: AppExceptionResponse = {
      statusCode: status,
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log error details
    if (status >= 500) {
      this.logger.error(
        `[${code}] ${message}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else {
      this.logger.warn(`[${code}] ${message}`);
    }

    response.status(status).json(errorResponse);
  }
}
