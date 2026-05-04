import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'instance-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  ready() {
    return {
      status: 'ready',
      service: 'instance-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('live')
  live() {
    return {
      status: 'live',
      service: 'instance-api',
      timestamp: new Date().toISOString(),
    };
  }
}
