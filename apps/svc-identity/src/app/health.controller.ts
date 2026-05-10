import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../api/src/app/identity/auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @SkipThrottle()
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'svc-identity',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
