import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from './error-codes';

export interface AppExceptionResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  timestamp: string;
  path?: string;
}

export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    message?: string,
    details?: unknown
  ) {
    const errorMessage = message || ErrorMessages[code] || 'An error occurred';
    super(
      {
        statusCode: status,
        code,
        message: errorMessage,
        details,
        timestamp: new Date().toISOString(),
      },
      status
    );
    this.code = code;
    this.details = details;
  }

  static badRequest(code: ErrorCode, message?: string, details?: unknown): AppException {
    return new AppException(code, HttpStatus.BAD_REQUEST, message, details);
  }

  static unauthorized(code: ErrorCode, message?: string, details?: unknown): AppException {
    return new AppException(code, HttpStatus.UNAUTHORIZED, message, details);
  }

  static forbidden(code: ErrorCode, message?: string, details?: unknown): AppException {
    return new AppException(code, HttpStatus.FORBIDDEN, message, details);
  }

  static notFound(code: ErrorCode, message?: string, details?: unknown): AppException {
    return new AppException(code, HttpStatus.NOT_FOUND, message, details);
  }

  static conflict(code: ErrorCode, message?: string, details?: unknown): AppException {
    return new AppException(code, HttpStatus.CONFLICT, message, details);
  }

  static internal(code: ErrorCode, message?: string, details?: unknown): AppException {
    return new AppException(code, HttpStatus.INTERNAL_SERVER_ERROR, message, details);
  }
}

// Convenience classes for common error types
export class UnauthorizedAppException extends AppException {
  constructor(code: ErrorCode = ErrorCode.INVALID_CREDENTIALS, message?: string, details?: unknown) {
    super(code, HttpStatus.UNAUTHORIZED, message, details);
  }
}

export class ForbiddenAppException extends AppException {
  constructor(code: ErrorCode = ErrorCode.FORBIDDEN, message?: string, details?: unknown) {
    super(code, HttpStatus.FORBIDDEN, message, details);
  }
}

export class NotFoundAppException extends AppException {
  constructor(code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND, message?: string, details?: unknown) {
    super(code, HttpStatus.NOT_FOUND, message, details);
  }
}

export class ValidationAppException extends AppException {
  constructor(code: ErrorCode = ErrorCode.VALIDATION_FAILED, message?: string, details?: unknown) {
    super(code, HttpStatus.BAD_REQUEST, message, details);
  }
}

export class ConflictAppException extends AppException {
  constructor(code: ErrorCode = ErrorCode.RESOURCE_CONFLICT, message?: string, details?: unknown) {
    super(code, HttpStatus.CONFLICT, message, details);
  }
}
