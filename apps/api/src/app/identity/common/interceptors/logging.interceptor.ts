import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, ip, headers } = request;
    const instanceLabel = process.env.INSTANCE_ID || 'single-instance';

    // Generate or extract request ID
    const requestId = headers['x-request-id'] || uuidv4();
    
    // Attach request ID to request and response
    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    // Extract user context (if authenticated)
    const user = request.user;
    const userId = user?.userId || 'anonymous';

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log({
            requestId,
            method,
            url,
            statusCode,
            duration,
            userId,
            instance: instanceLabel,
            ip,
            userAgent: headers['user-agent'],
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.error({
            requestId,
            method,
            url,
            statusCode,
            duration,
            userId,
            instance: instanceLabel,
            ip,
            error: error.message,
            stack: error.stack,
          });
        },
      })
    );
  }
}
