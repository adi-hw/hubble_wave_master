import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('data/health')
export class DataHealthController {
  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'data',
      timestamp: new Date().toISOString(),
      dependencies: {},
    };
  }
}
