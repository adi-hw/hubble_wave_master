import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'svc-data',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
