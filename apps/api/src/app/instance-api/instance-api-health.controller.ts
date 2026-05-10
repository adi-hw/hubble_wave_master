import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('instance-api/health')
export class InstanceApiHealthController {
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
